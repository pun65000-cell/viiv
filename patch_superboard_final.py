#!/usr/bin/env python3
# patch_superboard_final.py
# python3 ~/viiv/patch_superboard_final.py

import os

BASE = os.path.expanduser("~/viiv/frontend/superboard")
CSS  = os.path.join(BASE, "css")
IDX  = os.path.join(BASE, "index.html")

# ══════════════════════════════════════════════
# theme.css — copy exact จาก platform dashboard
# ══════════════════════════════════════════════
THEME = """:root {
  --accent:        #e8b93e;
  --accent-hover:  #d4a52c;
  --accent-active: #bf941e;
  --accent-dim:    rgba(232,185,62,0.12);
  --accent-border: rgba(232,185,62,0.6);
  --bg-main:       #1a1a1a;
  --sidebar-bg:    #0e0e0e;
  --sidebar-border:#222222;
  --content-bg:    #f0ede8;
  --card-bg:       #ffffff;
  --card-border:   #e0ddd6;
  --text:          #1f2937;
  --muted:         #6b7280;
  --nav-text:      #c8c8c8;
  --nav-label:     #888888;
  --nav-hover:     #1a1a1a;
  --border:        rgba(0,0,0,0.10);
  --r-md: 9px; --r-lg: 12px; --r-xl: 14px;
  --font: 'Segoe UI', system-ui, -apple-system, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font); font-size: 14px;
  background: var(--bg-main); color: var(--text);
  height: 100vh; overflow: hidden;
  display: flex; flex-direction: column;
}

/* ── TOPBAR ── */
.sb-topbar {
  height: 50px; min-height: 50px;
  background: #f8f6f2;
  border-bottom: 1px solid #dddddd;
  display: flex; align-items: center;
  padding: 0 18px; gap: 10px;
  z-index: 100; flex-shrink: 0;
}
.sb-logo {
  font-size: 16px; font-weight: 800;
  letter-spacing: 2px; color: var(--accent);
  text-decoration: none; flex-shrink: 0;
  padding-right: 14px;
  border-right: 1px solid #dddddd;
}
.sb-shop-wrap { position: relative; flex-shrink: 0; }
.sb-shop-btn {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border: 1px solid var(--border);
  border-radius: var(--r-md); padding: 5px 10px 5px 6px;
  cursor: pointer; color: var(--text);
  transition: border-color 0.12s;
}
.sb-shop-btn:hover { border-color: rgba(0,0,0,0.2); }
.sb-shop-avatar {
  width: 26px; height: 26px; border-radius: 7px;
  background: var(--accent-dim); border: 1.5px solid var(--accent-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: var(--accent); flex-shrink: 0;
}
.sb-shop-name  { font-size: 13px; font-weight: 600; color: var(--text); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-shop-sub   { font-size: 10px; color: var(--muted); }
.sb-shop-star  { font-size: 10px; color: var(--accent); margin-left: 2px; }
.sb-shop-arrow { font-size: 10px; color: var(--muted); margin-left: 4px; }
.sb-shop-dropdown {
  display: none; position: absolute; top: calc(100% + 6px); left: 0;
  background: #fff; border: 1px solid var(--border);
  border-radius: var(--r-lg); min-width: 210px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.10); z-index: 999; overflow: hidden;
}
.sb-shop-dropdown.open { display: block; }
.sb-dd-header {
  padding: 9px 14px 7px; font-size: 10px; font-weight: 700;
  color: var(--muted); letter-spacing: 0.6px; text-transform: uppercase;
  border-bottom: 1px solid #eee;
}
.sb-shop-dd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px; cursor: pointer; font-size: 13px;
  color: var(--text); transition: background 0.1s;
}
.sb-shop-dd-item:hover { background: #f5f3ef; }
.sb-shop-dd-item.active { background: var(--accent-dim); color: var(--accent); font-weight: 600; }

/* topnav modules */
.sb-topnav { display: flex; align-items: center; gap: 2px; margin-left: 4px; }
.sb-topnav-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: var(--r-md);
  border: none; background: transparent;
  color: var(--muted); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: background 0.1s, color 0.1s; white-space: nowrap;
}
.sb-topnav-btn:hover { background: #f0ede8; color: var(--text); }
.sb-topnav-btn.active { background: var(--accent-dim); color: var(--accent); font-weight: 700; }
.sb-topnav-icon { font-size: 14px; }
.sb-spacer { flex: 1; }

/* profile */
.sb-profile-wrap { position: relative; }
.sb-profile-btn {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border: 1px solid var(--border);
  border-radius: var(--r-md); padding: 4px 10px 4px 6px;
  cursor: pointer; color: var(--text); transition: border-color 0.12s;
}
.sb-profile-btn:hover { border-color: rgba(0,0,0,0.2); }
.sb-profile-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #1a1200;
}
.sb-profile-name  { font-size: 13px; font-weight: 600; color: var(--text); }
.sb-profile-arrow { font-size: 10px; color: var(--muted); }
.sb-profile-dropdown {
  display: none; position: absolute; top: calc(100% + 6px); right: 0;
  background: #fff; border: 1px solid var(--border);
  border-radius: var(--r-lg); min-width: 175px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.10); z-index: 999; overflow: hidden; padding: 4px;
}
.sb-profile-dropdown.open { display: block; }
.sb-profile-dd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; cursor: pointer; font-size: 13px;
  color: var(--text); border-radius: var(--r-md);
  transition: background 0.1s; text-decoration: none;
}
.sb-profile-dd-item:hover { background: #f5f3ef; }
.sb-profile-dd-item.danger { color: #d03030; }
.sb-profile-dd-item.danger:hover { background: #fff0f0; }

/* ── BODY ── */
.sb-body { flex: 1; display: flex; min-height: 0; overflow: hidden; }

/* ── SIDEBAR ── */
.sb-sidebar {
  width: 56px; background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex; flex-direction: column;
  overflow: hidden; transition: width 0.18s ease;
  flex-shrink: 0; z-index: 50; padding: 8px 0;
  height: 100%;
}
.sb-sidebar:hover { width: 220px; }

.sb-nav-group-label {
  font-size: 9px; font-weight: 700; color: var(--nav-label);
  padding: 10px 16px 3px; letter-spacing: 0.8px; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; opacity: 0; transition: opacity 0.15s;
}
.sb-sidebar:hover .sb-nav-group-label { opacity: 1; }

.sb-nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 16px; cursor: pointer; color: var(--nav-text);
  border-left: 3px solid transparent;
  transition: background 0.1s, color 0.1s;
  white-space: nowrap; overflow: hidden; text-decoration: none;
}
.sb-nav-item:hover { background: var(--nav-hover); color: #d0d0d0; }
.sb-nav-item.active {
  background: var(--accent-dim); color: var(--accent);
  border-left-color: var(--accent); font-weight: 600;
}
.sb-nav-icon {
  font-size: 16px; flex-shrink: 0; width: 22px;
  text-align: center; opacity: 0.7;
}
.sb-nav-item:hover .sb-nav-icon { opacity: 0.9; }
.sb-nav-item.active .sb-nav-icon { opacity: 1; }
.sb-nav-label { font-size: 13px; }
.sb-sidebar-divider { height: 1px; background: #222; margin: 6px 12px; }
.sb-sidebar-footer {
  margin-top: auto; padding: 10px 14px;
  border-top: 1px solid var(--sidebar-border);
  font-size: 10px; color: var(--nav-label);
  text-align: center; white-space: nowrap; overflow: hidden;
}

/* ── CONTENT ── */
.sb-content {
  flex: 1; overflow-y: auto; padding: 20px 24px;
  min-width: 0; background: var(--content-bg);
}
.sb-content::-webkit-scrollbar { width: 5px; }
.sb-content::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }

/* ── COMPONENTS ── */
.sb-page-title { font-size: 18px; font-weight: 600; margin-bottom: 4px; color: var(--text); }
.sb-page-sub   { font-size: 13px; color: var(--muted); margin-bottom: 18px; }
.sb-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.sb-stat {
  flex: 1; min-width: 110px;
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: var(--r-lg); padding: 14px 18px;
}
.sb-stat-label { font-size: 11px; color: var(--muted); margin-bottom: 5px; }
.sb-stat-val   { font-size: 24px; font-weight: 600; color: var(--text); }
.sb-stat-val.gold { color: #a07820; }
.sb-card {
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: var(--r-lg); padding: 18px 22px; margin-bottom: 14px;
}
.sb-card-title { font-size: 15px; font-weight: 600; margin-bottom: 3px; color: var(--text); }
.sb-card-sub   { font-size: 12px; color: var(--muted); margin-bottom: 14px; }
.sb-placeholder {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 48px 20px; color: var(--muted); gap: 10px;
}
.sb-ph-icon { font-size: 28px; opacity: 0.2; }
.sb-ph-text { font-size: 13px; color: var(--muted); }
#sb-loading { color: var(--muted); font-size: 13px; padding: 20px 0; }
"""

