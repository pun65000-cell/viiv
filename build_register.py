#!/usr/bin/env python3
# build_register.py — VIIV Platform register shop page
# python3 ~/viiv/build_register.py

import os, re

BASE  = os.path.expanduser("~/viiv/frontend/platform")
PAGES = os.path.join(BASE, "pages")
API   = os.path.expanduser("~/viiv/app/api/register_shop.py")

# ══════════════════════════════════════════════════════════════
# 1. pages/register-shop.html
# ══════════════════════════════════════════════════════════════
REGISTER_HTML = r"""<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>สร้างร้านค้า</title>
  <link rel="stylesheet" href="/platform/css/theme.css" />
  <style>
    body { background: transparent; }
    .form-wrap { max-width: 560px; }
    .section-title {
      font-size: 12px; font-weight: 600; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.6px;
      margin: 20px 0 10px; padding-bottom: 6px;
      border-bottom: 1px solid var(--card-border);
    }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .subdomain-wrap { position: relative; }
    .subdomain-suffix {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      font-size: 12px; color: var(--muted); pointer-events: none;
    }
    .subdomain-wrap input { padding-right: 90px; }
    .check-badge {
      display: inline-block; font-size: 12px; margin-top: 4px; min-height: 16px;
    }
    .check-ok  { color: var(--success-text); }
    .check-err { color: var(--danger); }
    .check-ing { color: var(--muted); }
    .form-actions { display: flex; gap: 10px; margin-top: 20px; }
    .result-box {
      display: none; margin-top: 16px;
      background: var(--success-bg); border: 1px solid #a8dfc0;
      border-radius: var(--r-lg); padding: 16px 20px;
    }
    .result-box.err { background: #fdf0f0; border-color: #f0c0c0; }
    .result-title { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
    .result-row   { font-size: 13px; color: #444; margin-bottom: 4px; }
    .result-id    { font-family: monospace; font-size: 12px; color: #666; }
  </style>
</head>
<body>
<div class="form-wrap">

  <div class="section-title">ข้อมูลเจ้าของร้าน</div>
  <div class="row-2">
    <div class="field">
      <label>ชื่อ-นามสกุล <span style="color:var(--danger)">*</span></label>
      <input id="full_name" type="text" placeholder="สมชาย ใจดี" />
    </div>
    <div class="field">
      <label>อีเมล <span style="color:var(--danger)">*</span></label>
      <input id="email" type="email" placeholder="you@example.com" />
    </div>
  </div>
  <div class="row-2">
    <div class="field">
      <label>รหัสผ่าน <span style="color:var(--danger)">*</span></label>
      <input id="password" type="password" placeholder="อย่างน้อย 6 ตัวอักษร" />
    </div>
    <div class="field">
      <label>เบอร์โทรศัพท์ <span style="color:var(--danger)">*</span></label>
      <input id="phone" type="tel" placeholder="08x-xxx-xxxx" maxlength="13" />
      <span class="check-badge" id="phoneCheck"></span>
    </div>
  </div>

  <div class="section-title">ข้อมูลร้านค้า</div>
  <div class="field">
    <label>ชื่อร้านค้า <span style="color:var(--danger)">*</span></label>
    <input id="store_name" type="text" placeholder="ชื่อร้านของคุณ" />
  </div>
  <div class="field">
    <label>Subdomain <span style="color:var(--danger)">*</span> (ภาษาอังกฤษ ตัวเลข ขีด อย่างน้อย 4 ตัว)</label>
    <div class="subdomain-wrap">
      <input id="subdomain" type="text" placeholder="myshop" maxlength="40"
             oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9-]/g,'')" />
      <span class="subdomain-suffix">.viiv.me</span>
    </div>
    <span class="check-badge" id="subCheck"></span>
  </div>

  <div class="section-title">ที่อยู่ร้าน</div>
  <div class="field">
    <label>ที่อยู่ (บ้านเลขที่ / หมู่ / ซอย / ถนน)</label>
    <input id="address" type="text" placeholder="123 ถ.สุขุมวิท" />
  </div>
  <div class="row-2">
    <div class="field">
      <label>จังหวัด</label>
      <input id="province_search" type="text" placeholder="พิมพ์ค้นหา เช่น เชียง"
             oninput="searchProvince(this.value)" autocomplete="off" />
      <div id="province_list" style="display:none;position:absolute;z-index:99;background:#fff;border:1px solid var(--card-border);border-radius:var(--r-md);max-height:180px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
    </div>
    <div class="field">
      <label>อำเภอ/เขต</label>
      <select id="amphoe" onchange="loadTambon()" disabled>
        <option value="">— เลือกจังหวัดก่อน —</option>
      </select>
    </div>
  </div>
  <div class="row-2">
    <div class="field">
      <label>ตำบล/แขวง</label>
      <select id="tambon" onchange="loadPostcode()" disabled>
        <option value="">— เลือกอำเภอก่อน —</option>
      </select>
    </div>
    <div class="field">
      <label>รหัสไปรษณีย์</label>
      <input id="postcode" type="text" readonly placeholder="กรอกอัตโนมัติ"
             style="background:#f0ede8;cursor:default;" />
    </div>
  </div>

  <div class="form-actions">
    <button class="btn btn-accent" id="submitBtn" onclick="submitForm()">สร้างร้านค้า</button>
    <button class="btn" onclick="resetForm()">ล้างข้อมูล</button>
  </div>
  <div class="msg error" id="formMsg"></div>

  <div class="result-box" id="resultBox">
    <div class="result-title" id="resultTitle"></div>
    <div class="result-row" id="resultBody"></div>
  </div>
</div>

<script>
// ── Thailand geo data (ย่อ — โหลดจาก CDN จริงใน production) ──────────────
// ใช้ database ย่อจาก สนง.ไปรษณีย์ไทย
// โครงสร้าง: { province: { amphoe: { tambon: postcode } } }
let GEO = null;
let GEO_FLAT = []; // [{province, amphoe, tambon, postcode}]

async function loadGeo() {
  // โหลดจาก CDN thailand-geography-json
  try {
    const r = await fetch('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_tambon.json');
    const raw = await r.json();
    GEO = {};
    GEO_FLAT = [];
    raw.forEach(t => {
      const prov = t.province_name_th;
      const amp  = t.amphure_name_th;
      const tam  = t.name_th;
      const zip  = String(t.zip_code || '');
      if (!GEO[prov]) GEO[prov] = {};
      if (!GEO[prov][amp]) GEO[prov][amp] = {};
      GEO[prov][amp][tam] = zip;
      GEO_FLAT.push({province: prov, amphoe: amp, tambon: tam, postcode: zip});
    });
  } catch(e) {
    console.warn('Geo load failed, using fallback');
    loadGeoFallback();
  }
}

function loadGeoFallback() {
  // fallback ข้อมูลย่อ 5 จังหวัด
  const data = [
    ['เชียงใหม่','เมืองเชียงใหม่','ช้างเผือก','50300'],
    ['เชียงใหม่','เมืองเชียงใหม่','สุเทพ','50200'],
    ['เชียงใหม่','เมืองเชียงใหม่','ศรีภูมิ','50200'],
    ['เชียงราย','เมืองเชียงราย','เวียง','57000'],
    ['เชียงราย','เมืองเชียงราย','รอบเวียง','57000'],
    ['กรุงเทพมหานคร','พระนคร','พระบรมมหาราชวัง','10200'],
    ['กรุงเทพมหานคร','วัฒนา','คลองเตยเหนือ','10110'],
    ['กรุงเทพมหานคร','สาทร','ทุ่งมหาเมฆ','10120'],
    ['นนทบุรี','เมืองนนทบุรี','สวนใหญ่','11000'],
    ['ภูเก็ต','เมืองภูเก็ต','ตลาดใหญ่','83000'],
  ];
  GEO = {}; GEO_FLAT = [];
  data.forEach(([p,a,t,z]) => {
    if (!GEO[p]) GEO[p] = {};
    if (!GEO[p][a]) GEO[p][a] = {};
    GEO[p][a][t] = z;
    GEO_FLAT.push({province:p, amphoe:a, tambon:t, postcode:z});
  });
}

// ── Province search ──────────────────────────────────────────
let selectedProvince = '';

function searchProvince(q) {
  const list = document.getElementById('province_list');
  if (!q || q.length < 1) { list.style.display = 'none'; return; }
  const provinces = [...new Set(GEO_FLAT.map(r => r.province))];
  const matches = provinces.filter(p => p.includes(q)).slice(0, 12);
  if (!matches.length) { list.style.display = 'none'; return; }
  list.innerHTML = matches.map(p =>
    `<div onclick="selectProvince('${p}')"
      style="padding:8px 12px;cursor:pointer;font-size:13px;"
      onmouseover="this.style.background='#f5f3ef'"
      onmouseout="this.style.background=''">${p}</div>`
  ).join('');
  list.style.display = 'block';
}

function selectProvince(p) {
  selectedProvince = p;
  document.getElementById('province_search').value = p;
  document.getElementById('province_list').style.display = 'none';
  const amphoes = [...new Set(
    GEO_FLAT.filter(r => r.province === p).map(r => r.amphoe)
  )].sort();
  const sel = document.getElementById('amphoe');
  sel.innerHTML = '<option value="">— เลือกอำเภอ —</option>' +
    amphoes.map(a => `<option value="${a}">${a}</option>`).join('');
  sel.disabled = false;
  document.getElementById('tambon').innerHTML = '<option value="">— เลือกอำเภอก่อน —</option>';
  document.getElementById('tambon').disabled = true;
  document.getElementById('postcode').value = '';
}

function loadTambon() {
  const amp = document.getElementById('amphoe').value;
  if (!amp) return;
  const tambons = [...new Set(
    GEO_FLAT.filter(r => r.province === selectedProvince && r.amphoe === amp).map(r => r.tambon)
  )].sort();
  const sel = document.getElementById('tambon');
  sel.innerHTML = '<option value="">— เลือกตำบล —</option>' +
    tambons.map(t => `<option value="${t}">${t}</option>`).join('');
  sel.disabled = false;
  document.getElementById('postcode').value = '';
}

function loadPostcode() {
  const amp = document.getElementById('amphoe').value;
  const tam = document.getElementById('tambon').value;
  if (!amp || !tam) return;
  const row = GEO_FLAT.find(r => r.province===selectedProvince && r.amphoe===amp && r.tambon===tam);
  document.getElementById('postcode').value = row ? row.postcode : '';
}

// ── Subdomain check ──────────────────────────────────────────
const RESERVED = ['www','api','app','admin','mail','ftp','smtp','pop','imap',
  'concore','merchant','platform','viiv','static','cdn','dev','staging','test',
  'support','help','blog','shop','store','pos','chat','dashboard'];

let subTimer = null;
document.addEventListener('DOMContentLoaded', () => {
  loadGeo();
  document.getElementById('subdomain').addEventListener('input', function() {
    clearTimeout(subTimer);
    subTimer = setTimeout(() => checkSubdomain(this.value), 500);
  });
  document.getElementById('phone').addEventListener('input', function() {
    validatePhone(this.value);
  });
  // ปิด province dropdown เมื่อคลิกที่อื่น
  document.addEventListener('click', e => {
    if (!e.target.closest('#province_search') && !e.target.closest('#province_list')) {
      document.getElementById('province_list').style.display = 'none';
    }
  });
});

async function checkSubdomain(val) {
  const el = document.getElementById('subCheck');
  if (!val) { el.textContent = ''; return; }
  if (val.length < 4) { el.className='check-badge check-err'; el.textContent='❌ ต้องมีอย่างน้อย 4 ตัวอักษร'; return; }
  if (RESERVED.includes(val)) { el.className='check-badge check-err'; el.textContent='❌ subdomain นี้ถูกจองไว้'; return; }
  if (!/^[a-z0-9][a-z0-9-]{2,}[a-z0-9]$/.test(val)) {
    el.className='check-badge check-err'; el.textContent='❌ ใช้ได้เฉพาะ a-z 0-9 และ - (ขีดกลาง)'; return;
  }
  el.className='check-badge check-ing'; el.textContent='⏳ กำลังตรวจสอบ...';
  try {
    const r = await fetch('/api/check-subdomain?subdomain=' + val);
    if (r.ok) {
      const d = await r.json();
      if (d.available) { el.className='check-badge check-ok'; el.textContent='✅ ' + val + '.viiv.me ว่างอยู่'; }
      else             { el.className='check-badge check-err'; el.textContent='❌ subdomain นี้ถูกใช้แล้ว'; }
    } else { el.className='check-badge check-ok'; el.textContent='✅ ดูเหมือนว่าง (ตรวจสอบอีกครั้งตอนบันทึก)'; }
  } catch { el.className='check-badge check-ok'; el.textContent=''; }
}

function validatePhone(val) {
  const el = document.getElementById('phoneCheck');
  const clean = val.replace(/[-\s]/g, '');
  if (!clean) { el.textContent = ''; return; }
  const valid = /^(0[689]\d{7,8}|\+66[689]\d{7,8})$/.test(clean);
  el.className = 'check-badge ' + (valid ? 'check-ok' : 'check-err');
  el.textContent = valid ? '✅ เบอร์ถูกต้อง' : '❌ รูปแบบไม่ถูกต้อง (09x-xxx-xxxx)';
}

// ── Validate & Submit ────────────────────────────────────────
function validate() {
  const get = id => document.getElementById(id).value.trim();
  const msg = document.getElementById('formMsg');
  msg.textContent = '';

  if (!get('full_name'))  { msg.textContent = 'กรุณากรอกชื่อ-นามสกุล'; return false; }
  if (!get('email') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('email')))
    { msg.textContent = 'กรุณากรอกอีเมลให้ถูกต้อง'; return false; }
  if (get('password').length < 6)
    { msg.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'; return false; }

  const phone = get('phone').replace(/[-\s]/g,'');
  if (!/^(0[689]\d{7,8}|\+66[689]\d{7,8})$/.test(phone))
    { msg.textContent = 'กรุณากรอกเบอร์โทรให้ถูกต้อง (เช่น 0812345678)'; return false; }

  if (!get('store_name'))  { msg.textContent = 'กรุณากรอกชื่อร้านค้า'; return false; }

  const sub = get('subdomain');
  if (sub.length < 4)      { msg.textContent = 'Subdomain ต้องมีอย่างน้อย 4 ตัวอักษร'; return false; }
  if (RESERVED.includes(sub)) { msg.textContent = 'Subdomain นี้ถูกจองไว้ กรุณาเลือกใหม่'; return false; }

  return true;
}

async function submitForm() {
  if (!validate()) return;
  const get = id => document.getElementById(id).value.trim();
  const btn = document.getElementById('submitBtn');
  const msg = document.getElementById('formMsg');

  btn.disabled = true; btn.textContent = 'กำลังสร้างร้าน...';

  const payload = {
    full_name:  get('full_name'),
    email:      get('email'),
    password:   get('password'),
    store_name: get('store_name'),
    subdomain:  get('subdomain'),
    phone:      get('phone').replace(/[-\s]/g,''),
  };

  try {
    const token = localStorage.getItem('viiv_token');
    const res = await fetch('/api/register_shop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? {'Authorization': 'Bearer ' + token} : {})
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    const box = document.getElementById('resultBox');
    box.style.display = 'block';

    if (res.ok) {
      box.className = 'result-box';
      document.getElementById('resultTitle').textContent = '✅ สร้างร้านค้าสำเร็จ!';
      document.getElementById('resultBody').innerHTML = `
        <div class="result-row">ชื่อร้าน: <strong>${payload.store_name}</strong></div>
        <div class="result-row">URL: <strong>${result.subdomain}.viiv.me</strong></div>
        <div class="result-row result-id">User ID: ${result.user_id}</div>
        <div class="result-row result-id">Tenant ID: ${result.tenant_id}</div>
        <div class="result-row">สถานะ: ${result.status}</div>
      `;
      resetForm();
    } else {
      box.className = 'result-box err';
      const detail = result.detail || 'เกิดข้อผิดพลาด';
      document.getElementById('resultTitle').textContent = '❌ ไม่สำเร็จ';
      document.getElementById('resultBody').innerHTML =
        detail === 'subdomain taken' ? 'Subdomain นี้ถูกใช้แล้ว' :
        detail === 'email taken'     ? 'อีเมลนี้ถูกใช้แล้ว' :
        JSON.stringify(detail);
    }
  } catch(e) {
    msg.textContent = 'ไม่สามารถเชื่อมต่อ server ได้';
  } finally {
    btn.disabled = false; btn.textContent = 'สร้างร้านค้า';
  }
}

function resetForm() {
  ['full_name','email','password','phone','store_name','subdomain',
   'address','postcode','province_search'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('amphoe').innerHTML = '<option value="">— เลือกจังหวัดก่อน —</option>';
  document.getElementById('amphoe').disabled = true;
  document.getElementById('tambon').innerHTML = '<option value="">— เลือกอำเภอก่อน —</option>';
  document.getElementById('tambon').disabled = true;
  document.getElementById('subCheck').textContent = '';
  document.getElementById('phoneCheck').textContent = '';
  document.getElementById('formMsg').textContent = '';
  selectedProvince = '';
}
</script>
</body>
</html>
"""

