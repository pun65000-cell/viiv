#!/usr/bin/env python3
# build_superboard.py
# python3 ~/viiv/build_superboard.py

import os

BASE = os.path.expanduser("~/viiv/frontend/superboard")
CSS  = os.path.join(BASE, "css")
JS   = os.path.join(BASE, "js", "core")
PAGES= os.path.join(BASE, "pages")

for d in [BASE, CSS, JS, PAGES]:
    os.makedirs(d, exist_ok=True)

# ══════════════════════════════════════════════
# 1. css/theme.css
# ══════════════════════════════════════════════
THEME = """:root {
  --sb-bg:          #0f0f0f;
  --sb-topbar:      #141414;
  --sb-topbar-h:    52px;
  --sb-sidebar-w:   52px;
  --sb-sidebar-exp: 210px;
  --sb-border:      #242424;
  --sb-accent:      #e8b93e;
  --sb-accent-dim:  rgba(232,185,62,0.12);
  --sb-text:        #f0ede8;
  --sb-muted:       #666;
  --sb-hover:       rgba(255,255,255,0.05);
  --sb-card:        #1a1a1a;
  --sb-card-border: #2a2a2a;
  --r-md: 8px;
  --r-lg: 12px;
  --font: 'Segoe UI', system-ui, -apple-system, sans-serif;
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

/* ── Topbar ── */
.sb-topbar {
  height: var(--sb-topbar-h);
  min-height: var(--sb-topbar-h);
  background: var(--sb-topbar);
  border-bottom: 1px solid var(--sb-border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  z-index: 100;
  flex-shrink: 0;
}

/* logo */
.sb-logo {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 2px;
  color: var(--sb-accent);
  text-shadow: 0 0 20px rgba(232,185,62,0.3);
  text-decoration: none;
  flex-shrink: 0;
  padding-right: 12px;
  border-right: 1px solid var(--sb-border);
}

/* shop selector */
.sb-shop-wrap {
  position: relative;
  flex-shrink: 0;
}
.sb-shop-btn {
  display: flex; align-items: center; gap: 8px;
  background: var(--sb-hover);
  border: 1px solid var(--sb-border);
  border-radius: var(--r-md);
  padding: 5px 10px;
  cursor: pointer;
  color: var(--sb-text);
  transition: background 0.1s;
}
.sb-shop-btn:hover { background: rgba(255,255,255,0.08); }
.sb-shop-avatar {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--sb-accent-dim);
  border: 1.5px solid var(--sb-accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: var(--sb-accent);
  flex-shrink: 0;
}
.sb-shop-name { font-size: 13px; font-weight: 500; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-shop-star { font-size: 10px; color: var(--sb-accent); }
.sb-shop-arrow { font-size: 10px; color: var(--sb-muted); }

.sb-shop-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: #1e1e1e;
  border: 1px solid var(--sb-border);
  border-radius: var(--r-lg);
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 999;
  overflow: hidden;
}
.sb-shop-dropdown.open { display: block; }
.sb-shop-dd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
  border-bottom: 1px solid var(--sb-border);
}
.sb-shop-dd-item:last-child { border-bottom: none; }
.sb-shop-dd-item:hover { background: var(--sb-hover); }
.sb-shop-dd-item.active { color: var(--sb-accent); }

/* top nav modules */
.sb-topnav {
  display: flex; align-items: center; gap: 2px;
  margin-left: 8px;
}
.sb-topnav-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-md);
  border: none;
  background: transparent;
  color: var(--sb-muted);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
}
.sb-topnav-btn:hover { background: var(--sb-hover); color: var(--sb-text); }
.sb-topnav-btn.active {
  background: var(--sb-accent-dim);
  color: var(--sb-accent);
  font-weight: 600;
}
.sb-topnav-icon { font-size: 14px; }

/* spacer */
.sb-spacer { flex: 1; }

/* profile */
.sb-profile-wrap { position: relative; }
.sb-profile-btn {
  display: flex; align-items: center; gap: 8px;
  background: var(--sb-hover);
  border: 1px solid var(--sb-border);
  border-radius: var(--r-md);
  padding: 4px 10px 4px 6px;
  cursor: pointer;
  color: var(--sb-text);
  transition: background 0.1s;
}
.sb-profile-btn:hover { background: rgba(255,255,255,0.08); }
.sb-profile-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, #e8b93e, #bf941e);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #1a1200;
}
.sb-profile-name { font-size: 13px; font-weight: 500; }
.sb-profile-arrow { font-size: 10px; color: var(--sb-muted); }

.sb-profile-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #1e1e1e;
  border: 1px solid var(--sb-border);
  border-radius: var(--r-lg);
  min-width: 180px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 999;
  overflow: hidden;
}
.sb-profile-dropdown.open { display: block; }
.sb-profile-dd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
  border-bottom: 1px solid var(--sb-border);
  color: var(--sb-text);
  text-decoration: none;
}
.sb-profile-dd-item:last-child { border-bottom: none; }
.sb-profile-dd-item:hover { background: var(--sb-hover); }
.sb-profile-dd-item.danger { color: #e05555; }

/* ── Body layout ── */
.sb-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* ── Sidebar ── */
.sb-sidebar {
  width: var(--sb-sidebar-w);
  background: var(--sb-topbar);
  border-right: 1px solid var(--sb-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s ease;
  flex-shrink: 0;
  z-index: 50;
}
.sb-sidebar:hover { width: var(--sb-sidebar-exp); }

.sb-nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 13px 15px;
  cursor: pointer;
  color: var(--sb-muted);
  border-left: 3px solid transparent;
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-decoration: none;
}
.sb-nav-item:hover { background: var(--sb-hover); color: var(--sb-text); }
.sb-nav-item.active {
  background: var(--sb-accent-dim);
  color: var(--sb-accent);
  border-left-color: var(--sb-accent);
}
.sb-nav-icon { font-size: 18px; flex-shrink: 0; width: 22px; text-align: center; }
.sb-nav-label { font-size: 13px; font-weight: 500; }

/* ── SPA Content ── */
.sb-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  min-width: 0;
}
.sb-content::-webkit-scrollbar { width: 5px; }
.sb-content::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }

/* ── Cards ── */
.sb-card {
  background: var(--sb-card);
  border: 1px solid var(--sb-card-border);
  border-radius: var(--r-lg);
  padding: 18px 20px;
  margin-bottom: 16px;
}
.sb-card-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.sb-card-sub   { font-size: 12px; color: var(--sb-muted); margin-bottom: 14px; }

/* stats */
.sb-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.sb-stat {
  flex: 1; min-width: 110px;
  background: #111;
  border: 1px solid var(--sb-card-border);
  border-radius: var(--r-md);
  padding: 12px 16px;
}
.sb-stat-label { font-size: 11px; color: var(--sb-muted); margin-bottom: 4px; }
.sb-stat-val   { font-size: 22px; font-weight: 700; color: var(--sb-text); }
.sb-stat-val.gold { color: var(--sb-accent); }

/* placeholder */
.sb-placeholder {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 60px 20px; color: var(--sb-muted); gap: 10px;
}
.sb-ph-icon { font-size: 32px; opacity: 0.2; }
.sb-ph-text { font-size: 14px; }

/* loading */
#sb-loading {
  color: var(--sb-muted); font-size: 13px; padding: 20px 0;
}
"""

