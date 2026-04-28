/* VIIV PWA — staff.js */
(function () {

    const PERMS = [
      {group:'🛒 POS', items:[{k:'pos_view',l:'ดูหน้า POS'},{k:'pos_sale',l:'บันทึกการขาย'},{k:'pos_order',l:'จัดการคำสั่งซื้อ'},{k:'pos_product',l:'จัดการสินค้า/สต็อก'}]},
      {group:'📊 รายงาน', items:[{k:'report_view',l:'ดูรายงาน'},{k:'report_finance',l:'บัญชีการเงิน'},{k:'report_export',l:'Export ข้อมูล'}]},
      {group:'💬 Chat & AI', items:[{k:'chat_view',l:'ดู Chat'},{k:'chat_reply',l:'ตอบ Chat'},{k:'ai_config',l:'ตั้งค่า AI'}]},
      {group:'⚙ ตั้งค่า', items:[{k:'settings_store',l:'ตั้งค่าร้านค้า'},{k:'settings_staff',l:'จัดการพนักงาน'},{k:'settings_billing',l:'แพ็กเกจ/ชำระเงิน'}]},
      {group:'📢 Auto Post', items:[{k:'post_view',l:'ดู Auto Post'},{k:'post_create',l:'สร้างโพสต์'},{k:'post_delete',l:'ลบโพสต์'}]}
    ];
  
    let _staffDB = [];
    let _refreshHandler = null;
    const INP = 'width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none';
  
    Router.register('staff', {
      title: 'บุคลากร',
      async load() {
        _refreshHandler = () => _reload();
        document.addEventListener('viiv:refresh', _refreshHandler);
        await _reload();
      },
      destroy() {
        if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
      }
    });
  
    async function _reload() {
      const c = document.getElementById('page-container');
      c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">กำลังโหลด...</div>';
      try {
        const data = await App.api('/api/staff/list');
        _staffDB = Array.isArray(data) ? data : [];
        _renderList();
      } catch(e) {
        document.getElementById('page-container').innerHTML = '<div style="padding:20px;color:#ef4444">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
      }
    }
  
    function _renderList() {
      const c = document.getElementById('page-container');
      c.innerHTML = '<div style="max-width:600px;margin:0 auto;padding:14px 14px 80px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
        + '<div style="font-size:var(--fs-md);font-weight:700">บุคลากร</div>'
        + '<div style="display:flex;gap:8px">'
        + '<button onclick="StaffPage.openPerms()" style="background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:10px;padding:8px 12px;font-size:var(--fs-xs);font-weight:600;cursor:pointer">🛡 สิทธิ์</button>'
        + '<button onclick="StaffPage.openCP()" style="background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:10px;padding:8px 12px;font-size:var(--fs-xs);font-weight:600;cursor:pointer">🔑 รหัสผ่าน</button>'
        + '<button onclick="StaffPage.openCreate()" style="background:var(--gold);color:#000;border:none;border-radius:10px;padding:8px 14px;font-size:var(--fs-xs);font-weight:700;cursor:pointer">+ สร้าง</button>'
        + '</div></div>'
        + (_staffDB.length ? _staffDB.map(function(s) { return _staffCard(s); }).join('') :
          '<div style="text-align:center;padding:40px 20px;color:var(--muted)"><div style="font-size:2rem;margin-bottom:8px">👥</div><div>ยังไม่มีพนักงาน</div></div>')
        + '</div>';
    }
  
    function _staffCard(s) {
      const initials = ((s.first_name||'').charAt(0) + (s.last_name||'').charAt(0)).toUpperCase();
      const cnt = Object.values(s.permissions||{}).filter(Boolean).length;
      return '<div style="background:var(--card);border-radius:14px;padding:14px 16px;margin-bottom:10px;border:1px solid var(--bdr);display:flex;align-items:center;gap:12px">'
        + '<div style="width:42px;height:42px;border-radius:50%;background:rgba(232,185,62,0.15);border:1.5px solid rgba(232,185,62,0.3);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--gold);font-size:var(--fs-sm);flex-shrink:0">' + initials + '</div>'
        + '<div style="flex:1"><div style="font-weight:700;font-size:var(--fs-sm)">' + _esc(s.first_name) + ' ' + _esc(s.last_name) + '</div>'
        + '<div style="font-size:var(--fs-xs);color:var(--muted)">' + _esc(s.role) + ' · ' + _esc(s.email) + '</div></div>'
        + '<span style="font-size:10px;background:rgba(232,185,62,0.1);color:var(--gold);font-weight:600;padding:3px 8px;border-radius:10px">' + cnt + ' สิทธิ์</span>'
        + '<button onclick="StaffPage.openEdit(\'' + s.id + '\')" style="padding:5px 10px;border:1px solid var(--bdr);border-radius:6px;background:transparent;cursor:pointer;font-size:var(--fs-xs);font-weight:600;color:var(--muted)">แก้ไข</button>'
        + '</div>';
    }
  
    function _buildPermGrid(cls) {
      return PERMS.map(function(g) {
        return '<div style="background:var(--bg);border:1px solid var(--bdr);border-radius:9px;padding:12px;margin-bottom:8px">'
          + '<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:8px">' + g.group + '</div>'
          + g.items.map(function(i) {
            return '<label style="display:flex;align-items:center;gap:8px;font-size:var(--fs-xs);padding:4px 0;cursor:pointer">'
              + '<input type="checkbox" class="' + cls + '" data-key="' + i.k + '" style="accent-color:var(--gold);width:15px;height:15px"> ' + i.l + '</label>';
          }).join('') + '</div>';
      }).join('');
    }
  
    function _permSheet(staff) {
      const isEdit = !!staff;
      const title = isEdit ? 'สิทธิ์: ' + staff.first_name + ' ' + staff.last_name : 'จัดการสิทธิ์';
      let selOpts = '<option value="">— เลือกพนักงาน —</option>' + _staffDB.map(function(s) {
        return '<option value="' + s.id + '" ' + (staff && staff.id===s.id?'selected':'') + '>' + s.first_name + ' ' + s.last_name + ' (' + s.role + ')</option>';
      }).join('');
      return '<div style="padding:4px 0 8px">'
        + '<div style="font-size:var(--fs-md);font-weight:700;margin-bottom:16px">' + title + '</div>'
        + '<div style="margin-bottom:14px"><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">เลือกพนักงาน</div>'
        + '<select id="sp-sel" onchange="StaffPage.onPermSel(this.value)" style="' + INP + ';cursor:pointer">' + selOpts + '</select></div>'
        + '<div id="sp-perm-wrap">' + (staff ? _buildPermForStaff(staff) : '<div style="text-align:center;padding:24px;color:var(--muted)">เลือกพนักงานด้านบน</div>') + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:16px">'
        + '<button onclick="closeSheet()" style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:10px;padding:12px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">ยกเลิก</button>'
        + '<button onclick="StaffPage.savePerms()" style="flex:2;background:var(--gold);color:#000;border:none;border-radius:10px;padding:12px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">บันทึกสิทธิ์</button>'
        + '</div></div>';
    }
  
    function _buildPermForStaff(s) {
      const perms = s ? (s.permissions||{}) : {};
      return '<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(232,185,62,0.08);border:1px solid rgba(232,185,62,0.25);border-radius:8px;cursor:pointer;margin-bottom:10px;font-size:var(--fs-sm);font-weight:700;color:var(--gold)">'
        + '<input type="checkbox" id="sp-all" onchange="StaffPage.toggleAll(this)" style="accent-color:var(--gold);width:15px;height:15px"> ให้สิทธิ์ทั้งหมด</label>'
        + PERMS.map(function(g) {
          return '<div style="background:var(--bg);border:1px solid var(--bdr);border-radius:9px;padding:12px;margin-bottom:8px">'
            + '<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:8px">' + g.group + '</div>'
            + g.items.map(function(i) {
              return '<label style="display:flex;align-items:center;gap:8px;font-size:var(--fs-xs);padding:4px 0;cursor:pointer">'
                + '<input type="checkbox" class="sp-perm" data-key="' + i.k + '" ' + (perms[i.k]?'checked':'') + ' style="accent-color:var(--gold);width:15px;height:15px"> ' + i.l + '</label>';
            }).join('') + '</div>';
        }).join('');
    }
  
    function _createSheet(editId) {
      const s = editId ? _staffDB.find(function(x){return x.id===editId;}) : null;
      return '<div style="padding:4px 0 8px">'
        + '<div style="font-size:var(--fs-md);font-weight:700;margin-bottom:16px">' + (s?'แก้ไขพนักงาน':'สร้างพนักงานใหม่') + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
        + '<div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">ชื่อ *</div><input type="text" id="sf-fn" value="' + _esc(s&&s.first_name||'') + '" style="' + INP + '"></div>'
        + '<div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">นามสกุล *</div><input type="text" id="sf-ln" value="' + _esc(s&&s.last_name||'') + '" style="' + INP + '"></div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
        + '<div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">อีเมล *</div><input type="email" id="sf-email" value="' + _esc(s&&s.email||'') + '" style="' + INP + '"></div>'
        + '<div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">เบอร์โทร</div><input type="tel" id="sf-phone" value="' + _esc(s&&s.phone||'') + '" style="' + INP + '"></div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
        + '<div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">ตำแหน่ง *</div><input type="text" id="sf-role" value="' + _esc(s&&s.role||'') + '" style="' + INP + '"></div>'
        + '<div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">รหัสพนักงาน</div><input type="text" id="sf-code" value="' + _esc(s&&s.staff_code||'') + '" style="' + INP + '"></div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
        + '<div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">LINE ID</div><input type="text" id="sf-line" value="' + _esc(s&&s.line_id||'') + '" style="' + INP + '"></div>'
        + '<div><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">Facebook</div><input type="text" id="sf-fb" value="' + _esc(s&&s.facebook||'') + '" style="' + INP + '"></div>'
        + '</div>'
        + (!s ? '<div style="margin-bottom:10px"><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">รหัสผ่าน *</div><input type="password" id="sf-pw" style="' + INP + '"></div>'
        + '<div style="margin-bottom:10px"><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">ยืนยันรหัสผ่าน *</div><input type="password" id="sf-pw2" style="' + INP + '"></div>' : '')
        + '<div style="margin-bottom:16px"><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">หมายเหตุ</div><textarea id="sf-note" rows="2" style="' + INP + ';resize:none">' + _esc(s&&s.note||'') + '</textarea></div>'
        + '<input type="hidden" id="sf-edit-id" value="' + (editId||'') + '">'
        + '<div style="display:flex;gap:8px">'
        + '<button onclick="closeSheet()" style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:10px;padding:12px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">ยกเลิก</button>'
        + '<button onclick="StaffPage.saveStaff()" style="flex:2;background:var(--gold);color:#000;border:none;border-radius:10px;padding:12px;font-size:var(--fs-sm);font-weight:700;cursor:pointer" id="sf-save-btn">' + (s?'บันทึกการแก้ไข':'สร้างพนักงาน') + '</button>'
        + '</div></div>';
    }
  
    function _cpSheet() {
      return '<div style="padding:4px 0 8px">'
        + '<div style="font-size:var(--fs-md);font-weight:700;margin-bottom:16px">เปลี่ยนรหัสผ่าน</div>'
        + '<div style="margin-bottom:10px"><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">รหัสผ่านปัจจุบัน *</div><input type="password" id="cp-old" style="' + INP + '"></div>'
        + '<div style="margin-bottom:10px"><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">รหัสผ่านใหม่ *</div><input type="password" id="cp-new" style="' + INP + '"></div>'
        + '<div style="margin-bottom:20px"><div style="font-size:var(--fs-xs);font-weight:600;color:var(--muted);margin-bottom:5px">ยืนยันรหัสผ่านใหม่ *</div><input type="password" id="cp-conf" style="' + INP + '"></div>'
        + '<div style="display:flex;gap:8px">'
        + '<button onclick="closeSheet()" style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:10px;padding:12px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">ยกเลิก</button>'
        + '<button onclick="StaffPage.saveCP()" style="flex:2;background:var(--gold);color:#000;border:none;border-radius:10px;padding:12px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">บันทึก</button>'
        + '</div></div>';
    }
  
    function _g(id) { return document.getElementById(id); }
    function _esc(s) { return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  
    window.StaffPage = {
      openCreate() { openSheet(_createSheet(null)); },
      openEdit(id)  { openSheet(_createSheet(id)); },
      openPerms()   { openSheet(_permSheet(null)); },
      openCP()      { openSheet(_cpSheet()); },
  
      onPermSel(id) {
        const s = _staffDB.find(function(x){return x.id===id;});
        const wrap = _g('sp-perm-wrap');
        if (wrap) wrap.innerHTML = s ? _buildPermForStaff(s) : '<div style="text-align:center;padding:24px;color:var(--muted)">เลือกพนักงานด้านบน</div>';
      },
  
      toggleAll(cb) {
        document.querySelectorAll('.sp-perm').forEach(function(el){el.checked=cb.checked;});
      },
  
      async savePerms() {
        const id = (_g('sp-sel')||{}).value;
        if (!id) { App.toast('กรุณาเลือกพนักงาน'); return; }
        const perms = {};
        document.querySelectorAll('.sp-perm').forEach(function(el){perms[el.dataset.key]=el.checked;});
        const s = _staffDB.find(function(x){return x.id===id;});
        if (!s) return;
        try {
          await App.api('/api/staff/update/'+id, {method:'PUT', body: JSON.stringify({
            first_name: s.first_name, last_name: s.last_name,
            email: s.email, role: s.role, permissions: perms
          })});
          App.toast('บันทึกสิทธิ์แล้ว');
          closeSheet();
          await _reload();
        } catch(e) { App.toast(e.message); }
      },
  
      async saveStaff() {
        const editId = (_g('sf-edit-id')||{}).value || '';
        const fn    = ((_g('sf-fn')||{}).value||'').trim();
        const ln    = ((_g('sf-ln')||{}).value||'').trim();
        const email = ((_g('sf-email')||{}).value||'').trim();
        const role  = ((_g('sf-role')||{}).value||'').trim();
        if (!fn||!ln||!email||!role) { App.toast('กรุณากรอกข้อมูลที่จำเป็น'); return; }
  
        const payload = {
          first_name: fn, last_name: ln, email, role,
          phone:      ((_g('sf-phone')||{}).value||'').trim(),
          staff_code: ((_g('sf-code')||{}).value||'').trim(),
          line_id:    ((_g('sf-line')||{}).value||'').trim(),
          facebook:   ((_g('sf-fb')||{}).value||'').trim(),
          note:       ((_g('sf-note')||{}).value||'').trim(),
        };
  
        if (!editId) {
          const pw  = (_g('sf-pw')||{}).value||'';
          const pw2 = (_g('sf-pw2')||{}).value||'';
          if (!pw) { App.toast('กรุณากรอกรหัสผ่าน'); return; }
          if (pw !== pw2) { App.toast('รหัสผ่านไม่ตรงกัน'); return; }
          payload.password = pw;
          payload.permissions = {};
        }
  
        const btn = _g('sf-save-btn');
        if (btn) { btn.disabled=true; btn.textContent='กำลังบันทึก...'; }
        try {
          if (editId) {
            await App.api('/api/staff/update/'+editId, {method:'PUT', body: JSON.stringify(payload)});
          } else {
            await App.api('/api/staff/create', {method:'POST', body: JSON.stringify(payload)});
          }
          App.toast(editId ? 'แก้ไขแล้ว' : 'สร้างพนักงานแล้ว');
          closeSheet();
          await _reload();
        } catch(e) {
          App.toast(e.message);
          if (btn) { btn.disabled=false; btn.textContent=editId?'บันทึกการแก้ไข':'สร้างพนักงาน'; }
        }
      },
  
      async saveCP() {
        const old  = (_g('cp-old')||{}).value||'';
        const nw   = (_g('cp-new')||{}).value||'';
        const conf = (_g('cp-conf')||{}).value||'';
        if (!old||!nw) { App.toast('กรุณากรอกรหัสผ่าน'); return; }
        if (nw !== conf) { App.toast('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
        try {
          await App.api('/admin/change-password', {method:'POST', body: JSON.stringify({current_password:old, new_password:nw})});
          App.toast('เปลี่ยนรหัสผ่านแล้ว');
          closeSheet();
        } catch(e) { App.toast(e.message); }
      }
    };
  
  })();
  