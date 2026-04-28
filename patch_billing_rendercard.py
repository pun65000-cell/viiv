import re

SRC = "/home/viivadmin/viiv/frontend/pwa/pages/billing.js"
with open(SRC, "r", encoding="utf-8") as f:
    js = f.read()

OLD = re.search(r'const inStock = list\.filter.*?el\.innerHTML = inStock\.map.*?\);\n  \}', js, re.DOTALL)
if not OLD:
    # ลอง pattern สำรอง
    OLD = re.search(r'const inStock = list\.filter.*?outStock\.map\(p => renderCard\(p,true\)\)\.join\(\x27\x27\) : \x27\x27\);\n  \}', js, re.DOTALL)

if not OLD:
    print("ERROR: ไม่พบ block — ดู pattern จริง:")
    idx = js.find("const inStock")
    print(repr(js[idx:idx+300]))
else:
    NEW = (
        "const inStock = list.filter(p => _stockEmptySell || !p.track_stock || (p.stock_qty||0) > 0);\n"
        "    const outStock = list.filter(p => !_stockEmptySell && p.track_stock && (p.stock_qty||0) <= 0);\n"
        "    function renderCard(p, disabled) {\n"
        "      var click = disabled ? '' : 'onclick=\"BillingPage.addItem(\\'' + p.id + '\\'\"';\n"
        "      var icon = disabled ? '\U0001f6ab' : '\U0001f4e6';\n"
        "      var badge = disabled ? '<span style=\"font-size:10px;color:#ef4444;font-weight:600\">\u0e2b\u0e21\u0e14</span>' : '';\n"
        "      var style = disabled ? 'opacity:0.35;pointer-events:none;filter:grayscale(1)' : '';\n"
        "      return '<div class=\"list-item\" style=\"margin-bottom:6px;gap:10px;' + style + '\" ' + click + '>'\n"
        "        + '<div style=\"font-size:1.3rem;flex-shrink:0\">' + icon + '</div>'\n"
        "        + '<div class=\"li-left\">'\n"
        "        + '<div class=\"li-title\">' + _esc(p.name) + badge + '</div>'\n"
        "        + '<div class=\"li-sub\">\u0e3f' + _fmt(p.price) + (p.sku ? ' \u00b7 ' + _esc(p.sku) : '') + '</div>'\n"
        "        + '</div>'\n"
        "        + '<div style=\"background:var(--gold);color:#000;border-radius:8px;padding:4px 12px;font-weight:700;font-size:var(--fs-sm);flex-shrink:0\">+</div>'\n"
        "        + '</div>';\n"
        "    }\n"
        "    var outHtml = outStock.length ? '<div style=\"font-size:11px;color:#9ca3af;padding:6px 2px\">\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e2b\u0e21\u0e14</div>' + outStock.map(function(p){ return renderCard(p,true); }).join('') : '';\n"
        "    el.innerHTML = inStock.map(function(p){ return renderCard(p,false); }).join('') + outHtml;\n"
        "  }"
    )
    js = js[:OLD.start()] + NEW + js[OLD.end():]
    with open(SRC, "w", encoding="utf-8") as f:
        f.write(js)
    print("OK: rewrite renderCard สำเร็จ")
