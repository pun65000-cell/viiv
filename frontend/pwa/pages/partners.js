/* VIIV PWA — partners.js */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _all = [];
  let _q = '';

  Router.register('partners', {
    title: 'คู่ค้า',
    async load(params) {
      _destroyed = false;
      _q = '';
      _refreshHandler = () => _reload();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _reload();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  const PT_LABEL = {
    supplier:    'ซัพพลายเออร์',
    customer:    'ลูกค้าองค์กร',
    distributor: 'ตัวแทนจำหน่าย',
    agent:       'ตัวแทน/นายหน้า',
    other:       'อื่นๆ',
  };
  const PT_CLS = {
    supplier: 'tag-blue', customer: 'tag-green',
    distributor: 'tag-yellow', agent: '', other: '',
  };

  async function _reload() {
    const c = document.getElementById('page-container');
    c.innerHTML = _shell(_skeleton());
    _bindSearch();
    try {
      const data = await App.api('/api/pos/partners/list');
      if (_destroyed) return;
      _all = Array.isArray(data) ? data : [];
      _renderList();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('ptr-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _shell(inner) {
    return `<div style="max-width:768px;margin:0 auto">
      <div style="padding:10px 14px 0;display:flex;gap:8px;align-items:center">
        <input id="ptr-search" type="search" placeholder="ค้นหาชื่อบริษัท / เบอร์..."
          style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
        <button onclick="PartnersPage.openCreate()"
          style="flex-shrink:0;background:var(--gold);color:#000;border:none;border-radius:10px;padding:9px 16px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          + สร้าง
        </button>
      </div>
      <div id="ptr-list" style="padding:10px 14px 80px">${inner}</div>
    </div>`;
  }

  function _skeleton() {
    return Array(5).fill('<div class="list-item skeleton-card" style="height:64px;margin-bottom:8px"></div>').join('');
  }

  function _renderList() {
    const el = document.getElementById('ptr-list');
    if (!el) return;
    const q = _q.toLowerCase();
    const list = q ? _all.filter(p =>
      (p.company_name||'').toLowerCase().includes(q) ||
      (p.phone||'').includes(q) ||
      (p.partner_code||'').toLowerCase().includes(q) ||
      (p.contact_name||'').toLowerCase().includes(q)
    ) : _all;
    if (!list.length) { el.innerHTML = '<div class="empty-state">ไม่พบคู่ค้า</div>'; return; }
    el.innerHTML = list.map(_row).join('');
  }

  function _row(p) {
    const initials = (p.company_name||'?').slice(0, 2);
    const ptLabel = PT_LABEL[p.partner_type] || p.partner_type || '—';
    const ptCls   = PT_CLS[p.partner_type]   || '';
    return `<div class="list-item" style="gap:10px" onclick="PartnersPage.edit('${p.id}')">
      <div style="width:42px;height:42px;border-radius:10px;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--fs-sm);color:#000;flex-shrink:0">${_esc(initials)}</div>
      <div class="li-left">
        <div class="li-title">${_esc(p.company_name||'—')}</div>
        <div class="li-sub">${_esc(p.phone||'—')}${p.contact_name ? ' · '+_esc(p.contact_name) : ''}</div>
      </div>
      <div class="li-right" style="align-items:flex-end">
        <span class="tag ${ptCls}" style="${!ptCls ? 'background:var(--bdr);color:var(--muted)' : ''}">${ptLabel}</span>
        <div style="color:var(--muted);font-size:1rem;margin-top:4px">›</div>
      </div>
    </div>`;
  }

  function _bindSearch() {
    const el = document.getElementById('ptr-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { _q = e.target.value; _renderList(); }, 200); });
  }

  function _typeBtns(current) {
    return Object.entries(PT_LABEL).map(([k, v]) => `
      <button id="ptbtn-${k}" onclick="PartnersPage._setType('${k}')"
        style="padding:5px 12px;border-radius:20px;border:1px solid var(--bdr);font-size:var(--fs-xs);font-weight:600;cursor:pointer;
               background:${current===k ? 'var(--gold)' : 'var(--card)'};color:${current===k ? '#000' : 'var(--txt)'}">
        ${v}
      </button>`).join('');
  }

  function _formHtml(p) {
    const isEdit = !!p.id;
    const curType = p.partner_type || 'supplier';
    return `<div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 14px">
        <div style="font-size:var(--fs-lg);font-weight:700">${isEdit ? 'แก้ไขคู่ค้า' : 'สร้างคู่ค้าใหม่'}</div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>

      <div style="margin-bottom:14px">
        <div style="font-size:var(--fs-xs);color:var(--muted);font-weight:600;margin-bottom:6px">ประเภทคู่ค้า</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${_typeBtns(curType)}</div>
        <input type="hidden" id="ptf-ptype" value="${curType}">
      </div>

      <div class="pm-field" style="margin-bottom:10px"><label>ชื่อบริษัท / ร้านค้า *</label>
        <input type="text" id="ptf-cname" value="${_esc(p.company_name||'')}" placeholder="บริษัท ABC จำกัด">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>ประเภทนิติบุคคล</label>
          <select id="ptf-etype" style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
            <option value="company"    ${(p.entity_type||'company')==='company'    ? 'selected' : ''}>บริษัท/นิติบุคคล</option>
            <option value="individual" ${p.entity_type==='individual' ? 'selected' : ''}>บุคคลธรรมดา</option>
          </select>
        </div>
        <div class="pm-field"><label>เลขภาษี</label>
          <input type="text" id="ptf-taxid" value="${_esc(p.tax_id||'')}" placeholder="0000000000000">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>เบอร์โทร</label>
          <input type="tel" id="ptf-phone" value="${_esc(p.phone||'')}" placeholder="02-xxx-xxxx">
        </div>
        <div class="pm-field"><label>LINE / Social</label>
          <input type="text" id="ptf-social" value="${_esc(p.social_url||'')}" placeholder="@line-id">
        </div>
      </div>

      <div style="font-size:var(--fs-xs);color:var(--muted);font-weight:600;margin:4px 0 8px">ผู้ติดต่อ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>ชื่อ</label>
          <input type="text" id="ptf-ctname" value="${_esc(p.contact_name||'')}" placeholder="ชื่อผู้ติดต่อ">
        </div>
        <div class="pm-field"><label>เบอร์โทร</label>
          <input type="tel" id="ptf-ctphone" value="${_esc(p.contact_phone||'')}" placeholder="0812345678">
        </div>
      </div>
      <div class="pm-field" style="margin-bottom:10px"><label>อีเมล</label>
        <input type="email" id="ptf-ctemail" value="${_esc(p.contact_email||'')}" placeholder="email@example.com">
      </div>

      <div style="font-size:var(--fs-xs);color:var(--muted);font-weight:600;margin:4px 0 8px">เงื่อนไขทางการค้า</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>วงเงินเชื่อ (฿)</label>
          <input type="number" id="ptf-cl" value="${p.credit_limit||0}" min="0">
        </div>
        <div class="pm-field"><label>เครดิตเทอม (วัน)</label>
          <input type="number" id="ptf-ct" value="${p.credit_term||30}" min="0">
        </div>
        <div class="pm-field"><label>ส่วนลด (%)</label>
          <input type="number" id="ptf-dc" value="${p.discount||0}" min="0" max="100">
        </div>
      </div>
      <div class="pm-field" style="margin-bottom:16px"><label>หมายเหตุ</label>
        <input type="text" id="ptf-note" value="${_esc(p.note||'')}" placeholder="บันทึกเพิ่มเติม">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="closeSheet()"
          style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">
          ยกเลิก
        </button>
        <button id="ptf-save-btn" onclick="PartnersPage.save('${isEdit ? p.id : ''}')"
          style="flex:2;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ${isEdit ? 'บันทึกการแก้ไข' : 'สร้างคู่ค้า'}
        </button>
      </div>
    </div>`;
  }

  window.PartnersPage = {
    edit(id) {
      const p = _all.find(x => x.id === id);
      if (!p) return;
      openSheet(_formHtml(p));
    },
    openCreate() {
      openSheet(_formHtml({}));
    },
    _setType(type) {
      document.getElementById('ptf-ptype').value = type;
      Object.keys(PT_LABEL).forEach(k => {
        const btn = document.getElementById('ptbtn-' + k);
        if (!btn) return;
        btn.style.background = k === type ? 'var(--gold)' : 'var(--card)';
        btn.style.color      = k === type ? '#000'        : 'var(--txt)';
      });
    },
    async save(id) {
      const company_name = document.getElementById('ptf-cname')?.value.trim();
      if (!company_name) { App.toast('กรุณากรอกชื่อบริษัท / ร้านค้า'); return; }
      const payload = {
        company_name,
        partner_type:  document.getElementById('ptf-ptype')?.value   || 'supplier',
        entity_type:   document.getElementById('ptf-etype')?.value   || 'company',
        tax_id:        document.getElementById('ptf-taxid')?.value.trim()  || '',
        phone:         document.getElementById('ptf-phone')?.value.trim()  || '',
        social_url:    document.getElementById('ptf-social')?.value.trim() || '',
        contact_name:  document.getElementById('ptf-ctname')?.value.trim() || '',
        contact_phone: document.getElementById('ptf-ctphone')?.value.trim()|| '',
        contact_email: document.getElementById('ptf-ctemail')?.value.trim()|| '',
        credit_limit:  parseFloat(document.getElementById('ptf-cl')?.value) || 0,
        credit_term:   parseInt(document.getElementById('ptf-ct')?.value)   || 30,
        discount:      parseFloat(document.getElementById('ptf-dc')?.value) || 0,
        note:          document.getElementById('ptf-note')?.value.trim()    || '',
      };
      const btn = document.getElementById('ptf-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        if (id) {
          await App.api('/api/pos/partners/update/' + id, { method: 'PUT', body: JSON.stringify(payload) });
          App.toast('✅ แก้ไขคู่ค้าแล้ว');
        } else {
          await App.api('/api/pos/partners/create', { method: 'POST', body: JSON.stringify(payload) });
          App.toast('✅ สร้างคู่ค้าใหม่แล้ว');
        }
        closeSheet();
        await _reload();
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = id ? 'บันทึกการแก้ไข' : 'สร้างคู่ค้า'; }
      }
    }
  };

  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
