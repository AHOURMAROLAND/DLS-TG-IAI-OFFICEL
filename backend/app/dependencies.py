"""
Dépendances FastAPI pour l'authentification.
"""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models.user import User
from .services.auth_service import get_current_user

COOKIE_NAME = "dls_token"


async def require_auth(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """
    Dépendance qui exige une authentification.
    Lève 401 si pas de token ou token invalide.
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        # Essayer aussi le header Authorization: Bearer <token>
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(401, "Authentification requise")

    user = await get_current_user(token, db)
    if not user:
        raise HTTPException(401, "Session expirée — reconnectez-vous")

    return user


async def optional_auth(request: Request, db: AsyncSession = Depends(get_db)):
    """Authentification optionnelle — retourne None si pas connecté."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    return await get_current_user(token, db)
