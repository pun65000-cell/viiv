/* VIIV PWA — topup.js (Part 3D + Phase C bank bottom sheet)
 * Multipart top-up form: pick tier → pick bank → upload slip → submit
 *  POST /api/tenant/credits/topup (multipart) — pending status
 */
(function(){
  'use strict';
  let _destroyed = false;
  let _tiers = [], _banks = [];
  let _selectedTier = null, _selectedBank = null;
  let _slipFile = null;

  Router.register('topup', {
    title: '💰 เติมเครดิต',
    async load(){
      _destroyed = false;
      _tiers = []; _banks = [];
      _selectedTier = null; _selectedBank = null;
      _slipFile = null;
      await _render();

      // Bank sheet close handlers
      const sheet = document.getElementById('tuPwaBankSheet');
      const closeBtn = document.getElementById('tuPwaBankSheetClose');
      if (closeBtn) closeBtn.addEventListener('click', _closeBankSheet);
      if (sheet) sheet.addEventListener('click', (e) => { if (e.target === sheet) _closeBankSheet(); });
      document.addEventListener('keydown', _tuPwaEscHandler);
    },
    destroy(){
      _destroyed = true;
      document.removeEventListener('keydown', _tuPwaEscHandler);
      document.body.style.overflow = '';
    }
  });

  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtNum(n){ return Number(n||0).toLocaleString('en-US'); }
  function fmtBaht(n){ return '฿' + fmtNum(n); }

  function toast(msg, kind){
    if(typeof window.toast === 'function'){ window.toast(msg, kind); return; }
    let el = document.getElementById('tuToastP');
    if(!el){
      el = document.createElement('div');
      el.id = 'tuToastP';
      el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;z-index:2000;box-shadow:0 8px 22px rgba(0,0,0,.3);opacity:0;transition:opacity .25s;pointer-events:none;max-width:90vw;text-align:center';
      document.body.appendChild(el);
    }
    el.style.background = kind === 'error' ? '#991b1b' : (kind === 'ok' ? '#166534' : '#111');
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.style.opacity = '0', 2500);
  }

  function bankDisplay(b){
    const map = {
      'kbank':'🏦 กสิกรไทย', 'bbl':'🏦 กรุงเทพ', 'ktb':'🏦 กรุงไทย',
      'scb':'🏦 ไทยพาณิชย์', 'bay':'🏦 กรุงศรี', 'ttb':'🏦 ทหารไทยธนชาต',
      'gsb':'🏦 ออมสิน', 'isbt':'🏦 อิสลาม', 'baac':'🏦 ธ.ก.ส.',
      'promptpay':'💸 PromptPay'
    };
    return map[b.bank_code] || ('🏦 ' + esc(b.bank_name || b.bank_code));
  }

  async function _render(){
    const c = document.getElementById('page-container');
    if(!c) return;
    c.innerHTML = ''
      + '<div style="max-width:560px;margin:0 auto;padding:14px 14px 80px">'
      +   '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'
      +     '<button onclick="Router.go(\'credits\')" style="background:transparent;border:1px solid var(--bdr);border-radius:8px;padding:6px 12px;font-size:13px;color:#444;cursor:pointer">← กลับ</button>'
      +     '<div style="font-size:13px;color:var(--muted)">เลือกแพ็กเกจ → บัญชี → สลิป</div>'
      +   '</div>'
      +   '<div id="tuTierWrap"><div style="padding:18px;text-align:center;color:#888;font-size:13px">กำลังโหลด tier...</div></div>'
      +   '<div id="tuBankWrap" style="margin-top:14px"><div style="padding:18px;text-align:center;color:#888;font-size:13px">กำลังโหลดบัญชี...</div></div>'
      +   _slipBoxHtml()
      +   '<div id="tuSummaryWrap"></div>'
      +   _actionsHtml()
      +   _bankSheetHtml()
      + '</div>';

    const results = await Promise.allSettled([
      App.api('/api/tenant/credits/topup-packages'),
      App.api('/api/tenant/credits/payment-info'),
    ]);
    if(_destroyed) return;
    if(results[0].status === 'fulfilled'){
      _tiers = (results[0].value.packages || []).slice().sort((a,b) => (a.sort_order||0) - (b.sort_order||0));
    } else {
      document.getElementById('tuTierWrap').innerHTML = _emptyHtml('โหลด tier ไม่สำเร็จ');
    }
    if(results[1].status === 'fulfilled'){
      _banks = results[1].value.accounts || [];
      if(_banks.length){
        _selectedBank = _banks.find(b => b.is_default) || _banks[0];
      }
    } else {
      document.getElementById('tuBankWrap').innerHTML = _emptyHtml('โหลดบัญชีไม่สำเร็จ');
    }
    _renderTiers();
    _renderBanks();
    _refreshSubmit();
  }

  function _emptyHtml(msg){
    return '<div style="padding:18px;text-align:center;color:#999;font-size:13px;font-style:italic;background:var(--card);border:1px dashed var(--bdr);border-radius:10px">'+esc(msg)+'</div>';
  }

  function _slipBoxHtml(){
    return ''
      + '<div style="margin-top:14px">'
      +   '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px;display:flex;align-items:center;gap:8px">'
      +     '<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--gold);color:#1a1200;font-weight:800;font-size:11.5px;align-items:center;justify-content:center">3</span>'
      +     'อัปโหลดสลิป'
      +   '</div>'
      +   '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:14px">'
      +     '<input id="tuSlipFile" type="file" accept="image/*" onchange="window.tuSlipPwaPreview(event)" '
      +       'style="display:block;width:100%;padding:8px 11px;border:1px solid var(--bdr);border-radius:7px;font-size:13px;background:var(--bg2);cursor:pointer"/>'
      +     '<img id="tuSlipPwaPrev" style="width:140px;max-height:200px;display:none;margin:10px 0 0;border:1px dashed var(--bdr);border-radius:8px;background:var(--bg2);padding:6px;object-fit:contain"/>'
      +     '<div style="font-size:11px;color:var(--muted);margin-top:6px">รูปสลิป (jpg/png/webp ≤ 5MB) — ระบบจะตรวจและเปลี่ยนเป็นเครดิตให้ภายใน 1 ชั่วโมง</div>'
      +   '</div>'
      + '</div>';
  }

  function _actionsHtml(){
    return ''
      + '<div style="display:flex;gap:8px;margin-top:16px">'
      +   '<button onclick="Router.go(\'credits\')" style="flex:1;padding:11px;border-radius:8px;background:transparent;border:1px solid var(--bdr);color:#666;font-size:13px;cursor:pointer">ยกเลิก</button>'
      +   '<button id="tuSubmitBtn" onclick="window.tuPwaDoSubmit()" disabled style="flex:2;padding:11px;border-radius:8px;background:var(--gold);border:1px solid #c9a84c;color:#1a1200;font-size:14px;font-weight:700;cursor:pointer;opacity:.5">ส่งคำขอเติมเครดิต</button>'
      + '</div>';
  }

  // ─── Bank Detail Bottom Sheet HTML ───────────────────────────────────────

  function _tuPwaPaymentLogosHtml(){
    const items = [
      {
        label: 'Visa',
        svg: `<svg viewBox="0 0 80 26" xmlns="http://www.w3.org/2000/svg">
          <text x="40" y="20" font-family="Arial Black,sans-serif"
                font-size="22" font-weight="900" fill="#1a1f71"
                text-anchor="middle" letter-spacing="-1">VISA</text>
        </svg>`
      },
      {
        label: 'Mastercard',
        svg: `<svg viewBox="0 0 50 30" xmlns="http://www.w3.org/2000/svg">
          <circle cx="19" cy="15" r="11" fill="#eb001b"/>
          <circle cx="31" cy="15" r="11" fill="#f79e1b"/>
          <path d="M25,7 a11,11 0 0,1 0,16 a11,11 0 0,1 0,-16" fill="#ff5f00"/>
        </svg>`
      },
      {
        label: 'JCB',
        svg: `<svg viewBox="0 0 60 26" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="18" height="22" rx="3" fill="#0e4c96"/>
          <rect x="22" y="2" width="18" height="22" rx="3" fill="#bc2434"/>
          <rect x="42" y="2" width="16" height="22" rx="3" fill="#2e8b3e"/>
          <text x="11" y="17" font-family="Arial Black,sans-serif"
                font-size="10" font-weight="900" fill="#fff" text-anchor="middle">J</text>
          <text x="31" y="17" font-family="Arial Black,sans-serif"
                font-size="10" font-weight="900" fill="#fff" text-anchor="middle">C</text>
          <text x="50" y="17" font-family="Arial Black,sans-serif"
                font-size="10" font-weight="900" fill="#fff" text-anchor="middle">B</text>
        </svg>`
      },
      {
        label: 'PromptPay',
        svg: `<svg viewBox="0 0 80 26" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="4" width="22" height="20" rx="3" fill="#003d6e"/>
          <text x="13" y="18" font-family="Arial Black,sans-serif"
                font-size="11" font-weight="900" fill="#fff" text-anchor="middle">P</text>
          <text x="55" y="18" font-family="Arial,sans-serif"
                font-size="10" font-weight="700" fill="#003d6e" text-anchor="middle">PromptPay</text>
        </svg>`
      },
      {
        label: 'TrueMoney',
        svg: `<svg viewBox="0 0 80 26" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="4" width="22" height="20" rx="4" fill="#ff6900"/>
          <text x="13" y="18" font-family="Arial Black,sans-serif"
                font-size="11" font-weight="900" fill="#fff" text-anchor="middle">T</text>
          <text x="52" y="18" font-family="Arial,sans-serif"
                font-size="9" font-weight="700" fill="#ff6900" text-anchor="middle">TrueMoney</text>
        </svg>`
      },
      {
        label: 'ShopeePay',
        svg: `<svg viewBox="0 0 80 26" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="4" width="22" height="20" rx="4" fill="#ee4d2d"/>
          <path d="M8,10 L18,10 L18,12 L10,12 L10,14 L17,14 L17,16 L10,16 L10,20 L8,20 Z"
                fill="#fff"/>
          <text x="52" y="18" font-family="Arial,sans-serif"
                font-size="9" font-weight="700" fill="#ee4d2d" text-anchor="middle">ShopeePay</text>
        </svg>`
      }
    ];

    return items.map(it => `
      <div title="${it.label} - เร็วๆ นี้" style="
        position:relative;background:#fff;border:1px solid #e5e7eb;
        border-radius:10px;padding:12px 6px;
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:4px;
        opacity:.45;filter:grayscale(50%);
        min-height:64px;cursor:not-allowed;
      ">
        <span style="
          position:absolute;top:-6px;right:-4px;
          background:#fef3c7;color:#92400e;
          font-size:9px;font-weight:600;padding:2px 6px;
          border-radius:8px;border:1px solid #fde68a;
          white-space:nowrap;
        ">เร็วๆ นี้</span>
        <div style="
          width:100%;height:24px;display:flex;
          align-items:center;justify-content:center;
        ">${it.svg}</div>
        <span style="
          font-size:10px;color:#94a3b8;font-weight:500;white-space:nowrap;
        ">${it.label}</span>
      </div>
    `).join('');
  }

  function _bankSheetHtml(){
    return `<div id="tuPwaBankSheet" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:500;align-items:flex-end;justify-content:center;padding-bottom:0;">
  <div id="tuPwaBankSheetBox" style="background:#fff;width:100%;max-width:768px;max-height:92dvh;border-radius:20px 20px 0 0;overflow-y:auto;padding:8px 20px calc(24px + var(--safe-bot,0px));transform:translateY(100%);transition:transform .28s cubic-bezier(.16,1,.3,1);box-shadow:0 -10px 40px rgba(0,0,0,.2);position:relative;">
    <div style="display:flex;justify-content:center;padding:8px 0 4px;">
      <div style="width:40px;height:4px;background:#cbd5e1;border-radius:2px;"></div>
    </div>
    <button type="button" id="tuPwaBankSheetClose" aria-label="ปิด" style="position:absolute;top:14px;right:14px;width:36px;height:36px;border:none;border-radius:50%;background:#f3f4f6;color:#6b7280;font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
    <div style="text-align:center;margin:8px 0 20px;">
      <div style="font-size:32px;margin-bottom:8px;">🏦</div>
      <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 6px;letter-spacing:-.01em;">รายละเอียดบัญชี</h2>
      <p style="font-size:13px;color:#64748b;margin:0;">โอนเงินเข้าบัญชีนี้แล้วอัปโหลดสลิป</p>
    </div>
    <div id="tuPwaBankSheetContent"></div>
    <div style="padding-top:4px;margin-bottom:20px;">
      <button type="button" id="tuPwaBankSheetSelectBtn" style="width:100%;padding:14px;background:#0f172a;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:.01em;">เลือกบัญชีนี้สำหรับโอนเงิน</button>
    </div>
    <div style="margin-top:4px;padding-top:20px;border-top:1px dashed #d1d5db;">
      <div style="text-align:center;font-size:13px;color:#94a3b8;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
        <span style="flex:1;height:1px;background:#e5e7eb;"></span>
        <span>หรือชำระผ่าน</span>
        <span style="flex:1;height:1px;background:#e5e7eb;"></span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">${_tuPwaPaymentLogosHtml()}</div>
    </div>
  </div>
</div>`;
  }

  // ─── Sheet open / close / render ─────────────────────────────────────────

  function _renderBankSheet(bankId){
    const b = _banks.find(x => x.id === bankId);
    if (!b) return;

    const isSelected = _selectedBank && _selectedBank.id === bankId;
    const content = document.getElementById('tuPwaBankSheetContent');
    const btn = document.getElementById('tuPwaBankSheetSelectBtn');
    if (!content || !btn) return;

    const origin = window.location.origin;

    const branchRow = b.branch ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #eef2f7;gap:12px;">
        <span style="font-size:14px;color:#64748b;">สาขา</span>
        <span style="font-size:15px;font-weight:600;color:#0f172a;">${esc(b.branch)}</span>
      </div>
    ` : '';

    const qrSection = b.qr_url ? `
      <div style="text-align:center;margin-top:18px;padding-top:18px;border-top:1px solid #e5e7eb;">
        <img src="${origin}${esc(b.qr_url)}" alt="QR ${esc(b.bank_name||b.bank_code)}" style="width:280px;max-width:80vw;aspect-ratio:1;object-fit:contain;border:2px solid #fff;border-radius:12px;background:#fff;padding:10px;box-shadow:0 4px 16px rgba(0,0,0,.08);">
        <div style="font-size:13px;color:#64748b;margin-top:10px;">สแกนผ่านแอปธนาคารเพื่อโอนเงิน</div>
      </div>
    ` : '';

    const defBadge = b.is_default
      ? ' <span style="font-size:10px;color:#92400e;background:#fef3c7;padding:1px 7px;border-radius:6px;margin-left:6px;">⭐ หลัก</span>'
      : '';

    content.innerHTML = `
      <div style="background:linear-gradient(180deg,#fafbfc 0%,#fff 60%);border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:16px;">
        <div style="font-size:17px;font-weight:700;color:#0f172a;margin-bottom:14px;display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
          ${bankDisplay(b)}${defBadge}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #eef2f7;gap:12px;">
          <div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:2px;">เลขบัญชี</div>
            <div id="tuPwaBankSheetAcct" style="font-size:18px;font-weight:700;color:#0f172a;font-family:var(--font-mono,monospace);letter-spacing:.05em;">${esc(b.account_no)}</div>
          </div>
          <button id="tuPwaBankSheetCopyBtn" data-acct="${esc(b.account_no)}" type="button" style="padding:7px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;flex-shrink:0;">คัดลอก</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #eef2f7;gap:12px;">
          <span style="font-size:14px;color:#64748b;">ชื่อบัญชี</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${esc(b.account_name)}</span>
        </div>
        ${branchRow}
        ${qrSection}
      </div>
    `;

    // Select button state
    if (isSelected) {
      btn.style.background = '#10b981';
      btn.textContent = '✓ เลือกแล้ว';
    } else {
      btn.style.background = '#0f172a';
      btn.textContent = 'เลือกบัญชีนี้สำหรับโอนเงิน';
    }

    btn.onclick = () => {
      window.tuPwaPickBank(bankId);
      _closeBankSheet();
      toast('✓ เลือกบัญชีแล้ว');
    };

    // Copy button
    const copyBtn = document.getElementById('tuPwaBankSheetCopyBtn');
    if (copyBtn) {
      copyBtn.onclick = async function(){
        const acct = this.dataset.acct;
        try {
          await navigator.clipboard.writeText(acct);
          this.textContent = '✓ คัดลอกแล้ว';
          this.style.background = '#d1fae5';
          this.style.borderColor = '#10b981';
          this.style.color = '#065f46';
          setTimeout(() => {
            this.textContent = 'คัดลอก';
            this.style.background = '#fff';
            this.style.borderColor = '#d1d5db';
            this.style.color = '#374151';
          }, 1500);
        } catch(_){
          const el = document.getElementById('tuPwaBankSheetAcct');
          if (el) {
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      };
    }
  }

  function _tuPwaEscHandler(e){
    if (e.key === 'Escape') {
      const sheet = document.getElementById('tuPwaBankSheet');
      if (sheet && sheet.style.display === 'flex') _closeBankSheet();
    }
  }

  function _openBankSheet(bankId){
    _renderBankSheet(bankId);
    const sheet = document.getElementById('tuPwaBankSheet');
    const box = document.getElementById('tuPwaBankSheetBox');
    if (!sheet || !box) return;
    sheet.style.display = 'flex';
    void sheet.offsetWidth; // force reflow
    requestAnimationFrame(() => { box.style.transform = 'translateY(0)'; });
    document.body.style.overflow = 'hidden';
  }

  function _closeBankSheet(){
    const sheet = document.getElementById('tuPwaBankSheet');
    const box = document.getElementById('tuPwaBankSheetBox');
    if (!sheet || !box) return;
    box.style.transform = 'translateY(100%)';
    setTimeout(() => {
      if (_destroyed) return;
      sheet.style.display = 'none';
      document.body.style.overflow = '';
    }, 280);
  }

  window.tuPwaShowBankDetail = _openBankSheet;

  // ─── Tier / Bank renderers ────────────────────────────────────────────────

  function _renderTiers(){
    const w = document.getElementById('tuTierWrap');
    if(!w) return;
    if(!_tiers.length){
      w.innerHTML = _emptyHtml('ยังไม่มีแพ็กเกจเติม');
      return;
    }
    const cards = _tiers.map(p => {
      const sel = (_selectedTier && _selectedTier.id === p.id);
      const id = esc(p.id);
      const badge = p.badge ? '<div style="position:absolute;top:-7px;right:8px;font-size:10px;font-weight:700;background:#dc2626;color:#fff;padding:2px 8px;border-radius:99px">'+esc(p.badge)+'</div>' : '';
      const bonus = (p.bonus_pct && Number(p.bonus_pct) > 0)
        ? '<div style="font-size:10.5px;color:#92400e;background:#fef3c7;padding:2px 7px;border-radius:8px;width:fit-content;margin-top:4px">+'+Number(p.bonus_pct).toFixed(0)+'% bonus</div>' : '';
      const rate = p.rate ? '<div style="font-size:10.5px;color:#1a56db;background:#e8f0fe;padding:2px 7px;border-radius:8px;width:fit-content;margin-top:4px;font-family:var(--font-mono,monospace)">'+Number(p.rate).toFixed(1)+' cr/฿</div>' : '';
      return ''
        + '<div onclick="window.tuPwaPickTier(\''+id+'\')" '
        +   'style="position:relative;padding:14px 14px 12px;border-radius:12px;cursor:pointer;transition:all .15s;'
        +   'background:'+(sel?'#fffbeb':'var(--card)')+';'
        +   'border:'+(sel?'2px':'1px')+' solid '+(sel?'var(--gold)':'var(--bdr)')+';'
        +   (sel?'box-shadow:0 0 0 2px rgba(232,185,62,.3)':'')+'">'
        +   badge
        +   '<div style="font-size:13px;font-weight:600;color:#444">'+esc(p.display_name||'')+'</div>'
        +   '<div style="font-size:22px;font-weight:800;color:#111;line-height:1.1;margin-top:2px">'+fmtBaht(p.amount_thb)+'</div>'
        +   '<div style="font-size:13px;color:#16a34a;font-weight:600;margin-top:2px">+ '+fmtNum(p.credits)+' credits</div>'
        +   rate + bonus
        + '</div>';
    }).join('');
    w.innerHTML = ''
      + '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px;display:flex;align-items:center;gap:8px">'
      +   '<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--gold);color:#1a1200;font-weight:800;font-size:11.5px;align-items:center;justify-content:center">1</span>'
      +   'เลือกแพ็กเกจเติม'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px">'+cards+'</div>';
  }

  function _renderBanks(){
    const w = document.getElementById('tuBankWrap');
    if(!w) return;
    if(!_banks.length){
      w.innerHTML = ''
        + '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px;display:flex;align-items:center;gap:8px">'
        +   '<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--gold);color:#1a1200;font-weight:800;font-size:11.5px;align-items:center;justify-content:center">2</span>'
        +   'โอนเงินเข้าบัญชี'
        + '</div>'
        + _emptyHtml('ยังไม่มีบัญชีรับเงิน — ติดต่อแอดมิน');
      return;
    }
    const cards = _banks.map(b => {
      const sel = (_selectedBank && _selectedBank.id === b.id);
      const id = esc(b.id);
      const branch = b.branch ? '<div style="font-size:10.5px;color:var(--muted);margin-top:2px">สาขา: '+esc(b.branch)+'</div>' : '';
      const qr = b.qr_url
        ? '<img src="'+esc(b.qr_url)+'" onclick="event.stopPropagation();window.tuPwaShowBankDetail(\''+id+'\')" style="width:48px;height:48px;border:1px solid var(--bdr);border-radius:6px;background:#fff;object-fit:contain;cursor:zoom-in"/>'
        : '';
      const def = b.is_default ? ' <span style="font-size:9.5px;color:#92400e;background:#fef3c7;padding:1px 6px;border-radius:6px;margin-left:4px">⭐</span>' : '';
      return ''
        + '<div onclick="window.tuPwaShowBankDetail(\''+id+'\')" '
        +   'style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;'
        +   'background:'+(sel?'#fffbeb':'var(--card)')+';'
        +   'border:'+(sel?'2px':'1px')+' solid '+(sel?'var(--gold)':'var(--bdr)')+';'
        +   (sel?'box-shadow:0 0 0 2px rgba(232,185,62,.25)':'')+'">'
        +   '<div style="width:18px;height:18px;border-radius:50%;border:2px solid '+(sel?'var(--gold)':'#d0d0d0')+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'
        +     (sel?'<div style="width:9px;height:9px;border-radius:50%;background:var(--gold)"></div>':'')
        +   '</div>'
        +   '<div style="flex:1;min-width:0">'
        +     '<div style="font-size:13px;font-weight:700;color:#111">'+bankDisplay(b)+def+'</div>'
        +     '<div style="font-size:11.5px;color:#555;font-family:var(--font-mono,monospace);margin-top:1px">'+esc(b.account_no)+' · '+esc(b.account_name)+'</div>'
        +     branch
        +   '</div>'
        +   qr
        + '</div>';
    }).join('');
    w.innerHTML = ''
      + '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px;display:flex;align-items:center;gap:8px">'
      +   '<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--gold);color:#1a1200;font-weight:800;font-size:11.5px;align-items:center;justify-content:center">2</span>'
      +   'โอนเงินเข้าบัญชี'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:7px">'+cards+'</div>';
  }

  function _renderSummary(){
    const w = document.getElementById('tuSummaryWrap');
    if(!w) return;
    if(!_selectedTier){ w.innerHTML = ''; return; }
    w.innerHTML = ''
      + '<div style="background:var(--card);border:1px solid var(--gold);border-radius:12px;padding:14px 16px;margin-top:14px">'
      +   '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:#444;margin-bottom:4px"><span>แพ็กเกจ</span><span>'+esc(_selectedTier.display_name||'')+'</span></div>'
      +   '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:#444"><span>ยอดโอน</span><span style="font-family:var(--font-mono,monospace);font-weight:700">'+fmtBaht(_selectedTier.amount_thb)+'</span></div>'
      +   '<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;color:#111;padding-top:8px;border-top:1px dashed var(--bdr);margin-top:6px"><span>ได้รับเครดิต</span><span style="color:#16a34a">+ '+fmtNum(_selectedTier.credits)+'</span></div>'
      + '</div>';
  }

  function _refreshSubmit(){
    const ok = !!(_selectedTier && _selectedBank && _slipFile);
    const btn = document.getElementById('tuSubmitBtn');
    if(!btn) return;
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '.5';
    btn.style.cursor = ok ? 'pointer' : 'not-allowed';
  }

  window.tuPwaPickTier = function(id){
    _selectedTier = _tiers.find(p => p.id === id) || null;
    _renderTiers();
    _renderSummary();
    _refreshSubmit();
  };

  window.tuPwaPickBank = function(id){
    _selectedBank = _banks.find(b => b.id === id) || null;
    _renderBanks();
    _refreshSubmit();
  };

  window.tuSlipPwaPreview = function(e){
    const f = e.target.files && e.target.files[0];
    const img = document.getElementById('tuSlipPwaPrev');
    if(!f){ if(img){ img.style.display='none'; } _slipFile=null; _refreshSubmit(); return; }
    if(f.size > 5*1024*1024){ toast('สลิปใหญ่เกิน 5MB', 'error'); e.target.value=''; if(img) img.style.display='none'; _slipFile=null; _refreshSubmit(); return; }
    if(!/^image\//.test(f.type)){ toast('ต้องเป็นไฟล์รูป', 'error'); e.target.value=''; _slipFile=null; _refreshSubmit(); return; }
    _slipFile = f;
    const r = new FileReader();
    r.onload = ev => { if(img){ img.src = ev.target.result; img.style.display='block'; } };
    r.readAsDataURL(f);
    _refreshSubmit();
  };

  window.tuPwaDoSubmit = async function(){
    if(!_selectedTier){ toast('เลือก tier ก่อน', 'error'); return; }
    if(!_selectedBank){ toast('เลือกบัญชีรับเงิน', 'error'); return; }
    if(!_slipFile){ toast('แนบสลิปก่อน', 'error'); return; }

    const btn = document.getElementById('tuSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'กำลังส่ง...';
    btn.style.opacity = '.7';

    try {
      const fd = new FormData();
      fd.append('topup_package_id', _selectedTier.id);
      fd.append('payment_method', _selectedBank.bank_code === 'promptpay' ? 'promptpay' : 'bank_transfer');
      fd.append('slip', _slipFile);

      const res = await fetch('/api/tenant/credits/topup', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + (window.Auth ? Auth.token : (localStorage.getItem('viiv_token')||'')) },
        body: fd
      });
      let j = null; try { j = await res.json(); } catch(_){}
      if(!res.ok) throw new Error((j && (j.detail || j.message)) || ('HTTP ' + res.status));
      toast('ส่งคำขอแล้ว — รอแอดมินอนุมัติ', 'ok');
      setTimeout(() => Router.go('credits'), 1100);
    } catch(e){
      toast('ส่งไม่สำเร็จ: ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = 'ส่งคำขอเติมเครดิต';
      btn.style.opacity = '1';
    }
  };
})();
