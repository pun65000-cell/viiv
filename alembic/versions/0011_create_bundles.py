"""create bundles and bundle_items tables

Revision ID: 0011_create_bundles
Revises: extend_products_001
Create Date: 2026-04-24
"""
from alembic import op

revision = '0011_create_bundles'
down_revision = 'extend_products_001'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS bundles (
            id           TEXT PRIMARY KEY,
            tenant_id    TEXT NOT NULL,
            name         TEXT NOT NULL,
            sku          TEXT NOT NULL,
            price        NUMERIC(12,2) DEFAULT 0,
            cost_price   NUMERIC(12,2) DEFAULT 0,
            category     TEXT DEFAULT '',
            status       TEXT DEFAULT 'active',
            description  TEXT DEFAULT '',
            image_url    TEXT DEFAULT '',
            created_at   TIMESTAMPTZ DEFAULT now(),
            updated_at   TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS bundle_items (
            id            TEXT PRIMARY KEY,
            bundle_id     TEXT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
            tenant_id     TEXT NOT NULL,
            product_id    TEXT NOT NULL,
            product_name  TEXT DEFAULT '',
            sku           TEXT DEFAULT '',
            qty           NUMERIC(12,4) DEFAULT 1,
            cost_per_unit NUMERIC(12,2) DEFAULT 0,
            created_at    TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_bundles_tenant ON bundles(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON bundle_items(bundle_id)")

def downgrade():
    op.execute("DROP TABLE IF EXISTS bundle_items")
    op.execute("DROP TABLE IF EXISTS bundles")