with open(os.path.join(PAGES, "register-shop.html"), "w", encoding="utf-8") as f:
    f.write(REGISTER_HTML)
print("✅ pages/register-shop.html")

# ══════════════════════════════════════════════════════════════
# 2. แก้ dashboard.html — ปุ่ม "+ สร้างร้าน" โหลด register-shop ใน SPA
# ══════════════════════════════════════════════════════════════
dash_path = os.path.join(BASE, "dashboard.html")
with open(dash_path, "r", encoding="utf-8") as f:
    dash = f.read()

# เปลี่ยน createBtn ให้เรียก renderPage แทน alert
old_create = """document.getElementById('createBtn').textContent   = page.createLabel || '+ สร้างใหม่';"""
new_create = """document.getElementById('createBtn').textContent   = page.createLabel || '+ สร้างใหม่';
    document.getElementById('createBtn').onclick = page.onCreate || null;"""

if old_create in dash:
    dash = dash.replace(old_create, new_create)

# เพิ่ม onCreate ใน shops page config
old_shops = """  shops: {
    title:  'จัดการร้านค้า',
    sub:    'จัดการข้อมูลร้านค้าทั้งหมด',
    badge:  'Admin',
    action: true,
    searchPlaceholder: 'ค้นหา Shop ID',
    createLabel: '+ สร้างร้าน',
    render: renderShops,
  },"""

