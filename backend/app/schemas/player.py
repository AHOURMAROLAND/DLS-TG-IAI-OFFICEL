from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID

class PlayerRegister(BaseModel):
    pseudo: str = Field(..., min_length=2, max_length=50)
    dll_idx: str = Field(..., min_length=8, max_length=20)
    session_token: str

class PlayerVerify(BaseModel):
    dll_idx: str

class PlayerOut(BaseModel):
    id: UUID
    pseudo: str
    dll_idx: str
    team_name: str
    team_logo_url: Optional[str]
    dll_division: int
    dll_played: int
    dll_won: int
    dll_lost: int
    status: str
    group_id: Optional[str]
    is_creator: bool
    registered_at: Optional[str] = None

    class Config:
        from_attributes = True

class PlayerDecision(BaseModel):
    player_id: UUID
    decision: str

class AddPlayerManualRequest(BaseModel):
    """Payload pour l'ajout manuel d'un participant par le créateur (v2)."""
    dll_idx: str = Field(..., min_length=1, max_length=20)
    pseudo: str = Field(..., min_length=1, max_length=50)
    user_id: Optional[str] = None  # UUID du user existant, null = invité

class UserSearchResult(BaseModel):
    """Résultat de recherche d'utilisateur par pseudo (v2)."""
    id: str
    pseudo: str
