/* VIIV PWA — comingsoon.js */
(function () {
    Router.register('comingsoon', {
      title: 'Coming Soon',
      load() {
        document.getElementById('page-container').innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:40px 20px;text-align:center">
            <div style="font-size:64px;margin-bottom:20px">🚀</div>
            <div style="font-size:20px;font-weight:700;color:var(--txt);margin-bottom:8px">Coming Soon</div>
            <div style="font-size:14px;color:var(--muted);max-width:280px;line-height:1.6;margin-bottom:24px">
              ฟีเจอร์นี้กำลังพัฒนาอยู่<br>จะเปิดให้ใช้งานเร็วๆ นี้ครับ
            </div>
            <button onclick="history.back()" style="padding:12px 28px;background:var(--accent,#e8b93e);border:none;border-radius:12px;font-size:14px;font-weight:700;color:#1a1200;cursor:pointer">
              ← กลับ
            </button>
          </div>`;
      },
      destroy() {}
    });
  })();
  