#!/usr/bin/env python3
"""
Clone tenant data from ten_1 (test7) to test_dev (dev7).
- Read-only on source
- Regenerate all IDs (no collision)
- Remap FK in jsonb fields
- Single transaction (ROLLBACK on any failure)
"""
import os, sys, json, uuid
from sqlalchemy import create_engine, text

DB_URL = "postgresql://postgres:viiv_secure_123@10.1.0.3:5434/postgres"
SRC = "ten_1"
DST = "test_dev"
OWNER = "stf_64f54ddd-c4c7-4941-a5c0-13732fbf0c05"

engine = create_engine(DB_URL)

def gen_id(prefix):
    return f"{prefix}_{uuid.uuid4()}"

# Tables ที่ต้อง clone และ prefix ของ id
# Format: (table, id_prefix หรือ None ถ้า id เป็น integer/serial)
TABLES_PHASE1 = [
    ("categories", "cat"),
    ("bank_accounts", "bnk"),
    ("members", "mem"),
    ("partners", "ptn"),
    ("store_settings", None),     # PK = tenant_id
    ("organizations", "org"),
    ("tenant_discount_overrides", None),
    ("customers", "cus"),
    ("bot_training_data", None),  # serial PK
]

TABLES_PRODUCTS = [
    ("products", "prd"),
    ("bundles", "bdl"),
    ("affiliate_products", None),
]

TABLES_STOCK = [
    ("stock_receive", "rcv"),
    ("stock_receive_items", None),  # serial
    ("stock_receive_log", None),
    ("stock_log", None),
]

TABLES_SALES = [
    ("bills", "bil"),
    ("bill_seq", None),            # PK = tenant_id
    ("bill_void_log", None),
    ("orders", "ord"),
    ("partner_docs", None),
    ("finance_income", None),
    ("finance_expense", None),
    ("affiliate_clicks", None),
    ("billing_statements", None),  # serial
    ("bundle_items", None),
]

# id_map[table_name][old_id] = new_id
id_map = {}

def get_columns(conn, table):
    """อ่าน column list (ลำดับเดิม)"""
    rows = conn.execute(text("""
        SELECT column_name FROM information_schema.columns
         WHERE table_name=:t AND table_schema='public'
         ORDER BY ordinal_position
    """), {"t": table}).fetchall()
    return [r[0] for r in rows]

def get_id_type(conn, table):
    """อ่าน data_type ของ column id (text/integer/bigint/None ถ้าไม่มี)"""
    return conn.execute(text("""
        SELECT data_type FROM information_schema.columns
         WHERE table_name=:t AND column_name='id' AND table_schema='public'
    """), {"t": table}).scalar()

def fetch_rows(conn, table):
    """SELECT * FROM table WHERE tenant_id=SRC"""
    cols = get_columns(conn, table)
    if "tenant_id" not in cols:
        print(f"  ⚠️  {table} ไม่มี tenant_id — skip")
        return [], cols
    # Skip ถ้า tenant_id ไม่ใช่ text (legacy UUID-based — ไม่ตรง schema ใหม่)
    tid_type = conn.execute(text("""
        SELECT data_type FROM information_schema.columns
         WHERE table_name=:t AND column_name='tenant_id' AND table_schema='public'
    """), {"t": table}).scalar()
    if tid_type and tid_type != "text":
        print(f"  ⚠️  {table} tenant_id={tid_type} (legacy schema) — skip")
        return [], cols
    sql = f'SELECT * FROM "{table}" WHERE tenant_id=:tid'
    rows = conn.execute(text(sql), {"tid": SRC}).mappings().all()
    return [dict(r) for r in rows], cols

def remap_jsonb(obj, key, src_table):
    """ถ้า obj มี key (เช่น customer_id) ที่อยู่ใน id_map[src_table] → swap"""
    if not isinstance(obj, dict):
        return obj
    old = obj.get(key)
    if old and old in id_map.get(src_table, {}):
        obj[key] = id_map[src_table][old]
    return obj

