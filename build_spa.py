#!/usr/bin/env python3
# build_spa.py — VIIV Platform SPA restructure
# รันที่: python3 ~/viiv/build_spa.py

import os, shutil

BASE = os.path.expanduser("~/viiv/frontend/platform")
PAGES_DIR = os.path.join(BASE, "pages")
CSS_DIR   = os.path.join(BASE, "css")

os.makedirs(PAGES_DIR, exist_ok=True)
os.makedirs(CSS_DIR,   exist_ok=True)

# ══════════════════════════════════════════════
# 1. theme.css — single source of truth สำหรับ design
# ══════════════════════════════════════════════
THEME_CSS = """:root {
  /* ── Colors ── */
  --accent:        #e8b93e;
  --accent-hover:  #d4a52c;
  --accent-active: #bf941e;
  --accent-dim:    rgba(232,185,62,0.12);
  --accent-border: rgba(232,185,62,0.6);

  --bg-app:        #1a1a1a;
  --sidebar-bg:    #0e0e0e;
  --sidebar-border:#222222;
  --content-bg:    #f0ede8;
  --card-bg:       #ffffff;
  --card-border:   #e0ddd6;
  --input-bg:      #faf9f7;
  --input-border:  rgba(0,0,0,0.12);

  --text:          #1f2937;
  --muted:         #6b7280;
  --nav-text:      #9a9a9a;
  --nav-label:     #484848;
  --nav-hover:     #1a1a1a;

  --success-bg:    #e4f3ec;
  --success-text:  #1e6b42;
  --warning-bg:    #f5f0e5;
  --warning-text:  #9a7020;
  --danger:        #e05555;

  /* ── Radius ── */
  --r-sm:  6px;
  --r-md:  9px;
  --r-lg:  12px;
  --r-xl:  14px;

  /* ── Font ── */
  --font: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  font-size: 14px;
  color: var(--text);
}

/* ── Buttons ── */
.btn {
  padding: 7px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--input-border);
  background: var(--card-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.1s, border-color 0.1s;
}
.btn:hover  { border-color: rgba(0,0,0,0.2); background: #f5f3ef; }
.btn:active { transform: scale(0.98); }

.btn-accent {
  background: var(--accent);
  border-color: var(--accent-active);
  color: #1a1200;
  font-weight: 700;
}
.btn-accent:hover  { background: var(--accent-hover); }
.btn-accent:active { background: var(--accent-active); }
.btn-accent:disabled { background: #3a3020; color: #666; border-color: #3a3020; cursor: not-allowed; }

.btn-danger {
  background: #fdf0f0;
  border-color: #f0c0c0;
  color: #c03030;
}
.btn-danger:hover { background: #fae0e0; }

/* ── Cards ── */
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--r-lg);
  padding: 20px 24px;
}
.card-heading { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
.card-sub     { font-size: 13px; color: var(--muted); margin-bottom: 18px; }

/* ── Form inputs ── */
.field       { margin-bottom: 12px; }
.field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 5px; }

input[type=text], input[type=email], input[type=password], select, textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--r-md);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font);
  outline: none;
  transition: border-color 0.15s;
}
input:focus, select:focus, textarea:focus { border-color: var(--accent); }

/* ── Stats row ── */
.stats-row { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.stat {
  flex: 1; min-width: 100px;
  background: #f8f6f2;
  border: 1px solid #eae8e2;
  border-radius: var(--r-md);
  padding: 12px 16px;
}
.stat-label { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
.stat-val   { font-size: 22px; font-weight: 600; }
.stat-val.gold { color: #a07820; }

/* ── List rows ── */
.list-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 14px;
  background: #f8f6f2;
  border: 1px solid #eae8e2;
  border-radius: var(--r-md);
  font-size: 13px;
  margin-bottom: 8px;
}
.list-row:last-child { margin-bottom: 0; }
.row-title    { font-weight: 500; color: #333; }
.row-subtitle { font-size: 11px; color: #aaa; margin-top: 2px; font-family: monospace; }

/* ── Pills / badges ── */
.pill { font-size: 11px; font-weight: 600; padding: 3px 11px; border-radius: 20px; }
.pill-active   { background: var(--success-bg); color: var(--success-text); }
.pill-inactive { background: var(--warning-bg); color: var(--warning-text); }
.pill-admin    { background: rgba(232,185,62,0.15); color: #a07820; }

/* ── Tabs ── */
.tabs { display: flex; gap: 6px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--card-border); }
.tab  { padding: 7px 18px; border-radius: var(--r-md); border: 1px solid var(--card-border); background: #f8f6f2; color: var(--muted); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.1s; }
.tab.active  { background: var(--accent); border-color: var(--accent-active); color: #1a1200; font-weight: 700; }
.tab:hover:not(.active) { background: #f0ede5; }

/* ── Messages ── */
.msg       { font-size: 13px; margin-top: 10px; min-height: 18px; }
.msg.error { color: var(--danger); }
.msg.ok    { color: var(--success-text); }

/* ── Action bar (search/create topbar) ── */
.actionbar {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--r-lg);
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.actionbar input { flex: 1; }

/* ── Placeholder page ── */
.page-placeholder {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 20px;
  color: var(--muted); gap: 10px;
}
.ph-icon { font-size: 32px; opacity: 0.25; }
.ph-text { font-size: 14px; }

/* ── Modal overlay ── */
.modal-box {
  margin-top: 18px;
  background: #f8f6f2;
  border: 1px solid #eae8e2;
  border-radius: var(--r-lg);
  padding: 18px 20px;
}
.modal-title { font-size: 14px; font-weight: 600; margin-bottom: 14px; }
.modal-actions { display: flex; gap: 8px; margin-top: 14px; }
"""

