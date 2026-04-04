"""
Service d'authentification — JWT + bcrypt.
"""
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..config import settings
from ..models.user import User
from ..utils.logger import logger

# ─── Bcrypt ───────────────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SESSION_DURATION_DAYS = 30
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── Validation mot de passe ──────────────────────────────────────────────────

def validate_password(password: str) -> tuple[bool, str]:
    """
    Mot de passe robuste : min 6 caractères, au moins 1 majuscule,
    1 chiffre, 1 caractère spécial.
    """
    if len(password) < 6:
        return False, "Le mot de passe doit contenir au moins 6 caractères"
    if not re.search(r"[A-Z]", password):
        return False, "Le mot de passe doit contenir au moins une majuscule"
    if not re.search(r"\d", password):
        return False, "Le mot de passe doit contenir au moins un chiffre"
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        return False, "Le mot de passe doit contenir au moins un caractère spécial"
    return True, ""


# ─── JWT ──────────────────────────────────────────────────────────────────────

def create_access_token(user_id: str, pseudo: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=SESSION_DURATION_DAYS)
    payload = {
        "sub": user_id,
        "pseudo": pseudo,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# ─── Suggestions de pseudo ────────────────────────────────────────────────────

async def suggest_pseudos(base: str, db: AsyncSession, count: int = 3) -> list[str]:
    """Génère des suggestions de pseudo si le pseudo est déjà pris."""
    suggestions = []
    import random
    for _ in range(count * 3):
        candidate = f"{base}{random.randint(1, 9999)}"
        result = await db.execute(select(User).where(User.pseudo == candidate))
        if not result.scalar_one_or_none():
            suggestions.append(candidate)
        if len(suggestions) >= count:
            break
    return suggestions


# ─── Récupérer l'utilisateur depuis le token ──────────────────────────────────

async def get_current_user(token: str, db: AsyncSession) -> Optional[User]:
    """Décode le JWT et retourne l'utilisateur si valide et actif."""
    payload = decode_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return None

    # Vérifier expiration de session (30 jours d'inactivité)
    if user.last_active_at:
        inactive_days = (datetime.now(timezone.utc) - user.last_active_at.replace(tzinfo=timezone.utc)).days
        if inactive_days > SESSION_DURATION_DAYS:
            logger.info(f"Session expirée pour {user.pseudo} ({inactive_days} jours d'inactivité)")
            return None

    return user