with open(os.path.join(CSS, "theme.css"), "w", encoding="utf-8") as f:
    f.write(THEME)
print("✅ theme.css — exact platform dashboard style")

# ══════════════════════════════════════════════
# index.html — เขียนใหม่ทั้งหมด clean
# ══════════════════════════════════════════════
INDEX = r"""<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VIIV Superboard</title>
  <link rel="stylesheet" href="/superboard/css/theme.css" />
</head>
<body>

<header class="sb-topbar">
  <a href="/superboard/" class="sb-logo">VIIV</a>

  <div class="sb-shop-wrap">
    <div class="sb-shop-btn" id="shopBtn" onclick="toggleShopDD()">
      <div class="sb-shop-avatar" id="shopAvatar">S</div>
      <div>
        <div style="display:flex;align-items:center;gap:4px;">
          <span class="sb-shop-name" id="shopName">My Shop</span>
          <span class="sb-shop-star">★</span>
        </div>
        <div class="sb-shop-sub">เลือกร้าน</div>
      </div>
      <span class="sb-shop-arrow">▾</span>
    </div>
    <div class="sb-shop-dropdown" id="shopDropdown">
      <div class="sb-dd-header">ร้านค้าของฉัน</div>
      <div id="shopList"><div class="sb-shop-dd-item"><span>กำลังโหลด...</span></div></div>
    </div>
  </div>

  <nav class="sb-topnav">
    <button class="sb-topnav-btn active" id="mod-pos" onclick="switchMod('pos',this)">
      <span class="sb-topnav-icon">⊡</span> POS
    </button>
    <button class="sb-topnav-btn" id="mod-chat" onclick="switchMod('chat',this)">
      <span class="sb-topnav-icon">◌</span> Chat
    </button>
    <button class="sb-topnav-btn" id="mod-autopost" onclick="switchMod('autopost',this)">
      <span class="sb-topnav-icon">↗</span> Auto Post
    </button>
  </nav>

  <div class="sb-spacer"></div>

  <div class="sb-profile-wrap">
    <div class="sb-profile-btn" onclick="toggleProfileDD()">
      <div class="sb-profile-avatar" id="profileAvatar">A</div>
      <span class="sb-profile-name" id="profileName">Admin</span>
      <span class="sb-profile-arrow">▾</span>
    </div>
    <div class="sb-profile-dropdown" id="profileDropdown">
      <div class="sb-profile-dd-item" onclick="sbNav('settings')">
        <span>⚙</span> แก้ไขโปรไฟล์
      </div>
      <div class="sb-profile-dd-item danger" onclick="sbLogout()">
        <span>⏻</span> ออกจากระบบ
      </div>
    </div>
  </div>
</header>

<div class="sb-body">
  <aside class="sb-sidebar">
    <div class="sb-nav-group-label">Main</div>
    <a class="sb-nav-item active" data-page="home" onclick="sbNav('home')">
      <span class="sb-nav-icon">⌂</span><span class="sb-nav-label">หน้าหลัก</span>
    </a>
    <a class="sb-nav-item" data-page="trends" onclick="sbNav('trends')">
      <span class="sb-nav-icon">↗</span><span class="sb-nav-label">เทรนขายดี</span>
    </a>
    <a class="sb-nav-item" data-page="hashtag" onclick="sbNav('hashtag')">
      <span class="sb-nav-icon">#</span><span class="sb-nav-label">แฮชแท็กมาแรง</span>
    </a>
    <a class="sb-nav-item" data-page="ai" onclick="sbNav('ai')">
      <span class="sb-nav-icon">✦</span><span class="sb-nav-label">AI ช่วยเหลือ</span>
    </a>
    <div class="sb-sidebar-divider"></div>
    <div class="sb-nav-group-label">Settings</div>
    <a class="sb-nav-item" data-page="staff" onclick="sbNav('staff')">
      <span class="sb-nav-icon">◎</span><span class="sb-nav-label">บุคลากร</span>
    </a>
    <a class="sb-nav-item" data-page="settings" onclick="sbNav('settings')">
      <span class="sb-nav-icon">⚙</span><span class="sb-nav-label">ตั้งค่าร้านค้า</span>
    </a>
    <div class="sb-sidebar-footer">VIIV v0.1.0</div>
  </aside>

  <main class="sb-content" id="sbContent">
    <div id="sb-loading">กำลังโหลด...</div>
  </main>
</div>

<script>
(function(){
'use strict';
var TOKEN_KEY = 'viiv_token';
function getToken(){ return localStorage.getItem(TOKEN_KEY); }

window.sbLogout = function(){
  if(confirm('ออกจากระบบ?')){ localStorage.removeItem(TOKEN_KEY); window.location.href='/platform/login.html'; }
};

window.sbNav = function(page){
  document.querySelectorAll('.sb-nav-item').forEach(function(el){ el.classList.toggle('active', el.dataset.page===page); });
  closeDD();
  var c = document.getElementById('sbContent');
  c.innerHTML = '<div id="sb-loading">กำลังโหลด...</div>';
  fetch('/superboard/pages/'+page+'.html')
    .then(function(r){ return r.text(); })
    .then(function(html){
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      var body = tmp.querySelector('body');
      c.innerHTML = body ? body.innerHTML : html;
      c.querySelectorAll('script').forEach(function(old){
        var s = document.createElement('script'); s.textContent = old.textContent; old.replaceWith(s);
      });
    })
    .catch(function(){ c.innerHTML='<div class="sb-placeholder"><div class="sb-ph-icon">⚠</div><div class="sb-ph-text">โหลดหน้าไม่ได้</div></div>'; });
};

window.switchMod = function(mod, btn){
  document.querySelectorAll('.sb-topnav-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
};

window.toggleShopDD = function(){
  document.getElementById('shopDropdown').classList.toggle('open');
  document.getElementById('profileDropdown').classList.remove('open');
};
window.toggleProfileDD = function(){
  document.getElementById('profileDropdown').classList.toggle('open');
  document.getElementById('shopDropdown').classList.remove('open');
};
function closeDD(){
  document.getElementById('shopDropdown').classList.remove('open');
  document.getElementById('profileDropdown').classList.remove('open');
}
document.addEventListener('click', function(e){
  if(!e.target.closest('.sb-shop-wrap') && !e.target.closest('.sb-profile-wrap')) closeDD();
});

window.selectShop = function(el, name){
  document.querySelectorAll('.sb-shop-dd-item').forEach(function(i){ i.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('shopName').textContent = name;
  document.getElementById('shopAvatar').textContent = name.charAt(0).toUpperCase();
  closeDD();
};

async function loadShops(){
  try{
    var token = getToken();
    var res = await fetch('/api/stores/', { headers: token?{'Authorization':'Bearer '+token}:{} });
    if(!res.ok) return;
    var data = await res.json();
    var shops = data.stores||data.data||data||[];
    if(!shops.length) return;
    var shop = shops[0];
    var name = shop.store_name||shop.name||'My Shop';
    document.getElementById('shopName').textContent = name;
    document.getElementById('shopAvatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('shopList').innerHTML = shops.map(function(s,i){
      var n = s.store_name||s.name||'Shop';
      return '<div class="sb-shop-dd-item'+(i===0?' active':'')+'" onclick="selectShop(this,\''+n+'\')">'+
        '<div class="sb-shop-avatar" style="width:22px;height:22px;border-radius:5px;background:var(--accent-dim);border:1px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--accent);">'+n.charAt(0)+'</div>'+
        '<span>'+n+'</span></div>';
    }).join('');
  }catch(e){}
}

document.addEventListener('DOMContentLoaded', function(){
  if(!getToken()){ window.location.href='/platform/login.html'; return; }
  loadShops();
  sbNav('home');
});
})();
</script>
</body>
</html>
"""

with open(IDX, "w", encoding="utf-8") as f:
    f.write(INDEX)
print("✅ index.html — clean rewrite")
print("\n🎉 เสร็จ — Purge Cloudflare + Ctrl+Shift+R")
