from fastapi import APIRouter, HTTPException
from ..services.tracker_service import fetch_player_data, parse_player_info

router = APIRouter()

@router.get("/verify/{dll_idx}")
async def verify_player(dll_idx: str):
    try:
        data = await fetch_player_data(dll_idx)
        return parse_player_info(data)
    except Exception as e:
        raise HTTPException(400, f"Erreur tracker: {str(e)}")

@router.get("/full/{dll_idx}")
async def get_full_data(dll_idx: str):
    try:
        return await fetch_player_data(dll_idx)
    except Exception as e:
        raise HTTPException(400, f"Erreur tracker: {str(e)}")

@router.get("/matches/{dll_idx}")
async def get_player_matches(dll_idx: str, opponent_idx: str = None):
    """Récupère les 3 derniers matchs entre deux joueurs"""
    try:
        data = await fetch_player_data(dll_idx)
        matches = data.get("Matches", {}).get("results", [])
        
        # Filtrer par adversaire si spécifié
        if opponent_idx:
            matches = [m for m in matches if m.get("OId") == opponent_idx]
        
        # Trier par timestamp décroissant et prendre les 3 premiers
        matches.sort(key=lambda x: int(x.get("MTm", 0)), reverse=True)
        recent_matches = matches[:3]
        
        return {
            "matches": recent_matches,
            "total_count": len(matches)
        }
    except Exception as e:
        raise HTTPException(400, f"Erreur récupération matchs: {str(e)}")

@router.get("/stats/{dll_idx}")
async def get_player_stats(dll_idx: str):
    """Récupère les statistiques complètes du joueur"""
    try:
        data = await fetch_player_data(dll_idx)
        return {
            "team_name": data.get("TNm", ""),
            "division": data.get("Div", 0),
            "played": data.get("Pla", 0),
            "won": data.get("Won", 0),
            "lost": data.get("Los", 0),
            "recent_form": {
                "last_5": data.get("Matches", {}).get("results", [])[:5]
            }
        }
    except Exception as e:
        raise HTTPException(400, f"Erreur récupération stats: {str(e)}")
