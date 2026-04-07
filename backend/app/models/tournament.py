import uuid
import enum
import sqlalchemy as sa
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum, LargeBinary, ForeignKey
from sqlalchemy.sql import func
from ..database import Base


class TournamentType(str, enum.Enum):
    ELIMINATION = "elimination"
    GROUPS = "groups"
    CHAMPIONSHIP = "championship"


class EliminationType(str, enum.Enum):
    SINGLE = "single"
    DOUBLE = "double"


class ChampionshipLegs(str, enum.Enum):
    SINGLE = "single"
    DOUBLE = "double"


class TournamentStatus(str, enum.Enum):
    DRAFT = "draft"
    REGISTRATION = "registration"
    DRAW = "draw"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"


class TournamentVisibility(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String(12), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    logo_data = Column(LargeBinary, nullable=True)
    logo_content_type = Column(String(50), nullable=True)
    tournament_type = Column(Enum(TournamentType), nullable=False)
    elimination_type = Column(Enum(EliminationType), default=EliminationType.SINGLE)
    championship_legs = Column(Enum(ChampionshipLegs), default=ChampionshipLegs.SINGLE)
    max_teams = Column(Integer, nullable=False)
    group_count = Column(Integer, default=0)
    teams_per_group = Column(Integer, default=0)
    qualified_per_group = Column(Integer, default=2)
    elimination_round = Column(String(10), default="")
    status = Column(Enum(TournamentStatus), default=TournamentStatus.REGISTRATION)
    # Visibilité : "public" (page d'accueil) ou "private" (lien d'invitation uniquement)
    visibility = Column(sa.String(10), default="public", nullable=True)
    # Lié à l'utilisateur créateur
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
