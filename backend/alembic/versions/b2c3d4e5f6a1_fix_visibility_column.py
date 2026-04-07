"""fix_visibility_column

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-04-07 00:00:00.000000

Force l'ajout de la colonne visibility si elle manque (correction migration partielle).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect

revision = 'b2c3d4e5f6a1'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def _col_exists(table: str, col: str) -> bool:
    bind = op.get_bind()
    return col in [c["name"] for c in inspect(bind).get_columns(table)]


def upgrade():
    # Ajouter visibility si elle n'existe pas (migration précédente peut avoir échoué)
    if not _col_exists("tournaments", "visibility"):
        op.add_column("tournaments", sa.Column(
            "visibility",
            sa.String(10),
            nullable=True,
            server_default="public",
        ))
    # S'assurer que toutes les lignes ont une valeur
    op.execute(text("UPDATE tournaments SET visibility = 'public' WHERE visibility IS NULL"))

    # Ajouter les colonnes users si elles manquent aussi
    if not _col_exists("users", "dll_idx"):
        op.add_column("users", sa.Column("dll_idx", sa.String(20), nullable=True))
    if not _col_exists("users", "dll_team_name"):
        op.add_column("users", sa.Column("dll_team_name", sa.String(100), nullable=True))
    if not _col_exists("users", "dll_division"):
        op.add_column("users", sa.Column("dll_division", sa.Integer(), nullable=True))


def downgrade():
    pass  # Pas de rollback nécessaire pour ce fix
