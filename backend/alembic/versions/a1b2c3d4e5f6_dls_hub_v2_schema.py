"""dls_hub_v2_schema

Revision ID: a1b2c3d4e5f6
Revises: 3381562170a4
Create Date: 2026-04-06 00:00:00.000000

Adds:
- users.dll_idx, users.dll_team_name, users.dll_division
- tournaments.visibility (VARCHAR 'public'/'private', défaut 'public')
- players: unique constraint (tournament_id, dll_idx)
- players: partial unique index (tournament_id, user_id) WHERE user_id IS NOT NULL
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect

revision = 'a1b2c3d4e5f6'
down_revision = '3381562170a4'
branch_labels = None
depends_on = None


def _col_exists(table: str, col: str) -> bool:
    bind = op.get_bind()
    return col in [c["name"] for c in inspect(bind).get_columns(table)]


def _constraint_exists(table: str, name: str) -> bool:
    bind = op.get_bind()
    row = bind.execute(text(
        "SELECT 1 FROM information_schema.table_constraints "
        "WHERE table_name=:t AND constraint_name=:c"
    ), {"t": table, "c": name}).fetchone()
    return row is not None


def _index_exists(name: str) -> bool:
    bind = op.get_bind()
    row = bind.execute(
        text("SELECT 1 FROM pg_indexes WHERE indexname=:n"), {"n": name}
    ).fetchone()
    return row is not None


def upgrade():
    # ── users : nouvelles colonnes ────────────────────────────────────────────
    if not _col_exists("users", "dll_idx"):
        op.add_column("users", sa.Column("dll_idx", sa.String(20), nullable=True))
    if not _col_exists("users", "dll_team_name"):
        op.add_column("users", sa.Column("dll_team_name", sa.String(100), nullable=True))
    if not _col_exists("users", "dll_division"):
        op.add_column("users", sa.Column("dll_division", sa.Integer(), nullable=True))
    if not _constraint_exists("users", "uq_users_dll_idx"):
        op.create_unique_constraint("uq_users_dll_idx", "users", ["dll_idx"])

    # ── tournaments : colonne visibility en VARCHAR (pas d'enum PostgreSQL) ───
    if not _col_exists("tournaments", "visibility"):
        op.add_column("tournaments", sa.Column(
            "visibility",
            sa.String(10),          # "public" ou "private"
            nullable=False,
            server_default="public",
        ))

    # ── players : contraintes d'unicité ──────────────────────────────────────
    if not _constraint_exists("players", "uq_players_tournament_idx"):
        op.create_unique_constraint(
            "uq_players_tournament_idx", "players", ["tournament_id", "dll_idx"]
        )
    if not _index_exists("uq_players_tournament_user"):
        op.execute(text(
            "CREATE UNIQUE INDEX uq_players_tournament_user "
            "ON players (tournament_id, user_id) "
            "WHERE user_id IS NOT NULL"
        ))


def downgrade():
    op.execute(text("DROP INDEX IF EXISTS uq_players_tournament_user"))
    try:
        op.drop_constraint("uq_players_tournament_idx", "players", type_="unique")
    except Exception:
        pass
    if _col_exists("tournaments", "visibility"):
        op.drop_column("tournaments", "visibility")
    try:
        op.drop_constraint("uq_users_dll_idx", "users", type_="unique")
    except Exception:
        pass
    for col in ["dll_division", "dll_team_name", "dll_idx"]:
        if _col_exists("users", col):
            op.drop_column("users", col)
