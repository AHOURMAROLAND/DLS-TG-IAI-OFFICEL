import secrets
import uuid
from datetime import datetime, timedelta, timezone

SESSION_DURATION_DAYS = 30
SESSION_MAX_AGE_SECONDS = SESSION_DURATION_DAYS * 24 * 3600


def generate_session_token() -> str:
    """Génère un token de session sécurisé de 64 caractères hex."""
    return secrets.token_hex(32)


def generate_tournament_slug() -> str:
    """Génère un slug unique de 8 caractères pour le lien d'invitation."""
    return str(uuid.uuid4())[:8]


def is_session_valid(created_at: datetime) -> bool:
    """
    Vérifie si une session est encore valide (30 jours).
    Supporte les datetimes avec ou sans timezone.
    """
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return (now - created_at) < timedelta(days=SESSION_DURATION_DAYS)


def session_expires_at(created_at: datetime) -> datetime:
    """Retourne la date d'expiration d'une session."""
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return created_at + timedelta(days=SESSION_DURATION_DAYS)


def set_session_cookie(response, token: str, key: str = "creator_session") -> None:
    """
    Pose le cookie de session sur la réponse FastAPI.
    HttpOnly + SameSite=Lax pour la sécurité.
    Durée : 30 jours.
    """
    response.set_cookie(
        key=key,
        value=token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,  # Passer à True en production (HTTPS)
    )


def get_session_from_request(request, key: str = "creator_session") -> str | None:
    """Récupère le token de session depuis les cookies de la requête."""
    return request.cookies.get(key)


async def cleanup_expired_sessions(db) -> int:
    """
    Supprime les joueurs dont la session a expiré (> 30 jours sans activité)
    et dont le statut est PENDING (jamais acceptés).
    Retourne le nombre de lignes supprimées.
    """
    from sqlalchemy import delete
    from ..models.player import Player, PlayerStatus

    cutoff = datetime.now(timezone.utc) - timedelta(days=SESSION_DURATION_DAYS)

    result = await db.execute(
        delete(Player).where(
            Player.status == PlayerStatus.PENDING,
            Player.created_at < cutoff,
        )
    )
    await db.commit()
    return result.rowcount
