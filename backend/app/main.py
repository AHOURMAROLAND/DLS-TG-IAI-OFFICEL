from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio

from .routers import tournaments, players, matches, tracker, auth, og
from .websocket.manager import manager
from .middleware.security import setup_security_middleware, limiter
from .utils.exceptions import (
    DLSHubException,
    dls_hub_exception_handler,
    validation_exception_handler,
    database_exception_handler,
    httpx_exception_handler,
    general_exception_handler,
)
from .utils.logger import logger
from .config import settings
from .database import init_db, close_db, AsyncSessionLocal
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler


async def _session_cleanup_task():
    """
    Tâche de fond : nettoie les sessions expirées toutes les 24h.
    Supprime les joueurs PENDING dont la session a > 30 jours.
    """
    from .services.session_service import cleanup_expired_sessions
    while True:
        try:
            await asyncio.sleep(24 * 3600)  # toutes les 24h
            async with AsyncSessionLocal() as db:
                deleted = await cleanup_expired_sessions(db)
                if deleted:
                    logger.info(f"Session cleanup: {deleted} expired pending players removed")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Session cleanup error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    try:
        await init_db()
        logger.info("Application startup completed")
    except Exception as e:
        logger.error(f"Application startup failed: {str(e)}")
        raise

    # Lancer la tâche de nettoyage des sessions en arrière-plan
    cleanup_task = asyncio.create_task(_session_cleanup_task())

    yield

    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    logger.info("Shutting down application...")
    try:
        await close_db()
        logger.info("Application shutdown completed")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Plateforme de gestion de tournois Dream League Soccer 26",
    version=settings.VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# Middlewares de sécurité (CORS, headers, rate limiting, logging)
setup_security_middleware(app)

# Handlers d'exceptions
app.add_exception_handler(DLSHubException, dls_hub_exception_handler)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(ValueError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Routes API
app.include_router(tournaments.router, prefix="/api/tournaments", tags=["Tournois"])
app.include_router(players.router, prefix="/api/players", tags=["Joueurs"])
app.include_router(matches.router, prefix="/api/matches", tags=["Matchs"])
app.include_router(tracker.router, prefix="/api/tracker", tags=["Tracker DLS"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(og.router, prefix="/og", tags=["Open Graph"])


@app.websocket("/ws/{tournament_id}")
async def websocket_endpoint(websocket: WebSocket, tournament_id: str):
    """
    WebSocket par tournoi.
    Les clients s'abonnent avec l'ID du tournoi pour recevoir les mises à jour live.
    """
    await manager.connect(websocket, tournament_id)
    logger.info(f"WebSocket connecté — tournoi: {tournament_id}")
    try:
        while True:
            # Maintenir la connexion ouverte, on ne traite pas les messages entrants
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, tournament_id)
        logger.info(f"WebSocket déconnecté — tournoi: {tournament_id}")
    except Exception as e:
        logger.error(f"WebSocket erreur — tournoi {tournament_id}: {str(e)}")
        manager.disconnect(websocket, tournament_id)


@app.get("/")
@limiter.limit("100/minute")
async def root(request: Request):
    return {
        "message": f"{settings.PROJECT_NAME} API",
        "version": settings.VERSION,
        "status": "ok",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health")
@limiter.limit("10/minute")
async def health_check(request: Request):
    from .database import check_db_health
    db_healthy = await check_db_health()
    return JSONResponse({
        "status": "healthy" if db_healthy else "unhealthy",
        "database": "connected" if db_healthy else "disconnected",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    })
