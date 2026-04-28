/* VIIV PWA — bank.js */
(function () {
    const BANK_LIST = [
      'กสิกรไทย','กรุงเทพ','กรุงไทย','กรุงศรี','ทหารไทยธนชาต','ไทยพาณิชย์',
      'ออมสิน','อาคารสงเคราะห์','อิสลาม','ซีไอเอ็มบี','แลนด์แอนด์เฮ้าส์','เกียรตินาคิน',
      'ทิสโก้','ยูโอบี','สแตนดาร์ดชาร์เตอร์ด','ซิตี้แบงก์','ธ.ก.ส.'
    ];
    const ACC_TYPES = ['ออมทรัพย์','กระแสรายวัน','ฝากประจำ'];
  
    let _banks = [];
    let _editId = null;
    let _refreshHandler = null;
  
    Router.register('bank', {
      title: 'บัญชีธนาคาร',
      async load() {
        _refreshHandler = () => _reload();
        document.addEventListener('viiv:refresh', _refreshHandler);
        await _reload();
      },
      destroy() {
        if (_refreshHandler) {
          document.removeEventListener('viiv:refresh', _refreshHandler);
          _refreshHandler = null;
        }
      }
    });
  
    async function _reload() {
      const c = document.getElementById('page-container');
      c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">กำลังโหลด...</div>';
      try {
        const data = await App.api('/api/pos/bank/list');
        _banks = data.banks || [];
        _render();
      } catch(e) {
        c.innerHTML = '<div style="padding:20px;color:#ef4444">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
      }
    }
  
    function _render() {
      const c = document.getElementById('page-container');
      c.innerHTML = '<div style="max-width:600px;margin:0 auto;padding:14px 14px 80px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
        + '<div style="font-size:var(--fs-md);font-weight:700">บัญชีรับเงิน</div>'
        + (_banks.length < 3
            ? '<button onclick="BankPage.openAdd()" style="background:var(--gold);color:#000;border:none;border-radius:10px;padding:8px 16px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">+ เพิ่มบัญชี</button>'
            : '<div style="font-size:var(--fs-xs);color:var(--muted)">สูงสุด 3 บัญชี</div>')
        + '</div>'
        + (_banks.length
            ? _banks.map(function(b){ return _bankCard(b); }).join('')
            : '<div style="text-align:center;padding:40px 20px;color:var(--muted)"><div style="font-size:2rem;margin-bottom:8px">🏦</div><div>ยังไม่มีบัญชีธนาคาร</div></div>')
        + '</div>';
    }
  
    function _bankCard(b) {
      return '<div style="background:var(--card);border-radius:14px;padding:14px 16px;margin-bottom:12px;border:1px solid var(--bdr)' + (b.is_default ? ';border-left:3px solid var(--gold)' : '') + '">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<span style="font-size:1.3rem">🏦</span>'
        + '<div><div style="font-weight:700;font-size:var(--fs-sm)">' + _esc(b.bank_name) + '</div>'
        + '<div style="font-size:var(--fs-xs);color:var(--muted)">' + _esc(b.acc_type) + '</div></div>'
        + '</div>'
        + (b.is_default ? '<span style="background:var(--gold);color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">หลัก</span>' : '')
        + '</div>'
        + '<div style="font-size:var(--fs-sm);margin-bottom:4px">ชื่อบัญชี: <strong>' + _esc(b.acc_name) + '</strong></div>'
        + '<div style="font-size:var(--fs-sm);margin-bottom:4px">เลขบัญชี: <strong>' + _esc(b.acc_no) + '</strong></div>'
        + (b.bank_shop_name ? '<div style="font-size:var(--fs-xs);color:var(--muted)">PromptPay: ' + _esc(b.bank_shop_name) + ' · ' + _esc(b.bank_shop_id || '') + '</div>' : '')
        + (b.qr_url ? '<img src="' + _esc(b.qr_url) + '" style="width:80px;height:80px;object-fit:contain;margin-top:8px;border-radius:8px;border:1px solid var(--bdr)">' : '')
        + '<div style="display:flex;gap:8px;margin-top:12px">'
        + '<button onclick="BankPage.openEdit(\'' + b.id + '\')" style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:8px;padding:8px;font-size:var(--fs-xs);font-weight:600;cursor:pointer">แก้ไข</button>'
        + (!b.is_default ? '<button onclick="BankPage.setDefault(\'' + b.id + '\')" style="flex:1;background:var(--card);border:1px solid var(--gold);color:var(--gold);border-radius:8px;padding:8px;font-size:var(--fs-xs);font-weight:600;cursor:pointer">ตั้งเป็นหลัก</button>' : '')
        + '<button onclick="BankPage.del(\'' + b.id + '\')" style="background:var(--card);border:1px solid #ef4444;color:#ef4444;border-radius:8px;padding:8px 12px;font-size:var(--fs-xs);font-weight:600;cursor:pointer">ลบ</button>'
        + '</div></div>';
    }
  
    function _inp(id, val, type, ph) {
      return '<input type="' + (type||'text') + '" id="' + id + '" value="' + _esc(val||'') + '" placeholder="' + _esc(ph||'') + '"'
        + ' style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>';
    }
  
    function _lbl(txt) {
      return '<div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">' + txt + '</div>';
    }
  
    function _formSheet(b) {
      const isd = b ? b.is_default : (_banks.length === 0);
      const bankOpts = '<option value="">เลือกธนาคาร</option>'
        + BANK_LIST.map(function(bk){ return '<option value="' + bk + '"' + (b && b.bank_name === bk ? ' selected' : '') + '>' + bk + '</option>'; }).join('');
      const typeOpts = ACC_TYPES.map(function(t){ return '<option value="' + t + '"' + ((b ? b.acc_type : 'ออมทรัพย์') === t ? ' selected' : '') + '>' + t + '</option>'; }).join('');
      const sel = 'width:100%;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none';
  
      return '<div style="padding:4px 0 8px">'
        + '<div style="font-size:var(--fs-md);font-weight:700;margin-bottom:16px">' + (b ? 'แก้ไขบัญชี' : 'เพิ่มบัญชีธนาคาร') + '</div>'
        + '<div style="margin-bottom:10px">' + _lbl('ธนาคาร *') + '<select id="bk-bank" style="' + sel + '">' + bankOpts + '</select></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
        + '<div>' + _lbl('ประเภทบัญชี') + '<select id="bk-type" style="' + sel + '">' + typeOpts + '</select></div>'
        + '<div>' + _lbl('บัญชีหลัก') + '<label style="display:flex;align-items:center;gap:8px;padding:9px 0">'
        + '<input type="checkbox" id="bk-default" ' + (isd ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--gold)">'
        + '<span style="font-size:var(--fs-sm)">ตั้งเป็นบัญชีหลัก</span></label></div>'
        + '</div>'
        + '<div style="margin-bottom:10px">' + _lbl('ชื่อบัญชี *') + _inp('bk-name', b && b.acc_name, 'text', 'ชื่อ-นามสกุล') + '</div>'
        + '<div style="margin-bottom:10px">' + _lbl('เลขบัญชี *') + _inp('bk-no', b && b.acc_no, 'text', 'xxx-x-xxxxx-x') + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
        + '<div>' + _lbl('PromptPay ชื่อร้าน') + _inp('bk-shopname', b && b.bank_shop_name, 'text', 'ชื่อร้านค้า') + '</div>'
        + '<div>' + _lbl('PromptPay ID') + _inp('bk-shopid', b && b.bank_shop_id, 'text', 'เบอร์ / เลขนิติ') + '</div>'
        + '</div>'
        + '<div style="margin-bottom:20px">' + _lbl('รูป QR Code')
        + (b && b.qr_url
            ? '<img id="bk-qr-preview" src="' + _esc(b.qr_url) + '" style="width:90px;height:90px;object-fit:contain;border-radius:8px;border:1px solid var(--bdr);margin-bottom:8px;display:block">'
            : '<div id="bk-qr-preview" style="margin-bottom:8px"></div>')
        + '<input type="hidden" id="bk-qr" value="' + _esc(b && b.qr_url || '') + '">'
        + '<label style="display:inline-flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 14px;cursor:pointer;font-size:var(--fs-xs);font-weight:600">'
        + '<span>📤 อัปโหลด QR</span>'
        + '<input type="file" id="bk-qr-file" accept="image/*" style="display:none" onchange="BankPage.previewQR(this)">'
        + '</label></div>'
        + '<button id="bk-save-btn" onclick="BankPage.save()" style="width:100%;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">'
        + (b ? 'บันทึกการแก้ไข' : '+ เพิ่มบัญชี') + '</button></div>';
    }
  
    function _g(id) { return document.getElementById(id); }
    function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  
    window.BankPage = {
      openAdd() { _editId = null; openSheet(_formSheet(null)); },
      openEdit(id) { _editId = id; openSheet(_formSheet(_banks.find(function(b){ return b.id === id; }))); },
  
      previewQR(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
          const prev = document.getElementById('bk-qr-preview');
          if (!prev) return;
          const img = document.createElement('img');
          img.id = 'bk-qr-preview';
          img.src = e.target.result;
          img.style.cssText = 'width:90px;height:90px;object-fit:contain;border-radius:8px;border:1px solid var(--bdr);margin-bottom:8px;display:block';
          prev.parentNode.replaceChild(img, prev);
        };
        reader.readAsDataURL(file);
      },
  
      async save() {
        const bank_name = (_g('bk-bank') || {}).value || '';
        const acc_name  = ((_g('bk-name') || {}).value || '').trim();
        const acc_no    = ((_g('bk-no') || {}).value || '').trim();
        if (!bank_name || !acc_name || !acc_no) { App.toast('กรุณากรอกข้อมูลที่จำเป็น'); return; }
  
        const payload = {
          bank_name,
          acc_name,
          acc_no,
          acc_type:       (_g('bk-type') || {}).value || 'ออมทรัพย์',
          bank_shop_name: ((_g('bk-shopname') || {}).value || '').trim(),
          bank_shop_id:   ((_g('bk-shopid') || {}).value || '').trim(),
          qr_url:         ((_g('bk-qr') || {}).value || '').trim(),
          is_default:     !!(_g('bk-default') || {}).checked,
        };
  
        const qrFile = _g('bk-qr-file') && _g('bk-qr-file').files[0];
        if (qrFile) {
          const fd = new FormData();
          fd.append('file', qrFile);
          try {
            const ep = _editId ? '/api/pos/bank/upload-qr/' + _editId : '/api/pos/bank/upload-qr-new';
            const qrRes = await fetch(ep, {method:'POST', headers:{Authorization:'Bearer '+App.token}, body:fd}).then(function(r){return r.json();});
            if (qrRes.url) payload.qr_url = qrRes.url;
          } catch(e) { App.toast('อัปโหลด QR ไม่สำเร็จ'); return; }
        }
  
        const btn = _g('bk-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
        try {
          if (_editId) {
            await App.api('/api/pos/bank/update/' + _editId, {method:'PUT', body: JSON.stringify(payload)});
          } else {
            await App.api('/api/pos/bank/create', {method:'POST', body: JSON.stringify(payload)});
          }
          App.toast('บันทึกสำเร็จ');
          closeSheet();
          await _reload();
        } catch(e) {
          App.toast(e.message);
          if (btn) { btn.disabled = false; btn.textContent = _editId ? 'บันทึกการแก้ไข' : '+ เพิ่มบัญชี'; }
        }
      },
  
      async setDefault(id) {
        const b = _banks.find(function(x){ return x.id === id; });
        if (!b) return;
        try {
          await App.api('/api/pos/bank/update/' + id, {method:'PUT', body: JSON.stringify(Object.assign({}, b, {is_default:true}))});
          App.toast('ตั้งเป็นบัญชีหลักแล้ว');
          await _reload();
        } catch(e) { App.toast(e.message); }
      },
  
      async del(id) {
        if (!confirm('ลบบัญชีนี้?')) return;
        try {
          await App.api('/api/pos/bank/delete/' + id, {method:'DELETE'});
          App.toast('ลบแล้ว');
          await _reload();
        } catch(e) { App.toast(e.message); }
      }
    };
  })();
  