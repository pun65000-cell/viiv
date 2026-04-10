#!/usr/bin/env python3
# build_missing_pages.py
# python3 ~/viiv/build_missing_pages.py

import os

FRONTEND   = os.path.expanduser("~/viiv/frontend")
SUPER_PAGES= os.path.expanduser("~/viiv/frontend/superboard/pages")
PLAT_PAGES = os.path.expanduser("~/viiv/frontend/platform/pages")

# ══════════════════════════════════════════════
# 1. Superboard — pages/staff.html (บุคลากร + password tabs)
# ══════════════════════════════════════════════
STAFF_HTML = """<!doctype html>
<html lang="th">
<head><meta charset="utf-8"><title>บุคลากร</title>
<link rel="stylesheet" href="/superboard/css/theme.css" />
<style>
body { background: transparent; }
.tabs { display:flex; gap:6px; margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid var(--sb-card-border); }
.tab  { padding:7px 18px; border-radius:var(--r-md); border:1px solid var(--sb-card-border); background:#f8f6f2; color:var(--sb-muted); font-size:13px; font-weight:500; cursor:pointer; transition:all 0.1s; }
.tab.active { background:var(--sb-accent); border-color:var(--sb-accent-hover); color:#1a1200; font-weight:700; }
.tab:hover:not(.active) { background:#f0ede5; }
.field { margin-bottom:12px; }
.field label { display:block; font-size:12px; color:var(--sb-muted); margin-bottom:5px; }
input,select { width:100%; padding:8px 12px; border:1px solid var(--sb-card-border); border-radius:var(--r-md); font-size:13px; outline:none; background:#faf9f7; color:var(--sb-text); }
input:focus,select:focus { border-color:var(--sb-accent); }
.btn { padding:7px 16px; border-radius:var(--r-md); border:1px solid rgba(0,0,0,0.1); background:#fff; color:var(--sb-text); font-size:13px; font-weight:500; cursor:pointer; }
.btn-accent { background:var(--sb-accent); border-color:var(--sb-accent-hover); color:#1a1200; font-weight:700; }
.btn-accent:hover { background:var(--sb-accent-hover); }
.btn-accent:disabled { background:#d0cdc8; border-color:#bbb; color:#888; cursor:not-allowed; }
.modal-box { margin-top:16px; background:#f8f6f2; border:1px solid var(--sb-card-border); border-radius:var(--r-lg); padding:18px 20px; }
.modal-actions { display:flex; gap:8px; margin-top:14px; }
.msg { font-size:13px; margin-top:8px; min-height:16px; }
.msg.ok  { color:#1e6b42; }
.msg.err { color:#d03030; }
.pw-wrap { max-width:400px; }
.check-hint { font-size:12px; margin-top:3px; display:block; min-height:14px; }
.check-ok  { color:#1e6b42; }
.check-err { color:#d03030; }
.staff-list { display:flex; flex-direction:column; gap:8px; }
.staff-row { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#f8f6f2; border:1px solid var(--sb-card-border); border-radius:var(--r-md); font-size:13px; }
.staff-name { font-weight:500; }
.staff-email { font-size:11px; color:var(--sb-muted); margin-top:2px; }
.pill { font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; }
.pill-owner { background:#fff8e6; color:#a07820; }
.pill-staff { background:#f0f0ff; color:#5050aa; }
.pill-md    { background:#e8f5ee; color:#1e6b42; }
</style>
</head>
<body>

<div class="tabs">
  <button class="tab active" onclick="switchTab('staff',this)">บุคลากร</button>
  <button class="tab" onclick="switchTab('password',this)">Password</button>
</div>

<!-- ── TAB: บุคลากร ── -->
<div id="panel-staff">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
    <div style="font-size:14px;font-weight:600;">รายชื่อพนักงาน</div>
    <button class="btn btn-accent" onclick="toggleAddStaff()">+ เพิ่มพนักงาน</button>
  </div>
  <div class="staff-list" id="staffList">
    <div class="staff-row">
      <div>
        <div class="staff-name">Admin</div>
        <div class="staff-email">admin@viiv.me</div>
      </div>
      <span class="pill pill-owner">Owner</span>
    </div>
  </div>
  <div class="modal-box" id="addStaffBox" style="display:none;">
    <div style="font-size:14px;font-weight:600;margin-bottom:14px;">เพิ่มพนักงาน</div>
    <div class="field"><label>ชื่อ-นามสกุล</label><input id="sName" type="text" placeholder="ชื่อ นามสกุล" /></div>
    <div class="field"><label>อีเมล</label><input id="sEmail" type="email" placeholder="email@example.com" /></div>
    <div class="field">
      <label>สิทธิ์การเข้าถึง</label>
      <select id="sRole">
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
      <div style="position:relative;">
        <input id="pwOld" type="password" placeholder="••••••••" style="padding-right:38px;" oninput="pwCheck()" />
        <button type="button" onclick="togglePw('pwOld',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:13px;color:var(--sb-muted);">👁</button>
      </div>
    </div>
    <div class="field">
      <label>รหัสผ่านใหม่ <span style="font-weight:400;color:var(--sb-muted);font-size:11px;">(อย่างน้อย 8 ตัวอักษร)</span></label>
      <div style="position:relative;">
        <input id="pwNew" type="password" placeholder="••••••••" style="padding-right:38px;" oninput="pwCheck()" />
        <button type="button" onclick="togglePw('pwNew',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:13px;color:var(--sb-muted);">👁</button>
      </div>
      <span class="check-hint" id="pwNewHint"></span>
    </div>
    <div class="field">
      <label>ยืนยันรหัสผ่านใหม่</label>
      <div style="position:relative;">
        <input id="pwConfirm" type="password" placeholder="••••••••" style="padding-right:38px;" oninput="pwCheck()" />
        <button type="button" onclick="togglePw('pwConfirm',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:13px;color:var(--sb-muted);">👁</button>
      </div>
      <span class="check-hint" id="pwConfirmHint"></span>
    </div>
    <div class="modal-actions">
      <button class="btn btn-accent" id="pwSaveBtn" onclick="savePassword()" disabled>บันทึก</button>
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
    document.getElementById('panel-'+p).style.display = p===name ? 'block' : 'none';
  });
}
function toggleAddStaff() {
  var b = document.getElementById('addStaffBox');
  b.style.display = b.style.display==='none' ? 'block' : 'none';
}
function saveStaff() {
  var msg = document.getElementById('staffMsg');
  var name = document.getElementById('sName').value.trim();
  var email = document.getElementById('sEmail').value.trim();
  if (!name||!email) { msg.className='msg err'; msg.textContent='กรุณากรอกให้ครบ'; return; }
  msg.className='msg ok'; msg.textContent='✅ บันทึกแล้ว (backend coming soon)';
}
function togglePw(id, btn) {
  var el = document.getElementById(id);
  el.type = el.type==='password' ? 'text' : 'password';
  btn.textContent = el.type==='password' ? '👁' : '🙈';
}
function pwCheck() {
  var old = document.getElementById('pwOld').value;
  var nw  = document.getElementById('pwNew').value;
  var cf  = document.getElementById('pwConfirm').value;
  var h1  = document.getElementById('pwNewHint');
  var h2  = document.getElementById('pwConfirmHint');
  var btn = document.getElementById('pwSaveBtn');
  if (nw.length>0&&nw.length<8) { h1.className='check-hint check-err'; h1.textContent='❌ ต้องมีอย่างน้อย 8 ตัวอักษร'; }
  else if (nw.length>=8) { h1.className='check-hint check-ok'; h1.textContent='✅ ความยาวผ่าน'; }
  else h1.textContent='';
  if (cf.length>0&&nw!==cf) { h2.className='check-hint check-err'; h2.textContent='❌ รหัสผ่านไม่ตรงกัน'; }
  else if (cf.length>0&&nw===cf) { h2.className='check-hint check-ok'; h2.textContent='✅ รหัสผ่านตรงกัน'; }
  else h2.textContent='';
  btn.disabled = !(old.length>0 && nw.length>=8 && nw===cf && nw!==old);
}
function clearPassword() {
  ['pwOld','pwNew','pwConfirm'].forEach(id => document.getElementById(id).value='');
  document.getElementById('pwNewHint').textContent='';
  document.getElementById('pwConfirmHint').textContent='';
  document.getElementById('pwMsg').textContent='';
  document.getElementById('pwSaveBtn').disabled=true;
}
async function savePassword() {
  var old_password = document.getElementById('pwOld').value;
  var new_password = document.getElementById('pwNew').value;
  var msg = document.getElementById('pwMsg');
  var btn = document.getElementById('pwSaveBtn');
  btn.disabled=true; btn.textContent='กำลังบันทึก...';
  try {
    var token = localStorage.getItem('viiv_token');
    var res = await fetch('/admin/change-password', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({old_password, new_password})
    });
    if (res.ok) {
      msg.className='msg ok'; msg.textContent='✅ เปลี่ยนรหัสผ่านสำเร็จ';
      clearPassword();
      setTimeout(()=>{ localStorage.removeItem('viiv_token'); window.location.href='/platform/login.html'; }, 2000);
    } else if (res.status===401) {
      msg.className='msg err'; msg.textContent='รหัสผ่านเดิมไม่ถูกต้อง';
    } else {
      msg.className='msg err'; msg.textContent='เกิดข้อผิดพลาด ('+res.status+')';
    }
  } catch(e) {
    msg.className='msg err'; msg.textContent='ไม่สามารถเชื่อมต่อ server ได้';
  } finally { btn.disabled=false; btn.textContent='บันทึก'; pwCheck(); }
}
</script>
</body>
</html>"""

