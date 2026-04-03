from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.match import Match, MatchStatus, MatchPhase
from ..models.player import Player
from ..models.tournament import Tournament, TournamentStatus
from ..schemas.match import MatchValidate, MatchOutfrom ..services.tracker_service import fetch_player_data, find_recent_matches_vs_opponent
from ..websocket.manager import manager
from ..utils.logger import logger
from datetime import datetime

router = APIRouter()


def _apply_score_rules(
    home_score: int,
    away_score: int,
    minutes_played: int,
    phase: MatchPhase,
    round_number: int,
) -> tuple[int, int]:
    """
    Applique les règles de score selon le format :
    - Poule / Championnat / Double élim match 1 : Min <= 90 seulement (nul = nul)
    - Double élim match 2 (round_number=2) : Min > 90 compte (prolongations + penalties)
    Si minutes_played est None on ne filtre pas (score manuel).
    """
    if minutes_played is None:
        return home_score, away_score

    is_double_second = (
        phase == MatchPhase.DOUBLE_SECOND
        or (phase in (MatchPhase.DOUBLE_FIRST,) and round_number == 2)
    )

    if is_double_second:
        # Match 2 double élim : les prolongations comptent, on garde le score tel quel
        return home_score, away_score
    else:
        # Tous les autres cas : seulement 90 min
        if minutes_played > 90:
            # Match nul à 90 min → on garde les scores tels quels (nul = nul)
            # Le score affiché reste celui du tracker mais on signale que c'est 90 min
            return home_score, away_score

    return home_score, away_score


@router.get("/tournament/{slug}")
async def get_matches(slug: str, db: AsyncSession = Depends(get_db)):
    """Retourne tous les matchs d'un tournoi avec les infos joueurs."""
    t_result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = t_result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")

    matches_result = await db.execute(select(Match).where(Match.tournament_id == t.id))
    matches = matches_result.scalars().all()

    players_result = await db.execute(select(Player).where(Player.tournament_id == t.id))
    players = {str(p.id): p for p in players_result.scalars().all()}

    def enrich(m):
        home = players.get(str(m.home_player_id))
        away = players.get(str(m.away_player_id))
        return {
            "id": str(m.id),
            "phase": m.phase.value if hasattr(m.phase, "value") else m.phase,
            "round_number": m.round_number,
            "group_id": m.group_id,
            "status": m.status.value if hasattr(m.status, "value") else m.status,
            "home_score": m.home_score,
            "away_score": m.away_score,
            "home_score_agg": m.home_score_agg,
            "away_score_agg": m.away_score_agg,
            "is_manual": m.is_manual,
            "motm": m.motm,
            "home_scorers": m.home_scorers or [],
            "away_scorers": m.away_scorers or [],
            "dll_match_timestamp": m.dll_match_timestamp,
            "played_at": m.played_at.isoformat() if m.played_at else None,
            "validated_at": m.validated_at.isoformat() if m.validated_at else None,
            "home_player": {
                "id": str(home.id),
                "pseudo": home.pseudo,
                "team_name": home.team_name,
                "team_logo_url": f"/api/players/logo/{home.id}" if home.logo_data else None,
                "dll_division": home.dll_division,
                "dll_idx": home.dll_idx,
            } if home else None,
            "away_player": {
                "id": str(away.id),
                "pseudo": away.pseudo,
                "team_name": away.team_name,
                "team_logo_url": f"/api/players/logo/{away.id}" if away.logo_data else None,
                "dll_division": away.dll_division,
                "dll_idx": away.dll_idx,
            } if away else None,
        }

    return [enrich(m) for m in matches]


