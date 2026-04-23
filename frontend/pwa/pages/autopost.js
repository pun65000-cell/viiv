/* VIIV PWA — autopost.js */
(function() {
  Router.register('autopost', {
    title: 'AutoPost',
    async load(params) {
      const c = document.getElementById('page-container');
      c.innerHTML = `<div class="sb-wrap" style="text-align:center;padding-top:48px">
        <div style="font-size:3rem;margin-bottom:16px">↗</div>
        <div style="font-family:'Chakra Petch',sans-serif;font-size:var(--fs-lg);font-weight:700;color:var(--txt);margin-bottom:8px">AutoPost Module</div>
        <div style="color:var(--muted);font-size:var(--fs-sm);margin-bottom:32px">โพสต์อัตโนมัติทุกช่องทาง</div>
        <div class="sb-coming-soon">
          <div class="cs-icon">🔧</div>
          <div class="cs-title">กำลังพัฒนา</div>
          <div class="cs-sub">AutoPost module พร้อมใช้งานเร็วๆ นี้<br>รองรับ LINE · Facebook · Instagram · X</div>
        </div>
        <div style="margin-top:28px;display:flex;flex-direction:column;gap:10px">
          ${[
            {icon:'📅', label:'Scheduler', sub:'ตั้งเวลาโพสต์ล่วงหน้า'},
            {icon:'🤖', label:'AI Content', sub:'สร้างข้อความด้วย AI'},
            {icon:'📊', label:'Analytics', sub:'ยอด Reach · Engagement'},
            {icon:'🔗', label:'Multi-Platform', sub:'โพสต์ทุกช่องทางพร้อมกัน'},
          ].map(f=>`<div class="list-item" style="opacity:.55">
            <div style="font-size:1.4rem;margin-right:10px">${f.icon}</div>
            <div class="li-left">
              <div class="li-title">${f.label}</div>
              <div class="li-sub">${f.sub}</div>
            </div>
            <span class="tag tag-yellow">เร็วๆ นี้</span>
          </div>`).join('')}
        </div>
      </div>`;
    },
    destroy() {}
  });
})();
