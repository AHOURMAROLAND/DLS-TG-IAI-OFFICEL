from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from ..config import settings
from ..utils.logger import logger
import time

# Rate limiting
limiter = Limiter(key_func=get_remote_address)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Ajoute les headers de sécurité aux réponses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logue chaque requête avec son temps de traitement."""

    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        elapsed = time.time() - start
        logger.info(
            f"{request.method} {request.url.path} → {response.status_code} "
            f"({elapsed:.3f}s)"
        )
        response.headers["X-Process-Time"] = f"{elapsed:.4f}"
        return response


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """Rejette les requêtes trop volumineuses."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.MAX_UPLOAD_SIZE:
            client = request.client.host if request.client else "unknown"
            logger.warning(f"Request too large: {content_length} bytes from {client}")
            raise HTTPException(
                status_code=413,
                detail=f"Requête trop volumineuse. Max : {settings.MAX_UPLOAD_SIZE} bytes",
            )
        return await call_next(request)


def setup_security_middleware(app) -> None:
    """Configure tous les middlewares de sécurité."""

    # CORS — PATCH et DELETE inclus pour TournamentSettings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Trusted hosts + HTTPS redirect en production uniquement
    if settings.is_production:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["localhost", "127.0.0.1", "*.railway.app", "*.onrender.com", "*.vercel.app"],
        )
        app.add_middleware(HTTPSRedirectMiddleware)

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RequestSizeMiddleware)

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    logger.info("Security middleware configured")
