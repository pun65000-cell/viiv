/* VIIV PWA — facebook.js  Facebook Messenger (Browser Sandbox login flow) */
(function () {

  const FB_ICON = `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:#1877F2;border-radius:10px;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></span>`;

  let _status = null;
  let _destroyed = false;
  let _pendingCookies = null;

  Router.register('facebook', {
    title: 'Facebook Messenger',
    async load() {
      _destroyed = false;
      _status = null;
      _pendingCookies = null;
      const c = document.getElementById('page-container');
      c.innerHTML = _loadingHtml();
      try {
        _status = await App.api('/api/fbchat/status');
      } catch (e) {
        _status = null;
      }
      if (_destroyed) return;
      c.innerHTML = _html(_status);
      _bindEvents();
    },
    destroy() {
      _destroyed = true;
      _pendingCookies = null;
    }
  });

  /* ─────────────────────── HTML ─────────────────────── */

  function _loadingHtml() {
    return `<div style="text-align:center;padding:80px 16px;color:var(--muted)">
      <div style="width:28px;height:28px;border:3px solid var(--bdr);border-top-color:#1877F2;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px"></div>
      กำลังตรวจสอบสถานะ...
    </div>`;
  }

  function _html(s) {
    if (s && s.connected) return _connectedHtml(s);
    if (s === null)       return _errorHtml();
    return _disconnectedHtml();
  }

  function _disconnectedHtml() {
    return `<div style="max-width:560px;margin:0 auto;padding:8px 14px calc(var(--navbar-h,58px)+24px)">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-top:4px">
        ${FB_ICON}
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--txt)">Facebook Messenger</div>
          <div style="font-size:11px;color:var(--muted)">ยังไม่ได้เชื่อมบัญชี Facebook</div>
        </div>
      </div>

      <!-- Info -->
      <div class="fb-card" style="margin-bottom:16px">
        <div style="font-size:13.5px;color:var(--txt);line-height:1.65">
          เมื่อเชื่อมแล้ว <strong>AI จะตอบลูกค้าใน Messenger อัตโนมัติ</strong><br>
          รับออเดอร์ ตอบคำถาม และส่งรายการสินค้าได้ทันที
        </div>
      </div>

      <!-- Login card -->
      <div class="fb-card">
        <div style="font-size:13.5px;color:var(--txt);line-height:1.65;margin-bottom:14px">
          💡 <strong>คำแนะนำ</strong><br>
          เพื่อความปลอดภัย ระบบจะเปิดหน้าต่าง Facebook พิเศษ<br>
          Login แล้วหน้าต่างจะปิดอัตโนมัติ<br>
          <span style="color:var(--muted);font-size:12px">(ไม่กระทบ Facebook app ในมือถือของคุณ)</span>
        </div>

        <!-- inline error -->
        <div id="fb-mode-err" style="display:none;font-size:12px;color:#dc2626;margin-bottom:10px"></div>

        <button id="fb-continue-btn"
          style="width:100%;height:46px;background:#1877F2;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .15s">
          เริ่ม Login Facebook →
        </button>
      </div>

      <style>
        .fb-card{background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:14px}
        .fb-sec-title{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:12px}
      </style>
    </div>`;
  }

  function _connectedHtml(s) {
    const loginAt = s.last_login_at
      ? new Date(s.last_login_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const activeAt = s.last_active_at
      ? new Date(s.last_active_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
      : '—';

    return `<div style="max-width:560px;margin:0 auto;padding:8px 14px calc(var(--navbar-h,58px)+24px)">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-top:4px">
        ${FB_ICON}
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--txt)">Facebook Messenger</div>
          <div style="font-size:11px;color:#16a34a;font-weight:600">● เชื่อมต่อแล้ว</div>
        </div>
      </div>

      <!-- Account card -->
      <div class="fb-card">
        <div class="fb-sec-title">บัญชี Facebook</div>
        <div style="font-size:18px;font-weight:700;color:var(--txt);margin-bottom:4px">${_esc(s.fb_user_name || '—')}</div>
        <div style="font-size:12px;color:var(--muted)">FB ID: ${_esc(s.fb_user_id || '—')}</div>
      </div>

      <!-- Info rows -->
      <div class="fb-card">
        <div class="fb-sec-title">รายละเอียด</div>
        <div style="display:flex;flex-direction:column;gap:0">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bdr)">
            <span style="font-size:13px;color:var(--muted)">สถานะ</span>
            <span style="font-size:13px;font-weight:600;color:#16a34a">${_esc(s.status || 'active')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bdr)">
            <span style="font-size:13px;color:var(--muted)">เข้าสู่ระบบล่าสุด</span>
            <span style="font-size:13px">${loginAt}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0">
            <span style="font-size:13px;color:var(--muted)">ใช้งานล่าสุด</span>
            <span style="font-size:13px">${activeAt}</span>
          </div>
        </div>
      </div>

      <!-- Disconnect -->
      <div id="fb-disc-err" style="display:none;background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:10px 14px;font-size:12.5px;color:#991b1b;margin-bottom:12px"></div>
      <button id="fb-disconnect-btn" onclick="FbPage._disconnect()"
        style="width:100%;height:46px;background:var(--card);color:#dc2626;border:1.5px solid #fca5a5;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">
        ยกเลิกการเชื่อมต่อ
      </button>

      <style>
        .fb-card{background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:14px}
        .fb-sec-title{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:12px}
      </style>
    </div>`;
  }

  function _errorHtml() {
    return `<div style="max-width:560px;margin:0 auto;padding:8px 14px">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-top:4px">
        ${FB_ICON}
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--txt)">Facebook Messenger</div>
          <div style="font-size:11px;color:var(--muted)">ไม่สามารถโหลดสถานะได้</div>
        </div>
      </div>

      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="font-size:13.5px;color:#92400e;margin-bottom:12px">
          ⚠ ไม่สามารถตรวจสอบสถานะได้ ลองใหม่อีกครั้ง
        </div>
        <button onclick="FbPage._retryStatus()"
          style="height:40px;padding:0 20px;background:#1877F2;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
          ลองใหม่
        </button>
      </div>
    </div>`;
  }

  /* ─────────────────────── BIND ─────────────────────── */

  function _bindEvents() {
    const continueBtn = document.getElementById('fb-continue-btn');
    if (continueBtn) {
      continueBtn.addEventListener('click', function(e) {
        e.preventDefault();
        FbPage._stubStart();
      });
    }
  }

  /* ─────────────────────── Helpers ─────────────────────── */

  function _renderState(state) {
    const c = document.getElementById('page-container');
    if (!c) return;

    if (state === 'connecting') {
      c.innerHTML = `<div style="text-align:center;padding:80px 16px;color:var(--muted)">
        <div style="width:28px;height:28px;border:3px solid var(--bdr);border-top-color:#1877F2;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px"></div>
        กำลังเชื่อมต่อ...
      </div>`;
      return;
    }

    if (state === 'disconnected') {
      c.innerHTML = _disconnectedHtml();
      _bindEvents();
      return;
    }
  }

  function showInlineError(msg) {
    const el = document.getElementById('fb-mode-err');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function showError(msg) {
    App.toast('⚠ ' + msg);
  }

  /* ─────────────────────── Verify Screen ─────────────── */

  function _injectFbStyle() {
    if (document.getElementById('fb-page-style')) return;
    const style = document.createElement('style');
    style.id = 'fb-page-style';
    style.textContent = `
      .fb-warning{background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:12px;border-radius:8px;margin:12px 0;font-size:13px;line-height:1.5}
      .fb-account-preview{background:var(--bg2,#f8f9fa);border:1px solid var(--bdr);border-radius:8px;padding:16px;margin:16px 0}
      .fb-account-row{display:flex;justify-content:space-between;align-items:center;margin:8px 0}
      .fb-account-row .fb-alabel{font-size:13px;color:var(--muted)}
      .fb-account-row .fb-avalue{font-family:monospace;font-weight:700;font-size:13px;word-break:break-all}
      .fb-account-note{font-size:11.5px;color:var(--muted);margin-top:10px;text-align:center}
      .fb-verify-actions{display:flex;gap:12px;margin-top:20px}
      .fb-verify-actions button{flex:1;padding:14px 8px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;border:none}
      .fb-btn-cancel{background:var(--card);color:var(--txt);border:1.5px solid var(--bdr) !important}
      .fb-btn-confirm{background:#1877F2;color:#fff}
    `;
    document.head.appendChild(style);
  }

  function _renderVerifyScreen(cookies) {
    _injectFbStyle();
    const c = document.getElementById('page-container');
    if (!c) return;

    const fbId = escapeHtml(cookies.c_user);

    c.innerHTML = `<div style="max-width:560px;margin:0 auto;padding:8px 14px calc(var(--navbar-h,58px)+24px)">

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-top:4px">
        ${FB_ICON}
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--txt)">Facebook Messenger</div>
          <div style="font-size:11px;color:var(--muted)">ตรวจสอบบัญชีก่อนเชื่อม</div>
        </div>
      </div>

      <div class="fb-card">
        <div class="fb-sec-title">ยืนยันบัญชี Facebook</div>

        <div class="fb-warning">
          ⚠ กรุณาตรวจสอบให้แน่ใจว่าเป็นบัญชี Facebook ที่ต้องการเชื่อมกับร้านนี้
        </div>

        <div class="fb-account-preview">
          <div class="fb-account-row">
            <span class="fb-alabel">FB ID</span>
            <span class="fb-avalue">${fbId}</span>
          </div>
          <div class="fb-account-note">ระบบจะดึงชื่อบัญชีอัตโนมัติหลังเชื่อม</div>
        </div>

        <div class="fb-verify-actions">
          <button id="fb-verify-cancel" class="fb-btn-cancel">
            ❌ ไม่ใช่
          </button>
          <button id="fb-verify-confirm" class="fb-btn-confirm">
            ✅ ใช่ เชื่อมเลย
          </button>
        </div>
      </div>

      <style>
        .fb-card{background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:14px}
        .fb-sec-title{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:12px}
      </style>
    </div>`;

    document.getElementById('fb-verify-cancel')
      .addEventListener('click', _handleVerifyCancel);
    document.getElementById('fb-verify-confirm')
      .addEventListener('click', _handleVerifyConfirm);
  }

  async function _handleVerifyCancel() {
    _pendingCookies = null;
    _renderState('disconnected');
  }

  async function _handleVerifyConfirm() {
    if (!_pendingCookies) {
      showError('Session expired — กรุณาเริ่มใหม่');
      _renderState('disconnected');
      return;
    }

    const { xs, c_user, datr } = _pendingCookies;

    _renderState('connecting');

    try {
      await App.api('/api/fbchat/connect', {
        method: 'POST',
        body: { xs, c_user, datr }
      });

      _pendingCookies = null;
      await reloadStatus();

    } catch (err) {
      _pendingCookies = null;

      const msg = (err.message || '').toLowerCase();
      let userMsg = 'เชื่อมต่อไม่สำเร็จ';

      if (msg.includes('422') || msg.includes('invalid')) {
        userMsg = 'Cookies ใช้ไม่ได้ — อาจหมดอายุ กรุณาเชื่อมใหม่';
      } else if (msg.includes('403')) {
        userMsg = 'เฉพาะเจ้าของร้านเท่านั้นที่เชื่อมต่อได้';
      } else if (msg.includes('502') || msg.includes('mautrix')) {
        userMsg = 'ระบบ Facebook ขัดข้อง กรุณาลองใหม่อีก 1 นาที';
      } else if (err.message) {
        userMsg = 'เชื่อมต่อไม่สำเร็จ: ' + err.message;
      }

      showError(userMsg);
      _renderState('disconnected');
    }
  }

  async function reloadStatus() {
    let s;
    try {
      s = await App.api('/api/fbchat/status');
    } catch (e) {
      s = null;
    }
    if (_destroyed) return;
    const c = document.getElementById('page-container');
    if (c) {
      c.innerHTML = _html(s);
      _bindEvents();
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
      {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]
    ));
  }

  /* ─────────────────────── ACTIONS ──────────────────── */

  window.FbPage = {
    _stubStart() {
      App.toast('F.D.1: button wiring จะมาใน F.D.2');
    },

    _continue() { FbPage._stubStart(); },

    async _disconnect() {
      if (!confirm('ยืนยันยกเลิกการเชื่อมต่อ Facebook?')) return;
      const btn = document.getElementById('fb-disconnect-btn');
      const err = document.getElementById('fb-disc-err');
      if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
      if (err) err.style.display = 'none';
      try {
        await App.api('/api/fbchat/disconnect', { method: 'DELETE' });
        App.toast('✅ ยกเลิกการเชื่อมต่อแล้ว');
        if (!_destroyed) Router.go('facebook');
      } catch (e) {
        const msg = e.detail || e.message || 'ไม่ทราบสาเหตุ';
        if (err) { err.textContent = 'ยกเลิกไม่สำเร็จ: ' + msg; err.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      }
    },

    _retryStatus() {
      if (!_destroyed) Router.go('facebook');
    },

    _cancelVerify() {
      _pendingCookies = null;
      _renderState('disconnected');
    },
  };

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

})();
