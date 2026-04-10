#!/usr/bin/env python3
# build_merchant_dashboard.py
# python3 ~/viiv/build_merchant_dashboard.py

import os

MERCHANT_UI = os.path.expanduser("~/viiv/modules/pos/merchant/ui/dashboard")

DASHBOARD_HTML = r"""<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>My Shop POS</title>
  <style>
    :root {
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
      display: flex; height: 100vh; overflow: hidden;
    }

    /* ── SIDEBAR ── */
    .sidebar {
      width: 210px; min-width: 210px; height: 100vh;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--sidebar-border);
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    .brand {
      display: flex; align-items: center; gap: 8px;
      padding: 18px 16px 14px;
      border-bottom: 1px solid var(--sidebar-border);
    }
    .brand-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
    .brand-title .viiv { color: var(--accent); }
    .brand-title .platform { color: #ffffff; }
    .brand-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); margin-left: 2px; }

    .nav { flex: 1; padding: 10px 0; overflow-y: auto; }
    .nav-group-label {
      font-size: 10px; font-weight: 600; color: var(--nav-label);
      padding: 10px 16px 4px; letter-spacing: 0.8px; text-transform: uppercase;
    }
    .menu a {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 14px 9px 16px;
      color: var(--nav-text); text-decoration: none; font-size: 13px;
      border-left: 3px solid transparent;
      transition: background 0.12s, color 0.12s; white-space: nowrap;
    }
    .menu a .nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; opacity: 0.7; }
    .menu a:hover { background: var(--nav-hover); color: #d0d0d0; }
    .menu a.active {
      background: var(--accent-dim); color: var(--accent);
      border-left-color: var(--accent); font-weight: 600;
    }
    .menu a.active .nav-icon { opacity: 1; }

    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--sidebar-border);
      font-size: 11px; color: var(--accent); text-align: center;
      text-decoration: none; display: block;
      transition: opacity 0.12s;
    }
    .sidebar-footer:hover { opacity: 0.8; }

    /* ── MAIN ── */
    .main {
      flex: 1; display: flex; flex-direction: column;
      background: var(--content-bg); min-width: 0; height: 100vh; overflow: hidden;
    }

    /* topbar */
    .topbar {
      background: #f8f6f2; border-bottom: 1px solid #ddd;
      height: 50px; padding: 0 22px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between;
    }
    .topbar-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .topbar-right  { display: flex; align-items: center; gap: 12px; }
    .badge-shop {
      font-size: 11px; font-weight: 600;
      background: var(--accent); color: #1a1200;
      padding: 3px 12px; border-radius: 20px;
    }
    .profile-btn {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; color: var(--muted); cursor: pointer;
      padding: 4px 8px; border-radius: 8px;
      border: 1px solid var(--border); background: #fff; position: relative;
    }
    .profile-btn:hover { border-color: rgba(0,0,0,0.18); }
    .dropdown {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: #fff; border: 1px solid var(--border);
      border-radius: 10px; padding: 6px; min-width: 160px;
      display: none; box-shadow: 0 8px 20px rgba(0,0,0,0.10); z-index: 100;
    }
    .dropdown.open { display: block; }
    .dropdown button {
      width: 100%; text-align: left; padding: 8px 10px;
      border-radius: 8px; border: 0; background: transparent;
      color: var(--text); cursor: pointer; font-size: 13px;
    }
    .dropdown button:hover { background: #f5f3ef; }

    /* actionbar */
    .actionbar {
      background: #fff; border: 1px solid var(--card-border);
      border-radius: var(--r-lg); padding: 8px 14px;
      margin: 16px 20px 0;
      display: flex; align-items: center; gap: 10px;
    }
    .actionbar.hidden { display: none; }
    .actionbar input {
      flex: 1; padding: 7px 12px; border-radius: 8px;
      border: 1px solid var(--border); background: #faf9f7;
      color: var(--text); font-size: 13px; outline: none;
    }
    .actionbar input:focus { border-color: var(--accent); }

    /* buttons */
    .btn {
      padding: 7px 14px; border-radius: var(--r-md);
      border: 1px solid var(--border); background: #fff;
      color: var(--text); cursor: pointer; font-size: 13px; font-weight: 500;
    }
    .btn:hover { background: #f5f3ef; }
    .btn-accent {
      background: var(--accent); border-color: var(--accent-active);
      color: #1a1200; font-weight: 700;
    }
    .btn-accent:hover { background: var(--accent-hover); }

    /* content */
    .content-wrap { flex: 1; padding: 16px 20px 20px; overflow-y: auto; min-height: 0; }
    .card {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: var(--r-lg); padding: 22px 24px; min-height: 60vh;
    }
    .card-heading { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    .card-sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; }

    /* placeholder */
    .page-placeholder {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 60px 20px; color: var(--muted); gap: 10px;
    }
    .ph-icon { font-size: 32px; opacity: 0.2; }
    .ph-text { font-size: 14px; }

    /* stats */
    .stats-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat {
      flex: 1; min-width: 100px; background: #f8f6f2;
      border: 1px solid #eae8e2; border-radius: var(--r-md); padding: 12px 16px;
    }
    .stat-label { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
    .stat-val   { font-size: 22px; font-weight: 600; color: var(--text); }
    .stat-val.gold { color: #a07820; }
  </style>
</head>
<body>

<!-- ═══ SIDEBAR ═══ -->
<div class="sidebar">
  <div class="brand">
    <div class="brand-title">
      <span class="viiv">My Shop</span> <span class="platform">POS</span>
    </div>
    <div class="brand-dot"></div>
  </div>

  <nav class="nav">
    <div class="menu" id="navMenu">
      <a href="#" data-page="dashboard" class="active">
        <span class="nav-icon">▣</span> Dashboard
      </a>
      <a href="#" data-page="affiliate">
        <span class="nav-icon">◈</span> Affiliate
      </a>
      <a href="#" data-page="easysale">
        <span class="nav-icon">⚡</span> EasySale
      </a>
      <a href="#" data-page="products">
        <span class="nav-icon">⊞</span> สินค้า/สโตร์
      </a>
      <a href="#" data-page="orders">
        <span class="nav-icon">≡</span> คำสั่งซื้อ
      </a>
      <a href="#" data-page="members">
        <span class="nav-icon">◎</span> สมาชิกร้านค้า
      </a>
      <a href="#" data-page="finance">
        <span class="nav-icon">◉</span> บัญชีการเงิน
      </a>
      <a href="#" data-page="settings">
        <span class="nav-icon">⚙</span> ตั้งค่าร้านค้า
      </a>
    </div>
  </nav>

  <a class="sidebar-footer" href="https://viiv.me" target="_blank">
    VIIV POS v0.1.0
  </a>
</div>

<!-- ═══ MAIN ═══ -->
<div class="main">
  <div class="topbar">
    <span class="topbar-title" id="topbarTitle">Dashboard</span>
    <div class="topbar-right">
      <span class="badge-shop" id="shopBadge">My Shop</span>
      <div class="profile-btn" id="profileBtn">
        <span id="profileName">Admin</span> <span>▾</span>
        <div class="dropdown" id="profileDropdown">
          <button onclick="goViiv()">⌂ ไปที่ VIIV Platform</button>
          <button onclick="doLogout()">⏻ ออกจากระบบ</button>
        </div>
      </div>
    </div>
  </div>

  <div class="actionbar hidden" id="actionbar">
    <input type="text" id="searchInput" placeholder="ค้นหา..." />
    <button class="btn" id="searchBtn">ค้นหา</button>
    <button class="btn btn-accent" id="createBtn">+ สร้างใหม่</button>
  </div>

  <div class="content-wrap">
    <div class="card">
      <div class="card-heading" id="cardHeading">Dashboard</div>
      <div class="card-sub" id="cardSub">ภาพรวมร้านค้า</div>
      <div id="cardBody"></div>
    </div>
  </div>
</div>

<script type="module">
const PAGES = {
  dashboard: { title:'Dashboard', sub:'ภาพรวมร้านค้า', action:false, render: renderDashboard },
  affiliate:  { title:'Affiliate', sub:'จัดการ affiliate link', action:false, render: renderPlaceholder },
  easysale:   { title:'EasySale', sub:'ขายง่ายด้วย AI', action:false, render: renderPlaceholder },
  products:   { title:'สินค้า/สโตร์', sub:'จัดการสินค้าและสต็อก', action:true, searchPlaceholder:'ค้นหาสินค้า', createLabel:'+ เพิ่มสินค้า', render: renderPlaceholder },
  orders:     { title:'คำสั่งซื้อ', sub:'รายการสั่งซื้อทั้งหมด', action:true, searchPlaceholder:'ค้นหาออเดอร์', createLabel:'+ สร้างออเดอร์', render: renderPlaceholder },
  members:    { title:'สมาชิกร้านค้า', sub:'จัดการสมาชิกและ CRM', action:true, searchPlaceholder:'ค้นหาสมาชิก', createLabel:'+ เพิ่มสมาชิก', render: renderPlaceholder },
  finance:    { title:'บัญชีการเงิน', sub:'รายรับรายจ่าย', action:false, render: renderPlaceholder },
  settings:   { title:'ตั้งค่าร้านค้า', sub:'ข้อมูลและการตั้งค่า', action:false, render: renderPlaceholder },
};

function renderDashboard(el) {
  el.innerHTML = `
    <div class="stats-row">
      <div class="stat"><div class="stat-label">ยอดขายวันนี้</div><div class="stat-val gold">—</div></div>
      <div class="stat"><div class="stat-label">ออเดอร์ใหม่</div><div class="stat-val">—</div></div>
      <div class="stat"><div class="stat-label">สินค้าทั้งหมด</div><div class="stat-val">—</div></div>
      <div class="stat"><div class="stat-label">สมาชิก</div><div class="stat-val">—</div></div>
    </div>
    <div class="page-placeholder">
      <div class="ph-icon">⊡</div>
      <div class="ph-text">เชื่อมต่อ POS เพื่อดูสถิติการขาย</div>
    </div>`;
}

function renderPlaceholder(el, page) {
  el.innerHTML = `
    <div class="page-placeholder">
      <div class="ph-icon">◈</div>
      <div class="ph-text">${page.title} — coming soon</div>
    </div>`;
}

function navigate(key) {
  const page = PAGES[key];
  if (!page) return;
  document.querySelectorAll('#navMenu a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === key);
  });
  document.getElementById('topbarTitle').textContent = page.title;
  const ab = document.getElementById('actionbar');
  if (page.action) {
    ab.classList.remove('hidden');
    document.getElementById('searchInput').placeholder = page.searchPlaceholder || 'ค้นหา...';
    document.getElementById('createBtn').textContent   = page.createLabel || '+ สร้างใหม่';
  } else {
    ab.classList.add('hidden');
  }
  document.getElementById('cardHeading').textContent = page.title;
  document.getElementById('cardSub').textContent     = page.sub;
  page.render(document.getElementById('cardBody'), page);
}

function goViiv()    { window.open('https://viiv.me', '_blank'); }
function doLogout()  {
  if (confirm('ออกจากระบบ?')) {
    localStorage.removeItem('viiv_token');
    window.location.href = 'https://viiv.me/login';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#navMenu a[data-page]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.page); });
  });
  const profileBtn = document.getElementById('profileBtn');
  const dropdown   = document.getElementById('profileDropdown');
  profileBtn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
  document.addEventListener('click', () => dropdown.classList.remove('open'));

  // load shop name จาก token
  const token = localStorage.getItem('viiv_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.store_name) {
        document.getElementById('shopBadge').textContent  = payload.store_name;
        document.title = payload.store_name + ' POS';
        document.querySelector('.brand-title .viiv').textContent = payload.store_name;
      }
    } catch(e) {}
  }

  navigate('dashboard');
});

window.goViiv   = goViiv;
window.doLogout = doLogout;
</script>

</body>
</html>
"""

with open(os.path.join(MERCHANT_UI, "dashboard.html"), "w", encoding="utf-8") as f:
    f.write(DASHBOARD_HTML)
print("✅ modules/pos/merchant/ui/dashboard/dashboard.html")
print("\n🎉 เสร็จ — เปิดที่ https://merchant.viiv.me/dashboard.html")
