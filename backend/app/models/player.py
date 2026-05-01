import uuid
import enum
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Enum, LargeBinary, Index
from sqlalchemy.sql import func
from ..database import Base


class PlayerStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class Player(Base):
    __tablename__ = "players"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tournament_id = Column(String(36), ForeignKey("tournaments.id"), nullable=False, index=True)
    # Lié à l'utilisateur inscrit (nullable pour les invités futurs)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    pseudo = Column(String(50), nullable=False)
    dll_idx = Column(String(20), nullable=False)
    team_name = Column(String(100), nullable=False)

    logo_data = Column(LargeBinary, nullable=True)
    logo_content_type = Column(String(50), nullable=True)
    team_logo_url = Column(String(255), nullable=True)

    dll_division = Column(Integer, default=0)
    dll_played = Column(Integer, default=0)
    dll_won = Column(Integer, default=0)
    dll_lost = Column(Integer, default=0)

    status = Column(Enum(PlayerStatus), default=PlayerStatus.PENDING, index=True)
    group_id = Column(String(5), nullable=True)
    is_creator = Column(Boolean, default=False)

    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Index composite pour les requêtes fréquentes (tournament + status)
    __table_args__ = (
        Index('ix_players_tournament_status', 'tournament_id', 'status'),
    )
