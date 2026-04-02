from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.sql import text
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from .config import settings
from .utils.logger import logger


def _build_engine_kwargs() -> dict:
    """Construit les kwargs du moteur selon le type de base de données."""
    kwargs: dict = {"echo": settings.is_development}

    if "sqlite" in settings.DATABASE_URL:
        # SQLite ne supporte pas le pool de connexions standard
        kwargs["poolclass"] = NullPool
    else:
        # PostgreSQL / MySQL — pool complet
        kwargs.update({
            "pool_size": settings.DATABASE_POOL_SIZE,
            "max_overflow": settings.DATABASE_MAX_OVERFLOW,
            "pool_timeout": settings.DATABASE_POOL_TIMEOUT,
            "pool_recycle": settings.DATABASE_POOL_RECYCLE,
            "pool_pre_ping": True,
        })

    return kwargs


engine = create_async_engine(settings.DATABASE_URL, **_build_engine_kwargs())
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency FastAPI — fournit une session DB avec rollback automatique en cas d'erreur."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {str(e)}")
            await session.rollback()
            raise


async def init_db():
    """Crée toutes les tables au démarrage si elles n'existent pas."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise


async def close_db():
    """Ferme proprement toutes les connexions."""
    try:
        await engine.dispose()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database: {str(e)}")


async def check_db_health() -> bool:
    """Vérifie que la base de données répond."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return False
