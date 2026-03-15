from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as psql

revision = '0002_create_orgs_table'
down_revision = '0001_create_users_table'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'organizations',
        sa.Column('id', psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

def downgrade():
    op.drop_table('organizations')
