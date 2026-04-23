/* VIIV PWA — app.js
   Token management, pull-to-refresh, utilities
*/

const App = {
  token: null,
  tenantId: null,

  // ── TOKEN ──
  initToken() {
    // รับจาก parent (Superboard shell)
    window.addEventListener('message', e => {
      if (e.data?.type === 'viiv_token') {
        this.token = e.data.token;
        this.tenantId = e.data.tenant_id;
        document.dispatchEvent(new CustomEvent('viiv:token', { detail: e.data }));
      }
    });
    // fallback: localStorage
    const t = localStorage.getItem('viiv_token');
    if (t) { this.token = t; }
  },

  // ── API ──
  async api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: {
        'Authorization': 'Bearer ' + this.token,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },

  // ── FORMAT ──
  fmtB: n => '฿' + Number(n||0).toLocaleString('th-TH', { maximumFractionDigits: 0 }),
  fmtN: n => Number(n||0).toLocaleString('th-TH'),
  fmtDate: d => d ? new Date(d).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit' }) : '',
  fmtTime: d => d ? new Date(d).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) : '',

  // ── CLOCK ──
  initClock() {
    const el = document.getElementById('tb-clock');
    const tick = () => { if(el) el.textContent = new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}); };
    tick(); setInterval(tick, 1000);
  },

  // ── PULL TO REFRESH ──
  initPTR() {
    const container = document.getElementById('page-container');
    const ptr = document.getElementById('ptr');
    const spinner = document.getElementById('ptr-spinner');
    if (!container || !ptr) return;

    let startY = 0, pulling = false, threshold = 70;

    container.addEventListener('touchstart', e => {
      if (container.scrollTop === 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    container.addEventListener('touchmove', e => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        const pct = Math.min(dy / threshold, 1);
        ptr.classList.add('show');
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
        // trigger current page refresh
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

  // ── TOAST ──
  toast(msg, duration = 2500) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;bottom:calc(var(--navbar-h) + 16px);left:50%;transform:translateX(-50%);background:#231908ee;color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;z-index:300;transition:opacity .3s;white-space:nowrap;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, duration);
  },

  // ── INIT ──
  init() {
    this.initToken();
    this.initClock();
    this.initPTR();
    Router.init();
  }
};
