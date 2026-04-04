from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from enum import Enum
from base64 import b64encode


class TournamentType(str, Enum):
    ELIMINATION = "elimination"
    GROUPS = "groups"
    CHAMPIONSHIP = "championship"


class EliminationType(str, Enum):
    SINGLE = "single"
    DOUBLE = "double"


class ChampionshipLegs(str, Enum):
    SINGLE = "single"
    DOUBLE = "double"


class TournamentOut(BaseModel):
    id: str
    slug: str
    name: str
    logo_url: Optional[str] = None
    tournament_type: TournamentType
    elimination_type: EliminationType
    championship_legs: ChampionshipLegs
    max_teams: int
    group_count: int
    teams_per_group: int
    qualified_per_group: int
    elimination_round: str
    status: str
    creator_id: str  # ID de l'utilisateur créateur (pas de token exposé)

    class Config:
        from_attributes = True

    @classmethod
    def from_db(cls, tournament) -> "TournamentOut":
        logo_url = None
        if tournament.logo_data and tournament.logo_content_type:
            b64 = b64encode(tournament.logo_data).decode("utf-8")
            logo_url = f"data:{tournament.logo_content_type};base64,{b64}"

        def _val(v):
            return v.value if hasattr(v, "value") else (v or "")

        return cls(
            id=str(tournament.id),
            slug=tournament.slug,
            name=tournament.name,
            logo_url=logo_url,
            tournament_type=tournament.tournament_type,
            elimination_type=tournament.elimination_type,
            championship_legs=tournament.championship_legs,
            max_teams=tournament.max_teams,
            group_count=tournament.group_count or 0,
            teams_per_group=tournament.teams_per_group or 0,
            qualified_per_group=tournament.qualified_per_group or 2,
            elimination_round=tournament.elimination_round or "",
            status=_val(tournament.status),
            creator_id=str(tournament.creator_id),
        )