def remap_items_array(items, products_map):
    """items jsonb array — แต่ละ item มี product_id"""
    if not isinstance(items, list):
        return items
    for it in items:
        if isinstance(it, dict):
            old_pid = it.get("product_id")
            if old_pid and old_pid in products_map:
                it["product_id"] = products_map[old_pid]
    return items

def insert_row(conn, table, row, cols):
    """INSERT ทุก column (ที่ row มี) — เว้น generated/default ที่ไม่มีค่า"""
    keys = [k for k in cols if k in row]
    vals_sql = ", ".join(f":{k}" for k in keys)
    cols_sql = ", ".join(f'"{k}"' for k in keys)
    sql = f'INSERT INTO "{table}" ({cols_sql}) VALUES ({vals_sql})'
    # Convert dict/list to JSON string
    params = {}
    for k in keys:
        v = row[k]
        if isinstance(v, (dict, list)):
            params[k] = json.dumps(v, ensure_ascii=False, default=str)
        else:
            params[k] = v
    conn.execute(text(sql), params)

# Tables ที่ PK=tenant_id — skip ถ้า DST มี row อยู่แล้ว (DEV-specific data)
SKIP_IF_DST_EXISTS = {"store_settings", "bill_seq"}

def clone_table(conn, table, prefix):
    """
    Generic clone:
    1. fetch rows
    2. ถ้า prefix → regen id, save id_map[table][old]=new
    3. tenant_id = DST
    4. remap created_by/voided_by → OWNER (ถ้ามี column)
    5. INSERT
    """
    # Skip ถ้า PK=tenant_id และ DST มี row แล้ว
    if table in SKIP_IF_DST_EXISTS:
        existing = conn.execute(
            text(f'SELECT COUNT(*) FROM "{table}" WHERE tenant_id=:tid'),
            {"tid": DST}
        ).scalar() or 0
        if existing > 0:
            print(f"  ⏭️  {table}: DST มี {existing} row — skip (DEV-specific)")
            return 0

    rows, cols = fetch_rows(conn, table)
    if not rows:
        print(f"  ⏭️  {table}: 0 rows")
        return 0

    id_map.setdefault(table, {})
    has_id_col = "id" in cols
    id_type = get_id_type(conn, table) if has_id_col else None
    has_created_by = "created_by" in cols
    has_voided_by = "voided_by" in cols
    has_recorded_by = "recorded_by" in cols

    for r in rows:
        # 1. Regen id
        if has_id_col:
            if prefix:
                old_id = r["id"]
                new_id = gen_id(prefix)
                id_map[table][old_id] = new_id
                r["id"] = new_id
            elif id_type in ("integer", "bigint", "smallint"):
                # serial — ลบทิ้งให้ DB gen เอง
                del r["id"]
            elif id_type == "text":
                # text id but no prefix specified → use uuid (no prefix)
                old_id = r["id"]
                new_id = str(uuid.uuid4())
                id_map[table][old_id] = new_id
                r["id"] = new_id

        # 2. tenant_id
        r["tenant_id"] = DST

        # 3. created_by / voided_by → OWNER
        if has_created_by and r.get("created_by"):
            r["created_by"] = OWNER
        if has_voided_by and r.get("voided_by"):
            r["voided_by"] = OWNER
        if has_recorded_by and r.get("recorded_by"):
            r["recorded_by"] = OWNER

    # 4. INSERT
    for r in rows:
        insert_row(conn, table, r, cols)
    print(f"  ✅ {table}: {len(rows)} rows")
    return len(rows)

def clone_products(conn):
    """Products: remap category column ถ้าเป็น category_id (text — ดูใน data ว่าเก็บ id หรือ name)"""
    # products.category เก็บเป็น text (อาจ name หรือ id) — ตรวจดูก่อน
    return clone_table(conn, "products", "prd")

