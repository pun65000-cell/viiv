#!/usr/bin/env python3
"""
patch_platform_widget.py
วาง Platform Status Widget ใน dashboard/index.html
ตำแหน่ง: เหนือ grid ระหว่าง POS และ CHAT
theme: ปรับให้เข้ากับ dashboard (warm beige, gold accent)
"""
import re, sys

f = "frontend/superboard/dashboard/index.html"
html = open(f, encoding="utf-8").read()

# 1. ลบของเก่าทั้งหมดก่อน
html = re.sub(r'\s*<div id="hub-platforms"[^>]*>.*?</div>\s*\n', '\n', html, flags=re.DOTALL)
html = html.replace('<div id="canvas" style="position:relative;">', '<div id="canvas">')
html = html.replace('<div id="grid" style="position:relative;">', '<div id="grid">')
print("✅ ลบของเก่าแล้ว")

# 2. CSS สะอาดใหม่ — theme warm dashboard
CSS = """
  /* ═══ Platform Status Widget ═══ */
  #psw {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px 20px 12px;
    background: rgba(255,252,245,0.92);
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 16px;
    margin: 0 auto 14px;
    width: fit-content;
    min-width: 320px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    backdrop-filter: blur(4px);
  }
  #psw-title {
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #b8a070;
    font-weight: 600;
  }
  #psw-row {
    display: flex;
    gap: 12px;
    justify-content: center;
    align-items: flex-end;
  }
  .psw-p {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    transition: transform 0.2s;
  }
  .psw-p:hover { transform: translateY(-2px); }
  .psw-wrap {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 0.3s ease;
    background: rgba(100,90,70,0.08);
  }
  .psw-wrap svg { width: 22px; height: 22px; filter: grayscale(1); opacity: 0.25; transition: all 0.3s; }
  .psw-wrap .psw-line-txt { font-size: 8px; font-weight: 800; color: #fff; font-family: Arial, sans-serif; letter-spacing: -.3px; opacity: 0.25; transition: opacity 0.3s; }
  .psw-dot {
    position: absolute;
    bottom: -3px; right: -3px;
    width: 10px; height: 10px;
    border-radius: 50%;
    border: 2px solid #f5f0e8;
    background: #bbb;
    transition: background 0.3s;
  }
  .psw-name {
    font-size: 9px;
    letter-spacing: 0.3px;
    color: #bbb;
    transition: color 0.3s;
  }
  #psw-summary {
    font-size: 11px;
    color: #9a8a6a;
    min-height: 16px;
    text-align: center;
  }

  /* status-grey = default above */
  .psw-p.psw-green .psw-wrap { background: rgba(34,197,94,0.12); box-shadow: 0 0 12px rgba(34,197,94,0.2); }
  .psw-p.psw-green .psw-wrap svg { filter: none; opacity: 1; }
  .psw-p.psw-green .psw-wrap .psw-line-txt { opacity: 1; }
  .psw-p.psw-green .psw-dot { background: #22c55e; }
  .psw-p.psw-green .psw-name { color: #16a34a; }

  .psw-p.psw-yellow .psw-wrap { background: rgba(234,179,8,0.12); box-shadow: 0 0 12px rgba(234,179,8,0.2); }
  .psw-p.psw-yellow .psw-wrap svg { filter: none; opacity: 1; }
  .psw-p.psw-yellow .psw-dot { background: #eab308; animation: psw-py 1.5s infinite; }
  .psw-p.psw-yellow .psw-name { color: #ca8a04; }

  .psw-p.psw-red .psw-wrap { background: rgba(239,68,68,0.12); box-shadow: 0 0 12px rgba(239,68,68,0.2); }
  .psw-p.psw-red .psw-wrap svg { filter: none; opacity: 1; }
  .psw-p.psw-red .psw-dot { background: #ef4444; animation: psw-pr 1s infinite; }
  .psw-p.psw-red .psw-name { color: #dc2626; }

  @keyframes psw-py { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.2)} }
  @keyframes psw-pr { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.35)} }
  /* ═══ /Platform Status Widget ═══ */
"""

html = html.replace("</style>", CSS + "\n  </style>", 1)
print("✅ เพิ่ม CSS แล้ว")