new_shops = """  shops: {
    title:  'จัดการร้านค้า',
    sub:    'จัดการข้อมูลร้านค้าทั้งหมด',
    badge:  'Admin',
    action: true,
    searchPlaceholder: 'ค้นหา Shop ID',
    createLabel: '+ สร้างร้าน',
    render: renderShops,
    onCreate: () => {
      document.getElementById('cardHeading').textContent = 'สร้างร้านค้าใหม่';
      document.getElementById('cardSub').textContent = 'กรอกข้อมูลเพื่อเปิดร้านบน VIIV Platform';
      document.getElementById('actionbar').classList.add('hidden');
      renderPage(document.getElementById('cardBody'), 'register-shop');
    },
  },"""

if old_shops in dash:
    dash = dash.replace(old_shops, new_shops)

with open(dash_path, "w", encoding="utf-8") as f:
    f.write(dash)
print("✅ dashboard.html — createBtn updated")

# ══════════════════════════════════════════════════════════════
# 3. แก้ register_shop.py — subdomain min 4 + check endpoint
# ══════════════════════════════════════════════════════════════
with open(API, "r", encoding="utf-8") as f:
    api = f.read()

# เปลี่ยน min_length=3 → min_length=4
api = api.replace("min_length=3, max_length=100", "min_length=4, max_length=40")

