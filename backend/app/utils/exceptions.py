from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from httpx import RequestError
from ..utils.logger import logger
from datetime import datetime, timezone
import traceback


class DLSHubException(Exception):
    def __init__(self, message: str, error_code: str = "INTERNAL_ERROR", status_code: int = 500):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(self.message)


class TournamentNotFoundError(DLSHubException):
    def __init__(self, tournament_id: str = None):
        msg = f"Tournoi {tournament_id} introuvable" if tournament_id else "Tournoi introuvable"
        super().__init__(msg, "TOURNAMENT_NOT_FOUND", 404)


class PlayerNotFoundError(DLSHubException):
    def __init__(self, player_id: str = None):
        msg = f"Joueur {player_id} introuvable" if player_id else "Joueur introuvable"
        super().__init__(msg, "PLAYER_NOT_FOUND", 404)


class MatchNotFoundError(DLSHubException):
    def __init__(self, match_id: str = None):
        msg = f"Match {match_id} introuvable" if match_id else "Match introuvable"
        super().__init__(msg, "MATCH_NOT_FOUND", 404)


class UnauthorizedAccessError(DLSHubException):
    def __init__(self, message: str = "Accès non autorisé"):
        super().__init__(message, "UNAUTHORIZED", 403)


class TrackerAPIError(DLSHubException):
    def __init__(self, message: str = "Erreur API Tracker"):
        super().__init__(message, "TRACKER_API_ERROR", 502)


class DatabaseError(DLSHubException):
    def __init__(self, message: str = "Erreur base de données"):
        super().__init__(message, "DATABASE_ERROR", 500)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def dls_hub_exception_handler(request: Request, exc: DLSHubException):
    logger.error(f"DLSHubException [{exc.error_code}]: {exc.message} — {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "timestamp": _now_iso(),
                "path": request.url.path,
            }
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error: {exc.errors()} — {request.url.path}")
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Données invalides",
                "details": exc.errors(),
                "timestamp": _now_iso(),
                "path": request.url.path,
            }
        },
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error: {str(exc)} — {request.url.path}")
    logger.error(traceback.format_exc())
    if isinstance(exc, IntegrityError):
        return JSONResponse(
            status_code=409,
            content={
                "error": {
                    "code": "INTEGRITY_ERROR",
                    "message": "Conflit de données",
                    "timestamp": _now_iso(),
                    "path": request.url.path,
                }
            },
        )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "DATABASE_ERROR",
                "message": "Erreur interne de la base de données",
                "timestamp": _now_iso(),
                "path": request.url.path,
            }
        },
    )


async def httpx_exception_handler(request: Request, exc: RequestError):
    logger.error(f"HTTP request error: {str(exc)} — {request.url.path}")
    return JSONResponse(
        status_code=502,
        content={
            "error": {
                "code": "EXTERNAL_API_ERROR",
                "message": "Erreur de communication avec l'API externe",
                "timestamp": _now_iso(),
                "path": request.url.path,
            }
        },
    )


async def general_exception_handler(request: Request, exc: Exception):
    # Ne pas intercepter les HTTPException de FastAPI
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        raise exc

    logger.error(f"Unhandled exception: {str(exc)} — {request.url.path}")
    logger.error(traceback.format_exc())

    from .logger import settings_env
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Erreur interne du serveur" if settings_env == "production" else str(exc),
                "timestamp": _now_iso(),
                "path": request.url.path,
            }
        },
    )