with open(os.path.join(CSS_DIR, "theme.css"), "w") as f:
    f.write(THEME_CSS)
print("✅ css/theme.css")

# ══════════════════════════════════════════════
# 2. pages/settings.html
# ══════════════════════════════════════════════
SETTINGS_HTML = """<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ตั้งค่าระบบ</title>
  <link rel="stylesheet" href="/platform/css/theme.css" />
  <style>
    body { background: transparent; padding: 0; }
    .pw-wrap { max-width: 420px; }
  </style>
</head>
<body>

<div class="tabs" id="tabs">
  <button class="tab active" onclick="switchTab('staff', this)">บุคลากร</button>
  <button class="tab"        onclick="switchTab('password', this)">Password</button>
</div>

<!-- ── TAB: บุคลากร ── -->
<div id="panel-staff">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
    <div style="font-size:14px;font-weight:600;">รายชื่อพนักงาน</div>
    <button class="btn btn-accent" onclick="toggleAddStaff()">+ เพิ่มพนักงาน</button>
  </div>

  <div id="staffList">
    <div class="page-placeholder">
      <div class="ph-icon">👥</div>
      <div class="ph-text">ยังไม่มีข้อมูลพนักงาน</div>
    </div>
  </div>

  <div id="addStaffBox" class="modal-box" style="display:none;">
    <div class="modal-title">เพิ่มพนักงาน</div>
    <div class="field">
      <label>ชื่อ-นามสกุล</label>
      <input id="staffName" type="text" placeholder="ชื่อ นามสกุล" />
    </div>
    <div class="field">
      <label>อีเมล</label>
      <input id="staffEmail" type="email" placeholder="email@example.com" />
    </div>
    <div class="field">
      <label>สิทธิ์การเข้าถึง</label>
      <select id="staffRole">
        <option value="staff">Staff — ดูข้อมูลได้อย่างเดียว</option>
        <option value="md">MD — จัดการสินค้าและออเดอร์</option>
        <option value="owner">Owner — สิทธิ์เต็ม</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-accent" onclick="saveStaff()">บันทึก</button>
      <button class="btn" onclick="toggleAddStaff()">ยกเลิก</button>
    </div>
    <div class="msg" id="staffMsg"></div>
  </div>
</div>

<!-- ── TAB: Password ── -->
<div id="panel-password" style="display:none;">
  <div class="pw-wrap">
    <div style="font-size:14px;font-weight:600;margin-bottom:16px;">เปลี่ยนรหัสผ่าน</div>
    <div class="field">
      <label>รหัสผ่านเดิม</label>
      <input id="pwOld" type="password" placeholder="••••••••" />
    </div>
    <div class="field">
      <label>รหัสผ่านใหม่</label>
      <input id="pwNew" type="password" placeholder="••••••••" />
    </div>
    <div class="field">
      <label>ยืนยันรหัสผ่านใหม่</label>
      <input id="pwConfirm" type="password" placeholder="••••••••" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-accent" onclick="savePassword()">บันทึก</button>
      <button class="btn" onclick="clearPassword()">ยกเลิก</button>
    </div>
    <div class="msg" id="pwMsg"></div>
  </div>
</div>

<script>
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['staff','password'].forEach(p => {
    document.getElementById('panel-'+p).style.display = p === name ? 'block' : 'none';
  });
}

function toggleAddStaff() {
  const box = document.getElementById('addStaffBox');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
  document.getElementById('staffMsg').textContent = '';
}

function saveStaff() {
  const name  = document.getElementById('staffName').value.trim();
  const email = document.getElementById('staffEmail').value.trim();
  const msg   = document.getElementById('staffMsg');
  msg.className = 'msg error';
  if (!name || !email) { msg.textContent = 'กรุณากรอกชื่อและอีเมล'; return; }
  // TODO: POST /api/staff เมื่อ backend พร้อม
  msg.className = 'msg ok';
  msg.textContent = '✅ บันทึกแล้ว (backend coming soon)';
}

function clearPassword() {
  ['pwOld','pwNew','pwConfirm'].forEach(id => document.getElementById(id).value = '');
  const msg = document.getElementById('pwMsg');
  msg.textContent = '';
  msg.className = 'msg';
}

async function savePassword() {
  const old_password = document.getElementById('pwOld').value;
  const new_password = document.getElementById('pwNew').value;
  const confirm      = document.getElementById('pwConfirm').value;
  const msg          = document.getElementById('pwMsg');
  msg.textContent = ''; msg.className = 'msg error';

  if (!old_password || !new_password || !confirm) { msg.textContent = 'กรุณากรอกให้ครบ'; return; }
  if (new_password !== confirm) { msg.textContent = 'รหัสผ่านใหม่ไม่ตรงกัน'; return; }
  if (new_password.length < 6)  { msg.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'; return; }

  try {
    const token = localStorage.getItem('viiv_token');
    const res = await fetch('/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ old_password, new_password }),
    });
    if (res.ok) {
      msg.className = 'msg ok';
      msg.textContent = '✅ เปลี่ยนรหัสผ่านสำเร็จ';
      clearPassword();
    } else if (res.status === 401) {
      msg.textContent = 'รหัสผ่านเดิมไม่ถูกต้อง';
    } else {
      msg.textContent = 'เกิดข้อผิดพลาด (' + res.status + ')';
    }
  } catch(e) {
    msg.textContent = 'ไม่สามารถเชื่อมต่อ server ได้';
  }
}
</script>
</body>
</html>
"""