with open(os.path.join(CSS, "theme.css"), "w", encoding="utf-8") as f:
    f.write(THEME)
print("✅ css/theme.css")

# ══════════════════════════════════════════════
# 2. js/core/auth.js
# ══════════════════════════════════════════════
AUTH_JS = """// superboard/js/core/auth.js
const SB_TOKEN_KEY = 'viiv_token';

export function sbGetToken() {
  return localStorage.getItem(SB_TOKEN_KEY);
}

export function sbRequireAuth() {
  if (!localStorage.getItem(SB_TOKEN_KEY)) {
    window.location.href = '/platform/login.html';
    return false;
  }
  return true;
}

export function sbLogout() {
  localStorage.removeItem(SB_TOKEN_KEY);
  window.location.href = '/platform/login.html';
}

export function sbAuthHeader() {
  const t = sbGetToken();
  return t ? { 'Authorization': 'Bearer ' + t } : {};
}
"""
with open(os.path.join(JS, "auth.js"), "w", encoding="utf-8") as f:
    f.write(AUTH_JS)
print("✅ js/core/auth.js")

# ══════════════════════════════════════════════
# 3. pages/home.html
# ══════════════════════════════════════════════
HOME_HTML = """<!doctype html>
<html lang="th">
<head><meta charset="utf-8"><title>Home</title></head>
<body>
<div class="sb-stats">
  <div class="sb-stat"><div class="sb-stat-label">ยอดขายวันนี้</div><div class="sb-stat-val gold">—</div></div>
  <div class="sb-stat"><div class="sb-stat-label">ออเดอร์ใหม่</div><div class="sb-stat-val">—</div></div>
  <div class="sb-stat"><div class="sb-stat-label">ลูกค้าใหม่</div><div class="sb-stat-val">—</div></div>
  <div class="sb-stat"><div class="sb-stat-label">Credits คงเหลือ</div><div class="sb-stat-val gold">—</div></div>
</div>
<div class="sb-card">
  <div class="sb-card-title">ภาพรวม</div>
  <div class="sb-card-sub">สรุปกิจกรรมร้านค้าวันนี้</div>
  <div class="sb-placeholder"><div class="sb-ph-icon">📊</div><div class="sb-ph-text">ข้อมูลกำลังโหลด — เชื่อมต่อ POS เพื่อดูสถิติ</div></div>
</div>
</body>
</html>"""

