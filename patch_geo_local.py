#!/usr/bin/env python3
# patch_geo_local.py — เปลี่ยนให้ register-shop.html โหลด geo จาก local
# python3 ~/viiv/patch_geo_local.py

import os, shutil

BASE  = os.path.expanduser("~/viiv/frontend/platform")
PAGES = os.path.join(BASE, "pages")
REG   = os.path.join(PAGES, "register-shop.html")

# 1. copy thailand_geo.json ไปไว้ที่ /static หรือ /platform/data/
DATA_DIR = os.path.join(BASE, "data")
os.makedirs(DATA_DIR, exist_ok=True)

src = os.path.expanduser("~/viiv/thailand_geo.json")
dst = os.path.join(DATA_DIR, "thailand_geo.json")
shutil.copy2(src, dst)
print(f"✅ copied geo data → {dst}")

# 2. patch register-shop.html เปลี่ยน fetch URL
with open(REG, "r", encoding="utf-8") as f:
    html = f.read()

old_url = "https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_tambon.json"
new_url = "/platform/data/thailand_geo.json"

if old_url in html:
    # แก้ fetch URL
    html = html.replace(
        f"var r = await fetch('{old_url}');",
        f"var r = await fetch('{new_url}');"
    )
    # แก้ mapping — local data ใช้ p/a/t/z แทน province_name_th ฯลฯ
    old_map = """    vGeoFlat = raw.map(function(t) {
      return { province: t.province_name_th, amphoe: t.amphure_name_th,
               tambon: t.name_th, postcode: String(t.zip_code||'') };
    });"""
    new_map = """    vGeoFlat = raw.map(function(t) {
      return { province: t.p, amphoe: t.a, tambon: t.t, postcode: String(t.z||'') };
    });"""
    html = html.replace(old_map, new_map)
    print("✅ patched fetch URL → local")
elif new_url in html:
    print("ℹ️  URL เป็น local อยู่แล้ว")
else:
    print("⚠️  ไม่พบ URL เดิม — ตรวจสอบไฟล์ด้วยตนเอง")

with open(REG, "w", encoding="utf-8") as f:
    f.write(html)

print("\n🎉 เสร็จ — hard refresh แล้วทดสอบ dropdown จังหวัด")
