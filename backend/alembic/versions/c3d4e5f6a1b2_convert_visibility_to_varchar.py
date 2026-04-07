"""convert_visibility_to_varchar

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-04-07 00:00:00.000000

Convertit la colonne visibility de type enum PostgreSQL vers VARCHAR.
La migration précédente avait créé un type enum tournamentvisibility
mais le modèle SQLAlchemy utilise maintenant String(10).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect

revision = 'c3d4e5f6a1b2'
down_revision = 'b2c3d4e5f6a1'
branch_labels = None
depends_on = None


def _col_type(table: str, col: str) -> str:
    """Retourne le type de données d'une colonne."""
    bind = op.get_bind()
    result = bind.execute(text(
        "SELECT data_type, udt_name FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": col}).fetchone()
    if result:
        return result[1]  # udt_name (ex: 'tournamentvisibility', 'varchar')
    return ""


def upgrade():
    col_type = _col_type("tournaments", "visibility")

    if col_type == "tournamentvisibility":
        # Convertir l'enum en VARCHAR en castant via TEXT
        op.execute(text(
            "ALTER TABLE tournaments "
            "ALTER COLUMN visibility TYPE VARCHAR(10) "
            "USING visibility::text"
        ))
        # Supprimer le type enum devenu inutile
        op.execute(text("DROP TYPE IF EXISTS tournamentvisibility"))

    # S'assurer que toutes les lignes ont une valeur
    op.execute(text(
        "UPDATE tournaments SET visibility = 'public' WHERE visibility IS NULL OR visibility = ''"
    ))


def downgrade():
    pass
