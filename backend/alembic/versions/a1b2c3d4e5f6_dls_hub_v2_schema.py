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

revision = 'a1b2c3d4e5f6'
down_revision = '3381562170a4'
branch_labels = None
depends_on = None


def upgrade():
    # ── Table users — nouvelles colonnes nullable (rétrocompatible) ──────────
    op.add_column('users', sa.Column('dll_idx', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('dll_team_name', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('dll_division', sa.Integer(), nullable=True))
    op.create_unique_constraint('uq_users_dll_idx', 'users', ['dll_idx'])

    # ── Table tournaments — colonne visibility ───────────────────────────────
    op.add_column('tournaments', sa.Column(
        'visibility',
        sa.Enum('public', 'private', name='tournamentvisibility'),
        nullable=False,
        server_default='public',
    ))

    # ── Table players — contraintes d'unicité ────────────────────────────────
    op.create_unique_constraint(
        'uq_players_tournament_idx', 'players', ['tournament_id', 'dll_idx']
    )
    # Index partiel : unicité (tournament_id, user_id) uniquement pour user_id non null
    op.execute("""
        CREATE UNIQUE INDEX uq_players_tournament_user
        ON players (tournament_id, user_id)
        WHERE user_id IS NOT NULL
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_players_tournament_user")
    op.drop_constraint('uq_players_tournament_idx', 'players', type_='unique')
    op.drop_column('tournaments', 'visibility')
    op.execute("DROP TYPE IF EXISTS tournamentvisibility")
    op.drop_constraint('uq_users_dll_idx', 'users', type_='unique')
    op.drop_column('users', 'dll_division')
    op.drop_column('users', 'dll_team_name')
    op.drop_column('users', 'dll_idx')