with open(os.path.join(PAGES, "home.html"), "w", encoding="utf-8") as f:
    f.write(HOME_HTML)

# pages อื่นๆ placeholder
PAGES_DEF = {
    "trends.html":   ("📈", "เทรนสินค้าขายดี",   "วิเคราะห์สินค้าที่ขายดีในช่วงเวลานี้"),
    "hashtag.html":  ("🔥", "แฮชแท็กมาแรง",      "hashtag และ keyword ที่กำลังเป็นกระแส"),
    "ai.html":       ("✦",  "AI ช่วยเหลือ",        "ผู้ช่วย AI สำหรับการขายและการตลาด"),
    "staff.html":    ("👥", "บุคลากร",             "จัดการทีมงานและสิทธิ์การเข้าถึง"),
    "settings.html": ("⚙",  "ตั้งค่าร้านค้า",      "ตั้งค่าข้อมูลร้านและการเชื่อมต่อ"),
}
for fname, (icon, title, sub) in PAGES_DEF.items():
    html = f"""<!doctype html>
<html lang="th"><head><meta charset="utf-8"><title>{title}</title></head>
<body>
<div class="sb-card">
  <div class="sb-card-title">{title}</div>
  <div class="sb-card-sub">{sub}</div>
  <div class="sb-placeholder"><div class="sb-ph-icon">{icon}</div><div class="sb-ph-text">{title} — coming soon</div></div>
</div>
</body></html>"""
    with open(os.path.join(PAGES, fname), "w", encoding="utf-8") as f:
        f.write(html)

print("✅ pages/ (home + 5 placeholder)")

