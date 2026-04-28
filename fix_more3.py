#!/usr/bin/env python3
import re

# ── fix_more3.py ──
f = "frontend/pwa/pages/more.js"
html = open(f).read()

LINE_ICON = '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#06C755;border-radius:5px;font-size:7px;font-weight:800;color:#fff;font-family:Arial,sans-serif;letter-spacing:-0.3px">LINE</span>'

OLD = "        { icon: '" + LINE_ICON + "', label: 'เชื่อมต่อ LINE', sub: 'LINE OA, Token, Webhook, ใบเสนอราคา', pwa: 'line' },"

FB  = '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#1877F2;border-radius:5px;font-size:8px;font-weight:800;color:#fff">f</span>'
TT  = '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#000;border-radius:5px;font-size:7px;font-weight:800;color:#fff">Tok</span>'
IG  = '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:5px;background:linear-gradient(135deg,#f09433,#dc2743,#bc1888);font-size:8px;color:#fff">&#9768;</span>'
YT  = '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#FF0000;border-radius:5px;font-size:8px;color:#fff">&#9654;</span>'
AK  = '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#6366f1;border-radius:5px;font-size:10px;color:#fff">&#128273;</span>'

NEW = (
    "        { icon: '" + LINE_ICON + "', label: 'LINE', sub: 'OA · Token · Webhook · ใบเสนอราคา', pwa: 'line' },\n" +
    "        { icon: '" + FB  + "', label: 'Facebook',  sub: 'Facebook Page & Messenger',   pwa: 'comingsoon' },\n" +
    "        { icon: '" + TT  + "', label: 'TikTok',    sub: 'TikTok Shop & Live',           pwa: 'comingsoon' },\n" +
    "        { icon: '" + IG  + "', label: 'Instagram', sub: 'Instagram Business Account',   pwa: 'comingsoon' },\n" +
    "        { icon: '" + YT  + "', label: 'YouTube',   sub: 'YouTube Channel & Live',       pwa: 'comingsoon' },\n" +
    "        { icon: '" + AK  + "', label: 'API Keys',  sub: 'Developer Integration Keys',   pwa: 'comingsoon' },"
)

if OLD not in html:
    print("ERROR: หา LINE pattern ไม่เจอ")
    print("--- ลองหาบรรทัดที่มี 'line' ---")
    for i, line in enumerate(html.split('\n')):
        if 'pwa: .line' in line or "pwa: 'line'" in line:
            print(f"  line {i}: {line[:80]}")
else:
    open(f, "w").write(html.replace(OLD, NEW, 1))
    print("OK: more.js updated")
