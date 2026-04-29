/* VIIV PWA — app.js
 * Token ทั้งหมดดูแลโดย Auth (auth.js) — app.js ไม่แตะ localStorage โดยตรง
 */
const App = {
  get token() { return Auth.token; },
  tenantId: 'ten_1',

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

// Shop Switcher
window.ShopSwitcher = {
  _open: false,
  _shops: [],
  _activeId: null,

  toggle() {
    this._open = !this._open;
    document.getElementById('tb-shop-dd').classList.toggle('open', this._open);
    if (this._open) this._render();
  },

  close() {
    this._open = false;
    const dd = document.getElementById('tb-shop-dd');
    if (dd) dd.classList.remove('open');
  },

  async init() {
    try { this._shops = JSON.parse(localStorage.getItem('pwa_shops') || '[]'); } catch(_) { this._shops = []; }
    this._activeId = localStorage.getItem('pwa_active_shop') || null;
    try {
      const d = await App.api('/api/pos/store/settings');
      const id = d.tenant_id || 'ten_1';
      const name = d.store_name || 'My Shop';
      const logo = d.logo_url || null;
      const idx = this._shops.findIndex(s => s.id === id);
      if (idx < 0) this._shops.unshift({ id, name, logo });
      else { this._shops[idx].name = name; this._shops[idx].logo = logo; }
      if (!this._activeId) this._activeId = id;
      localStorage.setItem('pwa_shops', JSON.stringify(this._shops));
      localStorage.setItem('pwa_active_shop', this._activeId);
    } catch(_) {}
    this._updateBtn();
  },

  _updateBtn() {
    const s = this._shops.find(x => x.id === this._activeId) || this._shops[0];
    if (!s) return;
    document.getElementById('tb-shop-name').textContent = s.name;
    const av = document.getElementById('tb-shop-av');
    if (s.logo) av.innerHTML = '<img src="'+s.logo+'" style="width:100%;height:100%;object-fit:cover;">';
    else av.textContent = s.name.charAt(0).toUpperCase();
  },

  _render() {
    const list = document.getElementById('tb-shop-list');
    if (!list) return;
    if (!this._shops.length) {
      list.innerHTML = '<div style="padding:10px 14px;color:var(--muted);font-size:12px">ยังไม่มีร้าน</div>';
      return;
    }
    list.innerHTML = this._shops.map(s => {
      const active = s.id === this._activeId ? ' active' : '';
      const av = s.logo
        ? '<img src="'+s.logo+'" style="width:24px;height:24px;object-fit:cover;border-radius:5px;flex-shrink:0;">'
        : '<div class="tb-shop-item-av">'+s.name.charAt(0).toUpperCase()+'</div>';
      return '<div class="tb-shop-item'+active+'" onclick="ShopSwitcher.select(\''+s.id+'\')">'
        + av
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.name+'</div>'
        + '<div style="font-size:10px;color:var(--muted);font-family:monospace">'+s.id+'</div>'
        + '</div></div>';
    }).join('');
  },

  select(id) {
    this._activeId = id;
    localStorage.setItem('pwa_active_shop', id);
    this._updateBtn();
    this.close();
    window.location.reload();
  },

  showAdd() {
    document.getElementById('tb-shop-add-row').style.display = 'none';
    document.getElementById('tb-shop-add-form').classList.add('open');
    document.getElementById('tb-shop-id-in').focus();
  },

  addShop() {
    const input = document.getElementById('tb-shop-id-in');
    const id = input.value.trim();
    if (!id) { App.toast('กรุณาใส่ Shop ID'); return; }
    if (this._shops.find(s => s.id === id)) { App.toast('มีร้านนี้แล้ว'); return; }
    this._shops.push({ id, name: id, logo: null });
    localStorage.setItem('pwa_shops', JSON.stringify(this._shops));
    input.value = '';
    document.getElementById('tb-shop-add-form').classList.remove('open');
    document.getElementById('tb-shop-add-row').style.display = 'flex';
    this._render();
    App.toast('เพิ่มร้านแล้ว');
  }
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
    if (!e.target.closest('#tb-shop-wrap')) ShopSwitcher.close();
  });
});
