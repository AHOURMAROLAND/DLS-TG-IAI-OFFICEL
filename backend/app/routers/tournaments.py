from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.tournament import Tournament, TournamentStatus
from ..models.player import Player, PlayerStatus
from ..models.user import User
from ..schemas.tournament import TournamentOut
from ..schemas.match import DrawRequest, DrawConfirmRequest
from ..services.session_service import generate_tournament_slug
from ..services.audit_service import audit
from ..services.draw_service import (
    balanced_draw, elimination_draw, championship_draw,
    create_group_matches, create_elimination_matches, create_championship_matches,
)
from ..models.match import MatchPhase
from ..websocket.manager import manager
from ..utils.logger import logger
from ..utils.sanitize import sanitize_tournament_name
from ..dependencies import require_auth, optional_auth

router = APIRouter()


@router.get("/config/valid-sizes")
async def get_valid_sizes(tournament_type: str):
    from ..services.tournament_config import get_valid_team_counts
    sizes = get_valid_team_counts(tournament_type)
    if not sizes:
        raise HTTPException(400, f"Format inconnu : {tournament_type}")
    return {"tournament_type": tournament_type, "valid_sizes": sizes}


@router.get("/config/group-suggestions")
async def get_group_suggestions(max_teams: int):
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


from pydantic import BaseModel as PydanticModel

class TournamentCreateJSON(PydanticModel):
    name: str
    tournament_type: str
    elimination_type: str = "single"
    championship_legs: str = "single"
    max_teams: int
    group_count: int = 0
    teams_per_group: int = 0
    qualified_per_group: int = 2
    elimination_round: str = ""
    visibility: str = "public"  # "public" | "private" (v2)


@router.post("/json")
async def create_tournament_json(
    body: TournamentCreateJSON,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Crée un tournoi sans logo — accepte JSON."""
    # Sanitisation XSS
    name = sanitize_tournament_name(body.name)
    if not name or len(name) < 3:
        raise HTTPException(400, "Le nom du tournoi doit contenir au moins 3 caractères")

    slug = generate_tournament_slug()
    from ..services.tournament_config import validate_tournament_size
    validation = validate_tournament_size(body.tournament_type, body.max_teams, body.elimination_type)
    if not validation.valid:
        if body.max_teams < 4 or body.max_teams > 64:
            raise HTTPException(400, validation.error or "Nombre d'équipes invalide")

    tournament = Tournament(
        slug=slug, name=name, logo_data=None, logo_content_type=None,
        tournament_type=body.tournament_type, elimination_type=body.elimination_type,
        championship_legs=body.championship_legs, max_teams=body.max_teams,
        group_count=body.group_count, teams_per_group=body.teams_per_group,
        qualified_per_group=body.qualified_per_group, elimination_round=body.elimination_round,
        creator_id=current_user.id, status=TournamentStatus.REGISTRATION,
        visibility=body.visibility if body.visibility in ("public", "private") else "public",
    )
    db.add(tournament)

    client_ip = request.client.host if request.client else None
    await audit(
        db,
        user_id=str(current_user.id),
        action="tournament_created",
        details={"name": name, "type": body.tournament_type, "max_teams": body.max_teams},
        ip_address=client_ip,
    )

    await db.commit()
    await db.refresh(tournament)
    logger.info(f"Tournoi créé par {current_user.pseudo}: {tournament.name} ({tournament.slug})")
    return TournamentOut.from_db(tournament)


@router.post("/")
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
    visibility: str = Form("public"),
    logo: UploadFile = File(None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Crée un tournoi — authentification requise."""
    # Sanitisation XSS
    name = sanitize_tournament_name(name)
    if not name or len(name) < 3:
        raise HTTPException(400, "Le nom du tournoi doit contenir au moins 3 caractères")

    slug = generate_tournament_slug()

    from ..services.tournament_config import validate_tournament_size
    validation = validate_tournament_size(tournament_type, max_teams, elimination_type)
    if not validation.valid:
        if max_teams < 4 or max_teams > 64:
            raise HTTPException(400, validation.error or "Nombre d'équipes invalide")

    logo_data = None
    logo_content_type = None
    if logo:
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if logo.content_type not in allowed_types:
            raise HTTPException(400, "Type de fichier non supporté.")
        content = await logo.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(400, "L'image ne doit pas dépasser 5MB.")
        logo_data = content
        logo_content_type = logo.content_type

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
        creator_id=current_user.id,
        status=TournamentStatus.REGISTRATION,
        visibility=visibility if visibility in ("public", "private") else "public",
    )
    db.add(tournament)

    client_ip = request.client.host if request and request.client else None
    await audit(
        db,
        user_id=str(current_user.id),
        action="tournament_created",
        details={"name": name, "type": tournament_type, "max_teams": max_teams},
        ip_address=client_ip,
    )

    await db.commit()
    await db.refresh(tournament)

    logger.info(f"Tournoi créé par {current_user.pseudo}: {tournament.name} ({tournament.slug})")
    return TournamentOut.from_db(tournament)