# ══════════════════════════════════════════════
# 4. index.html — SPA shell
# ══════════════════════════════════════════════
INDEX_HTML = r"""<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VIIV Superboard</title>
  <link rel="stylesheet" href="/superboard/css/theme.css" />
</head>
<body>

<!-- ══ TOPBAR ══ -->
<header class="sb-topbar">

  <!-- Logo -->
  <a href="/superboard/" class="sb-logo">VIIV</a>

  <!-- Shop selector -->
  <div class="sb-shop-wrap">
    <div class="sb-shop-btn" id="shopBtn" onclick="toggleShopDD()">
      <div class="sb-shop-avatar" id="shopAvatar">S</div>
      <div>
        <div style="display:flex;align-items:center;gap:4px;">
          <span class="sb-shop-name" id="shopName">My Shop</span>
          <span class="sb-shop-star">★</span>
        </div>
        <div style="font-size:10px;color:var(--sb-muted);">เลือกร้าน</div>
      </div>
      <span class="sb-shop-arrow">▾</span>
    </div>
    <div class="sb-shop-dropdown" id="shopDropdown">
      <div class="sb-shop-dd-item active" id="shopList">
        <div class="sb-shop-avatar">S</div>
        <span>กำลังโหลด...</span>
      </div>
    </div>
  </div>

  <!-- Top nav modules -->
  <nav class="sb-topnav">
    <button class="sb-topnav-btn active" id="mod-pos" onclick="switchModule('pos',this)">
      <span class="sb-topnav-icon">⊡</span> POS
    </button>
    <button class="sb-topnav-btn" id="mod-chat" onclick="switchModule('chat',this)">
      <span class="sb-topnav-icon">◌</span> Chat
    </button>
    <button class="sb-topnav-btn" id="mod-autopost" onclick="switchModule('autopost',this)">
      <span class="sb-topnav-icon">↗</span> Auto Post
    </button>
  </nav>

  <div class="sb-spacer"></div>

  <!-- Profile -->
  <div class="sb-profile-wrap">
    <div class="sb-profile-btn" onclick="toggleProfileDD()">
      <div class="sb-profile-avatar" id="profileAvatar">A</div>
      <span class="sb-profile-name" id="profileName">Admin</span>
      <span class="sb-profile-arrow">▾</span>
    </div>
    <div class="sb-profile-dropdown" id="profileDropdown">
      <div class="sb-profile-dd-item" onclick="sbNavigate('settings')">
        <span>⚙</span> แก้ไขโปรไฟล์
      </div>
      <div class="sb-profile-dd-item danger" onclick="sbLogout()">
        <span>⏻</span> ออกจากระบบ
      </div>
    </div>
  </div>

</header>

<!-- ══ BODY ══ -->
<div class="sb-body">

  <!-- Sidebar -->
  <aside class="sb-sidebar">
    <a class="sb-nav-item active" data-page="home" onclick="sbNavigate('home')">
      <span class="sb-nav-icon">⌂</span>
      <span class="sb-nav-label">หน้าหลัก</span>
    </a>
    <a class="sb-nav-item" data-page="trends" onclick="sbNavigate('trends')">
      <span class="sb-nav-icon">📈</span>
      <span class="sb-nav-label">เทรนขายดี</span>
    </a>
    <a class="sb-nav-item" data-page="hashtag" onclick="sbNavigate('hashtag')">
      <span class="sb-nav-icon">🔥</span>
      <span class="sb-nav-label">แฮชแท็กมาแรง</span>
    </a>
    <a class="sb-nav-item" data-page="ai" onclick="sbNavigate('ai')">
      <span class="sb-nav-icon">✦</span>
      <span class="sb-nav-label">AI ช่วยเหลือ</span>
    </a>
    <a class="sb-nav-item" data-page="staff" onclick="sbNavigate('staff')">
      <span class="sb-nav-icon">👥</span>
      <span class="sb-nav-label">บุคลากร</span>
    </a>
    <a class="sb-nav-item" data-page="settings" onclick="sbNavigate('settings')">
      <span class="sb-nav-icon">⚙</span>
      <span class="sb-nav-label">ตั้งค่าร้านค้า</span>
    </a>
  </aside>

  <!-- SPA content -->
  <main class="sb-content" id="sbContent">
    <div id="sb-loading">กำลังโหลด...</div>
  </main>

</div>

<script>
(function() {
'use strict';

var TOKEN_KEY = 'viiv_token';

// ── Auth ────────────────────────────────────
function getToken() { return localStorage.getItem(TOKEN_KEY); }

function sbLogout() {
  if (confirm('ออกจากระบบ?')) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/platform/login.html';
  }
}
window.sbLogout = sbLogout;

// ── SPA Router ───────────────────────────────
function sbNavigate(page) {
  // update sidebar active
  document.querySelectorAll('.sb-nav-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // close dropdowns
  closeAllDD();

  // load page
  var content = document.getElementById('sbContent');
  content.innerHTML = '<div id="sb-loading">กำลังโหลด...</div>';

  fetch('/superboard/pages/' + page + '.html')
    .then(function(r) { return r.text(); })
    .then(function(html) {
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      var body = tmp.querySelector('body');
      content.innerHTML = body ? body.innerHTML : html;
      // re-run scripts
      content.querySelectorAll('script').forEach(function(old) {
        var s = document.createElement('script');
        s.textContent = old.textContent;
        old.replaceWith(s);
      });
    })
    .catch(function() {
      content.innerHTML = '<div class="sb-placeholder"><div class="sb-ph-icon">⚠</div><div class="sb-ph-text">โหลดหน้าไม่ได้</div></div>';
    });
}
window.sbNavigate = sbNavigate;

// ── Module switcher ──────────────────────────
function switchModule(mod, btn) {
  document.querySelectorAll('.sb-topnav-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  // TODO: เปลี่ยน context ตาม module
}
window.switchModule = switchModule;

// ── Shop dropdown ────────────────────────────
function toggleShopDD() {
  var dd = document.getElementById('shopDropdown');
  dd.classList.toggle('open');
  document.getElementById('profileDropdown').classList.remove('open');
}
window.toggleShopDD = toggleShopDD;

function toggleProfileDD() {
  var dd = document.getElementById('profileDropdown');
  dd.classList.toggle('open');
  document.getElementById('shopDropdown').classList.remove('open');
}
window.toggleProfileDD = toggleProfileDD;

function closeAllDD() {
  document.getElementById('shopDropdown').classList.remove('open');
  document.getElementById('profileDropdown').classList.remove('open');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.sb-shop-wrap') && !e.target.closest('.sb-profile-wrap')) {
    closeAllDD();
  }
});

// ── Load shops ───────────────────────────────
async function loadShops() {
  try {
    var token = getToken();
    var res = await fetch('/api/stores/', {
      headers: token ? {'Authorization': 'Bearer ' + token} : {}
    });
    if (!res.ok) return;
    var data = await res.json();
    var shops = data.stores || data.data || data || [];
    if (!shops.length) return;

    // set active shop
    var shop = shops[0];
    var name = shop.store_name || shop.name || 'My Shop';
    var initial = name.charAt(0).toUpperCase();
    document.getElementById('shopName').textContent = name;
    document.getElementById('shopAvatar').textContent = initial;
    document.getElementById('profileAvatar').textContent = initial;

    // build dropdown
    var list = document.getElementById('shopList');
    list.parentNode.innerHTML = shops.map(function(s, i) {
      var n = s.store_name || s.name || 'Shop';
      return '<div class="sb-shop-dd-item' + (i===0?' active':'') + '" onclick="selectShop(this,\''+n+'\')">' +
        '<div class="sb-shop-avatar">' + n.charAt(0) + '</div>' +
        '<span>' + n + '</span>' +
        '</div>';
    }).join('');
  } catch(e) {}
}

window.selectShop = function(el, name) {
  document.querySelectorAll('.sb-shop-dd-item').forEach(function(i){i.classList.remove('active');});
  el.classList.add('active');
  document.getElementById('shopName').textContent = name;
  document.getElementById('shopAvatar').textContent = name.charAt(0).toUpperCase();
  closeAllDD();
};

// ── Init ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  if (!getToken()) {
    window.location.href = '/platform/login.html';
    return;
  }
  loadShops();
  sbNavigate('home');
});

})();
</script>

</body>
</html>
"""

