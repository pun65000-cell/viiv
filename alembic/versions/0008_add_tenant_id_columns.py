from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as psql

revision = '0008_add_tenant_id_columns'
down_revision = '0007_orders_items_receipts'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('products', sa.Column('tenant_id', psql.UUID(as_uuid=True), nullable=True))
    op.add_column('customers', sa.Column('tenant_id', psql.UUID(as_uuid=True), nullable=True))
    op.add_column('orders', sa.Column('tenant_id', psql.UUID(as_uuid=True), nullable=True))
    op.add_column('order_items', sa.Column('tenant_id', psql.UUID(as_uuid=True), nullable=True))
    op.add_column('receipts', sa.Column('tenant_id', psql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_products_tenant', 'products', ['tenant_id'])
    op.create_index('ix_customers_tenant', 'customers', ['tenant_id'])
    op.create_index('ix_orders_tenant', 'orders', ['tenant_id'])
    op.create_index('ix_order_items_tenant', 'order_items', ['tenant_id'])
    op.create_index('ix_receipts_tenant', 'receipts', ['tenant_id'])
    op.create_foreign_key('fk_products_tenant', 'products', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_customers_tenant', 'customers', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_orders_tenant', 'orders', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_order_items_tenant', 'order_items', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_receipts_tenant', 'receipts', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')

def downgrade():
    op.drop_constraint('fk_receipts_tenant', 'receipts', type_='foreignkey')
    op.drop_constraint('fk_order_items_tenant', 'order_items', type_='foreignkey')
    op.drop_constraint('fk_orders_tenant', 'orders', type_='foreignkey')
    op.drop_constraint('fk_customers_tenant', 'customers', type_='foreignkey')
    op.drop_constraint('fk_products_tenant', 'products', type_='foreignkey')
    op.drop_index('ix_receipts_tenant', table_name='receipts')
    op.drop_index('ix_order_items_tenant', table_name='order_items')
    op.drop_index('ix_orders_tenant', table_name='orders')
    op.drop_index('ix_customers_tenant', table_name='customers')
    op.drop_index('ix_products_tenant', table_name='products')
    op.drop_column('receipts', 'tenant_id')
    op.drop_column('order_items', 'tenant_id')
    op.drop_column('orders', 'tenant_id')
    op.drop_column('customers', 'tenant_id')
    op.drop_column('products', 'tenant_id')
