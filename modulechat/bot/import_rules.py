#!/usr/bin/env python3
"""
VIIV Bot Rules Importer
Usage:
  python3 import_rules.py                          # import bot_rules_starter.json (old format)
  python3 import_rules.py --file data/general_rules_1.json  # import specific file (new format)
  python3 import_rules.py --dry-run                # preview
  python3 import_rules.py --list                   # list categories (old format only)
  python3 import_rules.py --tenant-id ten_xxx      # assign to tenant
"""
import json
import sys
import os
import asyncio
import argparse

# --- Config ---
DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:viiv_secure_123@10.1.0.3:5434/postgres"
)
DEFAULT_JSON_PATH = os.path.join(os.path.dirname(__file__), "data", "bot_rules_starter.json")


async def run(json_path, category_filter=None, dry_run=False, tenant_id=None):
    try:
        import asyncpg
    except ImportError:
        print("[ERROR] asyncpg not installed. Run: pip install asyncpg --break-system-packages")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # detect format: new={"rules":[...]}, old={"categories":[...]}
    if "rules" in data:
        rules_list = data["rules"]
        label = data.get("meta", {}).get("topic", os.path.basename(json_path))
        print(f"\n[+] File: {os.path.basename(json_path)} | {label} | {len(rules_list)} rules")
        all_rules = [(label, rules_list)]
    elif "categories" in data:
        categories = data["categories"]
        if category_filter:
            categories = [c for c in categories if c["id"] == category_filter]
            if not categories:
                print(f"[ERROR] Category '{category_filter}' not found")
                sys.exit(1)
        all_rules = [(cat["name"], cat["rules"]) for cat in categories]
    else:
        print("[ERROR] Unknown JSON format. Expected 'rules' or 'categories' key.")
        sys.exit(1)

    conn = await asyncpg.connect(DB_URL)
    total = 0
    skipped = 0

    try:
        for label, rules_list in all_rules:
            print(f"\n[+] {label} ({len(rules_list)} rules)")
            for rule in rules_list:
                keywords = rule["keywords"]
                response = rule["response"]

                existing = await conn.fetchval(
                    "SELECT id FROM chat_bot_rules WHERE $1 = ANY(keywords) AND tenant_id IS NOT DISTINCT FROM $2 LIMIT 1",
                    keywords[0], tenant_id
                )
                if existing:
                    print(f"  [SKIP] {keywords[0]}")
                    skipped += 1
                    continue

                if dry_run:
                    print(f"  [DRY]  {keywords[:3]}")
                    total += 1
                    continue

                await conn.execute(
                    """
                    INSERT INTO chat_bot_rules (tenant_id, keywords, response, is_active, hit_count)
                    VALUES ($1, $2, $3, true, 0)
                    """,
                    tenant_id, keywords, response
                )
                print(f"  [OK]   {keywords[:3]}")
                total += 1
    finally:
        await conn.close()

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Done: {total} inserted, {skipped} skipped")


def main():
    parser = argparse.ArgumentParser(description="Import VIIV bot rules")
    parser.add_argument("--file", help="Path to JSON file (default: bot_rules_starter.json)")
    parser.add_argument("--category", help="Filter by category id (old format only)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without inserting")
    parser.add_argument("--tenant-id", help="Assign to tenant (default: global/null)")
    parser.add_argument("--list", action="store_true", help="List categories (old format only)")
    args = parser.parse_args()

    json_path = args.file if args.file else DEFAULT_JSON_PATH

    if not os.path.exists(json_path):
        print(f"[ERROR] File not found: {json_path}")
        sys.exit(1)

    if args.list:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "categories" not in data:
            print("[INFO] Flat format file, no categories.")
            return
        for c in data["categories"]:
            print(f"  {c['id']:20s} {c.get('icon','')}  {c['name']}")
        return

    asyncio.run(run(
        json_path=json_path,
        category_filter=args.category,
        dry_run=args.dry_run,
        tenant_id=args.tenant_id
    ))


if __name__ == "__main__":
    main()
