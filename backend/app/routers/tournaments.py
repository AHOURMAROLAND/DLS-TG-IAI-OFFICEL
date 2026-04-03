from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.tournament import Tournament, TournamentStatus
from ..models.player import Player, PlayerStatus
from ..schemas.tournament import TournamentOut
from ..schemas.match import DrawRequest, DrawConfirmRequest
from ..services.session_service import generate_session_token, generate_tournament_slug
from ..services.draw_service import (
    balanced_draw, elimination_draw, championship_draw,
    create_group_matches, create_elimination_matches, create_championship_matches,
)
from ..models.match import MatchPhase
from ..websocket.manager import manager
from ..utils.logger import logger

router = APIRouter()


@router.get("/config/valid-sizes")
async def get_valid_sizes(tournament_type: str):
    """
    Retourne les nombres d'équipes valides pour un format donné.
    Utilisé par le frontend pour afficher les options disponibles.
    """
    from ..services.tournament_config import get_valid_team_counts
    sizes = get_valid_team_counts(tournament_type)
    if not sizes:
        raise HTTPException(400, f"Format inconnu : {tournament_type}")
    return {"tournament_type": tournament_type, "valid_sizes": sizes}


@router.get("/config/group-suggestions")
async def get_group_suggestions(max_teams: int):
    """
    Retourne les configurations de poules suggérées pour un nombre d'équipes.
    Triées par pertinence (configs propres en premier).
    """
    from ..services.tournament_config import suggest_group_configs, validate_tournament_size
    validation = validate_tournament_size("groups", max_teams)
    if not validation.valid:
        raise HTTPException(400, validation.error)

    configs = suggest_group_configs(max_teams)
    return {
        "max_teams": max_teams,
        "suggestions": [
            {
                "group_count": c.group_count,
                "teams_per_group": c.teams_per_group,
                "qualified_per_group": c.qualified_per_group,
                "total_qualified": c.total_qualified,
                "next_power_of_2": c.next_power_of_2,
                "best_thirds": c.best_thirds,
                "is_clean": c.is_clean,
                "label": c.label,
            }
            for c in configs
        ],
    }


@router.post("/", response_model=TournamentOut)
async def create_tournament(
    name: str = Form(...),
    tournament_type: str = Form(...),
    elimination_type: str = Form("single"),
    championship_legs: str = Form("single"),
    max_teams: int = Form(...),
    group_count: int = Form(0),
    teams_per_group: int = Form(0),
    qualified_per_group: int = Form(2),
    elimination_round: str = Form(""),
    logo: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
):
    session_token = generate_session_token()
    slug = generate_tournament_slug()

    # Valider le nombre d'équipes selon le format
    # Validation souple : on vérifie juste les limites absolues
    from ..services.tournament_config import validate_tournament_size
    validation = validate_tournament_size(tournament_type, max_teams, elimination_type)
    if not validation.valid:
        # En mode développement, logger l'erreur mais ne pas bloquer
        logger.warning(f"Tournament size validation warning: {validation.error} (type={tournament_type}, max_teams={max_teams})")
        # Bloquer seulement les cas vraiment invalides (< 4 équipes ou > 48)
        if max_teams < 4 or max_teams > 64:
            msg = validation.error or "Nombre d'équipes invalide"
            raise HTTPException(400, msg)

    logo_data = None
    logo_content_type = None

    if logo:
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if logo.content_type not in allowed_types:
            raise HTTPException(400, "Type de fichier non supporté. Utilisez JPG, PNG, GIF ou WebP.")
        content = await logo.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(400, "L'image ne doit pas dépasser 5MB.")
        logo_data = content
        logo_content_type = logo.content_type
        logger.info(f"Logo uploaded for tournament {name}: {len(content)} bytes")

    tournament = Tournament(
        slug=slug,
        name=name,
        logo_data=logo_data,
        logo_content_type=logo_content_type,
        tournament_type=tournament_type,
        elimination_type=elimination_type,
        championship_legs=championship_legs,
        max_teams=max_teams,
        group_count=group_count,
        teams_per_group=teams_per_group,
        qualified_per_group=qualified_per_group,
        elimination_round=elimination_round,
        creator_session=session_token,
        # Statut initial : DRAFT, passe à REGISTRATION après création
        status=TournamentStatus.REGISTRATION,
    )
    db.add(tournament)
    await db.commit()
    await db.refresh(tournament)

    logger.info(f"Tournament created: {tournament.name} ({tournament.slug})")
    return TournamentOut.from_db(tournament)


