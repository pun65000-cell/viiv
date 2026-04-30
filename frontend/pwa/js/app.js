/* VIIV PWA — app.js
 * Token ทั้งหมดดูแลโดย Auth (auth.js) — app.js ไม่แตะ localStorage โดยตรง
 */
const App = {
  get token() { return Auth.token; },
  get tenantId() {
    try {
      const b = (Auth.token||'').split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      return JSON.parse(atob(b + '=='.slice((b.length%4)||4))).tenant_id || '';
    } catch { return ''; }
  },

  _parseJwt(t) {
    try {
      const b = t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      return JSON.parse(atob(b));
    } catch { return {}; }
  },
  get user() {
    const p = this._parseJwt(Auth.token);
    return { id: p.sub || p.user_id || 'unknown', role: p.role || null, name: p.name || p.email || '' };
  },

  initToken() {
    // Delegate ทั้งหมดให้ Auth.init() — Auth คือ single source of truth
    Auth.init();
    // tenant_id อ่านจาก JWT ผ่าน getter — ไม่ต้อง sync แยก
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
    let startY = 0, pulling = false, triggered = false;
    const threshold = 55;   // lower threshold — easier to trigger on mobile

    container.addEventListener('touchstart', e => {
      triggered = false;
      if (container.scrollTop <= 0) {
        startY  = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    container.addEventListener('touchmove', e => {
      if (!pulling || triggered) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        ptr.classList.add('show');
        const pct = Math.min(dy / threshold, 1);
        spinner.style.transform = `rotate(${pct * 360}deg)`;
        spinner.style.opacity   = String(pct);
      } else {
        pulling = false;
        ptr.classList.remove('show');
      }
    }, { passive: true });

    container.addEventListener('touchend', e => {
      if (!pulling || triggered) return;
      pulling = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy >= threshold) {
        triggered = true;
        // show full spin then reload the page (true refresh — new JS + new data)
        spinner.classList.add('spin');
        spinner.style.opacity = '1';
        ptr.classList.add('show');
        setTimeout(() => { window.location.reload(); }, 600);
      } else {
        ptr.classList.remove('show');
        spinner.style.transform = '';
        spinner.style.opacity   = '';
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

// Shop Switcher — dropdown + add popup
window.ShopSwitcher = {
  _open: false,
  _shops: [],
  _curTid: null,

  async init() {
    // ชื่อ/avatar topbar จาก store settings (active shop)
    try {
      const d = await App.api('/api/pos/store/settings');
      this._updateBtn(d.store_name || 'My Shop', d.logo_url || null);
    } catch(_) {}
    // tenant_id ปัจจุบันจาก JWT
    try {
      const t = (Auth && Auth.token) || localStorage.getItem('viiv_token') || '';
      const b = t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const p = JSON.parse(atob(b + '=='.slice((b.length%4)||4)));
      this._curTid = p.tenant_id || null;
    } catch(_) {}
  },

  _updateBtn(name, logo) {
    const nameEl = document.getElementById('tb-shop-name');
    const av = document.getElementById('tb-shop-av');
    if (nameEl) nameEl.textContent = name;
    if (av) {
      if (logo) av.innerHTML = '<img src="'+logo+'" style="width:100%;height:100%;object-fit:cover;">';
      else av.textContent = (name||'S').charAt(0).toUpperCase();
    }
  },

  async toggle() {
    this._open = !this._open;
    document.getElementById('tb-shop-dd').classList.toggle('open', this._open);
    if (this._open) await this._render();
  },

  close() {
    this._open = false;
    const dd = document.getElementById('tb-shop-dd');
    if (dd) dd.classList.remove('open');
  },

  async _render() {
    const list = document.getElementById('tb-shop-list');
    if (!list) return;
    list.innerHTML = '<div style="padding:10px 14px;color:var(--muted);font-size:12px">กำลังโหลด...</div>';
    try {
      this._shops = await App.api('/api/platform/my-shops');
    } catch(e) {
      list.innerHTML = '<div style="padding:10px 14px;color:var(--muted);font-size:12px">โหลดไม่สำเร็จ</div>';
      return;
    }
    if (!this._shops.length) {
      list.innerHTML = '<div style="padding:10px 14px;color:var(--muted);font-size:12px">ยังไม่มีร้าน</div>';
      return;
    }
    list.innerHTML = this._shops.map(s => {
      const active = s.id === this._curTid ? ' active' : '';
      const initial = (s.store_name || s.subdomain || '?').charAt(0).toUpperCase();
      const av = '<div class="tb-shop-item-av">'+initial+'</div>';
      return '<div class="tb-shop-item'+active+'" onclick="ShopSwitcher.select(\''+(s.subdomain||'')+'\')">'
        + av
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(s.store_name||s.subdomain||'Shop')+'</div>'
        + '<div style="font-size:10px;color:var(--muted);font-family:monospace">'+(s.subdomain||'')+'.viiv.me</div>'
        + '</div></div>';
    }).join('');
  },

  async select(subdomain) {
    if (!subdomain) return;
    try {
      const data = await App.api('/api/platform/join-shop', {
        method:'POST', body: JSON.stringify({ subdomain })
      });
      if (data && data.access_token) {
        window.location.href = 'https://' + data.subdomain + '.viiv.me/pwa/?token=' + encodeURIComponent(data.access_token);
      } else {
        App.toast('สลับร้านไม่สำเร็จ');
      }
    } catch(e) { App.toast(e.message || 'สลับร้านไม่สำเร็จ'); }
  },

  showAdd() {
    document.getElementById('shop-add-input').value = '';
    document.getElementById('shop-add-err').textContent = '';
    document.getElementById('shop-add-mask').classList.add('open');
    setTimeout(() => document.getElementById('shop-add-input').focus(), 50);
  },

  closeAdd(e) {
    // ปิดเฉพาะเมื่อกดที่ backdrop
    if (e && e.target && e.target.id === 'shop-add-mask') {
      this.closeAddForce();
    }
  },

  closeAddForce() {
    document.getElementById('shop-add-mask').classList.remove('open');
  },

  async saveAdd() {
    const sd = (document.getElementById('shop-add-input').value || '').trim().toLowerCase();
    const err = document.getElementById('shop-add-err');
    err.textContent = '';
    if (!sd) { err.textContent = 'กรุณาใส่ Shop ID'; return; }
    const btn = document.getElementById('shop-add-save');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    try {
      const data = await App.api('/api/platform/join-shop', {
        method:'POST', body: JSON.stringify({ subdomain: sd })
      });
      if (data && data.access_token) {
        window.location.href = 'https://' + data.subdomain + '.viiv.me/pwa/?token=' + encodeURIComponent(data.access_token);
      } else {
        err.textContent = 'ตอบกลับจาก server ผิดรูปแบบ';
      }
    } catch(e) {
      err.textContent = e.message || 'เกิดข้อผิดพลาด';
    } finally {
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  },
};

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
  ShopSwitcher.init();
  document.addEventListener('click', e => {
    if (!e.target.closest('#tb-bell') && !e.target.closest('#tb-bell-dd')) {
      const dd = document.getElementById('tb-bell-dd');
      if (dd) dd.style.display = 'none';
      Bell._open = false;
    }
    // ปิด shop dropdown เมื่อคลิกนอก wrap — ยกเว้น popup เพิ่มสาขาเปิดอยู่
    const popupOpen = document.getElementById('shop-add-mask')?.classList.contains('open');
    if (!popupOpen && !e.target.closest('#tb-shop-wrap')) ShopSwitcher.close();
  });
});
