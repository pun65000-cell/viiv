/* VIIV PWA — more.js */
(function() {
  Router.register('more', {
    title: 'เพิ่มเติม',
    async load(params) {
      const c = document.getElementById('page-container');
      c.innerHTML = `<div style="max-width:768px;margin:0 auto;padding:14px 14px 80px">

        <div class="section-title">การขาย</div>
        ${_menuList([
          {icon:'🧾',label:'ออกบิล',sub:'สร้างบิลขายสินค้า',route:'billing'},
          {icon:'📋',label:'รายการออเดอร์',sub:'ดูและจัดการออเดอร์ทั้งหมด',route:'orders'},
        ])}

        <div class="section-title" style="margin-top:20px">สินค้าและลูกค้า</div>
        ${_menuList([
          {icon:'📦',label:'รายการสินค้า',sub:'ดูสต็อกและราคา',route:'products'},
          {icon:'👥',label:'รายชื่อลูกค้า',sub:'สมาชิกและยอดสะสม',route:'members'},
        ])}

        <div class="section-title" style="margin-top:20px">ข้อมูลทั่วไป</div>
        ${_menuList([
          {icon:'🏪',label:'ข้อมูลร้านค้า',sub:'ตั้งค่าร้านและโลโก้',ext:'https://concore.viiv.me/superboard/'},
          {icon:'💻',label:'Superboard Desktop',sub:'เปิดหน้า Desktop',ext:'https://concore.viiv.me/superboard/'},
        ])}

        <div style="text-align:center;color:var(--muted);font-size:var(--fs-xs);margin-top:28px">
          VIIV PWA v1.14
        </div>
      </div>`;
    },
    destroy() {}
  });

  function _menuList(items) {
    return items.map(m => {
      const onclick = m.route
        ? `Router.go('${m.route}')`
        : `window.open('${m.ext}','_blank')`;
      return `<div class="list-item" style="margin-bottom:8px" onclick="${onclick}">
        <div style="font-size:1.5rem;margin-right:12px;flex-shrink:0">${m.icon}</div>
        <div class="li-left">
          <div class="li-title">${m.label}</div>
          <div class="li-sub">${m.sub}</div>
        </div>
        <div style="color:var(--muted);font-size:1rem">›</div>
      </div>`;
    }).join('');
  }
})();