# 3. HTML widget — วางก่อน <div id="grid">
WIDGET = '''  <!-- ═══ Platform Status Widget ═══ -->
  <div id="psw">
    <div id="psw-title">การเชื่อมต่อแพลตฟอร์ม</div>
    <div id="psw-row">

      <!-- LINE -->
      <div class="psw-p" id="psw-line" title="LINE">
        <div class="psw-wrap" style="background:#06C755;">
          <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M40 21.8c0-7.2-7.2-13-16-13S8 14.6 8 21.8c0 6.4 5.7 11.8 13.4 12.8.5.1 1.2.34 1.38.78.16.4.1 1.02.05 1.42l-.22 1.34c-.07.4-.32 1.56 1.37.85 1.68-.71 9.06-5.33 12.37-9.13C38.1 27.7 40 25 40 21.8z" fill="white" opacity="0.3"/>
            <path d="M20.2 18.4h-1.4a.38.38 0 00-.38.38v8.7a.38.38 0 00.38.38h1.4a.38.38 0 00.38-.38v-8.7a.38.38 0 00-.38-.38zm9.1 0h-1.4a.38.38 0 00-.38.38v5.17l-3.99-5.39a.4.4 0 00-.31-.16h-1.4a.38.38 0 00-.38.38v8.7a.38.38 0 00.38.38h1.4a.38.38 0 00.38-.38v-5.17l4 5.4a.38.38 0 00.3.15h1.4a.38.38 0 00.38-.38v-8.7a.38.38 0 00-.38-.38zm-12.55 7.3h-2.57v-6.92a.38.38 0 00-.38-.38h-1.4a.38.38 0 00-.38.38v8.7a.38.38 0 00.38.38h4.35a.38.38 0 00.38-.38v-1.4a.38.38 0 00-.38-.38zm18.65-5.52a.38.38 0 00.38-.38v-1.4a.38.38 0 00-.38-.38h-4.35a.38.38 0 00-.38.38v8.7a.38.38 0 00.38.38h4.35a.38.38 0 00.38-.38v-1.4a.38.38 0 00-.38-.38h-2.57v-1.5h2.57a.38.38 0 00.38-.38v-1.4a.38.38 0 00-.38-.38h-2.57v-1.5h2.57z" fill="white" opacity="0.3"/>
          </svg>
          <div class="psw-dot"></div>
        </div>
        <div class="psw-name">LINE</div>
      </div>

      <!-- Facebook -->
      <div class="psw-p" id="psw-facebook" title="Facebook">
        <div class="psw-wrap">
          <svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/></svg>
          <div class="psw-dot"></div>
        </div>
        <div class="psw-name">Facebook</div>
      </div>

      <!-- TikTok -->
      <div class="psw-p" id="psw-tiktok" title="TikTok">
        <div class="psw-wrap">
          <svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 106.33 6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1-.07z" fill="#1a1a1a"/></svg>
          <div class="psw-dot"></div>
        </div>
        <div class="psw-name">TikTok</div>
      </div>

      <!-- Instagram -->
      <div class="psw-p" id="psw-instagram" title="Instagram">
        <div class="psw-wrap">
          <svg viewBox="0 0 24 24">
            <defs><linearGradient id="psw-ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f09433"/><stop offset="50%" stop-color="#dc2743"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" fill="url(#psw-ig)"/>
          </svg>
          <div class="psw-dot"></div>
        </div>
        <div class="psw-name">Instagram</div>
      </div>

      <!-- YouTube -->
      <div class="psw-p" id="psw-youtube" title="YouTube">
        <div class="psw-wrap">
          <svg viewBox="0 0 24 24"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" fill="#FF0000"/></svg>
          <div class="psw-dot"></div>
        </div>
        <div class="psw-name">YouTube</div>
      </div>

    </div>
    <div id="psw-summary">ยังไม่ได้เชื่อมต่อแพลตฟอร์ม</div>
  </div>
  <!-- ═══ /Platform Status Widget ═══ -->

'''

OLD_GRID = '  <div id="grid">'
if OLD_GRID not in html:
    print("ERROR: หา grid ไม่เจอ")
    sys.exit(1)

html = html.replace(OLD_GRID, WIDGET + OLD_GRID, 1)
print("✅ เพิ่ม widget HTML แล้ว")

# 4. JS โหลด LINE status + summary
JS = """
  // ═══ Platform Status Widget JS ═══
  (function(){
    function pswSet(id, status) {
      var el = document.getElementById('psw-' + id);
      if (!el) return;
      el.className = 'psw-p ' + (status || '');
    }
    function pswRefresh() {
      var els = document.querySelectorAll('.psw-p');
      var grey = 0, green = 0, yellow = 0, red = 0;
      els.forEach(function(e){
        if (e.className.includes('psw-green')) green++;
        else if (e.className.includes('psw-yellow')) yellow++;
        else if (e.className.includes('psw-red')) red++;
        else grey++;
      });
      var s = document.getElementById('psw-summary');
      if (!s) return;
      if (grey === els.length) { s.style.color='#bbb'; s.textContent='ยังไม่ได้เชื่อมต่อแพลตฟอร์ม'; return; }
      if (red > 0) { s.style.color='#dc2626'; s.textContent='⚠ มี ' + red + ' แพลตฟอร์มที่มีปัญหา'; return; }
      if (yellow > 0) { s.style.color='#ca8a04'; s.textContent='● ' + yellow + ' แพลตฟอร์มรอการตั้งค่า'; return; }
      s.style.color='#16a34a'; s.textContent='✓ เชื่อมต่อ ' + green + ' แพลตฟอร์ม พร้อมใช้งาน';
    }
    window.pswSet = pswSet;
    window.pswRefresh = pswRefresh;

    // โหลด LINE status จริง
    var t = localStorage.getItem('viiv_token');
    if (!t && window.parent && window.parent.localStorage) t = window.parent.localStorage.getItem('viiv_token');
    if (t) {
      fetch('/api/pos/line/settings', {headers:{'Authorization':'Bearer '+t}})
        .then(function(r){return r.json();})
        .then(function(d){
          if ((d.line_oa_id || d.oa_id) && d.channel_token) pswSet('line','psw-green');
          else pswSet('line','psw-yellow');
          pswRefresh();
        }).catch(function(){ pswRefresh(); });
    } else {
      pswRefresh();
    }
  })();
  // ═══ /Platform Status Widget JS ═══
"""

OLD_JS = "  window.vDash = {"
if OLD_JS not in html:
    print("ERROR: หา vDash ไม่เจอ")
    sys.exit(1)

html = html.replace(OLD_JS, JS + "\n  window.vDash = {", 1)
print("✅ เพิ่ม JS แล้ว")

open(f, "w", encoding="utf-8").write(html)
print("✅ บันทึกไฟล์แล้ว")
