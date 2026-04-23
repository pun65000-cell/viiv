/* VIIV PWA — more.js (PC Superboard menus only) */
(function() {

  Router.register('more', {
    title: 'เมนูทั้งหมด',
    async load() {
      document.getElementById('page-container').innerHTML = _html();
    },
    destroy() {}
  });

  const PC = 'https://concore.viiv.me/superboard/pages/';

  const SECTIONS = [
    {
      icon: '⊡',
      label: 'โมดูล',
      items: [
        { icon: '🖥',  label: 'POS',              sub: 'จัดการขาย, ออกบิล, สต็อก',    pwa: 'pos'      },
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
        { icon: '◎',  label: 'บุคลากร',         sub: 'จัดการพนักงานและสิทธิ์',      url: PC + 'staff.html'    },
        { icon: '⬆',  label: 'อัพเกรด',         sub: 'แพ็กเกจและฟีเจอร์เพิ่มเติม', url: PC + 'upgrade.html'  },
      ]
    },
    {
      icon: '👤',
      label: 'บัญชีของฉัน',
      items: [
        { icon: '⚙',  label: 'แก้ไขโปรไฟล์',     sub: 'ชื่อ, รูป, รหัสผ่าน',           action: 'profile' },
        { icon: '💻',  label: 'Superboard Desktop', sub: 'เปิดหน้า Desktop เต็มรูปแบบ',  url: 'https://concore.viiv.me/superboard/' },
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
                   onclick="MoreMenu.go(${JSON.stringify(item.pwa||'')},${JSON.stringify(item.url||'')},${JSON.stringify(item.action||'')})">
                <div style="font-size:1.25rem;flex-shrink:0;width:28px;text-align:center">${item.icon}</div>
                <div class="li-left">
                  <div class="li-title" style="${item.danger ? 'color:var(--orange)' : ''}">${_esc(item.label)}</div>
                  <div class="li-sub">${_esc(item.sub)}</div>
                </div>
                <div style="color:var(--muted);font-size:1rem;flex-shrink:0">›</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}

      <div style="text-align:center;color:var(--muted);font-size:var(--fs-xs);margin-top:24px;padding-bottom:8px">
        VIIV Platform v1.15
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
        if (typeof Profile !== 'undefined') Profile.logout();
        else if (confirm('ออกจากระบบ?')) {
          localStorage.removeItem('viiv_token');
          window.location.href = '/superboard/';
        }
        return;
      }
      if (url) window.open(url, '_blank');
    }
  };

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();