with open(os.path.join(SUPER_PAGES, "staff.html"), "w", encoding="utf-8") as f:
    f.write(STAFF_HTML)
print("✅ superboard/pages/staff.html")

# ══════════════════════════════════════════════
# 2. Superboard login page
# ══════════════════════════════════════════════
SB_LOGIN = """<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VIIV — เข้าสู่ระบบ</title>
  <style>
    :root {
      --accent: #c9a84c; --accent-h: #b8942a;
      --bg: #f0ede8; --card: #ffffff;
      --border: rgba(0,0,0,0.10); --text: #1f2937; --muted: #6b7280;
      --danger: #d03030; --success: #1e6b42;
      --font: 'Segoe UI', system-ui, sans-serif;
    }
    * { box-sizing: border-box; margin:0; padding:0; }
    body { font-family:var(--font); font-size:14px; background:var(--bg); min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .wrap { width:100%; max-width:400px; padding:24px 16px; }
    .logo { text-align:center; margin-bottom:28px; }
    .logo-text { font-size:26px; font-weight:900; letter-spacing:3px; color:var(--accent); }
    .logo-sub { font-size:12px; color:var(--muted); margin-top:4px; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:26px 26px 22px; box-shadow:0 4px 16px rgba(0,0,0,0.06); }
    .card-title { font-size:16px; font-weight:600; color:var(--text); margin-bottom:18px; }
    .field { margin-bottom:12px; }
    label { display:block; font-size:12px; color:var(--muted); margin-bottom:5px; }
    input { width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:9px; font-size:14px; color:var(--text); background:#faf9f7; outline:none; transition:border-color 0.15s; }
    input:focus { border-color:var(--accent); }
    .btn-login { width:100%; margin-top:6px; padding:11px; background:var(--accent); border:1px solid var(--accent-h); border-radius:9px; color:#1a1200; font-size:14px; font-weight:700; cursor:pointer; transition:background 0.12s; }
    .btn-login:hover { background:var(--accent-h); }
    .btn-login:disabled { background:#d0cdc8; border-color:#bbb; color:#888; cursor:not-allowed; }
    .divider { display:flex; align-items:center; gap:10px; margin:16px 0; }
    .divider-line { flex:1; height:1px; background:var(--border); }
    .divider-text { font-size:12px; color:var(--muted); }
    .social-row { display:flex; gap:8px; }
    .btn-social { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:9px 10px; border:1px solid var(--border); border-radius:9px; background:#fff; font-size:13px; color:var(--text); cursor:not-allowed; opacity:0.5; }
    .btn-google { cursor:pointer; opacity:1; }
    .btn-google:hover { background:#f5f3ef; }
    .social-icon { font-size:16px; }
    .msg { font-size:13px; text-align:center; margin-top:10px; min-height:16px; color:var(--danger); }
    .msg.ok { color:var(--success); }
    .footer { text-align:center; margin-top:20px; font-size:11px; color:#aaa; }
    .reg-link { text-align:center; margin-top:12px; font-size:13px; color:var(--muted); }
    .reg-link a { color:var(--accent); text-decoration:none; font-weight:600; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="logo">
    <div class="logo-text">VIIV</div>
    <div class="logo-sub">AI-Powered Sales Automation</div>
  </div>
  <div class="card">
    <div class="card-title">เข้าสู่ระบบ</div>
    <div class="field">
      <label>อีเมล</label>
      <input id="email" type="email" placeholder="you@example.com" autocomplete="email" oninput="checkForm()" />
    </div>
    <div class="field">
      <label>รหัสผ่าน</label>
      <input id="password" type="password" placeholder="••••••••" autocomplete="current-password" oninput="checkForm()" />
    </div>
    <button class="btn-login" id="loginBtn" onclick="doLogin()" disabled>เข้าสู่ระบบ</button>

    <div class="divider">
      <div class="divider-line"></div>
      <span class="divider-text">หรือเข้าสู่ระบบด้วย</span>
      <div class="divider-line"></div>
    </div>

    <div class="social-row">
      <button class="btn-social btn-google" onclick="loginGoogle()" title="Google">
        <span class="social-icon">G</span> Google
      </button>
      <button class="btn-social" title="LINE (coming soon)">
        <span class="social-icon">L</span> LINE
      </button>
      <button class="btn-social" title="Facebook (coming soon)">
        <span class="social-icon">f</span> Facebook
      </button>
    </div>

    <div class="msg" id="msg"></div>
  </div>
  <div class="reg-link">ยังไม่มีบัญชี? <a href="/register">สมัครใช้งาน</a></div>
  <div class="footer">VIIV Platform v0.1.0</div>
</div>
<script>
function checkForm() {
  var email = document.getElementById('email').value.trim();
  var pw    = document.getElementById('password').value;
  document.getElementById('loginBtn').disabled = !(email && pw.length >= 4);
}
async function doLogin() {
  var email    = document.getElementById('email').value.trim();
  var password = document.getElementById('password').value;
  var btn = document.getElementById('loginBtn');
  var msg = document.getElementById('msg');
  msg.textContent=''; msg.className='msg';
  btn.disabled=true; btn.textContent='กำลังเข้าสู่ระบบ...';
  try {
    var res = await fetch('/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email, password})
    });
    if (res.ok) {
      var data = await res.json();
      localStorage.setItem('viiv_token', data.access_token);
      msg.className='msg ok'; msg.textContent='✅ สำเร็จ กำลังโหลด...';
      setTimeout(()=>{ window.location.href='/platform/dashboard.html'; }, 400);
    } else if (res.status===401) {
      msg.textContent='อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    } else {
      msg.textContent='เกิดข้อผิดพลาด ('+res.status+')';
    }
  } catch(e) { msg.textContent='ไม่สามารถเชื่อมต่อ server ได้'; }
  finally { btn.disabled=false; btn.textContent='เข้าสู่ระบบ'; checkForm(); }
}
function loginGoogle() { window.location.href='/auth/google'; }
document.addEventListener('DOMContentLoaded', ()=>{
  if (localStorage.getItem('viiv_token')) window.location.href='/platform/dashboard.html';
  document.getElementById('password').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  document.getElementById('email').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('password').focus(); });
});
</script>
</body>
</html>"""

