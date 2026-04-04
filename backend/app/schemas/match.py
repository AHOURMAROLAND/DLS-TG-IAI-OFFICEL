from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID


class MatchOut(BaseModel):
    id: UUID
    home_player_id: UUID
    away_player_id: UUID
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    home_score_agg: Optional[int] = None
    away_score_agg: Optional[int] = None
    is_manual: bool
    phase: str
    round_number: int
    group_id: Optional[str] = None
    status: str
    motm: Optional[str] = None
    home_scorers: Optional[List] = []
    away_scorers: Optional[List] = []

    class Config:
        from_attributes = True


class MatchValidate(BaseModel):
    match_id: UUID
    dll_match_timestamp: Optional[str] = None
    home_score: int
    away_score: int
    home_scorers: Optional[List] = []
    away_scorers: Optional[List] = []
    motm: Optional[str] = ""
    is_manual: bool = False
    # Minutes jouées — utilisé pour appliquer la règle des 90 min
    minutes_played: Optional[int] = None


class DrawRequest(BaseModel):
    pass


class DrawConfirmRequest(BaseModel):
    draw: dict
