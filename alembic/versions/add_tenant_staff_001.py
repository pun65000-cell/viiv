"""create tenant_staff table

Revision ID: add_tenant_staff_001
Revises: 
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_tenant_staff_001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS tenant_staff (
            id TEXT PRIMARY KEY DEFAULT generate_prefixed_uuid('stf_'),
            tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            role TEXT NOT NULL,
            staff_code TEXT,
            line_id TEXT,
            facebook TEXT,
            note TEXT,
            hashed_password TEXT NOT NULL,
            permissions JSONB NOT NULL DEFAULT '{}',
            avatar_url TEXT,
            id_card_url TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(tenant_id, email)
        )
    """)

def downgrade():
    op.execute("DROP TABLE IF EXISTS tenant_staff")
