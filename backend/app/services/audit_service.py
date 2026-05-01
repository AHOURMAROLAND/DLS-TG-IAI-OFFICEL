"""
Service d'audit — enregistre les actions sensibles du créateur en base.
Usage : await audit(db, user_id, "player_accepted", tournament_id=..., ...)
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.audit_log import AuditLog
from ..utils.logger import logger


async def audit(
    db: AsyncSession,
    user_id: str,
    action: str,
    *,
    tournament_id: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> None:
    """
    Enregistre une action dans la table audit_logs.
    Ne lève jamais d'exception — l'audit ne doit pas bloquer le flux métier.
    """
    try:
        log = AuditLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            tournament_id=tournament_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            ip_address=ip_address,
        )
        db.add(log)
        # Flush sans commit — le commit est géré par l'appelant
        await db.flush()
        logger.debug(f"Audit [{action}] user={user_id} tournament={tournament_id} target={target_id}")
    except Exception as e:
        # L'audit ne doit jamais faire planter une requête métier
        logger.error(f"Audit log failed for action={action}: {e}")
