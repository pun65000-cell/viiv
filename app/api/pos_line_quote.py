import subprocess, tempfile, os, json, urllib.request
from datetime import datetime, timezone, timedelta

def render_quote_jpg(store: dict, products: list, banks: list) -> bytes:
    tz7 = timezone(timedelta(hours=7))
    now = datetime.now(tz7)
    date_str = now.strftime("%d/%m/") + str(now.year + 543)
    base = "https://concore.viiv.me"

    # โลโก้ใหญ่ขึ้น 20% จากเดิม 44px → 53px
    logo_html = ""
    if store.get("logo_url"):
        logo_html = '<img src="{}{}" style="height:53px;width:53px;object-fit:contain;border-radius:6px;flex-shrink:0;margin-right:12px;">'.format(base, store["logo_url"])
    else:
        first = (store.get("store_name") or "S")[0].upper()
        logo_html = '<div style="width:53px;height:53px;flex-shrink:0;margin-right:12px;background:#e8b93e;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#1a1200;">{}</div>'.format(first)

    # quote config
    quote_qr_url  = store.get("line_quote_qr_url", "") or ""
    quote_contact = store.get("line_quote_contact", "") or ""
    quote_note    = store.get("line_quote_note", "") or "ใบเสนอราคานี้มีผล 7 วัน ขอสงวนสิทธิ์ในการเปลี่ยนแปลงทุกกรณี"

    # บล็อกมุมขวาล่าง (QR + ข้อความ)
    contact_block = ""
    if quote_qr_url or quote_contact:
        qr_img = ""
        if quote_qr_url:
            qr_img = '<img src="{}{}" style="width:64px;height:64px;object-fit:contain;flex-shrink:0;">'.format(base, quote_qr_url)
        contact_txt = ""
        if quote_contact:
            contact_txt = '<div style="font-size:10px;color:#374151;margin-top:4px;line-height:1.5;">{}</div>'.format(quote_contact)
        contact_block = '''<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #e5e5e5;border-radius:6px;background:#fafafa;">
            {}
            <div style="font-size:10px;color:#6b7280;font-weight:600;">ช่องทางติดต่อ{}</div>
        </div>'''.format(qr_img, contact_txt)

    # จัดกลุ่มตาม category
    cats = {}
    for p in products[:150]:
        cat = p.get("category_name") or p.get("category") or "สินค้าทั่วไป"
        cats.setdefault(cat, []).append(p)

    table_blocks = ""
    for cat_name, items in cats.items():
        table_blocks += '<tr><td colspan="6" style="background:#e8e8e8;font-weight:700;font-size:13px;padding:5px 10px;color:#222;border-top:1px solid #999;border-bottom:1px solid #aaa;">{}</td></tr>'.format(cat_name)
        for i in range(0, len(items), 3):
            chunk = list(items[i:i+3])
            cells = ""
            for p in chunk:
                price = "{:,.0f}".format(float(p.get("price", 0)))
                name = p.get("name", "")
                if len(name) > 20:
                    name = name[:19] + "…"
                cells += '<td style="padding:6px 4px 6px 10px;font-size:13px;color:#1a1a1a;border-bottom:0.5px solid #bbb;border-right:0.5px solid #ccc;width:27%;">{}</td><td style="padding:6px 12px 6px 4px;font-size:13px;font-weight:700;color:#b86e00;border-bottom:0.5px solid #bbb;border-right:1px solid #aaa;width:7%;text-align:right;white-space:nowrap;">{}</td>'.format(name, price)
            while len(chunk) < 3:
                cells += '<td style="width:27%;border-bottom:0.5px solid #bbb;border-right:0.5px solid #ccc;"></td><td style="width:7%;border-bottom:0.5px solid #bbb;border-right:1px solid #aaa;"></td>'
                chunk.append({})
            table_blocks += "<tr>{}</tr>".format(cells)

    total_items = len(products[:150])

    # footer: หมายเหตุ (2/3) + contact block (1/3)
    footer_html = '''<div style="display:flex;gap:12px;margin-top:12px;align-items:flex-start;">
  <div style="flex:2;padding:8px 10px;background:#fffbf0;border-left:4px solid #e8b93e;font-size:10px;color:#6b7280;">
    หมายเหตุ : {}
  </div>
  <div style="flex:1;">
    {}
  </div>
</div>'''.format(quote_note, contact_block)

    html = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0;padding:0;box-sizing:border-box; }}
body {{ font-family:'Loma','Garuda','Waree',sans-serif;background:#fff;width:1200px;padding:32px 44px 28px; }}
table {{ width:100%;border-collapse:collapse;border:1px solid #aaa; }}
</style></head><body>

<div style="display:flex;align-items:center;margin-bottom:14px;">
  {}
  <div style="min-width:0;flex:1;">
    <div style="font-size:22px;font-weight:700;color:#1a1a1a;">{}</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px;">สินค้าทั้งหมด {} รายการ</div>
  </div>
  <div style="margin-left:auto;text-align:right;flex-shrink:0;">
    <div style="font-size:18px;font-weight:700;color:#b86e00;">ใบเสนอราคา</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px;">วันที่ {}</div>
  </div>
</div>

<div style="border-top:3px solid #e8b93e;margin-bottom:10px;"></div>

<table><tbody>{}</tbody></table>

{}

</body></html>""".format(
        logo_html,
        store.get("store_name", "ร้านค้า"),
        total_items,
        date_str,
        table_blocks,
        footer_html
    )

    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
        f.write(html)
        html_path = f.name
    jpg_path = html_path.replace(".html", ".jpg")
    try:
        subprocess.run([
            "wkhtmltoimage",
            "--format", "jpg",
            "--quality", "94",
            "--width", "1200",
            "--disable-smart-width",
            "--no-stop-slow-scripts",
            "--load-error-handling", "ignore",
            html_path, jpg_path
        ], capture_output=True, timeout=30)
        if not os.path.exists(jpg_path):
            return b""
        with open(jpg_path, "rb") as f:
            return f.read()
    finally:
        for p in [html_path, jpg_path]:
            try: os.unlink(p)
            except: pass


def push_image_to_line(channel_token: str, line_user_id: str, img_url: str) -> dict:
    data = json.dumps({
        "to": line_user_id,
        "messages": [{"type": "image", "originalContentUrl": img_url, "previewImageUrl": img_url}]
    }).encode()
    req = urllib.request.Request(
        "https://api.line.me/v2/bot/message/push",
        data=data,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + channel_token}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return {"ok": True, "status": resp.status}
    except urllib.error.HTTPError as e:
        return {"ok": False, "reason": e.read().decode()}
    except Exception as e:
        return {"ok": False, "reason": str(e)}