with open(os.path.join(PAGES_DIR, "settings.html"), "w") as f:
    f.write(SETTINGS_HTML)
print("✅ pages/settings.html")

# ══════════════════════════════════════════════
# 3. แก้ dashboard.html — เปลี่ยน settings render + โหลด theme.css + SPA fetch pages
# ══════════════════════════════════════════════
dash_path = os.path.join(BASE, "dashboard.html")
with open(dash_path, "r") as f:
    dash = f.read()

# 3a. เพิ่ม theme.css link หลัง <title>
if 'theme.css' not in dash:
    dash = dash.replace(
        '</title>',
        '</title>\n  <link rel="stylesheet" href="/platform/css/theme.css" />'
    )

# 3b. เปลี่ยน settings render → renderPage('settings')
dash = dash.replace(
    """  settings: {
    title:  'ตั้งค่าระบบ',
    sub:    'ตั้งค่าระบบและ integration',
    badge:  'System',
    action: false,
    render: renderPlaceholder,
  },""",
    """  settings: {
    title:  'ตั้งค่าระบบ',
    sub:    'ตั้งค่าระบบและ integration',
    badge:  'System',
    action: false,
    render: (el) => renderPage(el, 'settings'),
  },"""
)

# 3c. เพิ่ม renderPage function ก่อน renderPlaceholder
render_page_fn = """function renderPage(el, name) {
  el.innerHTML = '<div id="page-loading" style="color:#aaa;font-size:13px;padding:20px 0;">กำลังโหลด...</div>';
  fetch('/platform/pages/' + name + '.html')
    .then(r => r.text())
    .then(html => {
      // inject เฉพาะ <body> content
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const body = tmp.querySelector('body');
      el.innerHTML = body ? body.innerHTML : html;
      // รัน scripts ที่อยู่ใน page
      el.querySelectorAll('script').forEach(old => {
        const s = document.createElement('script');
        s.textContent = old.textContent;
        old.replaceWith(s);
      });
    })
    .catch(() => {
      el.innerHTML = '<div class="page-placeholder"><div class="ph-icon">⚠</div><div class="ph-text">โหลดหน้าไม่ได้</div></div>';
    });
}

"""