with open(os.path.join(BASE, "index.html"), "w", encoding="utf-8") as f:
    f.write(INDEX_HTML)
print("✅ index.html")

# ══════════════════════════════════════════════
# 5. แก้ Caddyfile เพิ่ม /superboard route ใน *.viiv.me
# ══════════════════════════════════════════════
CADDY = "/etc/caddy/Caddyfile"
try:
    with open(CADDY, "r") as f:
        cad = f.read()

    old = """*.viiv.me {
    @notOwner host owner.viiv.me
    @notApi host api.viiv.me
    @notConcore host concore.viiv.me
    handle {
        root * /home/viivadmin/viiv/frontend
        try_files {path} /product_ui.html"""

    new = """*.viiv.me {
    @notOwner host owner.viiv.me
    @notApi host api.viiv.me
    @notConcore host concore.viiv.me
    handle /api/* {
        reverse_proxy localhost:8000
    }
    handle /superboard/* {
        root * /home/viivadmin/viiv/frontend
        file_server
    }
    handle {
        root * /home/viivadmin/viiv/frontend
        try_files {path} /product_ui.html"""

    if old in cad:
        cad = cad.replace(old, new)
        with open(CADDY, "w") as f:
            f.write(cad)
        print("✅ Caddyfile updated — /superboard + /api routes")
        os.system("sudo systemctl restart caddy && echo '✅ Caddy restarted'")
    else:
        print("⚠️  Caddyfile pattern ไม่ตรง — แก้เองใน VS Code")
        print("   เพิ่มใน *.viiv.me block:")
        print("   handle /superboard/* {")
        print("       root * /home/viivadmin/viiv/frontend")
        print("       file_server")
        print("   }")
except Exception as e:
    print(f"⚠️  Caddyfile: {e}")

# ── สรุป ──────────────────────────────────────
print("\n📁 โครงสร้าง Superboard:")
for root, dirs, files in os.walk(BASE):
    dirs[:] = sorted(dirs)
    level = root.replace(BASE, '').count(os.sep)
    print('  ' * level + os.path.basename(root) + '/')
    for f in sorted(files):
        print('  ' * (level+1) + f)

print("\n🎉 เสร็จ! เปิดได้ที่:")
print("   https://{ชื่อshop}.viiv.me/superboard/")
print("   หรือทดสอบ: https://concore.viiv.me/superboard/")
