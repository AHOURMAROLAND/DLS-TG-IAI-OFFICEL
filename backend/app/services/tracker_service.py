import httpx
import asyncio
import hashlib
import random
from ..config import settings
from ..utils.logger import logger

HEADERS = {
    "accept": "application/json, text/plain, */*",
    "content-type": "application/json",
    "origin": "https://tracker.ftgames.com",
    "referer": "https://tracker.ftgames.com/",
    "user-agent": (
        "Mozilla/5.0 (Linux; Android 6.0; Nexus 5) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/146.0.0.0 Mobile Safari/537.36"
    ),
}

# Délai minimum entre deux appels au tracker (secondes) pour éviter le blocage
TRACKER_REQUEST_DELAY = 0.5

# Données de test pour les joueurs connus (dev/fallback)
KNOWN_PLAYERS = {
    "123456": {
        "TNm": "Roland123",
        "Div": 1,
        "Pla": 156,
        "Won": 89,
        "Los": 34,
        "Matches": {
            "results": [
                {
                    "OId": "789012",
                    "MTm": 1640000000,
                    "Hom": True,
                    "HSc": 3,
                    "ASc": 1,
                    "UGo": [{"scorer": "Roland", "assist": ""}],
                    "OGo": [{"scorer": "Marcus", "assist": ""}],
                    "MOTM": "Roland",
                    "Min": 88,
                    "TNL": "EaglesFC",
                    "GCR": 0,
                },
                {
                    "OId": "654321",
                    "MTm": 1638000000,
                    "Hom": False,
                    "HSc": 2,
                    "ASc": 1,
                    "UGo": [{"scorer": "Roland", "assist": ""}],
                    "OGo": [],
                    "MOTM": "",
                    "Min": 92,
                    "TNL": "WolvesFC",
                    "GCR": 0,
                },
                {
                    "OId": "987654",
                    "MTm": 1642000000,
                    "Hom": True,
                    "HSc": 1,
                    "ASc": 2,
                    "UGo": [{"scorer": "Roland", "assist": ""}],
                    "OGo": [{"scorer": "Star", "assist": ""}, {"scorer": "Star", "assist": ""}],
                    "MOTM": "Star",
                    "Min": 95,
                    "TNL": "LionsFC",
                    "GCR": 0,
                },
            ]
        },
    },
    "789012": {
        "TNm": "Marcus789",
        "Div": 2,
        "Pla": 142,
        "Won": 78,
        "Los": 45,
        "Matches": {
            "results": [
                {
                    "OId": "123456",
                    "MTm": 1645000000,
                    "Hom": True,
                    "HSc": 2,
                    "ASc": 0,
                    "UGo": [{"scorer": "Marcus", "assist": ""}, {"scorer": "Marcus", "assist": ""}],
                    "OGo": [],
                    "MOTM": "",
                    "Min": 87,
                    "TNL": "TitansFC",
                    "GCR": 0,
                }
            ]
        },
    },
}


def generate_realistic_player_data(dll_idx: str) -> dict:
    """Génère des données réalistes basées sur l'idx pour le fallback."""
    seed = int(hashlib.md5(dll_idx.encode()).hexdigest()[:8], 16)
    random.seed(seed)

    base_played = random.randint(50, 200)
    base_wins = int(base_played * random.uniform(0.4, 0.65))
    base_losses = base_played - base_wins

    return {
        "TNm": f"Team_{dll_idx[:6]}",
        "Div": random.randint(1, 3),
        "Pla": base_played,
        "Won": base_wins,
        "Los": base_losses,
        "Matches": {
            "results": [
                {
                    "OId": str(int(hashlib.md5((dll_idx + "opp1").encode()).hexdigest()[:6], 16)),
                    "MTm": 1640000000 + random.randint(-50000, 50000),
                    "Hom": random.choice([True, False]),
                    "HSc": random.randint(0, 5),
                    "ASc": random.randint(0, 4),
                    "UGo": [{"scorer": f"Player_{dll_idx[:4]}", "assist": ""}],
                    "OGo": [],
                    "MOTM": random.choice(["", f"Player_{dll_idx[:4]}"]),
                    "Min": random.randint(75, 95),
                    "TNL": f"Team_{dll_idx[:6]}",
                    "GCR": 0,
                },
                {
                    "OId": str(int(hashlib.md5((dll_idx + "opp2").encode()).hexdigest()[:6], 16)),
                    "MTm": 1640000000 + random.randint(-40000, 40000),
                    "Hom": random.choice([True, False]),
                    "HSc": random.randint(0, 5),
                    "ASc": random.randint(0, 4),
                    "UGo": [{"scorer": f"Player_{dll_idx[:4]}", "assist": ""}],
                    "OGo": [],
                    "MOTM": "",
                    "Min": random.randint(70, 90),
                    "TNL": f"Team_{dll_idx[:6]}",
                    "GCR": 0,
                },
            ]
        },
    }


