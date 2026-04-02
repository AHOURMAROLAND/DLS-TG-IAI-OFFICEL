import random
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.match import Match, MatchPhase, MatchStatus
from ..models.player import Player


def balanced_draw(players: list, group_count: int) -> dict:
    """
    Trie les joueurs par division DLL puis répartit équitablement dans les groupes.
    Évite de mettre 2 tops ensemble autant que possible.
    """
    sorted_players = sorted(players, key=lambda p: (p["dll_division"], -p["dll_won"]))
    groups = {f"G{chr(65+i)}": [] for i in range(group_count)}
    group_keys = list(groups.keys())
    # Serpentin : 0,1,2,3,3,2,1,0,0,1... pour mieux équilibrer les niveaux
    direction = 1
    idx = 0
    for i, player in enumerate(sorted_players):
        groups[group_keys[idx]].append(player)
        if direction == 1:
            if idx == group_count - 1:
                direction = -1
            else:
                idx += 1
        else:
            if idx == 0:
                direction = 1
            else:
                idx -= 1
    return groups


def elimination_draw(players: list) -> list:
    """Tirage aléatoire pour élimination directe, retourne des paires."""
    shuffled = players.copy()
    random.shuffle(shuffled)
    pairs = []
    for i in range(0, len(shuffled), 2):
        if i + 1 < len(shuffled):
            pairs.append({"home": shuffled[i], "away": shuffled[i + 1]})
    return pairs


def championship_draw(players: list, legs: str = "single") -> list:
    """
    Génère tous les matchs d'un championnat (round-robin).
    legs='single' -> aller simple, legs='double' -> aller-retour.
    """
    matches = []
    n = len(players)
    for i in range(n):
        for j in range(i + 1, n):
            matches.append({"home": players[i], "away": players[j]})
            if legs == "double":
                matches.append({"home": players[j], "away": players[i]})
    return matches


async def create_group_matches(
    tournament_id: str,
    groups: dict,
    db: AsyncSession,
) -> List[Match]:
    """
    Crée en base les matchs de phase de poules ET met à jour Player.group_id.
    `groups` est un dict { "GA": [{"id": ..., ...}, ...], "GB": [...] }
    """
    from sqlalchemy import select, update
    created = []
    for group_id, players in groups.items():
        # Mettre à jour group_id sur chaque joueur
        for p in players:
            await db.execute(
                update(Player)
                .where(Player.id == p["id"])
                .values(group_id=group_id)
            )
        # Créer les matchs round-robin dans le groupe
        for i in range(len(players)):
            for j in range(i + 1, len(players)):
                match = Match(
                    tournament_id=tournament_id,
                    home_player_id=players[i]["id"],
                    away_player_id=players[j]["id"],
                    phase=MatchPhase.GROUP,
                    group_id=group_id,
                    status=MatchStatus.SCHEDULED,
                )
                db.add(match)
                created.append(match)
    await db.commit()
    return created


async def create_elimination_matches(
    tournament_id: str,
    pairs: list,
    phase: MatchPhase,
    db: AsyncSession
) -> List[Match]:
    """Crée en base les matchs d'élimination directe."""
    created = []
    for pair in pairs:
        match = Match(
            tournament_id=tournament_id,
            home_player_id=pair["home"]["id"],
            away_player_id=pair["away"]["id"],
            phase=phase,
            status=MatchStatus.SCHEDULED,
        )
        db.add(match)
        created.append(match)
    await db.commit()
    return created


async def create_championship_matches(
    tournament_id: str,
    matchups: list,
    legs: str,
    db: AsyncSession
) -> List[Match]:
    """Crée en base les matchs de championnat."""
    created = []
    for i, matchup in enumerate(matchups):
        # Pour aller-retour, les matchs pairs sont les retours
        phase = MatchPhase.CHAMPIONSHIP
        round_number = 1
        if legs == "double":
            round_number = 1 if i % 2 == 0 else 2
        match = Match(
            tournament_id=tournament_id,
            home_player_id=matchup["home"]["id"],
            away_player_id=matchup["away"]["id"],
            phase=phase,
            round_number=round_number,
            status=MatchStatus.SCHEDULED,
        )
        db.add(match)
        created.append(match)
    await db.commit()
    return created
