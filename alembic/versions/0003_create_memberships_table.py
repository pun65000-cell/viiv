from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as psql

revision = '0003_create_memberships_table'
down_revision = '0002_create_orgs_table'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'memberships',
        sa.Column('user_id', psql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('org_id', psql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role', sa.String(length=50), nullable=False),
    )

def downgrade():
    op.drop_table('memberships')