@router.get("/")
async def get_tournaments(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(optional_auth),
):
    """
    Sans auth : retourne uniquement les tournois publics.
    Avec auth : retourne les publics + les tournois du user (créés ou rejoints).
    """
    if current_user is None:
        result = await db.execute(
            select(Tournament)
            .where(Tournament.visibility == "public")
            .order_by(Tournament.created_at.desc())
        )
        return [TournamentOut.from_db(t) for t in result.scalars().all()]

    # Utilisateur connecté : publics + ses propres tournois (privés inclus)
    from sqlalchemy import or_
    players_result = await db.execute(
        select(Player.tournament_id).where(Player.user_id == current_user.id)
    )
    participating_ids = [row[0] for row in players_result.all()]

    result = await db.execute(
        select(Tournament)
        .where(
            or_(
                Tournament.visibility == "public",
                Tournament.creator_id == current_user.id,
                Tournament.id.in_(participating_ids),
            )
        )
        .order_by(Tournament.created_at.desc())
    )
    return [TournamentOut.from_db(t) for t in result.scalars().all()]


@router.get("/mine")
async def get_my_tournaments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Retourne les tournois créés par l'utilisateur connecté."""
    result = await db.execute(
        select(Tournament)
        .where(Tournament.creator_id == current_user.id)
        .order_by(Tournament.created_at.desc())
    )
    return [TournamentOut.from_db(t) for t in result.scalars().all()]


@router.get("/participating")
async def get_participating_tournaments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Retourne les tournois où l'utilisateur est inscrit comme joueur."""
    players_result = await db.execute(
        select(Player).where(Player.user_id == current_user.id)
    )
    players = players_result.scalars().all()
    tournament_ids = list({p.tournament_id for p in players})

    if not tournament_ids:
        return []

    result = await db.execute(
        select(Tournament)
        .where(Tournament.id.in_(tournament_ids))
        .order_by(Tournament.created_at.desc())
    )
    return [TournamentOut.from_db(t) for t in result.scalars().all()]


