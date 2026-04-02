from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.player import Player, PlayerStatus
from ..models.tournament import Tournament, TournamentStatus
from ..schemas.player import PlayerDecision, PlayerOut
from ..services.tracker_service import fetch_player_data, parse_player_info
from ..services.session_service import generate_session_token
from ..websocket.manager import manager
from ..utils.logger import logger

router = APIRouter()


@router.get("/verify/{dll_idx}")
async def verify_player(dll_idx: str):
    """
    Vérifie un identifiant DLL via le tracker FTGames.
    Le frontend doit toujours passer par cet endpoint (jamais appeler FTGames directement).
    """
    try:
        data = await fetch_player_data(dll_idx)
        return parse_player_info(data)
    except Exception:
        raise HTTPException(400, "Identifiant DLL invalide ou tracker indisponible")


@router.post("/register/{slug}")
async def register_player(
    slug: str,
    pseudo: str = Form(...),
    dll_idx: str = Form(...),
    logo: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Inscrit un joueur à un tournoi.
    - Vérifie l'idx DLL via le tracker
    - Stocke le logo en base (LargeBinary) si fourni
    - Crée le joueur avec statut PENDING
    - Broadcast WebSocket au créateur
    """
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.status != TournamentStatus.REGISTRATION:
        raise HTTPException(400, "Les inscriptions sont fermées pour ce tournoi")

    # Vérifier doublon
    existing = await db.execute(
        select(Player).where(Player.tournament_id == t.id, Player.dll_idx == dll_idx)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Cet identifiant DLL est déjà inscrit dans ce tournoi")

    # Récupérer les données tracker
    tracker_data = await fetch_player_data(dll_idx)
    info = parse_player_info(tracker_data)

    # Gestion du logo en base (pas Cloudinary pour le MVP)
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

    session_token = generate_session_token()

    player = Player(
        tournament_id=t.id,
        session_token=session_token,
        pseudo=pseudo,
        dll_idx=dll_idx,
        team_name=info["team_name"],
        logo_data=logo_data,
        logo_content_type=logo_content_type,
        dll_division=info["division"],
        dll_played=info["played"],
        dll_won=info["won"],
        dll_lost=info["lost"],
        status=PlayerStatus.PENDING,
        is_creator=False,
    )
    db.add(player)
    await db.commit()
    await db.refresh(player)

    await manager.broadcast(
        str(t.id),
        {
            "event": "new_registration",
            "player": {
                "pseudo": pseudo,
                "team_name": info["team_name"],
                "division": info["division"],
            },
        },
    )
    logger.info(f"Player registered: {pseudo} ({dll_idx}) in tournament {slug}")
    return {
        "session_token": session_token,
        "player_id": str(player.id),
        "status": "pending",
        "team_name": info["team_name"],
        "division": info["division"],
    }


@router.post("/register/{slug}/creator")
async def register_creator(
    slug: str,
    pseudo: str = Form(...),
    dll_idx: str = Form(...),
    creator_session: str = Form(...),
    logo: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Permet au créateur de s'inscrire lui-même dans son propre tournoi.
    Son statut est directement ACCEPTED et is_creator=True.
    """
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_session != creator_session:
        raise HTTPException(403, "Accès refusé")

    existing = await db.execute(
        select(Player).where(Player.tournament_id == t.id, Player.dll_idx == dll_idx)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Cet identifiant DLL est déjà inscrit")

    tracker_data = await fetch_player_data(dll_idx)
    info = parse_player_info(tracker_data)

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

    player = Player(
        tournament_id=t.id,
        session_token=creator_session,
        pseudo=pseudo,
        dll_idx=dll_idx,
        team_name=info["team_name"],
        logo_data=logo_data,
        logo_content_type=logo_content_type,
        dll_division=info["division"],
        dll_played=info["played"],
        dll_won=info["won"],
        dll_lost=info["lost"],
        status=PlayerStatus.ACCEPTED,
        is_creator=True,
    )
    db.add(player)
    await db.commit()
    await db.refresh(player)

    logger.info(f"Creator registered as player: {pseudo} in tournament {slug}")
    return {
        "player_id": str(player.id),
        "status": "accepted",
        "team_name": info["team_name"],
        "division": info["division"],
    }


@router.get("/logo/{player_id}")
async def get_player_logo(player_id: str, db: AsyncSession = Depends(get_db)):
    """Sert le logo binaire d'un joueur."""
    from fastapi.responses import Response

    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()
    if not player or not player.logo_data:
        raise HTTPException(404, "Logo non trouvé")
    return Response(
        content=player.logo_data,
        media_type=player.logo_content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/decision")
async def player_decision(body: PlayerDecision, db: AsyncSession = Depends(get_db)):
    """Accepte ou refuse un joueur (créateur uniquement)."""
    player_result = await db.execute(select(Player).where(Player.id == str(body.player_id)))
    player = player_result.scalar_one_or_none()
    if not player:
        raise HTTPException(404, "Joueur introuvable")

    t_result = await db.execute(select(Tournament).where(Tournament.id == player.tournament_id))
    t = t_result.scalar_one_or_none()
    if t.creator_session != body.creator_session:
        raise HTTPException(403, "Accès refusé")

    if body.decision == "accept":
        player.status = PlayerStatus.ACCEPTED
    elif body.decision == "reject":
        player.status = PlayerStatus.REJECTED
    else:
        raise HTTPException(400, "Décision invalide : utilisez 'accept' ou 'reject'")

    await db.commit()

    await manager.broadcast(
        str(t.id),
        {
            "event": "player_decision",
            "player_id": str(player.id),
            "decision": body.decision,
        },
    )
    logger.info(f"Player {player.pseudo} {body.decision}ed in tournament {t.slug}")
    return {"message": f"Joueur {body.decision}é", "player_id": str(player.id)}


@router.get("/tournament/{slug}")
async def get_tournament_players(slug: str, db: AsyncSession = Depends(get_db)):
    """Retourne tous les joueurs d'un tournoi avec leurs infos complètes."""
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(404, "Tournoi introuvable")

    players_result = await db.execute(
        select(Player)
        .where(Player.tournament_id == tournament.id)
        .order_by(Player.registered_at.desc())
    )
    players = players_result.scalars().all()

    return [
        {
            "id": str(p.id),
            "pseudo": p.pseudo,
            "dll_idx": p.dll_idx,
            "team_name": p.team_name,
            # URL du logo via l'endpoint dédié
            "team_logo_url": f"/api/players/logo/{p.id}" if p.logo_data else None,
            "dll_division": p.dll_division,
            "dll_played": p.dll_played,
            "dll_won": p.dll_won,
            "dll_lost": p.dll_lost,
            "status": p.status.value if hasattr(p.status, "value") else str(p.status),
            "group_id": p.group_id,
            "is_creator": p.is_creator,
            "registered_at": p.registered_at.isoformat() if p.registered_at else None,
        }
        for p in players
    ]


@router.get("/{player_id}")
async def get_player_profile(player_id: str, db: AsyncSession = Depends(get_db)):
    """Retourne le profil complet d'un joueur."""
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(404, "Joueur introuvable")

    t_result = await db.execute(select(Tournament).where(Tournament.id == player.tournament_id))
    t = t_result.scalar_one_or_none()

    return {
        "id": str(player.id),
        "pseudo": player.pseudo,
        "dll_idx": player.dll_idx,
        "team_name": player.team_name,
        "team_logo_url": f"/api/players/logo/{player.id}" if player.logo_data else None,
        "dll_division": player.dll_division,
        "dll_played": player.dll_played,
        "dll_won": player.dll_won,
        "dll_lost": player.dll_lost,
        "status": player.status.value if hasattr(player.status, "value") else str(player.status),
        "group_id": player.group_id,
        "is_creator": player.is_creator,
        "tournament": {
            "id": str(t.id),
            "name": t.name,
            "slug": t.slug,
            "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        } if t else None,
    }
