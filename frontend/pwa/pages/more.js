/* VIIV PWA — more.js (PC Superboard menus only) */
(function() {

  Router.register('more', {
    title: 'เมนูทั้งหมด',
    async load() {
      document.getElementById('page-container').innerHTML = _html();
    },
    destroy() {}
  });

  const PC = window.location.origin + '/superboard/pages/';

  const SECTIONS = [
    {
      icon: '⊡',
      label: 'โมดูล',
      items: [
        { icon: '🖥',  label: 'POS',              sub: 'จัดการขาย, ออกบิล, สต็อก',    pwa: 'pos'      },
        { icon: '🏪',  label: 'สโตร์',            sub: 'คลังสินค้า, ตัดสต็อก, พิมพ์ป้าย', pwa: 'store' },
        { icon: '🤝',  label: 'คู่ค้า',           sub: 'ซัพพลายเออร์, ตัวแทนจำหน่าย', pwa: 'partners' },
        { icon: '💬',  label: 'Chat & Showroom',  sub: 'LINE · Facebook · Instagram',  pwa: 'chat'     },
        { icon: '📲',  label: 'Auto Post',        sub: 'Scheduler · สร้าง Content',    pwa: 'autopost' },
      ]
    },
    {
      icon: '✦',
      label: 'เครื่องมือ',
      items: [
        { icon: '↗',  label: 'เทรนขายดี',       sub: 'สินค้าที่ตลาดต้องการตอนนี้',  url: PC + 'trends.html'  },
        { icon: '#',  label: 'แฮชแท็กมาแรง',    sub: 'Hashtag เพิ่ม Reach โพสต์',   url: PC + 'hashtag.html' },
        { icon: '✦',  label: 'AI ช่วยเหลือ',    sub: 'คำแนะนำอัจฉริยะจาก AI',       url: PC + 'ai.html'      },
        { icon: '⚡', label: 'เพิ่มยอดขาย',     sub: 'Boost ด้วย AI Strategy',       url: PC + 'boost.html'   },
      ]
    },
    {
      icon: '⚙',
      label: 'ตั้งค่า',
      items: [
        { icon: '🏪', label: 'ตั้งค่าร้านค้า',  sub: 'ข้อมูลร้าน, ที่อยู่, โลโก้',  url: PC + 'settings.html' },
        { icon: '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#06C755;border-radius:5px;font-size:7px;font-weight:800;color:#fff;font-family:Arial,sans-serif;letter-spacing:-0.3px">LINE</span>', label: 'LINE', sub: 'LINE OA, Token, Webhook, ใบเสนอราคา', pwa: 'line' },
        { icon: '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#1877F2;border-radius:5px;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></span>', label: 'Facebook',  sub: 'Facebook Page & Messenger', pwa: 'facebook' },
        { icon: '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#000000;border-radius:5px;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.15 8.15 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z"/></svg></span>', label: 'TikTok',    sub: 'TikTok Shop & Live',        pwa: 'comingsoon' },
        { icon: '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:5px;background:linear-gradient(45deg,#f09433,#dc2743,#bc1888);font-size:7px;font-weight:800;color:#fff;font-family:Arial,sans-serif;letter-spacing:-0.3px">IG</span>', label: 'Instagram', sub: 'Instagram Business', pwa: 'comingsoon' },
        { icon: '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#FF0000;border-radius:5px;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg></span>', label: 'YouTube',   sub: 'YouTube Channel & Live',    pwa: 'comingsoon' },
        { icon: '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#6366f1;border-radius:5px;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg></span>', label: 'API Keys',  sub: 'Developer Integration',     pwa: 'comingsoon' },
        { icon: '◎',  label: 'บุคลากร',         sub: 'จัดการพนักงานและสิทธิ์',      url: PC + 'staff.html'    },
        { icon: '⬆',  label: 'อัพเกรด',         sub: 'แพ็กเกจและฟีเจอร์เพิ่มเติม', url: PC + 'upgrade.html'  },
      ]
    },
    {
      icon: '👤',
      label: 'บัญชีของฉัน',
      items: [
        { icon: '⚙',  label: 'แก้ไขโปรไฟล์',     sub: 'ชื่อ, รูป, รหัสผ่าน',           action: 'profile' },
        { icon: '💻',  label: 'Superboard Desktop', sub: 'เปิดหน้า Desktop เต็มรูปแบบ',  url: window.location.origin + '/' },
        { icon: '⏻',  label: 'ออกจากระบบ',        sub: 'Sign out จากทุกอุปกรณ์',        action: 'logout', danger: true },
      ]
    }
  ];

  function _html() {
    return `<div style="max-width:768px;margin:0 auto;padding:4px 0 100px">

      ${SECTIONS.map(sec => `
        <div style="padding:0 14px">
          <div class="section-title" style="margin-top:16px;display:flex;align-items:center;gap:6px">
            <span>${sec.icon}</span> ${_esc(sec.label)}
          </div>
          <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;overflow:hidden">
            ${sec.items.map((item, idx) => `
              <div class="list-item" style="${idx < sec.items.length-1 ? 'border-bottom:1px solid var(--bdr);' : ''}border-radius:0;${item.danger ? 'color:var(--orange)' : ''}"
                   onclick="MoreMenu.go('${item.pwa||''}','${item.url||''}','${item.action||''}')">
                <div style="font-size:1.25rem;flex-shrink:0;width:28px;text-align:center">${typeof item.icon==='string'&&item.icon.startsWith('<')?item.icon:_esc(item.icon)}</div>
                <div class="li-left">
                  <div class="li-title" style="${item.danger ? 'color:var(--orange)' : ''}">${_esc(item.label)}</div>
                  <div class="li-sub">${_esc(item.sub)}</div>
                </div>
                <div style="color:var(--muted);font-size:1rem;flex-shrink:0">›</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}

      <div style="text-align:center;color:var(--muted);font-size:var(--fs-xs);margin-top:24px;padding-bottom:8px">
        VIIV Platform v1.16
      </div>
    </div>`;
  }

  window.MoreMenu = {
    go(pwa, url, action) {
      if (pwa) { Router.go(pwa); return; }
      if (action === 'profile') {
        if (typeof Profile !== 'undefined') Profile.openSheet();
        return;
      }
      if (action === 'logout') {
        Auth.logout();
        return;
      }
      if (url) window.open(url, '_blank');
    }
  };

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();
