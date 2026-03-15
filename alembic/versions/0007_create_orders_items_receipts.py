from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as psql

revision = '0007_orders_items_receipts'
down_revision = '0006_create_products_customers'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'orders',
        sa.Column('id', psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('customer_id', psql.UUID(as_uuid=True), sa.ForeignKey('customers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('total', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        'order_items',
        sa.Column('order_id', psql.UUID(as_uuid=True), sa.ForeignKey('orders.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('product_id', psql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='RESTRICT'), primary_key=True),
        sa.Column('quantity', sa.Integer, nullable=False),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
    )
    op.create_table(
        'receipts',
        sa.Column('id', psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('order_id', psql.UUID(as_uuid=True), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
    )

def downgrade():
    op.drop_table('receipts')
    op.drop_table('order_items')
    op.drop_table('orders')
