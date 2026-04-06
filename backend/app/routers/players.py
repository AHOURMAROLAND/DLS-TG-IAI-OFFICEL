from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.player import Player, PlayerStatus
from ..models.tournament import Tournament, TournamentStatus
from ..models.user import User
from ..schemas.player import PlayerDecision, PlayerOut, AddPlayerManualRequest
from ..services.tracker_service import fetch_player_data, parse_player_info, get_all_recent_matches
from ..websocket.manager import manager
from ..utils.logger import logger
from ..dependencies import require_auth, optional_auth

router = APIRouter()


@router.get("/search-user")
async def search_users(
    pseudo: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Recherche des utilisateurs par pseudo (partielle, insensible à la casse)."""
    result = await db.execute(
        select(User)
        .where(User.pseudo.ilike(f"%{pseudo}%"))
        .where(User.is_active == True)
        .limit(10)
    )
    users = result.scalars().all()
    return [{"id": str(u.id), "pseudo": u.pseudo} for u in users]


@router.get("/verify/{dll_idx}")
async def verify_player(dll_idx: str):
    try:
        data = await fetch_player_data(dll_idx)
        info = parse_player_info(data)
        recent = get_all_recent_matches(data, limit=3)
        return {**info, "recent_matches": recent}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))


@router.post("/register/{slug}")
async def register_player(
    slug: str,
    pseudo: str = Form(...),
    dll_idx: str = Form(...),
    logo: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Inscrit l'utilisateur connecté à un tournoi."""
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.status != TournamentStatus.REGISTRATION:
        raise HTTPException(400, "Les inscriptions sont fermées")

    # Vérifier doublon (même user ou même idx)
    existing_user = await db.execute(
        select(Player).where(Player.tournament_id == t.id, Player.user_id == current_user.id)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(400, "Vous êtes déjà inscrit à ce tournoi")

    existing_idx = await db.execute(
        select(Player).where(Player.tournament_id == t.id, Player.dll_idx == dll_idx)
    )
    if existing_idx.scalar_one_or_none():
        raise HTTPException(400, "Cet identifiant DLL est déjà inscrit dans ce tournoi")

    try:
        tracker_data = await fetch_player_data(dll_idx)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
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

    is_creator = t.creator_id == current_user.id

    player = Player(
        tournament_id=t.id,
        user_id=current_user.id,
        pseudo=pseudo,
        dll_idx=dll_idx,
        team_name=info["team_name"],
        logo_data=logo_data,
        logo_content_type=logo_content_type,
        dll_division=info["division"],
        dll_played=info["played"],
        dll_won=info["won"],
        dll_lost=info["lost"],
        # Le créateur est auto-accepté
        status=PlayerStatus.ACCEPTED if is_creator else PlayerStatus.PENDING,
        is_creator=is_creator,
    )
    db.add(player)
    await db.commit()
    await db.refresh(player)

    await manager.broadcast(str(t.id), {
        "event": "new_registration",
        "player": {"pseudo": pseudo, "team_name": info["team_name"], "division": info["division"]},
    })
    logger.info(f"Joueur inscrit: {current_user.pseudo} ({dll_idx}) dans {slug}")
    return {
        "player_id": str(player.id),
        "status": player.status.value,
        "team_name": info["team_name"],
        "division": info["division"],
    }


@router.post("/register/{slug}/creator")
async def register_creator(
    slug: str,
    pseudo: str = Form(...),
    dll_idx: str = Form(...),
    logo: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """
    Inscrit le créateur du tournoi comme joueur — alias de /register/{slug}.
    Le créateur est auto-accepté et marqué is_creator=True.
    """
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_id != current_user.id:
        raise HTTPException(403, "Réservé au créateur du tournoi")
    if t.status != TournamentStatus.REGISTRATION:
        raise HTTPException(400, "Les inscriptions sont fermées")

    existing_user = await db.execute(
        select(Player).where(Player.tournament_id == t.id, Player.user_id == current_user.id)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(400, "Vous êtes déjà inscrit à ce tournoi")

    existing_idx = await db.execute(
        select(Player).where(Player.tournament_id == t.id, Player.dll_idx == dll_idx)
    )
    if existing_idx.scalar_one_or_none():
        raise HTTPException(400, "Cet identifiant DLL est déjà inscrit dans ce tournoi")

    try:
        tracker_data = await fetch_player_data(dll_idx)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
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
        user_id=current_user.id,
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

    await manager.broadcast(str(t.id), {
        "event": "new_registration",
        "player": {"pseudo": pseudo, "team_name": info["team_name"], "division": info["division"]},
    })
    logger.info(f"Créateur inscrit comme joueur: {current_user.pseudo} ({dll_idx}) dans {slug}")
    return {
        "player_id": str(player.id),
        "status": player.status.value,
        "team_name": info["team_name"],
        "division": info["division"],
    }



@router.post("/add/{slug}")
async def add_player_manually(
    slug: str,
    body: AddPlayerManualRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """
    Ajout manuel d'un participant par le créateur.
    - Statut accepted directement
    - user_id optionnel (null = invité sans compte)
    - dll_idx normalisé en lowercase
    """
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournoi introuvable")
    if t.creator_id != current_user.id:
        raise HTTPException(403, "Réservé au créateur du tournoi")
    if t.status != TournamentStatus.REGISTRATION:
        raise HTTPException(400, "Les inscriptions sont fermées")

    dll_idx = body.dll_idx.strip().lower()

    # Vérifier unicité idx dans le tournoi
    existing_idx = await db.execute(
        select(Player).where(Player.tournament_id == t.id, Player.dll_idx == dll_idx)
    )
    if existing_idx.scalar_one_or_none():
        raise HTTPException(400, "Cet identifiant DLL est déjà inscrit dans ce tournoi")

    # Vérifier unicité user dans le tournoi (si user_id fourni)
    linked_user_id = None
    if body.user_id:
        user_result = await db.execute(select(User).where(User.id == body.user_id))
        linked_user = user_result.scalar_one_or_none()
        if not linked_user:
            raise HTTPException(404, "Utilisateur introuvable")
        existing_user = await db.execute(
            select(Player).where(Player.tournament_id == t.id, Player.user_id == body.user_id)
        )
        if existing_user.scalar_one_or_none():
            raise HTTPException(400, "Ce joueur est déjà inscrit dans ce tournoi")
        linked_user_id = body.user_id

    # Vérifier l'idx via le tracker
    try:
        tracker_data = await fetch_player_data(dll_idx)
        info = parse_player_info(tracker_data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))

    player = Player(
        tournament_id=t.id,
        user_id=linked_user_id,
        pseudo=body.pseudo.strip(),
        dll_idx=dll_idx,
        team_name=info["team_name"],
        dll_division=info["division"],
        dll_played=info["played"],
        dll_won=info["won"],
        dll_lost=info["lost"],
        status=PlayerStatus.ACCEPTED,
        is_creator=False,
    )
    db.add(player)
    await db.commit()
    await db.refresh(player)

    await manager.broadcast(str(t.id), {
        "event": "new_registration",
        "player": {"pseudo": body.pseudo, "team_name": info["team_name"], "division": info["division"]},
    })
    logger.info(f"Joueur ajouté manuellement par {current_user.pseudo}: {body.pseudo} ({dll_idx}) dans {slug}")
    return {
        "player_id": str(player.id),
        "status": player.status.value,
        "team_name": info["team_name"],
        "division": info["division"],
        "is_guest": linked_user_id is None,
    }


@router.get("/logo/{player_id}")
async def get_player_logo(player_id: str, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import Response
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()
    if not player or not player.logo_data:
        raise HTTPException(404, "Logo non trouvé")
    return Response(content=player.logo_data, media_type=player.logo_content_type,
                    headers={"Cache-Control": "public, max-age=86400"})


@router.post("/decision")
async def player_decision(
    body: PlayerDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Accepte ou refuse un joueur — créateur uniquement."""
    player_result = await db.execute(select(Player).where(Player.id == str(body.player_id)))
    player = player_result.scalar_one_or_none()
    if not player:
        raise HTTPException(404, "Joueur introuvable")

    t_result = await db.execute(select(Tournament).where(Tournament.id == player.tournament_id))
    t = t_result.scalar_one_or_none()
    if t.creator_id != current_user.id:
        raise HTTPException(403, "Accès refusé")

    if body.decision == "accept":
        player.status = PlayerStatus.ACCEPTED
    elif body.decision == "reject":
        player.status = PlayerStatus.REJECTED
    else:
        raise HTTPException(400, "Décision invalide")

    await db.commit()
    await manager.broadcast(str(t.id), {
        "event": "player_decision", "player_id": str(player.id), "decision": body.decision,
    })
    return {"message": f"Joueur {body.decision}é", "player_id": str(player.id)}


@router.delete("/{player_id}")
async def delete_player(
    player_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Supprime un joueur invité (sans compte) — créateur uniquement, phase inscription."""
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(404, "Joueur introuvable")

    t_result = await db.execute(select(Tournament).where(Tournament.id == player.tournament_id))
    t = t_result.scalar_one_or_none()
    if not t or t.creator_id != current_user.id:
        raise HTTPException(403, "Accès refusé")
    if t.status != TournamentStatus.REGISTRATION:
        raise HTTPException(400, "Suppression impossible hors phase d'inscription")
    if player.user_id is not None:
        raise HTTPException(403, "Seuls les joueurs invités (sans compte) peuvent être supprimés")

    await db.delete(player)
    await db.commit()
    logger.info(f"Joueur invité supprimé par {current_user.pseudo}: {player.pseudo} ({player.dll_idx})")
    return {"message": "Joueur supprimé", "player_id": player_id}


@router.get("/tournament/{slug}")
async def get_tournament_players(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(404, "Tournoi introuvable")

    players_result = await db.execute(
        select(Player).where(Player.tournament_id == tournament.id).order_by(Player.registered_at.desc())
    )
    players = players_result.scalars().all()

    return [{
        "id": str(p.id), "pseudo": p.pseudo, "dll_idx": p.dll_idx, "team_name": p.team_name,
        "team_logo_url": f"/api/players/logo/{p.id}" if p.logo_data else None,
        "dll_division": p.dll_division, "dll_played": p.dll_played,
        "dll_won": p.dll_won, "dll_lost": p.dll_lost,
        "status": p.status.value if hasattr(p.status, "value") else str(p.status),
        "group_id": p.group_id, "is_creator": p.is_creator,
        "user_id": str(p.user_id) if p.user_id else None,
        "registered_at": p.registered_at.isoformat() if p.registered_at else None,
    } for p in players]


@router.get("/{player_id}")
async def get_player_profile(player_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(404, "Joueur introuvable")

    t_result = await db.execute(select(Tournament).where(Tournament.id == player.tournament_id))
    t = t_result.scalar_one_or_none()

    return {
        "id": str(player.id), "pseudo": player.pseudo, "dll_idx": player.dll_idx,
        "team_name": player.team_name,
        "team_logo_url": f"/api/players/logo/{player.id}" if player.logo_data else None,
        "dll_division": player.dll_division, "dll_played": player.dll_played,
        "dll_won": player.dll_won, "dll_lost": player.dll_lost,
        "status": player.status.value if hasattr(player.status, "value") else str(player.status),
        "group_id": player.group_id, "is_creator": player.is_creator,
        "tournament": {
            "id": str(t.id), "name": t.name, "slug": t.slug,
            "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        } if t else None,
    }
