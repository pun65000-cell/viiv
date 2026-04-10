#!/usr/bin/env python3
# patch_superboard_theme.py
# python3 ~/viiv/patch_superboard_theme.py

import os

BASE = os.path.expanduser("~/viiv/frontend/superboard")
CSS  = os.path.join(BASE, "css")

# ══════════════════════════════════════════════
# 1. theme.css ใหม่ — white/gray LINE OA style
# ══════════════════════════════════════════════
THEME = """:root {
  --sb-bg:          #f2f3f5;
  --sb-topbar:      #ffffff;
  --sb-topbar-h:    52px;
  --sb-sidebar-w:   56px;
  --sb-sidebar-exp: 220px;
  --sb-sidebar-bg:  #ffffff;
  --sb-border:      #e8e8e8;
  --sb-border-2:    #d4d4d4;
  --sb-accent:      #c9a84c;
  --sb-accent-bg:   #fff8e6;
  --sb-accent-dim:  rgba(201,168,76,0.12);
  --sb-text:        #1a1a1a;
  --sb-text-2:      #555555;
  --sb-muted:       #999999;
  --sb-hover:       #f5f5f5;
  --sb-active-bg:   #fff8e6;
  --sb-card:        #ffffff;
  --sb-card-border: #ebebeb;
  --sb-shadow:      0 1px 4px rgba(0,0,0,0.06);
  --sb-shadow-md:   0 4px 16px rgba(0,0,0,0.08);
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 14px;
  --r-xl: 18px;
  --font: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  font-size: 14px;
  background: var(--sb-bg);
  color: var(--sb-text);
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ══ TOPBAR ══ */
.sb-topbar {
  height: var(--sb-topbar-h);
  min-height: var(--sb-topbar-h);
  background: var(--sb-topbar);
  border-bottom: 1px solid var(--sb-border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 10px;
  z-index: 100;
  flex-shrink: 0;
  box-shadow: var(--sb-shadow);
}

/* Logo */
.sb-logo {
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 3px;
  color: var(--sb-accent);
  text-decoration: none;
  flex-shrink: 0;
  padding-right: 14px;
  border-right: 1.5px solid var(--sb-border);
}

/* Shop selector */
.sb-shop-wrap { position: relative; flex-shrink: 0; }

.sb-shop-btn {
  display: flex; align-items: center; gap: 8px;
  background: var(--sb-hover);
  border: 1px solid var(--sb-border);
  border-radius: var(--r-md);
  padding: 5px 10px 5px 6px;
  cursor: pointer;
  color: var(--sb-text);
  transition: background 0.15s, border-color 0.15s;
  min-width: 140px;
}
.sb-shop-btn:hover { background: #efefef; border-color: var(--sb-border-2); }

.sb-shop-avatar {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--sb-accent-bg);
  border: 1.5px solid var(--sb-accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; color: var(--sb-accent);
  flex-shrink: 0;
}
.sb-shop-name { font-size: 13px; font-weight: 600; color: var(--sb-text); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-shop-sub  { font-size: 10px; color: var(--sb-muted); margin-top: 1px; }
.sb-shop-star { font-size: 11px; color: var(--sb-accent); margin-left: 2px; }
.sb-shop-arrow { font-size: 10px; color: var(--sb-muted); margin-left: 2px; }

.sb-shop-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: #fff;
  border: 1px solid var(--sb-border);
  border-radius: var(--r-lg);
  min-width: 220px;
  box-shadow: var(--sb-shadow-md);
  z-index: 999;
  overflow: hidden;
}
.sb-shop-dropdown.open { display: block; }

.sb-dd-header {
  padding: 10px 14px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--sb-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--sb-border);
}

.sb-shop-dd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
  color: var(--sb-text);
}
.sb-shop-dd-item:hover { background: var(--sb-hover); }
.sb-shop-dd-item.active { background: var(--sb-accent-bg); color: var(--sb-accent); font-weight: 600; }
.sb-shop-dd-item .sb-shop-avatar { border-radius: 6px; width: 26px; height: 26px; font-size: 11px; }

/* Top nav modules */
.sb-topnav { display: flex; align-items: center; gap: 2px; margin-left: 4px; }

.sb-topnav-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border-radius: var(--r-md);
  border: none;
  background: transparent;
  color: var(--sb-text-2);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}
.sb-topnav-btn:hover { background: var(--sb-hover); color: var(--sb-text); }
.sb-topnav-btn.active {
  background: var(--sb-accent-bg);
  color: var(--sb-accent);
  font-weight: 700;
}
.sb-topnav-icon { font-size: 15px; }

/* Spacer */
.sb-spacer { flex: 1; }

/* Profile */
.sb-profile-wrap { position: relative; }

.sb-profile-btn {
  display: flex; align-items: center; gap: 8px;
  background: transparent;
  border: none;
  border-radius: var(--r-md);
  padding: 4px 8px;
  cursor: pointer;
  color: var(--sb-text);
  transition: background 0.12s;
}
.sb-profile-btn:hover { background: var(--sb-hover); }

.sb-profile-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--sb-accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #fff;
  box-shadow: 0 1px 4px rgba(201,168,76,0.4);
}
.sb-profile-name { font-size: 13px; font-weight: 600; color: var(--sb-text); }
.sb-profile-arrow { font-size: 10px; color: var(--sb-muted); }

.sb-profile-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #fff;
  border: 1px solid var(--sb-border);
  border-radius: var(--r-lg);
  min-width: 180px;
  box-shadow: var(--sb-shadow-md);
  z-index: 999;
  overflow: hidden;
  padding: 4px;
}
.sb-profile-dropdown.open { display: block; }

.sb-profile-dd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
  border-radius: var(--r-sm);
  color: var(--sb-text);
  text-decoration: none;
  margin: 1px 0;
}
.sb-profile-dd-item:hover { background: var(--sb-hover); }
.sb-profile-dd-item.danger { color: #e03535; }
.sb-profile-dd-item.danger:hover { background: #fff0f0; }
.sb-profile-dd-icon { font-size: 15px; width: 20px; text-align: center; }

/* ══ BODY ══ */
.sb-body { flex: 1; display: flex; min-height: 0; overflow: hidden; }

/* ══ SIDEBAR ══ */
.sb-sidebar {
  width: var(--sb-sidebar-w);
  background: var(--sb-sidebar-bg);
  border-right: 1px solid var(--sb-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  z-index: 50;
  padding: 8px 0;
}
.sb-sidebar:hover { width: var(--sb-sidebar-exp); }

.sb-nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  color: var(--sb-text-2);
  border-left: 3px solid transparent;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
  overflow: hidden;
  text-decoration: none;
  margin: 1px 6px;
  border-radius: var(--r-md);
  border-left: none;
}
.sb-nav-item:hover { background: var(--sb-hover); color: var(--sb-text); }
.sb-nav-item.active {
  background: var(--sb-accent-bg);
  color: var(--sb-accent);
}
.sb-nav-item.active .sb-nav-icon { opacity: 1; }

.sb-nav-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  opacity: 0.55;
  transition: opacity 0.12s;
}
.sb-nav-item:hover .sb-nav-icon { opacity: 0.85; }
.sb-nav-label { font-size: 13px; font-weight: 500; }

/* ══ SPA Content ══ */
.sb-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  min-width: 0;
  background: var(--sb-bg);
}
.sb-content::-webkit-scrollbar { width: 5px; }
.sb-content::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }

/* ══ Components ══ */
.sb-page-title {
  font-size: 18px; font-weight: 700;
  color: var(--sb-text); margin-bottom: 4px;
}
.sb-page-sub {
  font-size: 13px; color: var(--sb-muted); margin-bottom: 18px;
}

.sb-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.sb-stat {
  flex: 1; min-width: 110px;
  background: var(--sb-card);
  border: 1px solid var(--sb-card-border);
  border-radius: var(--r-lg);
  padding: 14px 18px;
  box-shadow: var(--sb-shadow);
}
.sb-stat-label { font-size: 11px; color: var(--sb-muted); margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.4px; }
.sb-stat-val   { font-size: 24px; font-weight: 700; color: var(--sb-text); }
.sb-stat-val.gold { color: var(--sb-accent); }

.sb-card {
  background: var(--sb-card);
  border: 1px solid var(--sb-card-border);
  border-radius: var(--r-lg);
  padding: 18px 20px;
  margin-bottom: 14px;
  box-shadow: var(--sb-shadow);
}
.sb-card-title { font-size: 15px; font-weight: 700; color: var(--sb-text); margin-bottom: 3px; }
.sb-card-sub   { font-size: 12px; color: var(--sb-muted); margin-bottom: 14px; }

.sb-placeholder {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 48px 20px; color: var(--sb-muted); gap: 10px;
}
.sb-ph-icon { font-size: 36px; opacity: 0.25; }
.sb-ph-text { font-size: 13px; color: var(--sb-muted); }

#sb-loading {
  color: var(--sb-muted); font-size: 13px; padding: 20px 0;
  display: flex; align-items: center; gap: 8px;
}
#sb-loading::before {
  content: '';
  width: 14px; height: 14px;
  border: 2px solid var(--sb-border);
  border-top-color: var(--sb-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Divider */
.sb-sidebar-divider {
  height: 1px; background: var(--sb-border);
  margin: 6px 12px;
}
"""