# login ที่ viiv.me/login
with open(os.path.join(FRONTEND, "login.html"), "w", encoding="utf-8") as f:
    f.write(SB_LOGIN)
print("✅ frontend/login.html")

# ══════════════════════════════════════════════
# 3. viiv.me/index.html — landing page
# ══════════════════════════════════════════════
LANDING = """<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VIIV — AI-Powered Sales Automation</title>
  <style>
    :root { --accent:#c9a84c; --font:'Segoe UI',system-ui,sans-serif; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:var(--font); font-size:15px; background:#0e0e0e; color:#f0ede8; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; }
    .logo { font-size:48px; font-weight:900; letter-spacing:6px; color:var(--accent); margin-bottom:12px; }
    .tagline { font-size:16px; color:#888; margin-bottom:40px; text-align:center; }
    .btns { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
    .btn { padding:12px 32px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; text-decoration:none; transition:opacity 0.15s; }
    .btn-primary { background:var(--accent); color:#1a1200; border:none; }
    .btn-primary:hover { opacity:0.88; }
    .btn-outline { background:transparent; color:var(--accent); border:1.5px solid var(--accent); }
    .btn-outline:hover { background:rgba(201,168,76,0.08); }
    .footer { margin-top:48px; font-size:12px; color:#444; }
  </style>
</head>
<body>
  <div class="logo">VIIV</div>
  <div class="tagline">AI-Powered Sales Automation — ระบบช่วยขายสินค้าอัตโนมัติครบวงจร</div>
  <div class="btns">
    <a class="btn btn-primary" href="/login">เข้าสู่ระบบ</a>
    <a class="btn btn-outline" href="/register">สมัครใช้งาน</a>
  </div>
  <div class="footer">VIIV Platform v0.1.0 · viiv.me</div>
</body>
</html>"""