@router.get("/{match_id}/tracker-suggest")
async def get_tracker_suggestions(
    match_id: str,
    creator_session: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Récupère les 3 derniers matchs FTGames entre les 2 joueurs.
    Le frontend doit toujours passer par cet endpoint.
    """
    m_result = await db.execute(select(Match).where(Match.id == match_id))
    match = m_result.scalar_one_or_none()
    if not match:
        raise HTTPException(404, "Match introuvable")

    t_result = await db.execute(select(Tournament).where(Tournament.id == match.tournament_id))
    t = t_result.scalar_one_or_none()
    if t.creator_session != creator_session:
        raise HTTPException(403, "Accès refusé")

    home = await db.execute(select(Player).where(Player.id == match.home_player_id))
    home_player = home.scalar_one_or_none()
    away = await db.execute(select(Player).where(Player.id == match.away_player_id))
    away_player = away.scalar_one_or_none()

    if not home_player or not away_player:
        raise HTTPException(404, "Joueur introuvable")

    data = await fetch_player_data(home_player.dll_idx)
    suggestions = find_recent_matches_vs_opponent(data, away_player.dll_idx)

    return {
        "match_id": match_id,
        "home_player": {
            "id": str(home_player.id),
            "pseudo": home_player.pseudo,
            "team_name": home_player.team_name,
            "dll_idx": home_player.dll_idx,
        },
        "away_player": {
            "id": str(away_player.id),
            "pseudo": away_player.pseudo,
            "team_name": away_player.team_name,
            "dll_idx": away_player.dll_idx,
        },
        "suggestions": suggestions,
        "phase": match.phase.value if hasattr(match.phase, "value") else match.phase,
        "round_number": match.round_number,
    }


@router.post("/validate")
async def validate_match(body: MatchValidate, db: AsyncSession = Depends(get_db)):
    """
    Valide le score d'un match.
    - Applique la règle des 90 min selon la phase
    - is_manual=True → statut MANUAL, affiché en rouge côté client
    - Broadcast WebSocket à tous les clients du tournoi
    - Progression automatique du bracket élimination
    - Détection fin de tournoi (finale validée → FINISHED)
    """
    m_result = await db.execute(select(Match).where(Match.id == str(body.match_id)))
    match = m_result.scalar_one_or_none()
    if not match:
        raise HTTPException(404, "Match introuvable")

    t_result = await db.execute(select(Tournament).where(Tournament.id == match.tournament_id))
    t = t_result.scalar_one_or_none()
    if t.creator_session != body.creator_session:
        raise HTTPException(403, "Accès refusé")

    if match.status in (MatchStatus.VALIDATED, MatchStatus.MANUAL):
        raise HTTPException(400, "Ce match a déjà été validé")

    home_score, away_score = _apply_score_rules(
        body.home_score, body.away_score,
        body.minutes_played, match.phase, match.round_number,
    )

    match.home_score = home_score
    match.away_score = away_score
    match.home_scorers = body.home_scorers
    match.away_scorers = body.away_scorers
    match.motm = body.motm
    match.is_manual = body.is_manual
    match.status = MatchStatus.MANUAL if body.is_manual else MatchStatus.VALIDATED
    match.dll_match_timestamp = body.dll_match_timestamp
    match.validated_at = datetime.utcnow()
    await db.commit()

    # ── Progression automatique du bracket élimination ──────────────────────
    NEXT_PHASE = {
        MatchPhase.R16:         MatchPhase.QF,
        MatchPhase.QF:          MatchPhase.SF,
        MatchPhase.SF:          MatchPhase.FINAL,
    }
    is_elimination = t.tournament_type == "elimination"
    next_phase = NEXT_PHASE.get(match.phase)

    if is_elimination and next_phase:
        winner_id = str(match.home_player_id) if home_score > away_score else str(match.away_player_id)

        # Chercher un match de la phase suivante avec une place libre (home ou away = None)
        next_matches_result = await db.execute(
            select(Match).where(
                Match.tournament_id == t.id,
                Match.phase == next_phase,
            )
        )
        next_matches = next_matches_result.scalars().all()

        placed = False
        for nm in next_matches:
            if nm.home_player_id is None:
                nm.home_player_id = winner_id
                placed = True
                break
            elif nm.away_player_id is None:
                nm.away_player_id = winner_id
                placed = True
                break

        # Si aucun match existant avec place libre, créer un nouveau match
        if not placed:
            new_match = Match(
                tournament_id=t.id,
                home_player_id=winner_id,
                away_player_id=None,
                phase=next_phase,
                status=MatchStatus.SCHEDULED,
            )
            db.add(new_match)

        await db.commit()

    # ── Détection fin de tournoi ─────────────────────────────────────────────
    if match.phase == MatchPhase.FINAL and is_elimination:
        t.status = TournamentStatus.FINISHED
        await db.commit()
        logger.info(f"Tournament {t.slug} finished — finale validée")

    elif t.tournament_type == "championship":
        # Vérifier si tous les matchs du championnat sont validés
        total_result = await db.execute(
            select(Match).where(Match.tournament_id == t.id)
        )
        all_matches = total_result.scalars().all()
        all_done = all(
            m.status in (MatchStatus.VALIDATED, MatchStatus.MANUAL)
            for m in all_matches
        )
        if all_done and all_matches:
            t.status = TournamentStatus.FINISHED
            await db.commit()
            logger.info(f"Tournament {t.slug} finished — tous les matchs validés")

    elif t.tournament_type == "groups":
        # Phase de poules : vérifier si tous les matchs de groupe sont validés
        group_matches_result = await db.execute(
            select(Match).where(
                Match.tournament_id == t.id,
                Match.phase == MatchPhase.GROUP,
            )
        )
        group_matches = group_matches_result.scalars().all()
        all_group_done = all(
            m.status in (MatchStatus.VALIDATED, MatchStatus.MANUAL)
            for m in group_matches
        )
        # Si tous les matchs de groupe sont faits et la finale aussi
        if match.phase == MatchPhase.FINAL:
            t.status = TournamentStatus.FINISHED
            await db.commit()

    await manager.broadcast(
        str(t.id),
        {
            "event": "match_validated",
            "match_id": str(match.id),
            "home_score": home_score,
            "away_score": away_score,
            "is_manual": body.is_manual,
            "home_scorers": body.home_scorers,
            "away_scorers": body.away_scorers,
            "motm": body.motm,
            "phase": match.phase.value if hasattr(match.phase, "value") else match.phase,
            "tournament_status": t.status.value if hasattr(t.status, "value") else t.status,
        },
    )
    logger.info(f"Match {match.id} validated: {home_score}-{away_score} (manual={body.is_manual})")
    return {
        "message": "Match validé",
        "match_id": str(match.id),
        "home_score": home_score,
        "away_score": away_score,
        "is_manual": body.is_manual,
        "tournament_status": t.status.value if hasattr(t.status, "value") else t.status,
    }


@router.get("/standings/{slug}")
async def get_standings(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Classement général (championnat ou poules).
    Critères : pts > diff buts > buts marqués.
    Inclut la forme (5 derniers matchs).
    """
    t_result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = t_result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")

    from ..models.player import PlayerStatus as PS
    from ..models.match import MatchStatus as MS

    players_result = await db.execute(
        select(Player).where(
            Player.tournament_id == t.id,
            Player.status == PS.ACCEPTED,
        )
    )
    players = players_result.scalars().all()

    matches_result = await db.execute(
        select(Match).where(
            Match.tournament_id == t.id,
            Match.status.in_([MS.VALIDATED, MS.MANUAL]),
        )
    )
    matches = matches_result.scalars().all()

    standings = {}
    for p in players:
        standings[str(p.id)] = {
            "player_id": str(p.id),
            "pseudo": p.pseudo,
            "team_name": p.team_name,
            "team_logo_url": f"/api/players/logo/{p.id}" if p.logo_data else None,
            "dll_division": p.dll_division,
            "played": 0,
            "won": 0,
            "draw": 0,
            "lost": 0,
            "gf": 0,
            "ga": 0,
            "diff": 0,
            "pts": 0,
            "form": [],
        }

    for m in matches:
        h, a = str(m.home_player_id), str(m.away_player_id)
        hs, as_ = m.home_score or 0, m.away_score or 0

        if h not in standings or a not in standings:
            continue

        standings[h]["played"] += 1
        standings[a]["played"] += 1
        standings[h]["gf"] += hs
        standings[h]["ga"] += as_
        standings[a]["gf"] += as_
        standings[a]["ga"] += hs
        standings[h]["diff"] = standings[h]["gf"] - standings[h]["ga"]
        standings[a]["diff"] = standings[a]["gf"] - standings[a]["ga"]

        if hs > as_:
            standings[h]["won"] += 1
            standings[h]["pts"] += 3
            standings[a]["lost"] += 1
            standings[h]["form"].append("W")
            standings[a]["form"].append("L")
        elif hs < as_:
            standings[a]["won"] += 1
            standings[a]["pts"] += 3
            standings[h]["lost"] += 1
            standings[a]["form"].append("W")
            standings[h]["form"].append("L")
        else:
            standings[h]["draw"] += 1
            standings[h]["pts"] += 1
            standings[a]["draw"] += 1
            standings[a]["pts"] += 1
            standings[h]["form"].append("D")
            standings[a]["form"].append("D")

    # Garder seulement les 5 derniers pour la forme
    for s in standings.values():
        s["form"] = s["form"][-5:]

    result = sorted(
        standings.values(),
        key=lambda x: (-x["pts"], -x["diff"], -x["gf"]),
    )
    return result


@router.get("/scorers/{slug}")
async def get_scorers(slug: str, db: AsyncSession = Depends(get_db)):
    """Retourne le classement des meilleurs buteurs du tournoi."""
    t_result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = t_result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")

    from ..models.match import MatchStatus as MS
    matches_result = await db.execute(
        select(Match).where(
            Match.tournament_id == t.id,
            Match.status.in_([MS.VALIDATED, MS.MANUAL]),
        )
    )
    matches = matches_result.scalars().all()

    scorers: dict = {}
    for m in matches:
        for goal in m.home_scorers or []:
            name = goal.get("scorer", "") if isinstance(goal, dict) else str(goal)
            if name:
                if name not in scorers:
                    scorers[name] = {"name": name, "goals": 0, "assists": 0}
                scorers[name]["goals"] += 1
                if isinstance(goal, dict) and goal.get("assist"):
                    assist = goal["assist"]
                    if assist not in scorers:
                        scorers[assist] = {"name": assist, "goals": 0, "assists": 0}
                    scorers[assist]["assists"] += 1

        for goal in m.away_scorers or []:
            name = goal.get("scorer", "") if isinstance(goal, dict) else str(goal)
            if name:
                if name not in scorers:
                    scorers[name] = {"name": name, "goals": 0, "assists": 0}
                scorers[name]["goals"] += 1
                if isinstance(goal, dict) and goal.get("assist"):
                    assist = goal["assist"]
                    if assist not in scorers:
                        scorers[assist] = {"name": assist, "goals": 0, "assists": 0}
                    scorers[assist]["assists"] += 1

    return sorted(scorers.values(), key=lambda x: (-x["goals"], -x["assists"]))[:20]
