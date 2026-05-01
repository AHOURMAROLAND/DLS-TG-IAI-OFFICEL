import uuid
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from ..database import Base


class AuditLog(Base):
    """
    Trace toutes les actions sensibles du créateur :
    - accept/reject joueur
    - validate match (manuel ou tracker)
    - confirm draw
    - delete tournament / player
    - update tournament settings
    """
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    tournament_id = Column(String(36), ForeignKey("tournaments.id"), nullable=True, index=True)

    # Ex: "player_accepted", "player_rejected", "match_validated_manual",
    #     "match_validated_tracker", "draw_confirmed", "tournament_deleted",
    #     "tournament_updated", "player_deleted"
    action = Column(String(50), nullable=False, index=True)

    # Type de la cible : "player", "match", "tournament"
    target_type = Column(String(30), nullable=True)
    target_id = Column(String(36), nullable=True)

    # Données contextuelles (score, pseudo, etc.)
    details = Column(JSON, nullable=True)

    # IP du créateur pour audit de sécurité
    ip_address = Column(String(45), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
