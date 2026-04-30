/* VIIV Auth — Single source of truth สำหรับ token ทั้งระบบ
 *
 * กฎเหล็ก (Rule 22-24):
 *   1. localStorage['viiv_token'] แก้ไขได้เฉพาะจากไฟล์นี้เท่านั้น
 *   2. ห้าม removeItem ยกเว้น Auth.logout() โดยตรง
 *   3. api() ไม่แตะ localStorage — ใช้ Auth.token เสมอ
 *   4. ทุกส่วนของระบบอ่าน/เขียน token ผ่าน Auth เท่านั้น
 */

const Auth = {
  _token: null,
  _key: 'viiv_token',

  // ── READ ──────────────────────────────────────────────────────────────────
  get token() { return this._token; },

  // ── WRITE (ผ่านที่นี่เท่านั้น) ────────────────────────────────────────────
  setToken(t) {
    if (!t) return;
    this._token = t;
    try { localStorage.setItem(this._key, t); } catch(e) {}
  },

  // ── INIT ──────────────────────────────────────────────────────────────────
  init() {
    // 1. URL param (bookmark / dev link)
    const urlToken = new URLSearchParams(location.search).get('token');
    if (urlToken) { this.setToken(urlToken); return; }

    // 2. Superboard parent postMessage
    window.addEventListener('message', e => {
      if (e.data?.type === 'viiv_token' && e.data.token) this.setToken(e.data.token);
    });

    // 3. localStorage (reload / tab restore)
    const stored = localStorage.getItem(this._key);
    if (stored) {
      try {
        const b = stored.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
        const pad = b + '=='.slice((b.length%4)||4);
        const p = JSON.parse(atob(pad));
        if (p.role || p.tenant_id) { this._token = stored; return; }
      } catch {}
    }

    // 4. ไม่มี token — ถ้าอยู่ top-level → redirect login
    //    ถ้าอยู่ใน iframe → ขอ token จาก parent
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'viiv_request_token' }, '*');
    } else {
      window.location.href = 'https://viiv.me/login.html';
    }
  },

  // ── 401 RECOVERY ─────────────────────────────────────────────────────────
  // 401 จริง = session หมดอายุ → clear + redirect login
  fallbackToken() {
    try { localStorage.removeItem(this._key); } catch(e) {}
    this._token = null;
    if (window.parent === window) {
      window.location.href = 'https://viiv.me/login.html';
    }
  },

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  logout() {
    if (!confirm('ออกจากระบบ?')) return;
    try { localStorage.removeItem(this._key); } catch(e) {}
    this._token = null;
    window.location.href = 'https://viiv.me/login.html';
  },
};
window.Auth = Auth;
