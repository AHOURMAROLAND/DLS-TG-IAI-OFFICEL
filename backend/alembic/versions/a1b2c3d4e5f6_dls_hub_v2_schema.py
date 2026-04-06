"""dls_hub_v2_schema

Revision ID: a1b2c3d4e5f6
Revises: 3381562170a4
Create Date: 2026-04-06 00:00:00.000000

Adds:
- users.dll_idx, users.dll_team_name, users.dll_division
- tournaments.visibility (public/private)
- players: unique constraint (tournament_id, dll_idx)
- players: partial unique index (tournament_id, user_id) WHERE user_id IS NOT NULL
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'a1b2c3d4e5f6'
down_revision = '3381562170a4'
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = inspect(bind)
    return column in [c["name"] for c in insp.get_columns(table)]


def _index_exists(index_name: str) -> bool:
    bind = op.get_bind()
    insp = inspect(bind)
    # pg_indexes check
    result = bind.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :n"),
        {"n": index_name}
    ).fetchone()
    return result is not None


def _constraint_exists(table: str, constraint_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_name = :t AND constraint_name = :c"
        ),
        {"t": table, "c": constraint_name}
    ).fetchone()
    return result is not None


def upgrade():
    # ── Table users ──────────────────────────────────────────────────────────
    if not _column_exists("users", "dll_idx"):
        op.add_column("users", sa.Column("dll_idx", sa.String(20), nullable=True))
    if not _column_exists("users", "dll_team_name"):
        op.add_column("users", sa.Column("dll_team_name", sa.String(100), nullable=True))
    if not _column_exists("users", "dll_division"):
        op.add_column("users", sa.Column("dll_division", sa.Integer(), nullable=True))
    if not _constraint_exists("users", "uq_users_dll_idx"):
        op.create_unique_constraint("uq_users_dll_idx", "users", ["dll_idx"])

    # ── Table tournaments — colonne visibility ────────────────────────────────
    # Créer le type enum s'il n'existe pas
    op.execute(sa.text(
        "DO $$ BEGIN "
        "  CREATE TYPE tournamentvisibility AS ENUM ('public', 'private'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$"
    ))
    if not _column_exists("tournaments", "visibility"):
        op.add_column("tournaments", sa.Column(
            "visibility",
            sa.Enum("public", "private", name="tournamentvisibility", create_type=False),
            nullable=False,
            server_default="public",
        ))

    # ── Table players — contraintes d'unicité ─────────────────────────────────
    if not _constraint_exists("players", "uq_players_tournament_idx"):
        op.create_unique_constraint(
            "uq_players_tournament_idx", "players", ["tournament_id", "dll_idx"]
        )
    if not _index_exists("uq_players_tournament_user"):
        op.execute(sa.text(
            "CREATE UNIQUE INDEX uq_players_tournament_user "
            "ON players (tournament_id, user_id) "
            "WHERE user_id IS NOT NULL"
        ))


def downgrade():
    op.execute(sa.text("DROP INDEX IF EXISTS uq_players_tournament_user"))
    try:
        op.drop_constraint("uq_players_tournament_idx", "players", type_="unique")
    except Exception:
        pass
    try:
        op.drop_column("tournaments", "visibility")
    except Exception:
        pass
    op.execute(sa.text("DROP TYPE IF EXISTS tournamentvisibility"))
    try:
        op.drop_constraint("uq_users_dll_idx", "users", type_="unique")
    except Exception:
        pass
    for col in ["dll_division", "dll_team_name", "dll_idx"]:
        if _column_exists("users", col):
            op.drop_column("users", col)