if 'function renderPage' not in dash:
    dash = dash.replace(
        'function renderPlaceholder(el, page) {',
        render_page_fn + 'function renderPlaceholder(el, page) {'
    )

with open(dash_path, "w") as f:
    f.write(dash)
print("✅ dashboard.html — updated")

# ══════════════════════════════════════════════
# 4. ลบไฟล์ขยะ
# ══════════════════════════════════════════════
TO_DELETE = [
    # bak files
    "platform/dashboard.html.bak",
    "platform/js/main.js.bak",
    # old platform pages (ซ้ำ — ย้ายเข้า pages/ แล้ว)
    "platform/stores.html",
    "platform/myshop.html",
    "platform/packages.html",
    "platform/staff.html",
    # duplicate js
    "platform/js/auth.js",
    "platform/js/stores.js",
    # old admin/owner UI ทั้งหมด
    "admin/chat.html",
    "admin/mobile_admin.html",
    "admin/orders.html",
    "admin/products.html",
    "admin/receipt.html",
    "admin/staff.html",
    "admin/stock.html",
    # old root frontend
    "activate.html",
    "index.html",
    "mobile_admin.html",
    "navbar.js",
    "owner_ui.html",
    "product_ui.html",
    "register.html",
    "storefront.html",
    # old owner UI
    "owner/index.html",
    "owner/js/api.js",
    "owner/register.html",
    "owner/store.html",
    "owner/subscription.html",
    # old core (ไม่ใช่ platform)
    "core/auth.js",
    "core/id.js",
]

FRONTEND = os.path.expanduser("~/viiv/frontend")
deleted, skipped = [], []
for rel in TO_DELETE:
    p = os.path.join(FRONTEND, rel)
    if os.path.exists(p):
        os.remove(p)
        deleted.append(rel)
    else:
        skipped.append(rel)

# ลบ dir ที่ว่างแล้ว
for d in ["admin", "owner/js", "owner", "core"]:
    dp = os.path.join(FRONTEND, d)
    try:
        if os.path.isdir(dp) and not os.listdir(dp):
            os.rmdir(dp)
            print(f"🗑  ลบ dir: {d}/")
    except:
        pass

print(f"\n🗑  ลบไฟล์: {len(deleted)} ไฟล์")
for f in deleted: print(f"   - {f}")
if skipped:
    print(f"\n⚠  ไม่พบ (ข้าม): {len(skipped)} ไฟล์")
    for f in skipped: print(f"   - {f}")

# ══════════════════════════════════════════════
# 5. สรุปโครงสร้างใหม่
# ══════════════════════════════════════════════
print("\n📁 โครงสร้างใหม่:")
for root, dirs, files in os.walk(os.path.join(FRONTEND, "platform")):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    level = root.replace(FRONTEND, '').count(os.sep)
    indent = '  ' * level
    print(f"{indent}{os.path.basename(root)}/")
    for file in sorted(files):
        print(f"{indent}  {file}")