# เพิ่ม reserved words check + check-subdomain endpoint
old_register = """@router.post("/register_shop", response_model=RegisterShopOut, status_code=status.HTTP_201_CREATED)"""

reserved_block = '''RESERVED_SUBDOMAINS = {
    "www","api","app","admin","mail","ftp","smtp","concore","merchant",
    "platform","viiv","static","cdn","dev","staging","test","support",
    "help","blog","shop","store","pos","chat","dashboard","login",
}

@router.get("/check-subdomain")
def check_subdomain(subdomain: str, db: Session = Depends(get_db)):
    if subdomain in RESERVED_SUBDOMAINS:
        return {"available": False, "reason": "reserved"}
    taken = tenant_repo.get_tenant_by_subdomain(db, subdomain)
    return {"available": not taken}

'''

if "RESERVED_SUBDOMAINS" not in api:
    api = api.replace(old_register, reserved_block + old_register)

# เพิ่ม reserved check ใน register endpoint
old_subdomain_check = '''        if tenant_repo.get_tenant_by_subdomain(db, payload.subdomain):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="subdomain taken")'''

new_subdomain_check = '''        if payload.subdomain in RESERVED_SUBDOMAINS:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="subdomain reserved")
        if tenant_repo.get_tenant_by_subdomain(db, payload.subdomain):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="subdomain taken")'''

if old_subdomain_check in api and "subdomain reserved" not in api:
    api = api.replace(old_subdomain_check, new_subdomain_check)

with open(API, "w", encoding="utf-8") as f:
    f.write(api)
print("✅ register_shop.py — min_length=4, reserved words, check endpoint")

print("\n🎉 เสร็จสิ้น — restart server แล้วทดสอบที่ปุ่ม '+ สร้างร้าน'")
print("   cd ~/viiv && source .venv/bin/activate")
print("   pkill -f uvicorn; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/viiv.log 2>&1 &")
