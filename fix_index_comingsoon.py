#!/usr/bin/env python3
f = "frontend/pwa/index.html"
html = open(f).read()

# หา more.js script tag แล้วเพิ่ม comingsoon.js ก่อน
OLD = '<script src="/pwa/pages/more.js'
NEW = '<script src="/pwa/pages/comingsoon.js?v=1"></script>\n  <script src="/pwa/pages/more.js'

if OLD not in html:
    print("ERROR: หา more.js ไม่เจอ")
else:
    open(f, "w").write(html.replace(OLD, NEW, 1))
    print("OK: เพิ่ม comingsoon.js ใน index.html แล้ว")
