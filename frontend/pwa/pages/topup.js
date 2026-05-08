/* VIIV PWA — topup.js (Part 3D)
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
    },
    destroy(){ _destroyed = true; }
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
        ? '<img src="'+esc(b.qr_url)+'" onclick="event.stopPropagation();window.open(this.src,\'_blank\')" style="width:48px;height:48px;border:1px solid var(--bdr);border-radius:6px;background:#fff;object-fit:contain;cursor:zoom-in"/>'
        : '';
      const def = b.is_default ? ' <span style="font-size:9.5px;color:#92400e;background:#fef3c7;padding:1px 6px;border-radius:6px;margin-left:4px">⭐</span>' : '';
      return ''
        + '<div onclick="window.tuPwaPickBank(\''+id+'\')" '
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
