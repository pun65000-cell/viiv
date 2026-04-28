SRC = "/home/viivadmin/viiv/frontend/pwa/pages/billing.js"
with open(SRC, "r", encoding="utf-8") as f:
    lines = f.readlines()

ok = []
err = []
out = []
i = 0
while i < len(lines):
    line = lines[i]

    # STEP 1: เพิ่ม _stockEmptySell หลัง _draftId
    if "_draftId = null;" in line and "_stockEmptySell" not in line:
        out.append(line)
        out.append("  let _stockEmptySell = true;\n")
        ok.append("STEP 1: เพิ่ม _stockEmptySell")
        i += 1
        continue

    # STEP 2: แทนที่ fetch products ใน _reload
    if "const data = await App.api('/api/pos/products/list');" in line:
        indent = "      "
        out.append(indent + "const [data, ss] = await Promise.all([\n")
        out.append(indent + "  App.api('/api/pos/products/list'),\n")
        out.append(indent + "  App.api('/api/pos/store/settings').catch(()=>({}))\n")
        out.append(indent + "]);\n")
        ok.append("STEP 2a: fetch parallel")
        i += 1
        continue

    if "_products = Array.isArray(data) ? data : (data.products || []);" in line:
        out.append(line)
        out.append("        _stockEmptySell = (ss.stock_empty_sell !== false);\n")
        ok.append("STEP 2b: อ่าน stock_empty_sell")
        i += 1
        continue

    # STEP 3: stock check ใน addItem
    if "const p = _products.find(x => x.id === pid);" in line:
        out.append(line)
        i += 1
        # บรรทัดถัดไปต้องเป็น if (!p) return;
        if i < len(lines) and "if (!p) return;" in lines[i]:
            out.append(lines[i])
            i += 1
            out.append("      if (!_stockEmptySell && p.track_stock && (p.stock_qty||0) <= 0) {\n")
            out.append("        App.toast('\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 ' + p.name + ' \u0e2b\u0e21\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e19\u0e2a\u0e15\u0e4a\u0e2d\u0e01'); return;\n")
            out.append("      }\n")
            ok.append("STEP 3: stock check ใน addItem")
        continue

    # STEP 4: แทนที่ el.innerHTML = list.map(p => `
    if "el.innerHTML = list.map(p => `" in line:
        # ข้ามจนถึง ).join('');
        card_lines = []
        while i < len(lines):
            card_lines.append(lines[i])
            if ").join('');" in lines[i]:
                i += 1
                break
            i += 1
        # เขียน renderProducts ใหม่
        out.append("      var inStock = list.filter(function(p){ return _stockEmptySell || !p.track_stock || (p.stock_qty||0) > 0; });\n")
        out.append("      var outStock = list.filter(function(p){ return !_stockEmptySell && p.track_stock && (p.stock_qty||0) <= 0; });\n")
        out.append("      function mkCard(p, dim) {\n")
        out.append("        return '<div class=\"list-item\" style=\"margin-bottom:6px;gap:10px'\n")
        out.append("          + (dim ? ';opacity:0.38;pointer-events:none' : '')\n")
        out.append("          + '\"' + (dim ? '' : ' onclick=\"BillingPage.addItem(\\'' + p.id + '\\')\"') + '>'\n")
        out.append("          + '<div style=\"font-size:1.3rem;flex-shrink:0\">' + (dim ? '\u26d4' : '\U0001f4e6') + '</div>'\n")
        out.append("          + '<div class=\"li-left\">'\n")
        out.append("          + '<div class=\"li-title\">' + _esc(p.name)\n")
        out.append("            + (dim ? ' <span style=\"font-size:10px;color:#ef4444\">\u0e2b\u0e21\u0e14</span>' : '') + '</div>'\n")
        out.append("          + '<div class=\"li-sub\">\u0e3f' + _fmt(p.price) + (p.sku ? ' \u00b7 ' + _esc(p.sku) : '') + '</div>'\n")
        out.append("          + '</div>'\n")
        out.append("          + '<div style=\"background:var(--gold);color:#000;border-radius:8px;padding:4px 12px;font-weight:700;font-size:var(--fs-sm);flex-shrink:0\">+</div>'\n")
        out.append("          + '</div>';\n")
        out.append("      }\n")
        out.append("      var outHtml = outStock.length\n")
        out.append("        ? '<div style=\"font-size:11px;color:#9ca3af;padding:6px 2px\">\u2014 \u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e2b\u0e21\u0e14 \u2014</div>'\n")
        out.append("          + outStock.map(function(p){ return mkCard(p, true); }).join('')\n")
        out.append("        : '';\n")
        out.append("      el.innerHTML = inStock.map(function(p){ return mkCard(p, false); }).join('') + outHtml;\n")
        ok.append("STEP 4: render inStock/outStock")
        continue

    out.append(line)
    i += 1

for s in ok: print("OK:", s)
for e in err: print("ERROR:", e)

if len(ok) >= 3:
    with open(SRC, "w", encoding="utf-8") as f:
        f.writelines(out)
    print("\nDONE: บันทึกสำเร็จ")
else:
    print("\nไม่บันทึก — OK น้อยเกินไป")
