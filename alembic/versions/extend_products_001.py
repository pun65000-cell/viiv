"""extend products table for POS

Revision ID: extend_products_001
Revises: add_tenant_staff_001
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = 'extend_products_001'
down_revision = 'add_tenant_staff_001'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""
        ALTER TABLE products
          ADD COLUMN IF NOT EXISTS sku TEXT,
          ADD COLUMN IF NOT EXISTS description TEXT,
          ADD COLUMN IF NOT EXISTS image_url TEXT,
          ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS price_min NUMERIC(12,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS pv NUMERIC(12,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS vat TEXT DEFAULT 'no_vat',
          ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '',
          ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS stock_qty NUMERIC(12,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS stock_floor NUMERIC(12,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS min_alert INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS qr_url TEXT DEFAULT '',
          ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    """)
    # unique SKU per tenant
    op.execute("""
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_products_tenant_sku'
          ) THEN
            ALTER TABLE products
              ADD CONSTRAINT uq_products_tenant_sku UNIQUE (tenant_id, sku);
          END IF;
        END $$
    """)

def downgrade():
    pass
