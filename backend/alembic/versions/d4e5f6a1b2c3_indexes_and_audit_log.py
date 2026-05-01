"""indexes_and_audit_log

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2026-05-01 00:00:00.000000

- Ajoute les index manquants sur matches et players (performance)
- Crée la table audit_logs pour tracer les actions créateur
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a1b2c3'
down_revision = 'c3d4e5f6a1b2'
branch_labels = None
depends_on = None


def upgrade():
    # ── Index sur matches ──────────────────────────────────────────────────
    op.create_index('ix_matches_tournament_id', 'matches', ['tournament_id'])
    op.create_index('ix_matches_home_player_id', 'matches', ['home_player_id'])
    op.create_index('ix_matches_away_player_id', 'matches', ['away_player_id'])
    op.create_index('ix_matches_status', 'matches', ['status'])
    op.create_index('ix_matches_phase', 'matches', ['phase'])

    # ── Index sur players ──────────────────────────────────────────────────
    op.create_index('ix_players_tournament_id', 'players', ['tournament_id'])
    op.create_index('ix_players_user_id', 'players', ['user_id'])
    op.create_index('ix_players_status', 'players', ['status'])
    op.create_index('ix_players_tournament_status', 'players', ['tournament_id', 'status'])

    # ── Index sur tournaments ──────────────────────────────────────────────
    op.create_index('ix_tournaments_creator_id', 'tournaments', ['creator_id'])
    op.create_index('ix_tournaments_status', 'tournaments', ['status'])
    op.create_index('ix_tournaments_visibility', 'tournaments', ['visibility'])

    # ── Table audit_logs ───────────────────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tournament_id', sa.String(36), sa.ForeignKey('tournaments.id'), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('target_type', sa.String(30), nullable=True),
        sa.Column('target_id', sa.String(36), nullable=True),
        sa.Column('details', sa.JSON, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_tournament_id', 'audit_logs', ['tournament_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])


def downgrade():
    op.drop_table('audit_logs')

    op.drop_index('ix_tournaments_visibility', 'tournaments')
    op.drop_index('ix_tournaments_status', 'tournaments')
    op.drop_index('ix_tournaments_creator_id', 'tournaments')

    op.drop_index('ix_players_tournament_status', 'players')
    op.drop_index('ix_players_status', 'players')
    op.drop_index('ix_players_user_id', 'players')
    op.drop_index('ix_players_tournament_id', 'players')

    op.drop_index('ix_matches_phase', 'matches')
    op.drop_index('ix_matches_status', 'matches')
    op.drop_index('ix_matches_away_player_id', 'matches')
    op.drop_index('ix_matches_home_player_id', 'matches')
    op.drop_index('ix_matches_tournament_id', 'matches')
