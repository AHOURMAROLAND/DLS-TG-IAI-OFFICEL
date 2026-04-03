import httpx
import asyncio
from ..config import settings
from ..utils.logger import logger

# Headers obligatoires — simule une requête depuis le site tracker.ftgames.com
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

# Délai entre appels pour éviter le blocage
TRACKER_REQUEST_DELAY = 0.3

# Mapping division DLL (valeur Div dans l'API → label)
# Basé sur les données réelles : Div=3 correspond à Division III dans le tracker
DIVISION_MAP = {
    1: "Elite Division I",
    2: "Elite Division II",
    3: "Elite Division III",
    4: "Division I",
    5: "Division II",
    6: "Division III",
}

# Type de but (Ty) → label
GOAL_TYPE_MAP = {
    2:     "Pied",
    3:     "Pénalty",
    18:    "Tête",
    1026:  "Coup franc",
    16387: "Frappe",
    16642: "Volée",
    16451: "Retourné",
    4610:  "Lob",
    34:    "Frappe lointaine",
    49155: "Reprise",
    8322:  "Tir croisé",
}


async def fetch_player_data(dll_idx: str) -> dict:
    """
    Récupère les données FTGames pour un joueur.
    Lève ValueError si l'idx est invalide/introuvable.
    Lève ConnectionError si le tracker est indisponible.
    """
    await asyncio.sleep(TRACKER_REQUEST_DELAY)

    payload = {
        "queryType": "AWSGetUserData",
        "queryData": {"TId": dll_idx},
        "analytics": {"idx": None},
    }

    last_error = None

    for attempt in range(settings.TRACKER_RETRY_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=settings.TRACKER_TIMEOUT) as client:
                response = await client.post(
                    settings.TRACKER_API_URL,
                    json=payload,
                    headers=HEADERS,
                )
                response.raise_for_status()
                data = response.json()

                # Vérifier que l'idx existe vraiment
                if not data.get("TNm"):
                    raise ValueError(
                        f"Identifiant DLS '{dll_idx}' introuvable sur le tracker FTGames"
                    )

                logger.info(
                    f"Tracker: données récupérées pour {dll_idx} "
                    f"— équipe: {data.get('TNm')} div: {data.get('Div')}"
                )
                return data

        except httpx.TimeoutException:
            last_error = f"Timeout (tentative {attempt + 1})"
            logger.warning(f"Tracker: timeout pour {dll_idx} (tentative {attempt + 1})")
            if attempt < settings.TRACKER_RETRY_ATTEMPTS - 1:
                await asyncio.sleep(1.5 * (attempt + 1))

        except httpx.ConnectError:
            last_error = "Connexion impossible"
            logger.warning(f"Tracker: connexion impossible pour {dll_idx}")
            break

        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            logger.warning(f"Tracker: HTTP {status} pour {dll_idx}")
            if status == 404:
                raise ValueError(
                    f"Identifiant DLS '{dll_idx}' introuvable sur le tracker FTGames"
                )
            last_error = f"Erreur HTTP {status}"
            if attempt < settings.TRACKER_RETRY_ATTEMPTS - 1:
                await asyncio.sleep(1.0)

        except ValueError:
            raise  # Re-lever sans retry

        except Exception as e:
            last_error = str(e)
            logger.warning(f"Tracker: erreur inattendue pour {dll_idx} — {e}")
            break

    raise ConnectionError(
        f"Le tracker FTGames est temporairement indisponible. "
        f"Réessaie dans quelques instants. ({last_error})"
    )


def parse_player_info(data: dict) -> dict:
    """
    Extrait les infos de base d'un joueur depuis la réponse tracker réelle.

    Structure réelle confirmée :
    - TNm : nom équipe
    - Div : division (entier 1-6)
    - Pla : matchs joués
    - Los : défaites
    - Won : victoires (parfois absent — calculé depuis Pla - Los si manquant)
    """
    played = data.get("Pla", 0) or 0
    lost = data.get("Los", 0) or 0
    # Won peut être absent dans certaines réponses
    won = data.get("Won", played - lost) or 0

    return {
        "team_name": data.get("TNm", ""),
        "division": data.get("Div", 0),
        "played": played,
        "won": won,
        "lost": lost,
        "win_rate": round((won / played * 100), 1) if played > 0 else 0.0,
    }


def _parse_goal(goal: dict) -> dict:
    """Parse un objet but depuis UGo ou OGo."""
    ty = goal.get("Ty", 2)
    return {
        "scorer": goal.get("scorer", ""),
        "assister": goal.get("assister", ""),
        "minute": goal.get("Ti", 0),
        "type": GOAL_TYPE_MAP.get(ty, "Pied"),
        "type_code": ty,
    }