@router.get("/")
async def get_tournaments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tournament).order_by(Tournament.created_at.desc()))
    tournaments = result.scalars().all()
    return [TournamentOut.from_db(t) for t in tournaments]


@router.get("/{slug}", response_model=TournamentOut)
async def get_tournament(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    return TournamentOut.from_db(t)


@router.get("/{slug}/logo")
async def get_tournament_logo(slug: str, db: AsyncSession = Depends(get_db)):
    """Sert le logo binaire du tournoi."""
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    tournament = result.scalar_one_or_none()
    if not tournament or not tournament.logo_data:
        raise HTTPException(404, "Logo non trouvé")
    return Response(
        content=tournament.logo_data,
        media_type=tournament.logo_content_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f"inline; filename={tournament.slug}_logo",
        },
    )


@router.patch("/{slug}")
async def update_tournament(
    slug: str,
    name: str = Form(None),
    logo: UploadFile = File(None),
    creator_session: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Modifie le nom et/ou le logo d'un tournoi (créateur uniquement)."""
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_session != creator_session:
        raise HTTPException(403, "Accès refusé")

    if name and name.strip():
        t.name = name.strip()

    if logo:
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if logo.content_type not in allowed_types:
            raise HTTPException(400, "Type de fichier non supporté.")
        content = await logo.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(400, "L'image ne doit pas dépasser 5MB.")
        t.logo_data = content
        t.logo_content_type = logo.content_type

    await db.commit()
    await db.refresh(t)
    logger.info(f"Tournament updated: {t.slug}")
    return TournamentOut.from_db(t)


@router.delete("/{slug}")
async def delete_tournament(
    slug: str,
    creator_session: str,
    db: AsyncSession = Depends(get_db),
):
    """Supprime un tournoi et toutes ses données (créateur uniquement)."""
    from ..models.match import Match
    from sqlalchemy import delete as sa_delete

    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_session != creator_session:
        raise HTTPException(403, "Accès refusé")

    # Supprimer dans l'ordre (FK)
    await db.execute(sa_delete(Match).where(Match.tournament_id == t.id))
    await db.execute(sa_delete(Player).where(Player.tournament_id == t.id))
    await db.delete(t)
    await db.commit()

    logger.info(f"Tournament deleted: {slug}")
    return {"message": "Tournoi supprimé"}


@router.post("/{slug}/draw")
async def generate_draw(slug: str, body: DrawRequest, db: AsyncSession = Depends(get_db)):
    """
    Génère un aperçu du tirage (preview) sans persister les matchs.
    Le créateur peut régénérer autant de fois qu'il veut.
    """
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_session != body.creator_session:
        raise HTTPException(403, "Accès refusé")
    if t.status not in (TournamentStatus.REGISTRATION, TournamentStatus.DRAW):
        raise HTTPException(400, "Le tirage n'est possible qu'en phase d'inscription ou de tirage")

    players_result = await db.execute(
        select(Player).where(
            Player.tournament_id == t.id,
            Player.status == PlayerStatus.ACCEPTED,
        )
    )
    players = players_result.scalars().all()

    if len(players) < 2:
        raise HTTPException(400, "Il faut au moins 2 joueurs acceptés pour générer un tirage")

    players_data = [
        {
            "id": str(p.id),
            "pseudo": p.pseudo,
            "team_name": p.team_name,
            "dll_division": p.dll_division,
            "dll_won": p.dll_won,
        }
        for p in players
    ]

    if t.tournament_type == "groups":
        if t.group_count < 2:
            raise HTTPException(400, "Nombre de poules invalide")
        draw = balanced_draw(players_data, t.group_count)
    elif t.tournament_type == "championship":
        matchups = championship_draw(players_data, t.championship_legs.value if hasattr(t.championship_legs, 'value') else t.championship_legs)
        draw = {"matchups": matchups}
    else:
        pairs = elimination_draw(players_data)
        draw = {"pairs": pairs}

    # Passer le tournoi en statut DRAW si ce n'est pas déjà fait
    if t.status == TournamentStatus.REGISTRATION:
        t.status = TournamentStatus.DRAW
        await db.commit()

    return {"draw": draw, "status": "preview", "tournament_type": t.tournament_type}


@router.post("/{slug}/draw/confirm")
async def confirm_draw(slug: str, body: DrawConfirmRequest, db: AsyncSession = Depends(get_db)):
    """
    Confirme le tirage : crée les matchs en base et passe le tournoi en IN_PROGRESS.
    """
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_session != body.creator_session:
        raise HTTPException(403, "Accès refusé")
    if t.status == TournamentStatus.IN_PROGRESS:
        raise HTTPException(400, "Le tirage a déjà été confirmé")

    draw = body.draw

    if t.tournament_type == "groups":
        groups = draw.get("groups") or draw.get("draw", {})
        await create_group_matches(str(t.id), groups, db)

    elif t.tournament_type == "championship":
        matchups = draw.get("matchups", [])
        legs = t.championship_legs.value if hasattr(t.championship_legs, 'value') else t.championship_legs
        await create_championship_matches(str(t.id), matchups, legs, db)

    else:
        # Élimination directe
        pairs = draw.get("pairs", [])
        # Déterminer la phase selon le nombre de paires
        n = len(pairs)
        if n >= 8:
            phase = MatchPhase.R16
        elif n >= 4:
            phase = MatchPhase.QF
        elif n >= 2:
            phase = MatchPhase.SF
        else:
            phase = MatchPhase.FINAL
        await create_elimination_matches(str(t.id), pairs, phase, db)

    t.status = TournamentStatus.IN_PROGRESS
    await db.commit()

    await manager.broadcast(str(t.id), {"event": "draw_confirmed", "tournament_id": str(t.id)})
    logger.info(f"Draw confirmed for tournament {t.slug}")
    return {"message": "Tirage confirmé, tournoi lancé"}


@router.get("/{slug}/bracket")
async def get_bracket(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Retourne les matchs organisés par phase pour l'affichage du bracket.
    """
    from ..models.match import Match

    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")

    matches_result = await db.execute(select(Match).where(Match.tournament_id == t.id))
    matches = matches_result.scalars().all()

    players_result = await db.execute(select(Player).where(Player.tournament_id == t.id))
    players = {str(p.id): p for p in players_result.scalars().all()}

    def _player_dict(p):
        if not p:
            return None
        return {
            "id": str(p.id),
            "pseudo": p.pseudo,
            "team_name": p.team_name,
            # Utiliser l'endpoint logo dédié, pas team_logo_url (Cloudinary legacy)
            "team_logo_url": f"/api/players/logo/{p.id}" if p.logo_data else None,
            "dll_division": p.dll_division,
            "dll_idx": p.dll_idx,
        }

    def enrich(m):
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
            "home_player": _player_dict(players.get(str(m.home_player_id))),
            "away_player": _player_dict(players.get(str(m.away_player_id))),
        }

    enriched = [enrich(m) for m in matches]

    bracket: dict = {}
    for m in enriched:
        phase = m["phase"]
        bracket.setdefault(phase, []).append(m)

    return {"bracket": bracket, "matches": enriched}


@router.get("/{slug}/groups")
async def get_groups(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Retourne les groupes avec classement et matchs pour la phase de poules.
    """
    from ..models.match import Match, MatchStatus as MS

    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.tournament_type != "groups":
        raise HTTPException(400, "Ce tournoi n'a pas de phase de poules")

    players_result = await db.execute(
        select(Player).where(
            Player.tournament_id == t.id,
            Player.status == PlayerStatus.ACCEPTED,
        )
    )
    players = players_result.scalars().all()
    players_map = {str(p.id): p for p in players}

    matches_result = await db.execute(
        select(Match).where(Match.tournament_id == t.id, Match.group_id.isnot(None))
    )
    matches = matches_result.scalars().all()

    # Construire les stats par groupe
    groups: dict = {}
    for p in players:
        gid = p.group_id or "?"
        if gid not in groups:
            groups[gid] = {"group_id": gid, "players": {}, "matches": []}
        groups[gid]["players"][str(p.id)] = {
            "id": str(p.id),
            "pseudo": p.pseudo,
            "team_name": p.team_name,
            "team_logo_url": f"/api/players/logo/{p.id}" if p.logo_data else None,
            "dll_division": p.dll_division,
            "played": 0, "won": 0, "draw": 0, "lost": 0,
            "gf": 0, "ga": 0, "diff": 0, "pts": 0,
        }

    for m in matches:
        gid = m.group_id or "?"
        if gid not in groups:
            continue

        home_p = players_map.get(str(m.home_player_id))
        away_p = players_map.get(str(m.away_player_id))
        groups[gid]["matches"].append({
            "id": str(m.id),
            "status": m.status.value if hasattr(m.status, "value") else m.status,
            "home_score": m.home_score,
            "away_score": m.away_score,
            "is_manual": m.is_manual,
            "home_player": {"pseudo": home_p.pseudo, "team_name": home_p.team_name} if home_p else None,
            "away_player": {"pseudo": away_p.pseudo, "team_name": away_p.team_name} if away_p else None,
        })

        # Stats uniquement pour les matchs validés — comparer avec l'enum
        if m.status not in (MS.VALIDATED, MS.MANUAL):
            continue

        h = str(m.home_player_id)
        a = str(m.away_player_id)
        hs, as_ = m.home_score or 0, m.away_score or 0

        for pid, gs, gc in [(h, hs, as_), (a, as_, hs)]:
            if pid in groups[gid]["players"]:
                groups[gid]["players"][pid]["played"] += 1
                groups[gid]["players"][pid]["gf"] += gs
                groups[gid]["players"][pid]["ga"] += gc
                groups[gid]["players"][pid]["diff"] = (
                    groups[gid]["players"][pid]["gf"] - groups[gid]["players"][pid]["ga"]
                )

        if hs > as_:
            if h in groups[gid]["players"]:
                groups[gid]["players"][h]["won"] += 1
                groups[gid]["players"][h]["pts"] += 3
            if a in groups[gid]["players"]:
                groups[gid]["players"][a]["lost"] += 1
        elif hs < as_:
            if a in groups[gid]["players"]:
                groups[gid]["players"][a]["won"] += 1
                groups[gid]["players"][a]["pts"] += 3
            if h in groups[gid]["players"]:
                groups[gid]["players"][h]["lost"] += 1
        else:
            for pid in [h, a]:
                if pid in groups[gid]["players"]:
                    groups[gid]["players"][pid]["draw"] += 1
                    groups[gid]["players"][pid]["pts"] += 1

    qualified_per_group = t.qualified_per_group or 2
    result_groups = []
    for gid, gdata in sorted(groups.items()):
        sorted_players = sorted(
            gdata["players"].values(),
            key=lambda x: (-x["pts"], -x["diff"], -x["gf"]),
        )
        for i, p in enumerate(sorted_players):
            p["qualified"] = i < qualified_per_group
        result_groups.append({
            "group_id": gid,
            "players": sorted_players,
            "matches": gdata["matches"],
        })

    return {"groups": result_groups, "qualified_per_group": qualified_per_group}
