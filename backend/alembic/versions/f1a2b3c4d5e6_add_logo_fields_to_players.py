"""add logo fields to players

Revision ID: f1a2b3c4d5e6
Revises: 9d24cd7a5a87
Create Date: 2026-04-02

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = '9d24cd7a5a87'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter logo_data et logo_content_type à la table players
    with op.batch_alter_table('players', schema=None) as batch_op:
        batch_op.add_column(sa.Column('logo_data', sa.LargeBinary(), nullable=True))
        batch_op.add_column(sa.Column('logo_content_type', sa.String(length=50), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('players', schema=None) as batch_op:
        batch_op.drop_column('logo_content_type')
        batch_op.drop_column('logo_data')
