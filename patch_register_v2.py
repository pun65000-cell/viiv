#!/usr/bin/env python3
# patch_register_v2.py
# python3 ~/viiv/patch_register_v2.py

import os

BASE  = os.path.expanduser("~/viiv/frontend/platform")
PAGES = os.path.join(BASE, "pages")
DASH  = os.path.join(BASE, "dashboard.html")

# ══════════════════════════════════════════════════════════════
# 1. แก้ dashboard.html — .content-wrap ให้ scroll เฉพาะ SPA zone
# ══════════════════════════════════════════════════════════════
with open(DASH, "r", encoding="utf-8") as f:
    dash = f.read()

# แก้ body ไม่ให้ scroll — ให้ content-wrap scroll แทน
old_body = """    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      background: var(--bg-main);
      display: flex;
      min-height: 100vh;
      color: var(--text);
    }"""

new_body = """    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      background: var(--bg-main);
      display: flex;
      height: 100vh;
      overflow: hidden;
      color: var(--text);
    }"""

if old_body in dash:
    dash = dash.replace(old_body, new_body)
    print("✅ body: height:100vh + overflow:hidden")

# sidebar ต้อง scroll ได้เฉพาะ nav
old_sidebar = """    .sidebar {
      width: 210px;
      min-width: 210px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--sidebar-border);
      display: flex;
      flex-direction: column;
      padding: 0;
    }"""

new_sidebar = """    .sidebar {
      width: 210px;
      min-width: 210px;
      height: 100vh;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--sidebar-border);
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
    }"""

if old_sidebar in dash:
    dash = dash.replace(old_sidebar, new_sidebar)
    print("✅ sidebar: height:100vh")

# main ต้อง overflow hidden เช่นกัน
old_main = """    /* ─── MAIN ─── */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--content-bg);
      min-width: 0;
    }"""

new_main = """    /* ─── MAIN ─── */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--content-bg);
      min-width: 0;
      height: 100vh;
      overflow: hidden;
    }"""

if old_main in dash:
    dash = dash.replace(old_main, new_main)
    print("✅ main: overflow:hidden")

# content-wrap ให้ scroll
old_cwrap = """    .content-wrap { flex: 1; padding: 16px 20px 20px; overflow-y: auto; }"""
new_cwrap  = """    .content-wrap { flex: 1; padding: 16px 20px 20px; overflow-y: auto; min-height: 0; }"""

if old_cwrap in dash:
    dash = dash.replace(old_cwrap, new_cwrap)
    print("✅ content-wrap: min-height:0 (flex scroll fix)")

with open(DASH, "w", encoding="utf-8") as f:
    f.write(dash)

# ══════════════════════════════════════════════════════════════
# 2. แก้ pages/register-shop.html — dropdown + ข้อตกลง
# ══════════════════════════════════════════════════════════════
REG_PATH = os.path.join(PAGES, "register-shop.html")
with open(REG_PATH, "r", encoding="utf-8") as f:
    reg = f.read()

# 2a. แก้ province field — เพิ่ม position:relative บน wrapper
old_prov = """    <div class="field">
      <label>จังหวัด</label>
      <input id="province_search" type="text" placeholder="พิมพ์ค้นหา เช่น เชียง"
             oninput="searchProvince(this.value)" autocomplete="off" />
      <div id="province_list" style="display:none;position:absolute;z-index:99;background:#fff;border:1px solid var(--card-border);border-radius:var(--r-md);max-height:180px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
    </div>"""

new_prov = """    <div class="field" style="position:relative;">
      <label>จังหวัด</label>
      <input id="province_search" type="text" placeholder="พิมพ์ค้นหา เช่น เชียง"
             oninput="searchProvince(this.value)" autocomplete="off" />
      <div id="province_list" style="display:none;position:absolute;z-index:999;background:#fff;border:1px solid var(--card-border);border-radius:var(--r-md);max-height:200px;overflow-y:auto;width:100%;box-shadow:0 6px 16px rgba(0,0,0,0.12);top:100%;left:0;"></div>
    </div>"""

if old_prov in reg:
    reg = reg.replace(old_prov, new_prov)
    print("✅ province dropdown: position:relative + top:100%")

# 2b. เพิ่ม section ข้อตกลงก่อนปุ่ม submit
old_actions = """  <div class="form-actions">
    <button class="btn btn-accent" id="submitBtn" onclick="submitForm()">สร้างร้านค้า</button>
    <button class="btn" onclick="resetForm()">ล้างข้อมูล</button>
  </div>"""