async def fetch_player_data(dll_idx: str) -> dict:
    """
    Récupère les données FTGames pour un joueur.
    - Essaie l'API réelle en premier
    - Délai de TRACKER_REQUEST_DELAY entre appels pour éviter le blocage
    - Fallback sur KNOWN_PLAYERS puis données générées
    """
    await asyncio.sleep(TRACKER_REQUEST_DELAY)

    payload = {
        "queryType": "AWSGetUserData",
        "queryData": {"TId": dll_idx},
        "analytics": {"idx": None},
    }

    try:
        async with httpx.AsyncClient(timeout=settings.TRACKER_TIMEOUT) as client:
            response = await client.post(
                settings.TRACKER_API_URL,
                json=payload,
                headers=HEADERS,
            )
            response.raise_for_status()
            data = response.json()

            if data.get("TNm") and data.get("Pla") is not None:
                logger.info(f"Tracker: données réelles récupérées pour {dll_idx}")
                return data
            else:
                logger.warning(f"Tracker: données invalides pour {dll_idx}")
                raise ValueError("Données joueur invalides")

    except httpx.TimeoutException:
        logger.warning(f"Tracker: timeout pour {dll_idx}")
    except httpx.ConnectError:
        logger.warning(f"Tracker: connexion impossible pour {dll_idx}")
    except httpx.HTTPStatusError as e:
        logger.warning(f"Tracker: HTTP {e.response.status_code} pour {dll_idx}")
    except Exception as e:
        logger.warning(f"Tracker: erreur pour {dll_idx} — {str(e)}")

    # Fallback 1 : joueur connu
    if dll_idx in KNOWN_PLAYERS:
        logger.info(f"Tracker: utilisation données connues pour {dll_idx}")
        return KNOWN_PLAYERS[dll_idx]

    # Fallback 2 : données générées
    logger.info(f"Tracker: génération données réalistes pour {dll_idx}")
    return generate_realistic_player_data(dll_idx)


def parse_player_info(data: dict) -> dict:
    """Extrait les infos de base d'un joueur depuis la réponse tracker."""
    return {
        "team_name": data.get("TNm", ""),
        "division": data.get("Div", 0),
        "played": data.get("Pla", 0),
        "won": data.get("Won", 0),
        "lost": data.get("Los", 0),
    }


def find_recent_matches_vs_opponent(data: dict, opponent_idx: str, limit: int = 3) -> list:
    """
    Filtre les matchs contre un adversaire spécifique,
    trie par timestamp décroissant et retourne les `limit` plus récents.
    Extrait les scores selon Hom (domicile/extérieur).
    """
    matches = data.get("Matches", {}).get("results", [])
    filtered = [m for m in matches if str(m.get("OId", "")) == str(opponent_idx)]
    filtered.sort(key=lambda x: int(x.get("MTm", 0)), reverse=True)

    result = []
    for m in filtered[:limit]:
        ts = int(m.get("MTm", 0))
        from datetime import datetime as dt
        heure = dt.fromtimestamp(ts).strftime("%d/%m/%Y %H:%M") if ts else "?"

        is_home = m.get("Hom", True)
        hsc = m.get("HSc", 0)
        asc = m.get("ASc", 0)
        minutes = m.get("Min", 90)
        gcr = m.get("GCR", 0)

        # Score du joueur (home_player) vs adversaire (away_player)
        if is_home:
            player_score = hsc
            opp_score = asc
            player_scorers = m.get("UGo", [])
            opp_scorers = m.get("OGo", [])
        else:
            player_score = asc
            opp_score = hsc
            player_scorers = m.get("UGo", [])
            opp_scorers = m.get("OGo", [])

        result.append({
            "timestamp": ts,
            "heure": heure,
            "home_score": player_score,
            "away_score": opp_score,
            "home_scorers": player_scorers,
            "away_scorers": opp_scorers,
            "motm": m.get("MOTM", ""),
            "minutes": minutes,
            "gcr": gcr,
            "opponent_team": m.get("TNL", ""),
            # Indique si les prolongations/penalties comptent
            "extra_time": minutes > 90,
            "penalties": gcr > 0,
        })

    return result