def find_recent_matches_vs_opponent(
    data: dict, opponent_idx: str, limit: int = 3
) -> list:
    """
    Filtre les matchs contre un adversaire spécifique (OId == opponent_idx),
    trie par MTm décroissant, retourne les `limit` plus récents.

    Structure réelle d'un match :
    - OId    : idx adversaire
    - TNL    : nom équipe adverse
    - MTm    : timestamp Unix (string)
    - Hom    : true = joueur est à domicile
    - HSc    : score domicile
    - ASc    : score extérieur
    - Min    : minutes jouées (> 90 = prolongations)
    - GCR    : code penalties (> 0 = tirs au but)
    - UGo    : buts du joueur [{scorer, Ti, Ty, assister}]
    - OGo    : buts de l'adversaire
    - MOTM   : nom du joueur MOTM (string)
    - URe    : cartons du joueur [{Ti, Ye, player}]
    - ORe    : cartons adversaire
    """
    matches = data.get("Matches", {}).get("results", [])

    # Filtrer par adversaire
    filtered = [
        m for m in matches
        if str(m.get("OId", "")).lower() == str(opponent_idx).lower()
    ]

    # Trier par timestamp décroissant (MTm est une string dans l'API)
    filtered.sort(key=lambda x: int(x.get("MTm", 0)), reverse=True)

    result = []
    for m in filtered[:limit]:
        ts = int(m.get("MTm", 0))
        from datetime import datetime as dt
        heure = dt.fromtimestamp(ts).strftime("%d/%m/%Y %H:%M") if ts else "?"

        is_home = m.get("Hom", True)
        hsc = m.get("HSc", 0) or 0
        asc = m.get("ASc", 0) or 0
        minutes = m.get("Min", 90) or 90
        gcr = m.get("GCR", 0) or 0

        # Scores du point de vue du joueur (home_player dans notre tournoi)
        if is_home:
            player_score = hsc
            opp_score = asc
            player_goals_raw = m.get("UGo", []) or []
            opp_goals_raw = m.get("OGo", []) or []
        else:
            player_score = asc
            opp_score = hsc
            player_goals_raw = m.get("UGo", []) or []
            opp_goals_raw = m.get("OGo", []) or []

        player_goals = [_parse_goal(g) for g in player_goals_raw if isinstance(g, dict)]
        opp_goals = [_parse_goal(g) for g in opp_goals_raw if isinstance(g, dict)]

        # Cartons
        user_cards = m.get("URe", []) or []
        opp_cards = m.get("ORe", []) or []

        result.append({
            "timestamp": ts,
            "heure": heure,
            "home_score": player_score,
            "away_score": opp_score,
            "home_scorers": player_goals,
            "away_scorers": opp_goals,
            "motm": m.get("MOTM", ""),
            "minutes": minutes,
            "gcr": gcr,
            "opponent_team": m.get("TNL", ""),
            "opponent_idx": m.get("OId", ""),
            # Règles de score
            "extra_time": minutes > 90,
            "penalties": gcr > 0,
            # Stats supplémentaires
            "user_possession": m.get("UserPossession", 0),
            "opp_possession": m.get("OpponentPossession", 0),
            "user_shots": m.get("UserShots", 0),
            "opp_shots": m.get("OpponentShots", 0),
            "user_shots_on_target": m.get("UserShotsOnTarget", 0),
            "opp_shots_on_target": m.get("OpponentShotsOnTarget", 0),
            "user_cards": user_cards,
            "opp_cards": opp_cards,
        })

    return result


def get_all_recent_matches(data: dict, limit: int = 10) -> list:
    """
    Retourne les derniers matchs du joueur (tous adversaires confondus).
    Utilisé pour afficher l'historique dans le profil.
    """
    matches = data.get("Matches", {}).get("results", [])
    matches_sorted = sorted(matches, key=lambda x: int(x.get("MTm", 0)), reverse=True)

    result = []
    for m in matches_sorted[:limit]:
        ts = int(m.get("MTm", 0))
        from datetime import datetime as dt
        heure = dt.fromtimestamp(ts).strftime("%d/%m/%Y %H:%M") if ts else "?"

        is_home = m.get("Hom", True)
        hsc = m.get("HSc", 0) or 0
        asc = m.get("ASc", 0) or 0
        minutes = m.get("Min", 90) or 90
        gcr = m.get("GCR", 0) or 0

        if is_home:
            player_score, opp_score = hsc, asc
        else:
            player_score, opp_score = asc, hsc

        result.append({
            "timestamp": ts,
            "heure": heure,
            "player_score": player_score,
            "opp_score": opp_score,
            "opponent_team": m.get("TNL", ""),
            "opponent_idx": m.get("OId", ""),
            "motm": m.get("MOTM", ""),
            "minutes": minutes,
            "gcr": gcr,
            "extra_time": minutes > 90,
            "penalties": gcr > 0,
            "is_home": is_home,
        })

    return result
