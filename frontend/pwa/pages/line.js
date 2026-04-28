/* VIIV PWA — line.js  LINE OA Settings (เชื่อมต่อ LINE) */
(function () {

  const LINE_ICON = `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#06C755;border-radius:5px;font-size:7.5px;font-weight:800;color:#fff;font-family:Arial,sans-serif;letter-spacing:-0.3px;flex-shrink:0">LINE</span>`;

  let _data = {};
  let _qrFile = null;
  let _destroyed = false;
  let _tid = '';

  Router.register('line', {
    title: 'เชื่อมต่อ LINE',
    async load() {
      _destroyed = false;
      _qrFile = null;
      const c = document.getElementById('page-container');
      c.innerHTML = '<div style="text-align:center;padding:60px 16px;color:var(--muted)">กำลังโหลด...</div>';
      try {
        _data = await App.api('/api/pos/line/settings');
        _tid = _data.tenant_id || App.tenantId || 'ten_1';
      } catch (e) {
        _data = {};
        _tid = App.tenantId || 'ten_1';
      }
      if (_destroyed) return;
      c.innerHTML = _html();
      _bindEvents();
    },
    destroy() { _destroyed = true; }
  });

  /* ─────────────────────── HTML ─────────────────────── */
  function _html() {
    const d = _data;
    const webhookUrl = `https://concore.viiv.me/api/line/webhook?tenant=${_tid}`;
    const oaId = d.oa_id || '';
    const token = d.channel_token || '';
    const secret = d.channel_secret || '';
    const notifyTarget = d.notify_target || '';
    const qrUrl = d.quote_qr_url || '';

    function tog(id, val) {
      return `<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer">
        <span style="font-size:13px;color:var(--txt)">${id}</span>
        <input type="checkbox" class="ln-toggle" data-key="${val}" ${d[val] !== false && d[val] ? 'checked' : ''} style="display:none">
        <span class="ln-sw" data-key="${val}" onclick="LinePage._togSwitch(this)" style="width:42px;height:24px;border-radius:12px;background:${d[val] !== false && d[val] ? '#06C755' : 'var(--bdr)'};display:flex;align-items:center;padding:2px;cursor:pointer;transition:background .2s;flex-shrink:0">
          <span style="width:20px;height:20px;border-radius:50%;background:#fff;transform:translateX(${d[val] !== false && d[val] ? '18px' : '0px'});transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.25)"></span>
        </span>
      </label>`;
    }

    return `<div style="max-width:640px;margin:0 auto;padding:8px 14px calc(var(--navbar-h,58px)+24px)">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-top:4px">
        ${LINE_ICON}
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--txt)">เชื่อมต่อ LINE OA</div>
          <div style="font-size:11px;color:var(--muted)">ตั้งค่าการเชื่อมต่อ LINE Official Account</div>
        </div>
      </div>

      <!-- Credentials -->
      <div class="ln-card">
        <div class="ln-sec-title">🔑 ข้อมูลการเชื่อมต่อ</div>
        <div class="pm-field" style="margin-bottom:10px">
          <label>LINE OA ID (@handle)</label>
          <input id="ln-oa-id" value="${_esc(oaId)}" placeholder="@youroa" autocomplete="off">
        </div>
        <div class="pm-field" style="margin-bottom:10px">
          <label>Channel Access Token</label>
          <textarea id="ln-token" rows="2" placeholder="Channel Access Token จาก LINE Developers"
            style="width:100%;box-sizing:border-box;resize:none;background:var(--bg);border:1.5px solid var(--bdr);border-radius:9px;padding:10px 12px;color:var(--txt);font-size:13px;font-family:inherit;outline:none">${_esc(token)}</textarea>
        </div>
        <div class="pm-field" style="margin-bottom:14px">
          <label>Channel Secret</label>
          <input id="ln-secret" type="password" value="${_esc(secret)}" placeholder="Channel Secret" autocomplete="off">
        </div>
        <button onclick="LinePage._saveCredentials()" class="btn-gold" style="width:100%;height:42px">บันทึกการเชื่อมต่อ</button>
      </div>

      <!-- Webhook URL -->
      <div class="ln-card">
        <div class="ln-sec-title">🔗 Webhook URL</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:8px">นำ URL นี้ไปตั้งค่าที่ LINE Developers Console</div>
        <div style="display:flex;gap:8px;align-items:center">
          <div id="ln-webhook-url" style="flex:1;background:var(--bg2);border:1.5px solid var(--bdr);border-radius:9px;padding:9px 12px;font-size:11px;color:var(--txt);word-break:break-all;font-family:monospace">${_esc(webhookUrl)}</div>
          <button onclick="LinePage._copyWebhook()" style="height:38px;padding:0 14px;border-radius:9px;border:1.5px solid var(--bdr);background:var(--card);color:var(--txt);font-size:12px;cursor:pointer;flex-shrink:0">คัดลอก</button>
        </div>
      </div>

      <!-- Features -->
      <div class="ln-card">
        <div class="ln-sec-title">⚡ ฟีเจอร์</div>
        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:14px">
          ${tog('ส่งใบเสร็จ/บิลทาง LINE', 'feature_bill')}
          ${tog('ส่งใบเสนอราคาทาง LINE', 'feature_quote')}
          ${tog('แสดงปุ่ม Chat ใน Catalog', 'feature_chat')}
          ${tog('แจ้งเตือนออเดอร์ใหม่', 'feature_order')}
        </div>
        <div class="pm-field" style="margin-bottom:10px">
          <label>ป้ายกำกับปุ่ม Chat</label>
          <input id="ln-chat-label" value="${_esc(d.chat_label || 'Chat')}" placeholder="Chat" maxlength="10">
        </div>
        <div class="pm-field" style="margin-bottom:14px">
          <label>การกระทำเมื่อกดปุ่ม Chat</label>
          <select id="ln-chat-action" style="height:40px;padding:0 12px;border:1.5px solid var(--bdr);border-radius:9px;font-size:14px;background:var(--bg);color:var(--txt);width:100%">
            <option value="add" ${(d.chat_action||'add')==='add'?'selected':''}>เพิ่มเพื่อน (Add Friend)</option>
            <option value="chat" ${d.chat_action==='chat'?'selected':''}>เปิด Chat (Chat Direct)</option>
          </select>
        </div>
        <button onclick="LinePage._saveFeatures()" class="btn-gold" style="width:100%;height:42px">บันทึกฟีเจอร์</button>
      </div>

      <!-- Notify -->
      <div class="ln-card">
        <div class="ln-sec-title">🔔 การแจ้งเตือน</div>
        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:14px">
          ${tog('แจ้งเตือนเมื่อมีออเดอร์ใหม่', 'notify_on_order')}
          ${tog('แจ้งเตือนเมื่อมีบิลใหม่', 'notify_on_bill')}
        </div>
        <div class="pm-field" style="margin-bottom:8px">
          <label>LINE UID ผู้รับแจ้งเตือน</label>
          <div style="display:flex;gap:8px">
            <input id="ln-notify-target" value="${_esc(notifyTarget)}" placeholder="U... (LINE User ID)" style="flex:1">
            <button onclick="LinePage._fetchPendingUid()" style="height:40px;padding:0 12px;border-radius:9px;border:1.5px solid var(--bdr);background:var(--card);color:var(--txt);font-size:12px;cursor:pointer;flex-shrink:0;white-space:nowrap">ดึงล่าสุด</button>
          </div>
        </div>
        <div id="ln-uid-hint" style="font-size:11px;color:var(--muted);margin-bottom:14px">ให้ผู้รับ Follow LINE OA ก่อน แล้วกด "ดึงล่าสุด"</div>
        <button onclick="LinePage._saveFeatures()" class="btn-gold" style="width:100%;height:42px">บันทึกการแจ้งเตือน</button>
      </div>

      <!-- Quote Config -->
      <div class="ln-card">
        <div class="ln-sec-title">📄 ใบเสนอราคา</div>
        <div style="margin-bottom:12px">
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px">QR Code สำหรับชำระเงิน (แสดงในใบเสนอราคา)</div>
          <div style="display:flex;align-items:center;gap:12px">
            <div id="ln-qr-preview" style="width:72px;height:72px;border-radius:10px;overflow:hidden;background:var(--bg2);border:1.5px solid var(--bdr);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">
              ${qrUrl ? `<img src="${_esc(qrUrl)}" style="width:100%;height:100%;object-fit:cover">` : '📷'}
            </div>
            <label style="display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:9px;border:1.5px solid var(--bdr);font-size:13px;color:var(--muted);cursor:pointer;background:var(--bg)">
              เลือกรูป QR<input type="file" accept="image/*" style="display:none" onchange="LinePage._pickQR(this)">
            </label>
          </div>
        </div>
        <div class="pm-field" style="margin-bottom:10px">
          <label>ช่องทางติดต่อ</label>
          <input id="ln-quote-contact" value="${_esc(d.quote_contact || '')}" placeholder="LINE: @youroa หรือ 0812345678">
        </div>
        <div class="pm-field" style="margin-bottom:14px">
          <label>หมายเหตุใบเสนอราคา</label>
          <textarea id="ln-quote-note" rows="3"
            style="width:100%;box-sizing:border-box;resize:none;background:var(--bg);border:1.5px solid var(--bdr);border-radius:9px;padding:10px 12px;color:var(--txt);font-size:13px;font-family:inherit;outline:none">${_esc(d.quote_note || 'ใบเสนอราคานี้มีผล 7 วัน ขอสงวนสิทธิ์ในการเปลี่ยนแปลงทุกกรณี')}</textarea>
        </div>
        <button onclick="LinePage._saveQuote()" class="btn-gold" style="width:100%;height:42px">บันทึกใบเสนอราคา</button>
      </div>

      <style>
        .ln-card{background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:14px}
        .ln-sec-title{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;margin-bottom:14px;text-transform:uppercase}
        .pm-field label{display:block;font-size:11px;color:var(--muted);margin-bottom:4px}
        .pm-field input,.pm-field select{width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid var(--bdr);border-radius:9px;font-size:14px;background:var(--bg);color:var(--txt);outline:none;font-family:inherit}
        .btn-gold{border:none;background:linear-gradient(135deg,#e8b93e,#c4902a);color:#fff;font-size:14px;font-weight:700;border-radius:12px;cursor:pointer;box-shadow:0 2px 8px rgba(196,144,42,.3)}
      </style>
    </div>`;
  }

  /* ─────────────────────── BIND ─────────────────────── */
  function _bindEvents() {}

  /* ─────────────────────── ACTIONS ──────────────────── */
  window.LinePage = {
    _togSwitch(el) {
      const key = el.dataset.key;
      const on = el.children[0].style.transform === 'translateX(0px)';
      el.style.background = on ? '#06C755' : 'var(--bdr)';
      el.children[0].style.transform = on ? 'translateX(18px)' : 'translateX(0px)';
      _data[key] = on;
      const cb = document.querySelector(`.ln-toggle[data-key="${key}"]`);
      if (cb) cb.checked = on;
    },

    async _saveCredentials() {
      const oa_id = (document.getElementById('ln-oa-id')?.value || '').trim();
      const channel_token = (document.getElementById('ln-token')?.value || '').trim();
      const channel_secret = (document.getElementById('ln-secret')?.value || '').trim();
      if (!oa_id || !channel_token || !channel_secret) {
        App.toast('❌ กรุณากรอก OA ID, Token และ Secret ให้ครบ'); return;
      }
      try {
        await App.api('/api/pos/line/credentials', { method: 'POST', body: JSON.stringify({ oa_id, channel_token, channel_secret }) });
        _data.oa_id = oa_id; _data.channel_token = channel_token; _data.channel_secret = channel_secret;
        App.toast('✅ บันทึกการเชื่อมต่อสำเร็จ');
      } catch (e) { App.toast('❌ ' + e.message); }
    },

    async _saveFeatures() {
      const payload = {
        feature_bill:    _data.feature_bill    !== false && !!_data.feature_bill,
        feature_quote:   _data.feature_quote   !== false && !!_data.feature_quote,
        feature_chat:    _data.feature_chat    !== false && !!_data.feature_chat,
        feature_order:   !!_data.feature_order,
        notify_on_order: _data.notify_on_order !== false && !!_data.notify_on_order,
        notify_on_bill:  !!_data.notify_on_bill,
        chat_label:   (document.getElementById('ln-chat-label')?.value  || 'Chat').slice(0, 10),
        chat_action:  document.getElementById('ln-chat-action')?.value  || 'add',
        notify_target: document.getElementById('ln-notify-target')?.value?.trim() || '',
      };
      try {
        await App.api('/api/pos/line/features', { method: 'POST', body: JSON.stringify(payload) });
        Object.assign(_data, payload);
        App.toast('✅ บันทึกสำเร็จ');
      } catch (e) { App.toast('❌ ' + e.message); }
    },

    async _saveQuote() {
      try {
        if (_qrFile) {
          const fd = new FormData(); fd.append('file', _qrFile);
          const r = await fetch('/api/pos/line/upload-quote-qr', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + App.token },
            body: fd
          });
          const j = await r.json();
          if (j.url) _data.quote_qr_url = j.url;
          _qrFile = null;
        }
        const payload = {
          quote_qr_url:  _data.quote_qr_url || '',
          quote_contact: (document.getElementById('ln-quote-contact')?.value || '').trim(),
          quote_note:    (document.getElementById('ln-quote-note')?.value    || '').trim(),
        };
        await App.api('/api/pos/line/quote-config', { method: 'POST', body: JSON.stringify(payload) });
        Object.assign(_data, payload);
        App.toast('✅ บันทึกใบเสนอราคาสำเร็จ');
      } catch (e) { App.toast('❌ ' + e.message); }
    },

    async _fetchPendingUid() {
      const hint = document.getElementById('ln-uid-hint');
      if (hint) hint.textContent = 'กำลังดึง...';
      try {
        const d = await App.api(`/api/line/pending-uid?tenant=${_tid}`);
        if (d.found && d.line_user_id) {
          const inp = document.getElementById('ln-notify-target');
          if (inp) inp.value = d.line_user_id;
          if (hint) hint.textContent = `พบ: ${d.line_user_id}${d.display_name ? ' (' + d.display_name + ')' : ''}`;
        } else {
          if (hint) hint.textContent = 'ไม่พบ UID ใหม่ — ให้ผู้รับ Follow LINE OA ก่อน';
        }
      } catch (e) {
        if (hint) hint.textContent = 'ดึงไม่สำเร็จ: ' + e.message;
      }
    },

    _pickQR(input) {
      const f = input.files[0]; if (!f) return;
      _qrFile = f;
      const url = URL.createObjectURL(f);
      const preview = document.getElementById('ln-qr-preview');
      if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
    },

    _copyWebhook() {
      const url = document.getElementById('ln-webhook-url')?.textContent || '';
      navigator.clipboard?.writeText(url).then(() => App.toast('📋 คัดลอกแล้ว')).catch(() => App.toast('❌ คัดลอกไม่สำเร็จ'));
    }
  };

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

})();
