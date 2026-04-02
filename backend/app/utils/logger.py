import logging
import sys
from datetime import datetime
from pathlib import Path

# Exposé pour le general_exception_handler sans import circulaire
settings_env = "development"


def setup_logging() -> logging.Logger:
    """Configure le système de logging pour l'application."""
    global settings_env

    # Import ici pour éviter les imports circulaires au niveau module
    try:
        from ..config import settings
        log_level = logging.DEBUG if settings.is_development else logging.INFO
        settings_env = settings.ENVIRONMENT
    except Exception:
        log_level = logging.DEBUG

    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)

    fmt = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    date_fmt = "%Y-%m-%d %H:%M:%S"
    formatter = logging.Formatter(fmt, date_fmt)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Éviter les handlers dupliqués si setup_logging est appelé plusieurs fois
    if root_logger.handlers:
        return logging.getLogger("dls_hub")

    # Console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Fichier général
    today = datetime.now().strftime("%Y%m%d")
    file_handler = logging.FileHandler(logs_dir / f"dls_hub_{today}.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    # Fichier erreurs uniquement
    error_handler = logging.FileHandler(logs_dir / f"errors_{today}.log", encoding="utf-8")
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    root_logger.addHandler(error_handler)

    # Réduire le bruit des libs externes
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)

    return logging.getLogger("dls_hub")


logger = setup_logging()
