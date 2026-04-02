import uuid
import enum
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Enum, LargeBinary
from sqlalchemy.sql import func
from ..database import Base


class PlayerStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class Player(Base):
    __tablename__ = "players"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tournament_id = Column(String(36), ForeignKey("tournaments.id"), nullable=False)
    session_token = Column(String(64), nullable=False)
    pseudo = Column(String(50), nullable=False)
    dll_idx = Column(String(20), nullable=False)
    team_name = Column(String(100), nullable=False)

    # Logo stocké en base (cohérent avec le stockage du logo tournoi)
    logo_data = Column(LargeBinary, nullable=True)
    logo_content_type = Column(String(50), nullable=True)
    # Conservé pour compatibilité ascendante (Cloudinary URL si migration future)
    team_logo_url = Column(String(255), nullable=True)

    dll_division = Column(Integer, default=0)
    dll_played = Column(Integer, default=0)
    dll_won = Column(Integer, default=0)
    dll_lost = Column(Integer, default=0)

    status = Column(Enum(PlayerStatus), default=PlayerStatus.PENDING)
    group_id = Column(String(5), nullable=True)
    is_creator = Column(Boolean, default=False)

    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
