/* VIIV PWA — members.js (สมาชิก: ร้านค้า + คู่ค้า) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _tab = 'store';   // 'store' | 'partner'
  let _all = [];        // store members
  let _partners = [];   // partner members
  let _q = '';

  Router.register('members', {
    title: 'สมาชิก',
    async load(params) {
      _destroyed = false;
      _q = '';
      const _hashTab = location.hash.includes('tab=partner') ? 'partner' : null;
      _tab = _hashTab || params?.tab || 'store';
      _refreshHandler = () => _reload();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _reload();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  async function _reload() {
    const c = document.getElementById('page-container');
    c.innerHTML = _shell(_skeleton());
    _bindSearch();
    _tab === 'store' ? await _loadStore() : await _loadPartners();
  }

  function _shell(inner) {
    return `<div style="max-width:768px;margin:0 auto">
      <div style="display:flex;border-bottom:2px solid var(--bdr)">
        <button onclick="MembersPage.switchTab('store')"
          style="flex:1;padding:11px 0;border:none;background:none;font-size:var(--fs-sm);font-weight:700;cursor:pointer;
                 border-bottom:2px solid ${_tab==='store'?'var(--gold)':'transparent'};margin-bottom:-2px;
                 color:${_tab==='store'?'var(--gold)':'var(--muted)'}">
          👥 สมาชิกร้านค้า
        </button>
        <button onclick="MembersPage.switchTab('partner')"
          style="flex:1;padding:11px 0;border:none;background:none;font-size:var(--fs-sm);font-weight:700;cursor:pointer;
                 border-bottom:2px solid ${_tab==='partner'?'var(--gold)':'transparent'};margin-bottom:-2px;
                 color:${_tab==='partner'?'var(--gold)':'var(--muted)'}">
          🤝 สมาชิกคู่ค้า
        </button>
      </div>
      <div style="padding:10px 14px 0;display:flex;gap:8px;align-items:center">
        <input id="mem-search" type="search"
          placeholder="${_tab==='store' ? 'ค้นหาชื่อ / เบอร์โทร...' : 'ค้นหาชื่อบริษัท / เบอร์...'}"
          style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
        <button onclick="MembersPage.openCreate()"
          style="flex-shrink:0;background:var(--gold);color:#000;border:none;border-radius:10px;padding:9px 16px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          + สร้าง
        </button>
      </div>
      <div id="mem-list" style="padding:10px 14px 80px">${inner}</div>
    </div>`;
  }

  function _skeleton() {
    return Array(6).fill('<div class="list-item skeleton-card" style="height:58px;margin-bottom:8px"></div>').join('');
  }

  // ─── STORE MEMBERS ───────────────────────────────────────────────────────────

  async function _loadStore() {
    try {
      const data = await App.api('/api/pos/members/list?limit=100');
      if (_destroyed) return;
      _all = data.members || [];
      _renderStoreList();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('mem-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _renderStoreList() {
    const el = document.getElementById('mem-list');
    if (!el) return;
    const q = _q.toLowerCase();
    const list = q ? _all.filter(m =>
      (m.name||'').toLowerCase().includes(q) ||
      (m.phone||'').includes(q) ||
      (m.code||'').toLowerCase().includes(q)
    ) : _all;
    if (!list.length) { el.innerHTML = '<div class="empty-state">ไม่พบสมาชิกร้านค้า</div>'; return; }
    el.innerHTML = list.map(_storeRow).join('');
  }

  function _storeRow(m) {
    const initials = (m.name||'?').slice(0, 2);
    const pf = Array.isArray(m.platforms) ? m.platforms : [];
    const pfBadges = pf.map(p => `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--bdr);color:var(--muted)">${_esc(p)}</span>`).join('');
    return `<div class="list-item" style="gap:10px;align-items:flex-start;padding:10px 12px" onclick="MembersPage.editStore('${m.id}')">
      <div style="width:38px;height:38px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--fs-sm);color:#000;flex-shrink:0;margin-top:2px">${_esc(initials)}</div>
      <div class="li-left">
        <div class="li-title">${_esc(m.name)}</div>
        <div class="li-sub">${_esc(m.phone||'-')}${m.code ? ' · '+_esc(m.code) : ''}</div>
        ${pfBadges ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${pfBadges}</div>` : ''}
      </div>
      <div class="li-right" style="align-items:flex-end;margin-top:2px">
        ${m.credit > 0 ? `<span class="tag tag-red">เชื่อ ฿${_fmt(m.credit)}</span>` : ''}
        ${m.pv_total > 0 ? `<div style="font-size:var(--fs-xs);color:var(--gold);font-weight:700">${_fmt(m.pv_total)} PV</div>` : ''}
        <div style="color:var(--muted);font-size:1rem;margin-top:4px">›</div>
      </div>
    </div>`;
  }

  // ─── PARTNER MEMBERS ─────────────────────────────────────────────────────────

  const PT_LABEL = { supplier:'ซัพพลายเออร์', distributor:'ตัวแทนจำหน่าย', manufacturer:'ผู้ผลิต', service:'บริการ', other:'อื่นๆ' };
  const PT_CLS   = { supplier:'tag-blue', distributor:'tag-yellow', manufacturer:'tag-green', service:'', other:'' };

  async function _loadPartners() {
    try {
      const data = await App.api('/api/pos/partners/list');
      if (_destroyed) return;
      _partners = Array.isArray(data) ? data : [];
      _renderPartnerList();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('mem-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _renderPartnerList() {
    const el = document.getElementById('mem-list');
    if (!el) return;
    const q = _q.toLowerCase();
    const list = q ? _partners.filter(p =>
      (p.company_name||'').toLowerCase().includes(q) ||
      (p.phone||'').includes(q) ||
      (p.partner_code||'').toLowerCase().includes(q) ||
      (p.contact_name||'').toLowerCase().includes(q)
    ) : _partners;
    if (!list.length) { el.innerHTML = '<div class="empty-state">ไม่พบสมาชิกคู่ค้า</div>'; return; }
    el.innerHTML = list.map(_partnerRow).join('');
  }

  function _partnerRow(p) {
    const initials = (p.company_name||'?').slice(0, 2);
    const ptLabel = PT_LABEL[p.partner_type] || p.partner_type || '—';
    const ptCls   = PT_CLS[p.partner_type]   || '';
    return `<div class="list-item" style="gap:10px" onclick="MembersPage.editPartner('${p.id}')">
      <div style="width:42px;height:42px;border-radius:10px;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--fs-sm);color:#000;flex-shrink:0">${_esc(initials)}</div>
      <div class="li-left">
        <div class="li-title">${_esc(p.company_name||'—')}</div>
        <div class="li-sub">${_esc(p.phone||'—')}${p.contact_name ? ' · '+_esc(p.contact_name) : ''}</div>
      </div>
      <div class="li-right" style="align-items:flex-end">
        <span class="tag ${ptCls}" style="${!ptCls?'background:var(--bdr);color:var(--muted)':''}">${ptLabel}</span>
        <div style="color:var(--muted);font-size:1rem;margin-top:4px">›</div>
      </div>
    </div>`;
  }

  // ─── SEARCH ──────────────────────────────────────────────────────────────────

  function _bindSearch() {
    const el = document.getElementById('mem-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { _q = e.target.value; _tab === 'store' ? _renderStoreList() : _renderPartnerList(); }, 200);
    });
  }

  // ─── STORE MEMBER FORM ───────────────────────────────────────────────────────

  const PLATFORMS = ['facebook','line','instagram','tiktok','walk_in','manual'];

  function _storeFormHtml(m) {
    const isEdit = !!m.id;
    const selPF = Array.isArray(m.platforms) ? m.platforms : [];
    const pfPills = PLATFORMS.map(p => {
      const on = selPF.includes(p);
      return `<label id="pfpl-${p}"
        style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:20px;cursor:pointer;
               font-size:var(--fs-xs);font-weight:600;border:1px solid var(--bdr);user-select:none;
               background:${on?'var(--gold)':'var(--card)'};color:${on?'#000':'var(--txt)'}">
        <input type="checkbox" name="mf-pf" value="${p}" ${on?'checked':''}
          style="display:none" onchange="MembersPage._togglePF(this,'pfpl-${p}')"/>${p}
      </label>`;
    }).join('');

    return `<div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 14px">
        <div style="font-size:var(--fs-lg);font-weight:700">${isEdit ? 'แก้ไขสมาชิกร้านค้า' : 'สร้างสมาชิกใหม่'}</div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>
      ${isEdit ? `<div style="background:var(--bg);border-radius:10px;padding:9px 12px;margin-bottom:12px;font-size:var(--fs-xs);color:var(--muted)">
        รหัส: <strong style="color:var(--txt)">${_esc(m.code||'—')}</strong>&nbsp;·&nbsp;
        สมาชิกตั้งแต่: <strong style="color:var(--txt)">${App.fmtDate(m.created_at)}</strong>
        ${m.pv_total > 0 ? `&nbsp;·&nbsp; PV: <strong style="color:var(--gold)">${_fmt(m.pv_total)}</strong>` : ''}
      </div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>ชื่อลูกค้า *</label>
          <input type="text" id="mf-name" value="${_esc(m.name||'')}" placeholder="ชื่อ-นามสกุล">
        </div>
        <div class="pm-field"><label>รหัสลูกค้า${isEdit?' (ปัจจุบัน)':''}</label>
          <input type="text" id="mf-code" value="${_esc(m.code||'')}" placeholder="เว้นว่าง=สร้างอัตโนมัติ"${isEdit?' readonly':''}>\n        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>เบอร์โทร</label>
          <input type="tel" id="mf-phone" value="${_esc(m.phone||'')}" placeholder="0812345678">
        </div>
        <div class="pm-field"><label>Tax ID</label>
          <input type="text" id="mf-taxid" value="${_esc(m.tax_id||'')}" placeholder="เลขประจำตัวผู้เสียภาษี">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>อีเมล</label>
          <input type="email" id="mf-email" value="${_esc(m.email||'')}" placeholder="email@example.com">
        </div>
        <div class="pm-field"><label>วันเกิด</label>
          <input type="date" id="mf-bday" value="${_esc(m.birthday||'')}">
        </div>
      </div>
      <div class="pm-field" style="margin-bottom:10px"><label>ที่อยู่</label>
        <input type="text" id="mf-addr" value="${_esc(m.address||'')}" placeholder="ที่อยู่">
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>พิกัด GPS</label>
          <input type="text" id="mf-geo" value="${_esc(m.geo||'')}" placeholder="lat,lng">
        </div>
        <div class="pm-field"><label>PV สะสม</label>
          <input type="number" id="mf-pv" value="${m.pv_total||0}" min="0">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>เงินสด (฿)</label>
          <input type="number" id="mf-cash" value="${m.cash||0}" min="0">
        </div>
        <div class="pm-field"><label>Credit (฿)</label>
          <input type="number" id="mf-credit" value="${m.credit||0}" min="0">
        </div>
        <div class="pm-field"><label>วงเงินเชื่อ (฿)</label>
          <input type="number" id="mf-cl" value="${m.credit_limit||0}" min="0">
        </div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">แพลตฟอร์ม</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${pfPills}</div>
      </div>
      <div class="pm-field" style="margin-bottom:16px"><label>หมายเหตุ</label>
        <input type="text" id="mf-note" value="${_esc(m.note||'')}" placeholder="บันทึกเพิ่มเติม">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="closeSheet()"
          style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">
          ยกเลิก
        </button>
        <button id="mf-save-btn" onclick="MembersPage.saveStore('${isEdit ? m.id : ''}')"
          style="flex:2;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ${isEdit ? 'บันทึกการแก้ไข' : 'สร้างสมาชิก'}
        </button>
      </div>
    </div>`;
  }

  // ─── PARTNER FORM ────────────────────────────────────────────────────────────

  function _ptTypeBtns(cur) {
    return Object.entries(PT_LABEL).map(([k, v]) => `
      <button id="ptbtn-${k}" onclick="MembersPage._setPType('${k}')"
        style="padding:5px 12px;border-radius:20px;border:1px solid var(--bdr);font-size:var(--fs-xs);font-weight:600;cursor:pointer;
               background:${cur===k?'var(--gold)':'var(--card)'};color:${cur===k?'#000':'var(--txt)'}">${v}
      </button>`).join('');
  }

  function _partnerFormHtml(p) {
    const isEdit = !!p.id;
    const curType = p.partner_type || 'supplier';
    return `<div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 14px">
        <div style="font-size:var(--fs-lg);font-weight:700">${isEdit ? 'แก้ไขสมาชิกคู่ค้า' : 'สร้างคู่ค้าใหม่'}</div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">ประเภทคู่ค้า</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${_ptTypeBtns(curType)}</div>
        <input type="hidden" id="ptf-ptype" value="${curType}">
      </div>
      <div class="pm-field" style="margin-bottom:10px"><label>ชื่อบริษัท / ร้านค้า *</label>
        <input type="text" id="ptf-cname" value="${_esc(p.company_name||'')}" placeholder="บริษัท ABC จำกัด">
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>ประเภทนิติบุคคล</label>
          <select id="ptf-etype" style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;color:var(--txt);font-size:var(--fs-sm);outline:none">
            <option value="company"    ${(p.entity_type||'company')==='company'    ?'selected':''}>บริษัท/นิติบุคคล</option>
            <option value="individual" ${p.entity_type==='individual'?'selected':''}>บุคคลธรรมดา</option>
          </select>
        </div>
        <div class="pm-field"><label>เลขภาษี</label>
          <input type="text" id="ptf-taxid" value="${_esc(p.tax_id||'')}" placeholder="0000000000000">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>เบอร์โทรบริษัท *</label>
          <input type="tel" id="ptf-phone" value="${_esc(p.phone||'')}" placeholder="02-xxx-xxxx">
        </div>
        <div class="pm-field"><label>LINE / Social</label>
          <input type="text" id="ptf-social" value="${_esc(p.social_url||'')}" placeholder="@line-id">
        </div>
      </div>
      <div class="pm-field" style="margin-bottom:10px"><label>ที่อยู่</label>
        <input type="text" id="ptf-addr" value="${_esc(p.address||'')}" placeholder="ที่อยู่บริษัท">
      </div>
      <div style="font-size:12px;font-weight:600;color:var(--muted);margin:4px 0 8px">ผู้ติดต่อ</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>ชื่อผู้ติดต่อ *</label>
          <input type="text" id="ptf-ctname" value="${_esc(p.contact_name||'')}" placeholder="ชื่อ-นามสกุล">
        </div>
        <div class="pm-field"><label>ตำแหน่ง</label>
          <input type="text" id="ptf-ctpos" value="${_esc(p.contact_position||'')}" placeholder="ผู้จัดการ">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>เบอร์โทรผู้ติดต่อ *</label>
          <input type="tel" id="ptf-ctphone" value="${_esc(p.contact_phone||'')}" placeholder="0812345678">
        </div>
        <div class="pm-field"><label>LINE ผู้ติดต่อ</label>
          <input type="text" id="ptf-ctline" value="${_esc(p.contact_line||'')}" placeholder="@line-id">
        </div>
      </div>
      <div class="pm-field" style="margin-bottom:10px"><label>อีเมล</label>
        <input type="email" id="ptf-ctemail" value="${_esc(p.contact_email||'')}" placeholder="email@example.com">
      </div>
      <div style="font-size:12px;font-weight:600;color:var(--muted);margin:4px 0 8px">การเงิน</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>วงเงินสินเชื่อ (฿) *</label>
          <input type="number" id="ptf-cl" value="${p.credit_limit||0}" min="0">
        </div>
        <div class="pm-field"><label>เครดิตเทอม (วัน)</label>
          <input type="number" id="ptf-ct" value="${p.credit_term||30}" min="0">
        </div>
        <div class="pm-field"><label>ส่วนลด (%)</label>
          <input type="number" id="ptf-dc" value="${p.discount||0}" min="0" max="100">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>ธนาคาร</label>
          <input type="text" id="ptf-bank" value="${_esc(p.bank||'')}" placeholder="กสิกรไทย, SCB...">
        </div>
        <div class="pm-field"><label>เลขบัญชี</label>
          <input type="text" id="ptf-ba" value="${_esc(p.bank_account||'')}" placeholder="xxx-x-xxxxx-x">
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
        <button id="ptf-save-btn" onclick="MembersPage.savePartner('${isEdit ? p.id : ''}')"
          style="flex:2;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ${isEdit ? 'บันทึกการแก้ไข' : 'สร้างคู่ค้า'}
        </button>
      </div>
    </div>`;
  }

  // ─── PUBLIC ──────────────────────────────────────────────────────────────────

  window.MembersPage = {
    switchTab(tab) { _tab = tab; _q = ''; history.replaceState(null,'','#members?tab='+tab); _reload(); },
    openCreate() {
      openSheet(_tab === 'store' ? _storeFormHtml({}) : _partnerFormHtml({}));
    },
    editStore(id) {
      const m = _all.find(x => x.id === id);
      if (m) openSheet(_storeFormHtml(m));
    },
    editPartner(id) {
      const p = _partners.find(x => x.id === id);
      if (p) openSheet(_partnerFormHtml(p));
    },
    _togglePF(cb, labelId) {
      const lbl = document.getElementById(labelId);
      if (!lbl) return;
      lbl.style.background = cb.checked ? 'var(--gold)' : 'var(--card)';
      lbl.style.color      = cb.checked ? '#000'        : 'var(--txt)';
    },
    _setPType(type) {
      document.getElementById('ptf-ptype').value = type;
      Object.keys(PT_LABEL).forEach(k => {
        const btn = document.getElementById('ptbtn-' + k);
        if (!btn) return;
        btn.style.background = k === type ? 'var(--gold)' : 'var(--card)';
        btn.style.color      = k === type ? '#000'        : 'var(--txt)';
      });
    },
    async saveStore(id) {
      const name = document.getElementById('mf-name')?.value.trim();
      if (!name) { App.toast('กรุณาระบุชื่อลูกค้า'); return; }
      const platforms = Array.from(document.querySelectorAll('input[name="mf-pf"]:checked')).map(cb => cb.value);
      const payload = {
        name,
        code:         document.getElementById('mf-code')?.value.trim()      || '',
        phone:        document.getElementById('mf-phone')?.value.trim()     || '',
        tax_id:       document.getElementById('mf-taxid')?.value.trim()     || '',
        email:        document.getElementById('mf-email')?.value.trim()     || '',
        birthday:     document.getElementById('mf-bday')?.value             || '',
        address:      document.getElementById('mf-addr')?.value.trim()      || '',
        geo:          document.getElementById('mf-geo')?.value.trim()       || '',
        pv_total:     parseFloat(document.getElementById('mf-pv')?.value)      || 0,
        cash:         parseFloat(document.getElementById('mf-cash')?.value)    || 0,
        credit:       parseFloat(document.getElementById('mf-credit')?.value)  || 0,
        credit_limit: parseFloat(document.getElementById('mf-cl')?.value)      || 0,
        note:         document.getElementById('mf-note')?.value.trim()      || '',
        platforms,
      };
      const btn = document.getElementById('mf-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        if (id) {
          await App.api('/api/pos/members/update/' + id, { method: 'PUT', body: JSON.stringify(payload) });
          App.toast('✅ แก้ไขข้อมูลสมาชิกแล้ว');
        } else {
          await App.api('/api/pos/members/create', { method: 'POST', body: JSON.stringify(payload) });
          App.toast('✅ สร้างสมาชิกใหม่แล้ว');
        }
        closeSheet();
        await _reload();
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = id ? 'บันทึกการแก้ไข' : 'สร้างสมาชิก'; }
      }
    },
    async savePartner(id) {
      const company_name  = document.getElementById('ptf-cname')?.value.trim();
      const phone         = document.getElementById('ptf-phone')?.value.trim();
      const contact_name  = document.getElementById('ptf-ctname')?.value.trim();
      const contact_phone = document.getElementById('ptf-ctphone')?.value.trim();
      if (!company_name)  { App.toast('กรุณากรอกชื่อบริษัท / ร้านค้า'); return; }
      if (!phone)         { App.toast('กรุณากรอกเบอร์โทรบริษัท'); return; }
      if (!contact_name)  { App.toast('กรุณากรอกชื่อผู้ติดต่อ'); return; }
      if (!contact_phone) { App.toast('กรุณากรอกเบอร์โทรผู้ติดต่อ'); return; }
      const payload = {
        company_name,
        partner_type:      document.getElementById('ptf-ptype')?.value      || 'supplier',
        entity_type:       document.getElementById('ptf-etype')?.value      || 'company',
        tax_id:            document.getElementById('ptf-taxid')?.value.trim()   || '',
        phone,
        social_url:        document.getElementById('ptf-social')?.value.trim()  || '',
        address:           document.getElementById('ptf-addr')?.value.trim()    || '',
        contact_name,
        contact_position:  document.getElementById('ptf-ctpos')?.value.trim()   || '',
        contact_phone,
        contact_line:      document.getElementById('ptf-ctline')?.value.trim()  || '',
        contact_email:     document.getElementById('ptf-ctemail')?.value.trim() || '',
        credit_limit:      parseFloat(document.getElementById('ptf-cl')?.value)    || 0,
        credit_term:       parseInt(document.getElementById('ptf-ct')?.value)      || 30,
        discount:          parseFloat(document.getElementById('ptf-dc')?.value)    || 0,
        bank:              document.getElementById('ptf-bank')?.value.trim()    || '',
        bank_account:      document.getElementById('ptf-ba')?.value.trim()      || '',
        note:              document.getElementById('ptf-note')?.value.trim()    || '',
      };
      const btn = document.getElementById('ptf-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        if (id) {
          await App.api('/api/pos/partners/update/' + id, { method: 'PUT', body: JSON.stringify(payload) });
          App.toast('✅ แก้ไขข้อมูลคู่ค้าแล้ว');
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

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