terms_text = """ข้อตกลงการใช้บริการระบบ VIIV Platform

ผู้ให้บริการระบบ (ต่อไปนี้เรียกว่า "ผู้ให้บริการ") ให้บริการพื้นที่และเครื่องมือสำหรับการขายสินค้าออนไลน์แก่ผู้ประกอบการ (ต่อไปนี้เรียกว่า "ผู้ใช้บริการ") ภายใต้เงื่อนไขดังต่อไปนี้

1. ความรับผิดชอบของผู้ใช้บริการ
ผู้ใช้บริการมีหน้าที่รับผิดชอบต่อความถูกต้องของข้อมูลร้านค้า สินค้า และเนื้อหาทั้งหมดที่นำเข้าสู่ระบบ รวมถึงการปฏิบัติตามกฎหมายพาณิชย์อิเล็กทรอนิกส์ กฎหมายคุ้มครองผู้บริโภค กฎหมายภาษีอากร และกฎหมายที่เกี่ยวข้องอื่นๆ ของประเทศไทย

2. การคุ้มครองข้อมูลส่วนบุคคล (PDPA)
ผู้ให้บริการเก็บรวบรวมและประมวลผลข้อมูลส่วนบุคคลของผู้ใช้บริการและลูกค้าของผู้ใช้บริการ ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ผู้ใช้บริการยินยอมให้ผู้ให้บริการประมวลผลข้อมูลดังกล่าวเพื่อวัตถุประสงค์ในการให้บริการระบบเท่านั้น และรับทราบว่าตนมีสิทธิ์เข้าถึง แก้ไข และลบข้อมูลส่วนบุคคลของตนได้ตามสิทธิ์ที่กฎหมายกำหนด

3. ข้อจำกัดความรับผิดของผู้ให้บริการ
ผู้ให้บริการระบบไม่ใช่คู่สัญญาในธุรกรรมระหว่างผู้ใช้บริการและลูกค้าปลายทาง และไม่รับผิดชอบต่อความเสียหายใดๆ อันเกิดจากธุรกรรมดังกล่าว ความพร้อมใช้งานของระบบอาจหยุดชะงักได้เป็นครั้งคราวเพื่อการบำรุงรักษา

4. การยกเลิกบริการ
ผู้ให้บริการสงวนสิทธิ์ระงับหรือยกเลิกบัญชีที่ฝ่าฝืนข้อตกลงนี้ ใช้ระบบในทางที่ผิดกฎหมาย หรือก่อให้เกิดความเสียหายแก่ผู้ให้บริการหรือผู้ใช้บริการรายอื่น

5. การเปลี่ยนแปลงข้อตกลง
ผู้ให้บริการอาจปรับปรุงข้อตกลงนี้เป็นครั้งคราว โดยแจ้งให้ผู้ใช้บริการทราบล่วงหน้าผ่านระบบ การใช้บริการต่อเนื่องถือว่าผู้ใช้บริการยอมรับข้อตกลงที่เปลี่ยนแปลงนั้นแล้ว

การสร้างบัญชีถือว่าผู้ใช้บริการได้อ่าน เข้าใจ และยอมรับข้อตกลงข้างต้นทั้งหมด"""

new_actions = """  <div class="section-title">ข้อตกลงการใช้บริการ</div>
  <div style="background:#f8f6f2;border:1px solid var(--card-border);border-radius:var(--r-md);padding:14px 16px;max-height:160px;overflow-y:scroll;font-size:12px;line-height:1.8;color:#444;white-space:pre-line;" id="termsBox">""" + terms_text + """</div>
  <div style="margin-top:10px;display:flex;align-items:flex-start;gap:8px;">
    <input type="checkbox" id="termsCheck" style="width:16px;height:16px;margin-top:2px;accent-color:var(--accent);cursor:pointer;" />
    <label for="termsCheck" style="font-size:13px;color:var(--text);cursor:pointer;line-height:1.5;">
      ข้าพเจ้าได้อ่านและยอมรับ <strong>ข้อตกลงการใช้บริการ</strong> ของผู้ให้บริการระบบ VIIV Platform ครบถ้วนแล้ว
    </label>
  </div>

  <div class="form-actions" style="margin-top:16px;">
    <button class="btn btn-accent" id="submitBtn" onclick="submitForm()">สร้างร้านค้า</button>
    <button class="btn" onclick="resetForm()">ล้างข้อมูล</button>
  </div>"""

if old_actions in reg:
    reg = reg.replace(old_actions, new_actions)
    print("✅ terms & conditions section added")

# 2c. แก้ validate() เพิ่มเช็ค termsCheck
old_validate_end = """  if (!get('store_name'))  { msg.textContent = 'กรุณากรอกชื่อร้านค้า'; return false; }

  const sub = get('subdomain');
  if (sub.length < 4)      { msg.textContent = 'Subdomain ต้องมีอย่างน้อย 4 ตัวอักษร'; return false; }
  if (RESERVED.includes(sub)) { msg.textContent = 'Subdomain นี้ถูกจองไว้ กรุณาเลือกใหม่'; return false; }

  return true;
}"""

new_validate_end = """  if (!get('store_name'))  { msg.textContent = 'กรุณากรอกชื่อร้านค้า'; return false; }

  const sub = get('subdomain');
  if (sub.length < 4)      { msg.textContent = 'Subdomain ต้องมีอย่างน้อย 4 ตัวอักษร'; return false; }
  if (RESERVED.includes(sub)) { msg.textContent = 'Subdomain นี้ถูกจองไว้ กรุณาเลือกใหม่'; return false; }

  if (!document.getElementById('termsCheck').checked) {
    msg.textContent = 'กรุณายอมรับข้อตกลงการใช้บริการก่อนดำเนินการต่อ';
    document.getElementById('termsCheck').focus();
    return false;
  }

  return true;
}"""

if old_validate_end in reg:
    reg = reg.replace(old_validate_end, new_validate_end)
    print("✅ validate: termsCheck required")

# 2d. แก้ resetForm() รีเซ็ต termsCheck ด้วย
old_reset_end = """  document.getElementById('subCheck').textContent = '';
  document.getElementById('phoneCheck').textContent = '';
  document.getElementById('formMsg').textContent = '';
  selectedProvince = '';
}"""

new_reset_end = """  document.getElementById('subCheck').textContent = '';
  document.getElementById('phoneCheck').textContent = '';
  document.getElementById('formMsg').textContent = '';
  document.getElementById('termsCheck').checked = false;
  selectedProvince = '';
}"""

if old_reset_end in reg:
    reg = reg.replace(old_reset_end, new_reset_end)
    print("✅ resetForm: clear termsCheck")

with open(REG_PATH, "w", encoding="utf-8") as f:
    f.write(reg)

print("\n🎉 เสร็จ — hard refresh แล้วทดสอบเลยครับ (Ctrl+Shift+R)")
