/* VIIV Auth — Single source of truth สำหรับ token ทั้งระบบ
 *
 * กฎเหล็ก (Rule 22-24):
 *   1. localStorage['viiv_token'] แก้ไขได้เฉพาะจากไฟล์นี้เท่านั้น
 *   2. ห้าม removeItem ยกเว้น Auth.logout() โดยตรง
 *   3. api() ไม่แตะ localStorage — ใช้ Auth.token เสมอ
 *   4. ทุกส่วนของระบบอ่าน/เขียน token ผ่าน Auth เท่านั้น
 */

const DEV_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMSIsInRlbmFudF9pZCI6InRlbl8xIiwicm9sZSI6Im93bmVyIiwibmFtZSI6IkFkbWluIiwiYWRtaW4iOnRydWV9.K0OzKuZqWAr5fdZ7gPruRiEebNK6gFqB_fRi3nPQGkw';

const Auth = {
  _token: DEV_TOKEN,
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

    // 3. localStorage (reload / tab restore) — ถ้า token เก่าไม่มี role ให้ upgrade
    const stored = localStorage.getItem(this._key);
    if (stored) {
      try {
        const b = stored.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
        const pad = b + '=='.slice((b.length%4)||4);
        const p = JSON.parse(atob(pad));
        if (p.role) { this._token = stored; return; }
        // token เก่าไม่มี role → upgrade เป็น DEV_TOKEN
      } catch {}
      // ถ้า decode ไม่ได้ หรือไม่มี role → ใช้ DEV_TOKEN แทน
    }

    // 4. dev token fallback — เขียน localStorage เพื่อให้ merchant dashboard ใช้ได้
    this.setToken(DEV_TOKEN);

    // 5. แจ้ง Superboard parent ขอ token ถ้าอยู่ใน iframe
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'viiv_request_token' }, '*');
    }
  },

  // ── 401 RECOVERY ─────────────────────────────────────────────────────────
  // เรียกเมื่อ API ได้ 401 — fallback dev token, ไม่แตะ localStorage
  // (localStorage อาจมี real token ของ merchant dashboard อยู่)
  fallbackToken() {
    this._token = DEV_TOKEN;
    // *** ไม่ setToken() ที่นี่ — ไม่แตะ localStorage ***
    // ถ้า dev token ก็ยังไม่ผ่าน → redirect login (production ใส่ที่นี่)
  },

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  // เรียกได้จาก UI เท่านั้น — จุดเดียวที่ลบ localStorage ได้
  logout() {
    if (!confirm('ออกจากระบบ?')) return;
    try { localStorage.removeItem(this._key); } catch(e) {}
    this._token = DEV_TOKEN;
    window.location.href = '/superboard/login.html';
  },
};
window.Auth = Auth;