with open(os.path.join(CSS, "theme.css"), "w", encoding="utf-8") as f:
    f.write(THEME)
print("✅ theme.css — light gray LINE OA style")

# ══════════════════════════════════════════════
# 2. แก้ index.html — ปรับ icon + sidebar divider + shop dropdown header
# ══════════════════════════════════════════════
IDX = os.path.join(BASE, "index.html")
with open(IDX, "r", encoding="utf-8") as f:
    html = f.read()

# ปรับ icon sidebar ให้ modern SVG-style emoji
icon_map = {
    '<span class="sb-nav-icon">⌂</span>': '<span class="sb-nav-icon">🏠</span>',
    '<span class="sb-nav-icon">📈</span>': '<span class="sb-nav-icon">📈</span>',
    '<span class="sb-nav-icon">🔥</span>': '<span class="sb-nav-icon">🔥</span>',
    '<span class="sb-nav-icon">✦</span>':  '<span class="sb-nav-icon">🤖</span>',
    '<span class="sb-nav-icon">👥</span>': '<span class="sb-nav-icon">👥</span>',
    '<span class="sb-nav-icon">⚙</span>':  '<span class="sb-nav-icon">⚙️</span>',
}
for old, new in icon_map.items():
    html = html.replace(old, new)

# เพิ่ม header ใน shop dropdown
old_dd = '<div class="sb-shop-dropdown" id="shopDropdown">'
new_dd = '<div class="sb-shop-dropdown" id="shopDropdown"><div class="sb-dd-header">ร้านค้าของฉัน</div>'
html = html.replace(old_dd, new_dd, 1)

