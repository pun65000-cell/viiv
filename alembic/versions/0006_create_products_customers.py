from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as psql

revision = '0006_create_products_customers'
down_revision = '0005_concore_tenants'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'products',
        sa.Column('id', psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        'customers',
        sa.Column('id', psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_customers_email', 'customers', ['email'], unique=True)

def downgrade():
    op.drop_index('ix_customers_email', table_name='customers')
    op.drop_table('customers')
    op.drop_table('products')
