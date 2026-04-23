/* VIIV PWA — app.js */
const App = {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJ0ZW5fMSIsInVzZXJfaWQiOiJ1c3JfMSJ9.JfVeXPnQd1vE6rW4UbjilcWEKcAI_C9RVqorjoUJoZI',
  tenantId: 'ten_1',

  initToken() {
    // 1. รับ token จาก Superboard parent (primary)
    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'viiv_token') {
        this.token = e.data.token;
        this.tenantId = e.data.tenant_id;
        localStorage.setItem('viiv_token', e.data.token);
      }
    });
    // 2. fallback: localStorage (เปิดตรง URL หรือ reload)
    const t = localStorage.getItem('viiv_token');
    if (t) { this.token = t; }
    // 3. fallback สุดท้าย: DEV token (localhost หรือเปิด /pwa/ ตรงโดยไม่มี parent)
    if (!this.token) {
      this.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJ0ZW5fMSIsInVzZXJfaWQiOiJ1c3JfMSJ9.JfVeXPnQd1vE6rW4UbjilcWEKcAI_C9RVqorjoUJoZI';
    }
    // ตรวจสอบว่า localStorage มี token หรือไม่ — ถ้าไม่มีให้ store ไว้เพื่อให้ merchant dashboard ใช้ได้
    if (!localStorage.getItem('viiv_token')) {
      localStorage.setItem('viiv_token', this.token);
    }
    // 4. แจ้ง parent ขอ token (กรณี PWA โหลดก่อน Superboard ready)
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'viiv_request_token' }, '*');
    }
  },

  async api(path, opts) {
    opts = opts || {};
    const res = await fetch(path, Object.assign({}, opts, {
      headers: Object.assign({ 'Authorization': 'Bearer ' + this.token, 'Content-Type': 'application/json' }, opts.headers || {})
    }));
    if (res.status === 401) {
      // token หมดอายุหรือไม่ถูกต้อง — fallback dev token และ sync กลับ localStorage
      this.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJ0ZW5fMSIsInVzZXJfaWQiOiJ1c3JfMSJ9.JfVeXPnQd1vE6rW4UbjilcWEKcAI_C9RVqorjoUJoZI';
      localStorage.setItem('viiv_token', this.token);
      // retry ครั้งเดียว
      const r2 = await fetch(path, Object.assign({}, opts, {
        headers: Object.assign({ 'Authorization': 'Bearer ' + this.token, 'Content-Type': 'application/json' }, opts.headers || {})
      }));
      if (!r2.ok) throw new Error(r2.status + ' ' + r2.statusText);
      return r2.json();
    }
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    return res.json();
  },

  fmtB: function(n) { return '฿' + Number(n||0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); },
  fmtN: function(n) { return Number(n||0).toLocaleString('th-TH'); },
  fmtDate: function(d) { return d ? new Date(d).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit' }) : ''; },
  fmtTime: function(d) { return d ? new Date(d).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) : ''; },

  setTitle: function(t) {
    const el = document.getElementById('tb-title');
    if (el) { el.textContent = t; el.style.display = 'block'; }
    document.title = t;
  },

  initClock() {
    const el = document.getElementById('tb-clock');
    const tick = function() { if(el) el.textContent = new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}); };
    tick(); setInterval(tick, 1000);
  },

  initPTR() {
    const container = document.getElementById('page-container');
    const ptr = document.getElementById('ptr');
    const spinner = document.getElementById('ptr-spinner');
    if (!container || !ptr) return;
    let startY = 0, pulling = false, threshold = 70;
    container.addEventListener('touchstart', function(e) {
      if (container.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });
    container.addEventListener('touchmove', function(e) {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        const pct = Math.min(dy / threshold, 1);
        ptr.classList.add('show');
        spinner.style.transform = 'rotate(' + (pct * 360) + 'deg)';
        spinner.style.opacity = String(pct);
      }
    }, { passive: true });
    container.addEventListener('touchend', function(e) {
      if (!pulling) return;
      pulling = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy >= threshold) {
        spinner.classList.add('spin');
        spinner.style.opacity = '1';
        document.dispatchEvent(new CustomEvent('viiv:refresh'));
        setTimeout(function() {
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

  toast: function(msg, duration) {
    duration = duration || 2500;
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
    el._t = setTimeout(function() { el.style.opacity = '0'; }, duration);
  },

  init() {
    this.initToken();
    this.initClock();
    this.initPTR();
  }
};
