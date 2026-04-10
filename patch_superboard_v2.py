#!/usr/bin/env python3
"""
VIIV Superboard Patch v2
- sb-sidebar collapsed width -10% (56px → 50px)
- icon +50%
- เพิ่มเมนู อัพเกรด
- footer VIIV v0.1.0 → logo icon สีทอง → link viiv.me
"""

import re, shutil, os

HTML_FILE = "/home/viivadmin/viiv/frontend/superboard/index.html"
CSS_FILE  = "/home/viivadmin/viiv/frontend/superboard/css/theme.css"

# ── backup ────────────────────────────────────────────────────────────────────
for f in [HTML_FILE, CSS_FILE]:
    if os.path.exists(f):
        shutil.copy(f, f + ".bak")
        print(f"📦 backup: {f}.bak")

# ══════════════════════════════════════════════════════════════════════════════
# 1. PATCH theme.css — sidebar collapsed width 56px → 50px, icon size
# ══════════════════════════════════════════════════════════════════════════════
if os.path.exists(CSS_FILE):
    with open(CSS_FILE, "r", encoding="utf-8") as f:
        css = f.read()

    original_css = css

    # --- 1a. sidebar collapsed width: 56px → 50px (-10.7% ≈ -10%) ---
    css = re.sub(r'(\.sb-sidebar\s*\{[^}]*?width\s*:\s*)56px', r'\g<1>50px', css)
    css = re.sub(r'(--sb-sidebar-w\s*:\s*)56px', r'\g<1>50px', css)

    # --- 1b. icon size ขึ้น 50% (ถ้า 18px → 27px, 20px → 30px, 16px → 24px) ---
    def scale_icon_px(m):
        val = int(m.group(2))
        return m.group(1) + str(round(val * 1.5)) + 'px'

    css = re.sub(
        r'(\.sb-nav-icon\s*\{[^}]*?font-size\s*:\s*)(\d+)px',
        scale_icon_px, css
    )
    css = re.sub(
        r'(\.sb-nav-icon\s*\{[^}]*?width\s*:\s*)(\d+)px',
        scale_icon_px, css
    )
    css = re.sub(
        r'(\.sb-nav-icon\s*\{[^}]*?height\s*:\s*)(\d+)px',
        scale_icon_px, css
    )

    # --- 1c. เพิ่ม override block ท้าย CSS (กัน case ที่ regex miss) ---
    CSS_OVERRIDE = """
/* ── Superboard Patch: sidebar width, icon size, footer logo ── */
.sb-sidebar { width: 50px !important; }
.sb-sidebar:hover { width: 220px !important; }

.sb-nav-icon {
  font-size: 1.35rem !important;
  min-width: 1.35rem !important;
  line-height: 1 !important;
}

/* Upgrade menu item */
.sb-nav-item.upgrade-item .sb-nav-icon,
.sb-nav-item.upgrade-item .sb-nav-label {
  color: var(--accent, #C9A84C) !important;
}
.sb-nav-item.upgrade-item {
  font-weight: 600;
}

/* Footer logo */
.sb-sidebar-footer {
  padding: 10px 0 14px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: transparent !important;
  border: none !important;
  font-size: 0 !important;        /* ซ่อน text เดิม */
  color: transparent !important;
}
.sb-sidebar-footer a.viiv-footer-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
.viiv-logo-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: var(--accent, #C9A84C);
  border: 1.5px solid var(--accent, #C9A84C);
  border-radius: 7px;
  transition: box-shadow .2s, transform .2s;
  flex-shrink: 0;
}
.viiv-logo-box:hover {
  box-shadow: 0 0 0 2.5px var(--accent, #C9A84C);
  transform: scale(1.08);
}
.viiv-logo-box svg { display: block; }
"""
    css += CSS_OVERRIDE

    with open(CSS_FILE, "w", encoding="utf-8") as f:
        f.write(css)

    changed = css != original_css
    print("✅ theme.css patched" if changed else "⚠️  theme.css — regex miss, override block เพิ่มแล้ว")

else:
    print("⚠️  ไม่พบ theme.css — ข้าม")

# ══════════════════════════════════════════════════════════════════════════════
# 2. PATCH index.html — เพิ่มเมนู + เปลี่ยน footer
# ══════════════════════════════════════════════════════════════════════════════
with open(HTML_FILE, "r", encoding="utf-8") as f:
    html = f.read()

# --- 2a. เพิ่มเมนู อัพเกรด ก่อน sb-sidebar-divider (Settings section) ---
UPGRADE_ITEM = """    <a class="sb-nav-item upgrade-item" data-page="upgrade" onclick="sbNav('upgrade')">
      <span class="sb-nav-icon">⬆</span><span class="sb-nav-label">อัพเกรด</span>
    </a>
    """

# insert ก่อน <div class="sb-sidebar-divider">
DIVIDER = '<div class="sb-sidebar-divider">'
if DIVIDER in html and 'upgrade-item' not in html:
    html = html.replace(DIVIDER, UPGRADE_ITEM + DIVIDER, 1)
    print("✅ เพิ่มเมนู อัพเกรด แล้ว")
else:
    print("⚠️  ไม่พบ divider หรือมี upgrade-item อยู่แล้ว")

# --- 2b. เปลี่ยน footer VIIV v0.1.0 → logo icon ---
LOGO_HTML = """<div class="sb-sidebar-footer">
      <a href="https://viiv.me" target="_blank" class="viiv-footer-logo" title="VIIV v0.1.0">
        <span class="viiv-logo-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 5 L12 18 L20 5" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 7 L20 7 L20 13" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11.5 12.5 L20 7" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </a>
    </div>"""

OLD_FOOTER_PATTERN = r'<div class="sb-sidebar-footer">VIIV v[\d.]+</div>'
if re.search(OLD_FOOTER_PATTERN, html):
    html = re.sub(OLD_FOOTER_PATTERN, LOGO_HTML, html)
    print("✅ Footer เปลี่ยนเป็น logo icon แล้ว")
else:
    print("⚠️  ไม่พบ footer text pattern")

# --- write ---
with open(HTML_FILE, "w", encoding="utf-8") as f:
    f.write(html)

print()
print("=" * 55)
print("✅ DONE:", HTML_FILE)
print()
print("👉 ขั้นตอนต่อไป:")
print("   1. reload caddy:  sudo systemctl reload caddy")
print("   2. hard refresh:  Ctrl+Shift+R ใน browser")
print("   3. หรือ Cloudflare → Caching → Purge Everything")
print("=" * 55)
