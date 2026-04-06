import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean
from sqlalchemy.sql import func
from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pseudo = Column(String(30), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    # Identifiant FTGames — associé au compte (v2)
    dll_idx = Column(String(20), nullable=True, unique=True)
    dll_team_name = Column(String(100), nullable=True)
    dll_division = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
