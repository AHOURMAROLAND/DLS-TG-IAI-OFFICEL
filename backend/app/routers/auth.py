from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from ..database import get_db
from ..models.user import User
from ..services.auth_service import (
    hash_password, verify_password, validate_password,
    create_access_token, get_current_user, suggest_pseudos,
)
from ..services.tracker_service import fetch_player_data, parse_player_info
from ..config import settings

from ..utils.logger import logger

router = APIRouter()
COOKIE_NAME = "dls_token"


COOKIE_MAX_AGE = 30 * 24 * 3600  # 30 jours

class RegisterRequest(BaseModel):
    pseudo: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=6)
    dll_idx: str | None = None  # Optionnel — associé au compte si fourni (v2)


class LoginRequest(BaseModel):
    pseudo: str
    password: str


class UserOut(BaseModel):
    id: str
    pseudo: str
    dll_idx: str | None = None
    dll_team_name: str | None = None
    dll_division: int | None = None
    created_at: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Crée un compte utilisateur.
    - Pseudo unique (suggestions si déjà pris)
    - Mot de passe : min 6 chars, 1 majuscule, 1 chiffre, 1 spécial
    - dll_idx optionnel : vérifié via tracker FTGames, stocké en lowercase
    """
    # Validation mot de passe
    valid, msg = validate_password(body.password)
    if not valid:
        raise HTTPException(400, msg)

    # Vérifier unicité du pseudo
    existing = await db.execute(select(User).where(User.pseudo == body.pseudo))
    if existing.scalar_one_or_none():
        suggestions = await suggest_pseudos(body.pseudo, db)
        raise HTTPException(409, {
            "message": f"Le pseudo '{body.pseudo}' est déjà pris",
            "suggestions": suggestions,
        })

    # Traitement idx DLS optionnel
    dll_idx = None
    dll_team_name = None
    dll_division = None

    if body.dll_idx and body.dll_idx.strip():
        dll_idx = body.dll_idx.strip().lower()  # Normalisation lowercase — Req 5.2

        # Vérifier unicité de l'idx en base
        existing_idx = await db.execute(select(User).where(User.dll_idx == dll_idx))
        if existing_idx.scalar_one_or_none():
            raise HTTPException(409, "Cet identifiant DLS est déjà associé à un compte")

        # Vérifier l'idx via le tracker FTGames
        try:
            tracker_data = await fetch_player_data(dll_idx)
            info = parse_player_info(tracker_data)
            dll_team_name = info["team_name"]
            dll_division = info["division"]
        except ValueError as e:
            raise HTTPException(400, str(e))
        except ConnectionError as e:
            raise HTTPException(503, str(e))

    user = User(
        pseudo=body.pseudo,
        password_hash=hash_password(body.password),
        dll_idx=dll_idx,
        dll_team_name=dll_team_name,
        dll_division=dll_division,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), user.pseudo)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
    )

    logger.info(f"Nouveau compte créé : {user.pseudo}" + (f" (idx: {dll_idx})" if dll_idx else ""))
    return {
        "id": str(user.id),
        "pseudo": user.pseudo,
        "dll_idx": user.dll_idx,
        "dll_team_name": user.dll_team_name,
        "dll_division": user.dll_division,
        "token": token,
    }


@router.post("/login")
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Connexion avec pseudo + mot de passe.
    - Compte expiré (inactif > 30j) → message spécifique
    """
    result = await db.execute(select(User).where(User.pseudo == body.pseudo))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Pseudo ou mot de passe incorrect")

    if not user.is_active:
        raise HTTPException(403, "Compte désactivé")

    # Vérifier inactivité
    if user.last_active_at:
        inactive_days = (datetime.now(timezone.utc) - user.last_active_at.replace(tzinfo=timezone.utc)).days
        if inactive_days > 30:
            raise HTTPException(410, {
                "message": "Compte expiré après 1 mois d'inactivité",
                "expired": True,
            })

    # Mettre à jour last_active_at
    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    token = create_access_token(str(user.id), user.pseudo)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
    )

    logger.info(f"Connexion : {user.pseudo}")
    return {"id": str(user.id), "pseudo": user.pseudo, "token": token}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"message": "Déconnecté"}


@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    """Retourne l'utilisateur connecté depuis le cookie ou le header Authorization."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(401, "Non authentifié")

    user = await get_current_user(token, db)
    if not user:
        raise HTTPException(401, "Session expirée ou invalide")

    # Mettre à jour last_active_at pour éviter l'expiration par inactivité
    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "id": str(user.id),
        "pseudo": user.pseudo,
        "dll_idx": user.dll_idx,
        "dll_team_name": user.dll_team_name,
        "dll_division": user.dll_division,
    }


@router.get("/check-pseudo/{pseudo}")
async def check_pseudo(pseudo: str, db: AsyncSession = Depends(get_db)):
    """Vérifie si un pseudo est disponible."""
    result = await db.execute(select(User).where(User.pseudo == pseudo))
    taken = result.scalar_one_or_none() is not None
    suggestions = await suggest_pseudos(pseudo, db) if taken else []
    return {"available": not taken, "suggestions": suggestions}
