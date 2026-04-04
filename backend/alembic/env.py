from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys, os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import Base
from app.models import Tournament, Player, Match

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_sync_url() -> str:
    """
    Récupère DATABASE_URL et le convertit en URL synchrone pour Alembic.
    asyncpg → psycopg2  (pour les migrations)
    """
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        # Fallback : lire depuis alembic.ini (dev local SQLite)
        return config.get_main_option("sqlalchemy.url", "sqlite:///./dlshub.db")

    # Render fournit postgresql:// ou postgresql+asyncpg://
    # Alembic a besoin du driver synchrone psycopg2
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    url = url.replace("postgresql://", "postgresql+psycopg2://")
    return url


def run_migrations_offline():
    url = get_sync_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    sync_url = get_sync_url()
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = sync_url

    connectable = engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
