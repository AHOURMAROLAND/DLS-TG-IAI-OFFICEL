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
import hashlib
from typing import Dict

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Ajoute les headers de sécurité aux réponses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        return response

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware pour logger les requêtes"""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Logger la requête
        logger.info(
            f"Request: {request.method} {request.url.path} - "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )
        
        response = await call_next(request)
        
        # Calculer le temps de traitement
        process_time = time.time() - start_time
        
        # Logger la réponse
        logger.info(
            f"Response: {response.status_code} - "
            f"Time: {process_time:.4f}s - "
            f"Path: {request.url.path}"
        )
        
        response.headers["X-Process-Time"] = str(process_time)
        return response

class RequestSizeMiddleware(BaseHTTPMiddleware):
    """Middleware pour limiter la taille des requêtes"""
    
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        
        if content_length and int(content_length) > settings.MAX_UPLOAD_SIZE:
            logger.warning(f"Request too large: {content_length} bytes from {request.client.host}")
            raise HTTPException(
                status_code=413,
                detail=f"Request too large. Max size: {settings.MAX_UPLOAD_SIZE} bytes"
            )
        
        return await call_next(request)

class HealthCheckMiddleware(BaseHTTPMiddleware):
    """Middleware pour les health checks"""
    
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            from ..database import check_db_health
            
            db_healthy = await check_db_health()
            
            return JSONResponse({
                "status": "healthy" if db_healthy else "unhealthy",
                "database": "connected" if db_healthy else "disconnected",
                "version": settings.VERSION,
                "environment": settings.ENVIRONMENT
            })
        
        return await call_next(request)

def setup_security_middleware(app):
    """Configure tous les middlewares de sécurité"""
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
    
    # Trusted hosts (production uniquement)
    if settings.is_production:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["localhost", "127.0.0.1", "*.yourdomain.com"]
        )
        app.add_middleware(HTTPSRedirectMiddleware)
    
    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)
    
    # Request logging
    app.add_middleware(RequestLoggingMiddleware)
    
    # Request size limiting
    app.add_middleware(RequestSizeMiddleware)
    
    # Health check
    app.add_middleware(HealthCheckMiddleware)
    
    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    logger.info("Security middleware configured")

# Rate limit decorators
@limiter.limit("100/minute")
async def rate_limit_endpoint(request: Request):
    """Decorator pour limiter les endpoints"""
    pass

@limiter.limit("10/minute") 
async def strict_rate_limit_endpoint(request: Request):
    """Decorator pour limiter strictement les endpoints sensibles"""
    pass
