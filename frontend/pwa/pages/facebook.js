(function () {
  'use strict';

  let _destroyed = false;
  let _status = null;

  Router.register('facebook', {
    title: 'Facebook',
    async load() {
      _destroyed = false;
      const c = document.getElementById('page-container');
      c.innerHTML = _loadingHtml();

      try {
        _status = await App.api('/api/fbchat/status');
      } catch (e) {
        _status = { connected: false };
      }

      if (_destroyed) return;
      c.innerHTML = _html(_status);
      _bindEvents();
    },
    destroy() {
      _destroyed = true;
    },
  });

  /* ── Templates ─────────────────────────────────────────── */

  function _loadingHtml() {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:14px">
        <div style="width:32px;height:32px;border:3px solid #e5e7eb;border-top-color:#1877F2;border-radius:50%;animation:spin .8s linear infinite"></div>
        <div style="font-size:13px;color:var(--muted)">กำลังโหลด...</div>
      </div>`;
  }

  function _html(s) {
    if (s && s.connected) return _connectedHtml(s);
    return _disconnectedHtml();
  }

  function _disconnectedHtml() {
    return `
      <div style="padding:16px 16px 32px">

        <!-- Header -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#1877F2;border-radius:12px;flex-shrink:0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </span>
          <div>
            <div style="font-size:16px;font-weight:700">Facebook Messenger</div>
            <div style="font-size:12px;color:var(--muted)">ยังไม่ได้เชื่อมต่อ</div>
          </div>
        </div>

        <!-- Status badge -->
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:20px;font-size:12.5px;color:#92400e">
          ⚠ ยังไม่ได้เชื่อมต่อ Facebook — วาง cookies เพื่อเริ่มรับข้อความ
        </div>

        <!-- How-to note -->
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:14px;margin-bottom:20px;font-size:12px;color:var(--muted);line-height:1.7">
          <strong style="color:var(--text)">วิธีรับ Cookies:</strong><br>
          1. เปิด facebook.com บน PC ด้วย Chrome/Firefox<br>
          2. เปิด DevTools → Application → Cookies → facebook.com<br>
          3. คัดลอกค่า <code>xs</code>, <code>c_user</code>, <code>datr</code>
        </div>

        <!-- Cookie form -->
        <form id="fb-connect-form" autocomplete="off" onsubmit="return false">
          <input type="text" name="fake_fb" style="display:none" tabindex="-1" aria-hidden="true">
          <input type="password" name="fake_fb2" style="display:none" tabindex="-1" aria-hidden="true">

          ${_cookieField('xs', 'xs', 'Session token (xs cookie)')}
          ${_cookieField('c_user', 'c_user', 'User ID (c_user cookie)')}
          ${_cookieField('datr', 'datr', 'Browser ID (datr cookie)')}

          <!-- Error -->
          <div id="fb-error" style="display:none;background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:#991b1b"></div>

          <button id="fb-submit-btn" type="button" onclick="_fbConnect()"
            style="width:100%;background:#1877F2;color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .15s">
            เชื่อมต่อ Facebook
          </button>
        </form>
      </div>`;
  }

  function _cookieField(id, name, placeholder) {
    return `
      <div style="margin-bottom:14px">
        <label style="font-size:12px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">${name}</label>
        <div style="position:relative">
          <input id="fb-inp-${id}" type="password" autocomplete="new-password" autocorrect="off"
            autocapitalize="off" spellcheck="false"
            placeholder="${placeholder}"
            style="width:100%;box-sizing:border-box;padding:12px 44px 12px 14px;border:1.5px solid var(--bdr);border-radius:10px;font-size:13px;background:var(--card);color:var(--text)">
          <button type="button" onclick="_fbToggle('${id}')"
            style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:var(--muted);padding:4px">
            👁
          </button>
        </div>
      </div>`;
  }

  function _connectedHtml(s) {
    const loginAt = s.last_login_at ? new Date(s.last_login_at).toLocaleString('th-TH') : '—';
    const activeAt = s.last_active_at ? new Date(s.last_active_at).toLocaleString('th-TH') : '—';
    return `
      <div style="padding:16px 16px 32px">

        <!-- Header -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#1877F2;border-radius:12px;flex-shrink:0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </span>
          <div>
            <div style="font-size:16px;font-weight:700">Facebook Messenger</div>
            <div style="font-size:12px;color:#16a34a">● เชื่อมต่อแล้ว</div>
          </div>
        </div>

        <!-- Account card -->
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:16px">
          <div style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">บัญชี Facebook</div>
          <div style="font-size:17px;font-weight:700;margin-bottom:4px">${_esc(s.fb_user_name || '—')}</div>
          <div style="font-size:12px;color:var(--muted)">ID: ${_esc(s.fb_user_id || '—')}</div>
        </div>

        <!-- Info rows -->
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:14px;margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bdr)">
            <span style="font-size:12.5px;color:var(--muted)">สถานะ</span>
            <span style="font-size:12.5px;font-weight:600;color:#16a34a">${_esc(s.status || 'active')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bdr)">
            <span style="font-size:12.5px;color:var(--muted)">เข้าสู่ระบบล่าสุด</span>
            <span style="font-size:12.5px">${loginAt}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0">
            <span style="font-size:12.5px;color:var(--muted)">ใช้งานล่าสุด</span>
            <span style="font-size:12.5px">${activeAt}</span>
          </div>
        </div>

        <!-- Error -->
        <div id="fb-error" style="display:none;background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:#991b1b"></div>

        <!-- Disconnect -->
        <button id="fb-disconnect-btn" type="button" onclick="_fbDisconnect()"
          style="width:100%;background:#fff;color:#dc2626;border:1.5px solid #fca5a5;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">
          ยกเลิกการเชื่อมต่อ
        </button>
      </div>`;
  }

  /* ── Helpers ────────────────────────────────────────────── */

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _showError(msg) {
    const el = document.getElementById('fb-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function _hideError() {
    const el = document.getElementById('fb-error');
    if (el) el.style.display = 'none';
  }

  function _setLoading(btnId, on) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = on;
    btn.style.opacity = on ? '0.6' : '1';
  }

  function _errorMsg(status, detail) {
    if (status === 401) return 'Token หมดอายุ — กรุณาเข้าสู่ระบบใหม่';
    if (status === 403) return 'ไม่มีสิทธิ์ — ต้องการสิทธิ์ admin เพื่อเชื่อมต่อ';
    if (status === 422) return detail || 'Cookies ไม่ถูกต้องหรือหมดอายุ — กรุณาคัดลอกใหม่';
    if (status === 502) return 'ไม่สามารถเชื่อมต่อ mautrix bridge ได้ — กรุณาลองใหม่';
    if (status === 404) return 'ไม่พบ tenant ในระบบ';
    return detail || `เกิดข้อผิดพลาด (HTTP ${status})`;
  }

  /* ── Event binding ──────────────────────────────────────── */

  function _bindEvents() {
    // expose to inline onclick attributes
    window._fbConnect    = _doConnect;
    window._fbDisconnect = _doDisconnect;
    window._fbToggle     = _toggleVisibility;
  }

  function _toggleVisibility(id) {
    const inp = document.getElementById('fb-inp-' + id);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  async function _doConnect() {
    _hideError();

    const xs     = (document.getElementById('fb-inp-xs')     || {}).value || '';
    const c_user = (document.getElementById('fb-inp-c_user') || {}).value || '';
    const datr   = (document.getElementById('fb-inp-datr')   || {}).value || '';

    if (!xs.trim() || !c_user.trim() || !datr.trim()) {
      _showError('กรุณากรอก xs, c_user และ datr ให้ครบ');
      return;
    }

    _setLoading('fb-submit-btn', true);
    try {
      const res = await App.api('/api/fbchat/connect', {
        method: 'POST',
        body: JSON.stringify({ xs: xs.trim(), c_user: c_user.trim(), datr: datr.trim() }),
      });
      App.toast('✅ เชื่อมต่อ Facebook สำเร็จ: ' + (res.fb_user_name || res.fb_user_id));
      // Reload page to connected state
      if (!_destroyed) {
        _status = null;
        Router.go('facebook');
      }
    } catch (e) {
      const status = e.status || 0;
      const detail = e.detail || e.message || '';
      _showError(_errorMsg(status, detail));
      _setLoading('fb-submit-btn', false);
    }
  }

  async function _doDisconnect() {
    _hideError();
    if (!confirm('ยืนยันยกเลิกการเชื่อมต่อ Facebook?')) return;

    _setLoading('fb-disconnect-btn', true);
    try {
      await App.api('/api/fbchat/disconnect', { method: 'DELETE' });
      App.toast('✅ ยกเลิกการเชื่อมต่อแล้ว');
      if (!_destroyed) Router.go('facebook');
    } catch (e) {
      const status = e.status || 0;
      const detail = e.detail || e.message || '';
      _showError(_errorMsg(status, detail));
      _setLoading('fb-disconnect-btn', false);
    }
  }

})();
