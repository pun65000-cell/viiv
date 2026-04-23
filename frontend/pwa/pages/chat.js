/* VIIV PWA — chat.js */
(function() {
  Router.register('chat', {
    title: 'Chat',
    async load(params) {
      const c = document.getElementById('page-container');
      c.innerHTML = `<div class="sb-wrap" style="text-align:center;padding-top:48px">
        <div style="font-size:3rem;margin-bottom:16px">◌</div>
        <div style="font-family:'Chakra Petch',sans-serif;font-size:var(--fs-lg);font-weight:700;color:var(--txt);margin-bottom:8px">Chat Module</div>
        <div style="color:var(--muted);font-size:var(--fs-sm);margin-bottom:32px">LINE · Facebook · Instagram</div>
        <div class="sb-coming-soon">
          <div class="cs-icon">🔧</div>
          <div class="cs-title">กำลังพัฒนา</div>
          <div class="cs-sub">Chat module พร้อมใช้งานเร็วๆ นี้<br>รองรับ LINE OA · FB Messenger · IG DM</div>
        </div>
        <div style="margin-top:28px;display:flex;flex-direction:column;gap:10px">
          ${[
            {icon:'📊', label:'Dashboard Chat', sub:'ยอดแชท วันนี้ / เดือน'},
            {icon:'💬', label:'Live Feed', sub:'แชทเรียลไทม์ทุกช่องทาง'},
            {icon:'🤖', label:'AI Auto Reply', sub:'ตอบอัตโนมัติด้วย AI'},
            {icon:'📦', label:'Mini POS in Chat', sub:'ออกบิลจากหน้าแชท'},
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
