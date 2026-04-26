/* VIIV PWA — app.js
 * Token ทั้งหมดดูแลโดย Auth (auth.js) — app.js ไม่แตะ localStorage โดยตรง
 */
const App = {
  get token() { return Auth.token; },
  tenantId: 'ten_1',

  initToken() {
    // Delegate ทั้งหมดให้ Auth.init() — Auth คือ single source of truth
    Auth.init();
    // sync tenantId ถ้า Superboard ส่งมา
    window.addEventListener('message', e => {
      if (e.data?.type === 'viiv_token' && e.data.tenant_id) {
        this.tenantId = e.data.tenant_id;
      }
    });
  },

  async api(path, opts) {
    opts = opts || {};
    const res = await fetch(path, Object.assign({}, opts, {
      headers: Object.assign({
        'Authorization': 'Bearer ' + Auth.token,
        'Content-Type': 'application/json'
      }, opts.headers || {})
    }));

    if (res.status === 401) {
      // *** ไม่แตะ localStorage เลย — Auth.fallbackToken() เปลี่ยนแค่ in-memory token ***
      Auth.fallbackToken();
      const r2 = await fetch(path, Object.assign({}, opts, {
        headers: Object.assign({
          'Authorization': 'Bearer ' + Auth.token,
          'Content-Type': 'application/json'
        }, opts.headers || {})
      }));
      if (!r2.ok) {
        let msg = r2.status + ' ' + r2.statusText;
        try { const d = await r2.json(); if (d && d.detail) msg = d.detail; } catch(_) {}
        throw new Error(msg);
      }
      return r2.json();
    }

    if (!res.ok) {
      let msg = res.status + ' ' + res.statusText;
      try { const d = await res.json(); if (d && d.detail) msg = d.detail; } catch(_) {}
      throw new Error(msg);
    }
    return res.json();
  },

  fmtB:    n => '฿' + Number(n||0).toLocaleString('th-TH', { maximumFractionDigits: 0 }),
  fmtN:    n => Number(n||0).toLocaleString('th-TH'),
  fmtDate: d => d ? new Date(d).toLocaleDateString('th-TH',  { day:'numeric', month:'short', year:'2-digit' }) : '',
  fmtTime: d => d ? new Date(d).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) : '',

  setTitle(t) {
    const el = document.getElementById('tb-title');
    if (el) { el.textContent = t; el.style.display = 'block'; }
    document.title = t;
  },

  initClock() {
    const el = document.getElementById('tb-clock');
    const tick = () => { if (el) el.textContent = new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }); };
    tick(); setInterval(tick, 1000);
  },

  initPTR() {
    const container = document.getElementById('page-container');
    const ptr       = document.getElementById('ptr');
    const spinner   = document.getElementById('ptr-spinner');
    if (!container || !ptr) return;
    let startY = 0, pulling = false;
    const threshold = 70;
    container.addEventListener('touchstart', e => {
      if (container.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });
    container.addEventListener('touchmove', e => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        ptr.classList.add('show');
        const pct = Math.min(dy / threshold, 1);
        spinner.style.transform = `rotate(${pct * 360}deg)`;
        spinner.style.opacity = String(pct);
      }
    }, { passive: true });
    container.addEventListener('touchend', e => {
      if (!pulling) return;
      pulling = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy >= threshold) {
        spinner.classList.add('spin');
        spinner.style.opacity = '1';
        document.dispatchEvent(new CustomEvent('viiv:refresh'));
        setTimeout(() => {
          ptr.classList.remove('show');
          spinner.classList.remove('spin');
          spinner.style.transform = '';
        }, 1000);
      } else {
        ptr.classList.remove('show');
        spinner.style.transform = '';
        spinner.style.opacity = '';
      }
    }, { passive: true });
  },

  toast(msg, duration = 2500) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#231908ee;color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;z-index:300;transition:opacity .3s;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, duration);
  },

  init() {
    this.initToken();
    this.initClock();
    this.initPTR();
  }
};
window.App = App;

// AI boost label — เลื่อนเข้าออกทุก 12 วินาที
(function(){
  function pulse(){
    const lbl = document.getElementById('tb-ai-label');
    if (!lbl) return;
    lbl.classList.add('show');
    setTimeout(()=>lbl.classList.remove('show'), 3000);
  }
  setTimeout(pulse, 2000);
  setInterval(pulse, 12000);
})();

// Bell notification
window.Bell = {
  _open: false,
  toggle() {
    this._open = !this._open;
    const dd = document.getElementById('tb-bell-dd');
    if (dd) dd.style.display = this._open ? 'block' : 'none';
    if (this._open) this.markAll();
  },
  markAll() {
    document.querySelectorAll('.bell-item.unread').forEach(el => {
      el.classList.remove('unread');
      const dot = el.querySelector('span');
      if (dot) dot.style.background = 'var(--bdr)';
    });
    const bellDot = document.getElementById('tb-bell-dot');
    if (bellDot) bellDot.style.display = 'none';
  },
  showDot() {
    const bellDot = document.getElementById('tb-bell-dot');
    if (bellDot) bellDot.style.display = 'block';
  }
};
// แสดง dot ถ้ามี unread
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.bell-item.unread')) Bell.showDot();
  // ปิด dropdown เมื่อคลิกนอก
  document.addEventListener('click', e => {
    if (!e.target.closest('#tb-bell') && !e.target.closest('#tb-bell-dd')) {
      const dd = document.getElementById('tb-bell-dd');
      if (dd) dd.style.display = 'none';
      Bell._open = false;
    }
  });
});