with open(os.path.join(FRONTEND, "index.html"), "w", encoding="utf-8") as f:
    f.write(LANDING)
print("✅ frontend/index.html (landing)")

# ══════════════════════════════════════════════
# 4. viiv.me/register — redirect ไป platform register
# ══════════════════════════════════════════════
REGISTER = """<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VIIV — สมัครใช้งาน</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Segoe UI',system-ui,sans-serif; font-size:14px; background:#f0ede8; min-height:100vh; }
    .topbar { background:#0e0e0e; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; }
    .logo { font-size:18px; font-weight:900; letter-spacing:2px; color:#c9a84c; text-decoration:none; }
    .login-link { font-size:13px; color:#888; text-decoration:none; }
    .login-link:hover { color:#c9a84c; }
    .content { max-width:620px; margin:0 auto; padding:24px 20px; }
    .title { font-size:20px; font-weight:600; margin-bottom:4px; }
    .sub { font-size:13px; color:#6b7280; margin-bottom:20px; }
  </style>
</head>
<body>
  <div class="topbar">
    <a class="logo" href="/">VIIV</a>
    <a class="login-link" href="/login">มีบัญชีแล้ว? เข้าสู่ระบบ</a>
  </div>
  <div class="content">
    <div class="title">สมัครใช้งาน VIIV Platform</div>
    <div class="sub">สร้างร้านค้าของคุณวันนี้ — ทดลองใช้ฟรี 10 วัน</div>
    <iframe
      src="/platform/pages/register-shop.html"
      style="width:100%;border:none;min-height:85vh;"
      id="regFrame"
    ></iframe>
  </div>
  <script>
    // auto-resize iframe
    window.addEventListener('message', function(e) {
      if (e.data && e.data.height) {
        document.getElementById('regFrame').style.height = e.data.height + 'px';
      }
    });
  </script>
</body>
</html>"""