@router.get("/{slug}")
async def get_tournament(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    return TournamentOut.from_db(t)


@router.get("/{slug}/logo")
async def get_tournament_logo(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    tournament = result.scalar_one_or_none()
    if not tournament or not tournament.logo_data:
        raise HTTPException(404, "Logo non trouvé")
    return Response(
        content=tournament.logo_data,
        media_type=tournament.logo_content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.patch("/{slug}")
async def update_tournament(
    slug: str,
    name: str = Form(None),
    visibility: str = Form(None),
    logo: UploadFile = File(None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_id != current_user.id:
        raise HTTPException(403, "Accès refusé")
    if t.status == TournamentStatus.FINISHED:
        raise HTTPException(400, "Impossible de modifier un tournoi terminé")

    changes: dict = {}
    if name and name.strip():
        clean_name = sanitize_tournament_name(name)
        if clean_name:
            t.name = clean_name
            changes["name"] = clean_name
    if visibility and visibility in ("public", "private"):
        t.visibility = visibility
        changes["visibility"] = visibility
    if logo:
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if logo.content_type not in allowed_types:
            raise HTTPException(400, "Type de fichier non supporté.")
        content = await logo.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(400, "L'image ne doit pas dépasser 5MB.")
        t.logo_data = content
        t.logo_content_type = logo.content_type
        changes["logo"] = "updated"

    if changes:
        client_ip = request.client.host if request and request.client else None
        await audit(
            db,
            user_id=str(current_user.id),
            action="tournament_updated",
            tournament_id=str(t.id),
            target_type="tournament",
            target_id=str(t.id),
            details=changes,
            ip_address=client_ip,
        )

    await db.commit()
    await db.refresh(t)
    return TournamentOut.from_db(t)


@router.delete("/{slug}")
async def delete_tournament(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    from ..models.match import Match
    from ..models.audit_log import AuditLog
    from sqlalchemy import delete as sa_delete
    import uuid as _uuid
    from datetime import datetime, timezone

    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_id != current_user.id:
        raise HTTPException(403, "Accès refusé")

    tournament_name = t.name
    tournament_slug = t.slug
    tournament_id   = str(t.id)
    client_ip = request.client.host if request.client else None

    # Supprimer dans l'ordre strict pour respecter les FK :
    # 1. audit_logs liés au tournoi (FK tournament_id)
    # 2. matches
    # 3. players
    # 4. le tournoi lui-même
    await db.execute(sa_delete(AuditLog).where(AuditLog.tournament_id == tournament_id))
    await db.execute(sa_delete(Match).where(Match.tournament_id == tournament_id))
    await db.execute(sa_delete(Player).where(Player.tournament_id == tournament_id))
    await db.execute(sa_delete(Tournament).where(Tournament.id == tournament_id))

    # Écrire l'audit APRÈS la suppression, sans tournament_id (plus de FK)
    log = AuditLog(
        id=str(_uuid.uuid4()),
        user_id=str(current_user.id),
        tournament_id=None,
        action="tournament_deleted",
        target_type="tournament",
        target_id=tournament_id,
        details={"name": tournament_name, "slug": tournament_slug},
        ip_address=client_ip,
    )
    db.add(log)

    await db.commit()
    logger.info(f"Tournoi supprimé par {current_user.pseudo}: {tournament_name} ({tournament_slug})")
    return {"message": "Tournoi supprimé"}


@router.post("/{slug}/draw")
async def generate_draw(
    slug: str,
    body: DrawRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_id != current_user.id:
        raise HTTPException(403, "Accès refusé")
    if t.status not in (TournamentStatus.REGISTRATION, TournamentStatus.DRAW):
        raise HTTPException(400, "Le tirage n'est possible qu'en phase d'inscription ou de tirage")

    players_result = await db.execute(
        select(Player).where(Player.tournament_id == t.id, Player.status == PlayerStatus.ACCEPTED)
    )
    players = players_result.scalars().all()

    # ── Blocage strict : nombre de joueurs insuffisant ─────────────────────
    if len(players) < 2:
        raise HTTPException(400, "Il faut au moins 2 joueurs acceptés pour générer le tirage")

    if len(players) < t.max_teams:
        raise HTTPException(
            400,
            f"Le tournoi n'est pas complet : {len(players)}/{t.max_teams} joueurs acceptés. "
            f"Acceptez tous les joueurs avant de lancer le tirage."
        )

    players_data = [
        {"id": str(p.id), "pseudo": p.pseudo, "team_name": p.team_name,
         "dll_division": p.dll_division, "dll_won": p.dll_won}
        for p in players
    ]

    if t.tournament_type == "groups":
        draw = {"groups": balanced_draw(players_data, t.group_count)}
    elif t.tournament_type == "championship":
        legs = t.championship_legs.value if hasattr(t.championship_legs, 'value') else t.championship_legs
        draw = {"matchups": championship_draw(players_data, legs)}
    else:
        draw = {"pairs": elimination_draw(players_data)}

    if t.status == TournamentStatus.REGISTRATION:
        t.status = TournamentStatus.DRAW
        await db.commit()

    return {"draw": draw, "status": "preview", "tournament_type": t.tournament_type}


@router.post("/{slug}/draw/confirm")
async def confirm_draw(
    slug: str,
    body: DrawConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_id != current_user.id:
        raise HTTPException(403, "Accès refusé")
    if t.status == TournamentStatus.IN_PROGRESS:
        raise HTTPException(400, "Le tirage a déjà été confirmé")
    if t.status == TournamentStatus.FINISHED:
        raise HTTPException(400, "Le tournoi est terminé")

    draw = body.draw
    if t.tournament_type == "groups":
        groups = draw.get("groups") or draw.get("draw", {})
        await create_group_matches(str(t.id), groups, db)
    elif t.tournament_type == "championship":
        legs = t.championship_legs.value if hasattr(t.championship_legs, 'value') else t.championship_legs
        await create_championship_matches(str(t.id), draw.get("matchups", []), legs, db)
    else:
        pairs = draw.get("pairs", [])
        n = len(pairs)
        phase = MatchPhase.R16 if n >= 8 else MatchPhase.QF if n >= 4 else MatchPhase.SF if n >= 2 else MatchPhase.FINAL
        await create_elimination_matches(str(t.id), pairs, phase, db)

    t.status = TournamentStatus.IN_PROGRESS

    # Audit log
    client_ip = request.client.host if request.client else None
    await audit(
        db,
        user_id=str(current_user.id),
        action="draw_confirmed",
        tournament_id=str(t.id),
        target_type="tournament",
        target_id=str(t.id),
        details={"tournament_type": t.tournament_type},
        ip_address=client_ip,
    )

    await db.commit()
    await manager.broadcast(str(t.id), {"event": "draw_confirmed", "tournament_id": str(t.id)})
    return {"message": "Tirage confirmé, tournoi lancé"}


@router.get("/{slug}/bracket")
async def get_bracket(slug: str, db: AsyncSession = Depends(get_db)):
    from ..models.match import Match
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")

    matches_result = await db.execute(select(Match).where(Match.tournament_id == t.id))
    players_result = await db.execute(select(Player).where(Player.tournament_id == t.id))
    players = {str(p.id): p for p in players_result.scalars().all()}

    def _p(p):
        if not p: return None
        return {"id": str(p.id), "pseudo": p.pseudo, "team_name": p.team_name,
                "team_logo_url": f"/api/players/logo/{p.id}" if p.logo_data else None,
                "dll_division": p.dll_division, "dll_idx": p.dll_idx}

    enriched = [{
        "id": str(m.id), "phase": m.phase.value if hasattr(m.phase, "value") else m.phase,
        "round_number": m.round_number, "group_id": m.group_id,
        "status": m.status.value if hasattr(m.status, "value") else m.status,
        "home_score": m.home_score, "away_score": m.away_score,
        "home_score_agg": m.home_score_agg, "away_score_agg": m.away_score_agg,
        "is_manual": m.is_manual, "motm": m.motm,
        "home_scorers": m.home_scorers or [], "away_scorers": m.away_scorers or [],
        "home_player": _p(players.get(str(m.home_player_id))),
        "away_player": _p(players.get(str(m.away_player_id))),
    } for m in matches_result.scalars().all()]

    bracket: dict = {}
    for m in enriched:
        bracket.setdefault(m["phase"], []).append(m)
    return {"bracket": bracket, "matches": enriched}


@router.get("/{slug}/groups")
async def get_groups(slug: str, db: AsyncSession = Depends(get_db)):
    from ..models.match import Match, MatchStatus as MS
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.tournament_type != "groups":
        raise HTTPException(400, "Ce tournoi n'a pas de phase de poules")

    players_result = await db.execute(
        select(Player).where(Player.tournament_id == t.id, Player.status == PlayerStatus.ACCEPTED)
    )
    players = players_result.scalars().all()
    players_map = {str(p.id): p for p in players}

    matches_result = await db.execute(
        select(Match).where(Match.tournament_id == t.id, Match.group_id.isnot(None))
    )
    matches = matches_result.scalars().all()

    groups: dict = {}
    for p in players:
        gid = p.group_id or "?"
        if gid not in groups:
            groups[gid] = {"group_id": gid, "players": {}, "matches": []}
        groups[gid]["players"][str(p.id)] = {
            "id": str(p.id), "pseudo": p.pseudo, "team_name": p.team_name,
            "team_logo_url": f"/api/players/logo/{p.id}" if p.logo_data else None,
            "dll_division": p.dll_division,
            "played": 0, "won": 0, "draw": 0, "lost": 0, "gf": 0, "ga": 0, "diff": 0, "pts": 0,
        }

    for m in matches:
        gid = m.group_id or "?"
        if gid not in groups:
            continue
        home_p = players_map.get(str(m.home_player_id))
        away_p = players_map.get(str(m.away_player_id))
        groups[gid]["matches"].append({
            "id": str(m.id), "status": m.status.value if hasattr(m.status, "value") else m.status,
            "home_score": m.home_score, "away_score": m.away_score, "is_manual": m.is_manual,
            "home_player": {"pseudo": home_p.pseudo, "team_name": home_p.team_name} if home_p else None,
            "away_player": {"pseudo": away_p.pseudo, "team_name": away_p.team_name} if away_p else None,
        })

        if m.status not in (MS.VALIDATED, MS.MANUAL):
            continue

        h, a = str(m.home_player_id), str(m.away_player_id)
        hs, as_ = m.home_score or 0, m.away_score or 0
        for pid, gs, gc in [(h, hs, as_), (a, as_, hs)]:
            if pid in groups[gid]["players"]:
                groups[gid]["players"][pid]["played"] += 1
                groups[gid]["players"][pid]["gf"] += gs
                groups[gid]["players"][pid]["ga"] += gc
                groups[gid]["players"][pid]["diff"] = groups[gid]["players"][pid]["gf"] - groups[gid]["players"][pid]["ga"]
        if hs > as_:
            if h in groups[gid]["players"]: groups[gid]["players"][h]["won"] += 1; groups[gid]["players"][h]["pts"] += 3
            if a in groups[gid]["players"]: groups[gid]["players"][a]["lost"] += 1
        elif hs < as_:
            if a in groups[gid]["players"]: groups[gid]["players"][a]["won"] += 1; groups[gid]["players"][a]["pts"] += 3
            if h in groups[gid]["players"]: groups[gid]["players"][h]["lost"] += 1
        else:
            for pid in [h, a]:
                if pid in groups[gid]["players"]: groups[gid]["players"][pid]["draw"] += 1; groups[gid]["players"][pid]["pts"] += 1

    qualified_per_group = t.qualified_per_group or 2
    result_groups = []
    for gid, gdata in sorted(groups.items()):
        sorted_players = sorted(gdata["players"].values(), key=lambda x: (-x["pts"], -x["diff"], -x["gf"]))
        for i, p in enumerate(sorted_players):
            p["qualified"] = i < qualified_per_group
        result_groups.append({"group_id": gid, "players": sorted_players, "matches": gdata["matches"]})

    return {"groups": result_groups, "qualified_per_group": qualified_per_group}
