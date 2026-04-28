SRC = "/home/viivadmin/viiv/frontend/pwa/pages/billing.js"
with open(SRC, "r", encoding="utf-8") as f:
    js = f.read()

ok = []
err = []

# STEP 1: เพิ่ม _stockEmptySell variable
O1 = "  let _q = '';\n  let _draftId = null;"
N1 = "  let _q = '';\n  let _draftId = null;\n  let _stockEmptySell = true;"
if O1 in js:
    js = js.replace(O1, N1, 1); ok.append("STEP 1")
else:
    err.append("STEP 1: ไม่พบ _q/_draftId")

# STEP 2: โหลด store settings ใน _reload หลัง fetch products
O2 = "        const data = await App.api('/api/pos/products/list');\n        if (_destroyed) return;\n        _products = Array.isArray(data) ? data : (data.products || []);\n        _renderProducts();"
N2 = "        const [data, ss] = await Promise.all([\n          App.api('/api/pos/products/list'),\n          App.api('/api/pos/store/settings').catch(()=>({}))\n        ]);\n        if (_destroyed) return;\n        _products = Array.isArray(data) ? data : (data.products || []);\n        _stockEmptySell = ss.stock_empty_sell !== false;\n        _renderProducts();"
if O2 in js:
    js = js.replace(O2, N2, 1); ok.append("STEP 2")
else:
    err.append("STEP 2: ไม่พบ fetch products block")

# STEP 3: stock check ใน addItem + render สินค้าหมดจาง
O3 = "        const p = _products.find(x => x.id === pid);\n        if (!p) return;\n        const existing = _cart.find(x => x.id === pid);"
N3 = ("        const p = _products.find(x => x.id === pid);\n"
      "        if (!p) return;\n"
      "        if (!_stockEmptySell && p.track_stock && (p.stock_qty||0) <= 0) {\n"
      "          App.toast('\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 ' + p.name + ' \u0e2b\u0e21\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e19\u0e2a\u0e15\u0e4a\u0e2d\u0e01'); return;\n"
      "        }\n"
      "        const existing = _cart.find(x => x.id === pid);")
if O3 in js:
    js = js.replace(O3, N3, 1); ok.append("STEP 3")
else:
    err.append("STEP 3: ไม่พบ addItem block")

# STEP 4: _renderProducts แยก inStock/outStock (string concat ไม่ใช้ template literal)
O4 = ("      el.innerHTML = list.map(p => `\n"
      "        <div class=\"list-item\" style=\"margin-bottom:6px;gap:10px\" onclick=\"BillingPage.addItem('${p.id}')\">\n"
      "          <div style=\"font-size:1.3rem;flex-shrink:0\">\U0001f4e6</div>\n"
      "          <div class=\"li-left\">\n"
      "            <div class=\"li-title\">${_esc(p.name)}</div>\n"
      "            <div class=\"li-sub\">\u0e3f${_fmt(p.price)}${p.sku?' \u00b7 '+_esc(p.sku):''}</div>\n"
      "          </div>\n"
      "          <div style=\"background:var(--gold);color:#000;border-radius:8px;padding:4px 12px;font-weight:700;font-size:var(--fs-sm);flex-shrink:0\">+</div>\n"
      "        </div>`).join('');")
N4 = ("      var inStock = list.filter(function(p){ return _stockEmptySell || !p.track_stock || (p.stock_qty||0) > 0; });\n"
      "      var outStock = list.filter(function(p){ return !_stockEmptySell && p.track_stock && (p.stock_qty||0) <= 0; });\n"
      "      function mkCard(p, dim) {\n"
      "        return '<div class=\"list-item\" style=\"margin-bottom:6px;gap:10px' + (dim ? ';opacity:0.38;pointer-events:none' : '') + '\"'\n"
      "          + (dim ? '' : ' onclick=\"BillingPage.addItem(\\'' + p.id + '\\')\"') + '>'\n"
      "          + '<div style=\"font-size:1.3rem;flex-shrink:0\">' + (dim ? '\u26d4' : '\U0001f4e6') + '</div>'\n"
      "          + '<div class=\"li-left\">'\n"
      "          + '<div class=\"li-title\">' + _esc(p.name) + (dim ? ' <span style=\"font-size:10px;color:#ef4444\">\u0e2b\u0e21\u0e14</span>' : '') + '</div>'\n"
      "          + '<div class=\"li-sub\">\u0e3f' + _fmt(p.price) + (p.sku ? ' \u00b7 ' + _esc(p.sku) : '') + '</div>'\n"
      "          + '</div>'\n"
      "          + '<div style=\"background:var(--gold);color:#000;border-radius:8px;padding:4px 12px;font-weight:700;font-size:var(--fs-sm);flex-shrink:0\">+</div>'\n"
      "          + '</div>';\n"
      "      }\n"
      "      var outHtml = outStock.length\n"
      "        ? '<div style=\"font-size:11px;color:#9ca3af;padding:6px 2px\">\u2014 \u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e2b\u0e21\u0e14 \u2014</div>' + outStock.map(function(p){ return mkCard(p, true); }).join('')\n"
      "        : '';\n"
      "      el.innerHTML = inStock.map(function(p){ return mkCard(p, false); }).join('') + outHtml;")
if O4 in js:
    js = js.replace(O4, N4, 1); ok.append("STEP 4")
else:
    err.append("STEP 4: ไม่พบ el.innerHTML list.map block")

for s in ok: print("OK:", s)
for e in err: print("ERROR:", e)

if not err:
    with open(SRC, "w", encoding="utf-8") as f:
        f.write(js)
    print("\nDONE: บันทึกสำเร็จ")
else:
    print("\nไม่บันทึก — แก้ ERROR ก่อน")