def clone_bills(conn):
    """Bills: remap customer_id + customer_data.customer_id + items[].product_id"""
    rows, cols = fetch_rows(conn, "bills")
    if not rows:
        print("  ⏭️  bills: 0 rows")
        return 0

    members_map = id_map.get("members", {})
    products_map = id_map.get("products", {})
    id_map.setdefault("bills", {})

    for r in rows:
        old_id = r["id"]
        new_id = gen_id("bil")
        id_map["bills"][old_id] = new_id
        r["id"] = new_id
        r["tenant_id"] = DST

        # customer_id → members_map
        if r.get("customer_id") and r["customer_id"] in members_map:
            r["customer_id"] = members_map[r["customer_id"]]

        # customer_data jsonb
        if isinstance(r.get("customer_data"), dict):
            cd = r["customer_data"]
            if cd.get("id") and cd["id"] in members_map:
                cd["id"] = members_map[cd["id"]]
            if cd.get("customer_id") and cd["customer_id"] in members_map:
                cd["customer_id"] = members_map[cd["customer_id"]]

        # items jsonb array
        if isinstance(r.get("items"), list):
            r["items"] = remap_items_array(r["items"], products_map)

        # created_by / voided_by → OWNER
        if r.get("created_by"):
            r["created_by"] = OWNER
        if r.get("voided_by"):
            r["voided_by"] = OWNER

    for r in rows:
        insert_row(conn, "bills", r, cols)
    print(f"  ✅ bills: {len(rows)} rows")
    return len(rows)

def clone_billing_statements(conn):
    """billing_statements.bill_ids = jsonb array of bill IDs → remap"""
    rows, cols = fetch_rows(conn, "billing_statements")
    if not rows:
        print("  ⏭️  billing_statements: 0 rows")
        return 0

    bills_map = id_map.get("bills", {})

    for r in rows:
        # serial id → drop
        if "id" in r:
            del r["id"]
        r["tenant_id"] = DST

        # run_id: replace ten_1 → test_dev (UNIQUE constraint)
        if r.get("run_id") and SRC in r["run_id"]:
            r["run_id"] = r["run_id"].replace(SRC, DST)

        # bill_ids array
        if isinstance(r.get("bill_ids"), list):
            r["bill_ids"] = [bills_map.get(b, b) for b in r["bill_ids"]]

        if r.get("created_by"):
            r["created_by"] = OWNER
        if r.get("recorded_by"):
            r["recorded_by"] = OWNER

    for r in rows:
        insert_row(conn, "billing_statements", r, cols)
    print(f"  ✅ billing_statements: {len(rows)} rows")
    return len(rows)

def main():
    print(f"🔄 Cloning {SRC} → {DST}")
    print(f"   Owner reassign: {OWNER}")
    print()

    with engine.begin() as conn:
        try:
            print("📦 Phase 1: Independent tables")
            for table, prefix in TABLES_PHASE1:
                clone_table(conn, table, prefix)

            print("\n📦 Phase 2: Products")
            for table, prefix in TABLES_PRODUCTS:
                clone_table(conn, table, prefix)

            print("\n📦 Phase 3: Stock")
            for table, prefix in TABLES_STOCK:
                clone_table(conn, table, prefix)

            print("\n📦 Phase 4: Sales (custom remap)")
            clone_bills(conn)
            for table, prefix in TABLES_SALES:
                if table in ("bills", "billing_statements"):
                    continue  # handled separately
                clone_table(conn, table, prefix)
            clone_billing_statements(conn)

            print("\n✅ All cloned. Committing transaction...")
        except Exception as e:
            print(f"\n❌ Error: {e}")
            print("   ROLLBACK")
            raise

    # Verify
    print("\n📊 Verify:")
    with engine.connect() as conn:
        verify_tables = ["products","members","partners","bills","categories",
                         "billing_statements","bank_accounts"]
        for t in verify_tables:
            src = conn.execute(text(f'SELECT COUNT(*) FROM "{t}" WHERE tenant_id=:t'),
                               {"t": SRC}).scalar()
            dst = conn.execute(text(f'SELECT COUNT(*) FROM "{t}" WHERE tenant_id=:t'),
                               {"t": DST}).scalar()
            mark = "✅" if src == dst else "❌"
            print(f"  {mark} {t}: src={src} dst={dst}")

if __name__ == "__main__":
    main()