with open(os.path.join(FRONTEND, "register.html"), "w", encoding="utf-8") as f:
    f.write(REGISTER)
print("✅ frontend/register.html")

# ══════════════════════════════════════════════
# 5. แก้ Caddyfile — viiv.me serve index.html, login, register
# ══════════════════════════════════════════════
CADDY = "/etc/caddy/Caddyfile"
try:
    with open(CADDY,"r") as f: cad = f.read()

    old = """        handle_path /admin/* {
                handle {
                        root * /home/viivadmin/viiv/frontend/admin
                        file_server
                }
        }
        # frontend (ไว้ท้ายสุด)
        handle {
                root * /home/viivadmin/viiv/frontend
                try_files {path} /index.html
                file_server
        }"""

    new = """        handle_path /admin/* {
                handle {
                        root * /home/viivadmin/viiv/frontend/admin
                        file_server
                }
        }
        # login, register, landing
        handle /login {
                root * /home/viivadmin/viiv/frontend
                rewrite * /login.html
                file_server
        }
        handle /register {
                root * /home/viivadmin/viiv/frontend
                rewrite * /register.html
                file_server
        }
        handle /platform/* {
                root * /home/viivadmin/viiv/frontend
                file_server
        }
        # frontend (ไว้ท้ายสุด)
        handle {
                root * /home/viivadmin/viiv/frontend
                try_files {path} /index.html
                file_server
        }"""

    if old in cad:
        cad = cad.replace(old, new)
        with open(CADDY,"w") as f: f.write(cad)
        print("✅ Caddyfile — /login /register /platform routes")
        import subprocess
        subprocess.run(["sudo","systemctl","restart","caddy"])
        print("✅ Caddy restarted")
    else:
        print("⚠️  Caddyfile pattern ไม่ตรง — เพิ่ม routes เองใน viiv.me block")
except Exception as e:
    print(f"⚠️  Caddyfile: {e}")

print("\n🎉 เสร็จ!")
print("   viiv.me          → landing page")
print("   viiv.me/login     → login")
print("   viiv.me/register  → register (iframe)")
print("   superboard/staff  → บุคลากร + password")
