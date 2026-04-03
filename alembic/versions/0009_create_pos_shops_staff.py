from alembic import op
import sqlalchemy as sa

revision = "0009_create_pos_shops_staff"
down_revision = "0008_add_tenant_id_columns"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "shops",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("owner_user_id", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "staff",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("shop_id", sa.Text(), nullable=True),
        sa.Column("user_id", sa.Text(), nullable=True),
        sa.Column("role", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade():
    op.drop_table("staff")
    op.drop_table("shops")