# ปรับ profile icon
html = html.replace(
    '<div class="sb-profile-dd-item" onclick="sbNavigate(\'settings\')">',
    '<div class="sb-profile-dd-item" onclick="sbNavigate(\'settings\')"><span class="sb-profile-dd-icon">⚙️</span>'
)
html = html.replace(
    '<div class="sb-profile-dd-item danger" onclick="sbLogout()">',
    '<div class="sb-profile-dd-item danger" onclick="sbLogout()"><span class="sb-profile-dd-icon">🚪</span>'
)

# ปรับ module icon
html = html.replace(
    '<span class="sb-topnav-icon">⊡</span> POS',
    '<span class="sb-topnav-icon">🛒</span> POS'
)
html = html.replace(
    '<span class="sb-topnav-icon">◌</span> Chat',
    '<span class="sb-topnav-icon">💬</span> Chat'
)
html = html.replace(
    '<span class="sb-topnav-icon">↗</span> Auto Post',
    '<span class="sb-topnav-icon">📣</span> Auto Post'
)

# เพิ่ม divider ใน sidebar
html = html.replace(
    """    <a class="sb-nav-item" data-page="staff" onclick="sbNavigate('staff')">""",
    """    <div class="sb-sidebar-divider"></div>
    <a class="sb-nav-item" data-page="staff" onclick="sbNavigate('staff')">"""
)

with open(IDX, "w", encoding="utf-8") as f:
    f.write(html)
print("✅ index.html — icons + dropdown header updated")

# ══════════════════════════════════════════════
# 3. แก้ pages/home.html ให้สวยขึ้น
# ══════════════════════════════════════════════
HOME = """<!doctype html>
<html lang="th">
<head><meta charset="utf-8"><title>หน้าหลัก</title></head>
<body>
<div class="sb-page-title">หน้าหลัก</div>
<div class="sb-page-sub">สรุปภาพรวมร้านค้าวันนี้</div>

<div class="sb-stats">
  <div class="sb-stat">
    <div class="sb-stat-label">💰 ยอดขายวันนี้</div>
    <div class="sb-stat-val gold">—</div>
  </div>
  <div class="sb-stat">
    <div class="sb-stat-label">📦 ออเดอร์ใหม่</div>
    <div class="sb-stat-val">—</div>
  </div>
  <div class="sb-stat">
    <div class="sb-stat-label">👤 ลูกค้าใหม่</div>
    <div class="sb-stat-val">—</div>
  </div>
  <div class="sb-stat">
    <div class="sb-stat-label">⚡ Credits คงเหลือ</div>
    <div class="sb-stat-val gold">—</div>
  </div>
</div>

<div class="sb-card">
  <div class="sb-card-title">ภาพรวมกิจกรรม</div>
  <div class="sb-card-sub">สรุปกิจกรรมร้านค้าวันนี้</div>
  <div class="sb-placeholder">
    <div class="sb-ph-icon">📊</div>
    <div class="sb-ph-text">เชื่อมต่อ POS เพื่อดูสถิติการขาย</div>
  </div>
</div>
</body>
</html>"""

with open(os.path.join(BASE, "pages", "home.html"), "w", encoding="utf-8") as f:
    f.write(HOME)
print("✅ pages/home.html updated")
print("\n🎉 เสร็จ — Ctrl+Shift+R แล้วทดสอบ")
