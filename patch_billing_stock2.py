SRC = "/home/viivadmin/viiv/frontend/pwa/pages/billing.js"
with open(SRC, "r", encoding="utf-8") as f:
    js = f.read()

ok = []
errors = []

# ── 1. เพิ่ม _stockEmptySell variable
OLD1 = "let _cart = [];"
NEW1 = "let _cart = [];\n  let _stockEmptySell = true;"
if OLD1 in js:
    js = js.replace(OLD1, NEW1, 1)
    ok.append("STEP 1: เพิ่ม _stockEmptySell")
else:
    errors.append("STEP 1: ไม่พบ let _cart")

# ── 2. โหลด stock_empty_sell จาก _settings ใน Promise.all block
OLD2 = "_settings = settings || {};"
NEW2 = "_settings = settings || {};\n      _stockEmptySell = _settings.stock_empty_sell !== false;"
if OLD2 in js:
    js = js.replace(OLD2, NEW2, 1)
    ok.append("STEP 2: อ่าน stock_empty_sell จาก _settings")
else:
    errors.append("STEP 2: ไม่พบ _settings = settings")

# ── 3. เพิ่ม stock check ใน addItem() — แสดง toast แล้ว return
OLD3 = "      const p = _products.find(x => x.id === pid);"
NEW3 = (
    "      const p = _products.find(x => x.id === pid);\n"
    "      if (!_stockEmptySell && p && p.track_stock && (p.stock_qty || 0) <= 0) {\n"
    "        App.toast('\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 ' + p.name + ' \u0e2b\u0e21\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e19\u0e2a\u0e15\u0e4a\u0e2d\u0e01'); return;\n"
    "      }"
)
if OLD3 in js:
    js = js.replace(OLD3, NEW3, 1)
    ok.append("STEP 3: เพิ่ม stock check ใน addItem()")
else:
    errors.append("STEP 3: ไม่พบ const p = _products.find ใน addItem")

# ── 4. เพิ่ม css สินค้าหมดใน _renderProducts — เปลี่ยน list.map ให้แยก inStock/outStock
OLD4 = (
    "    el.innerHTML = list.map(p => `\n"
    "      <div class=\"list-item\" style=\"margin-bottom:6px;gap:10px\" onclick=\"BillingPage.addItem('${p.id}')\">\n"
    "        <div style=\"font-size:1.3rem;flex-shrink:0\">\U0001f4e6</div>\n"
    "        <div class=\"li-left\">\n"
    "          <div class=\"li-title\">${_esc(p.name)}</div>\n"
    "          <div class=\"li-sub\">\u0e3f${_fmt(p.price)}${p.sku?' \u00b7 '+_esc(p.sku):''}</div>\n"
    "        </div>"
)

if OLD4 not in js:
    # หา pattern จริงจากไฟล์
    idx = js.find("el.innerHTML = list.map")
    if idx == -1:
        errors.append("STEP 4: ไม่พบ el.innerHTML = list.map")
    else:
        snippet = js[idx:idx+400]
        errors.append("STEP 4: pattern ไม่ตรง — snippet: " + repr(snippet[:200]))
else:
    NEW4 = (
        "    const _inStock = list.filter(p => _stockEmptySell || !p.track_stock || (p.stock_qty||0) > 0);\n"
        "    const _outStock = list.filter(p => !_stockEmptySell && p.track_stock && (p.stock_qty||0) <= 0);\n"
        "    function _card(p, dim) {\n"
        "      return '<div class=\"list-item\" style=\"margin-bottom:6px;gap:10px' + (dim?';opacity:0.35;pointer-events:none':'') + '\"' + (dim?'':' onclick=\"BillingPage.addItem(\\'' + p.id + '\\')\"') + '>'\n"
        "        + '<div style=\"font-size:1.3rem;flex-shrink:0\">' + (dim ? '\u26d4' : '\U0001f4e6') + '</div>'\n"
        "        + '<div class=\"li-left\">'\n"
        "        + '<div class=\"li-title\">' + _esc(p.name) + (dim ? ' <span style=\"font-size:10px;color:#ef4444\">\u0e2b\u0e21\u0e14</span>' : '') + '</div>'\n"
        "        + '<div class=\"li-sub\">\u0e3f' + _fmt(p.price) + (p.sku ? ' \u00b7 ' + _esc(p.sku) : '') + '</div>'\n"
        "        + '</div>'\n"
        "        + '<div style=\"background:var(--gold);color:#000;border-radius:8px;padding:4px 12px;font-weight:700;font-size:var(--fs-sm);flex-shrink:0\">+</div>'\n"
        "        + '</div>';\n"
        "    }\n"
        "    el.innerHTML = _inStock.map(p => _card(p,false)).join('')\n"
        "      + (_outStock.length ? '<div style=\"font-size:11px;color:#9ca3af;padding:6px 2px\">\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e2b\u0e21\u0e14</div>' + _outStock.map(p => _card(p,true)).join('') : '');\n"
        "    // legacy close\n"
        "    if(false){\n"
        "    el.innerHTML = list.map(p => `\n"
        "      <div class=\"list-item\" style=\"margin-bottom:6px;gap:10px\" onclick=\"BillingPage.addItem('${p.id}')\">\n"
        "        <div style=\"font-size:1.3rem;flex-shrink:0\">\U0001f4e6</div>\n"
        "        <div class=\"li-left\">\n"
        "          <div class=\"li-title\">${_esc(p.name)}</div>\n"
        "          <div class=\"li-sub\">\u0e3f${_fmt(p.price)}${p.sku?' \u00b7 '+_esc(p.sku):''}</div>\n"
        "        </div>"
    )
    js = js.replace(OLD4, NEW4, 1)
    # ปิด if(false) block หลัง join ของ list.map เดิม
    OLD4B = ").join('');\n  }\n  // ── CART"
    NEW4B = ").join('');\n    } // end if(false)\n  }\n  // ── CART"
    if OLD4B in js:
        js = js.replace(OLD4B, NEW4B, 1)
        ok.append("STEP 4: render inStock/outStock สำเร็จ")
    else:
        errors.append("STEP 4B: ไม่พบ closing join — ต้องแก้มือ")

# ── บันทึก
for s in ok:
    print("OK:", s)
for e in errors:
    print("ERROR:", e)

if not errors:
    with open(SRC, "w", encoding="utf-8") as f:
        f.write(js)
    print("\nDONE: บันทึกไฟล์สำเร็จ")
    print("รัน: bash /home/viivadmin/viiv/bump.sh")
else:
    print("\nไม่บันทึก — แก้ ERROR ก่อน")
