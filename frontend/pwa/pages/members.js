/* VIIV PWA — members.js */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _all = [];
  let _q = '';

  Router.register('members', {
    title: 'ลูกค้า',
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

  async function _reload() {
    const c = document.getElementById('page-container');
    c.innerHTML = _shell(_skeleton());
    _bindSearch();
    try {
      const data = await App.api('/api/pos/members/list?limit=100');
      if (_destroyed) return;
      _all = data.members || [];
      _renderList();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('mem-list').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _shell(inner) {
    return `<div style="max-width:768px;margin:0 auto">
      <div style="padding:10px 14px 0;display:flex;gap:8px;align-items:center">
        <input id="mem-search" type="search" placeholder="ค้นหาชื่อ / เบอร์โทร..."
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

  function _renderList() {
    const el = document.getElementById('mem-list');
    if (!el) return;
    const q = _q.toLowerCase();
    const list = q ? _all.filter(m =>
      (m.name||'').toLowerCase().includes(q) ||
      (m.phone||'').includes(q) ||
      (m.code||'').toLowerCase().includes(q)
    ) : _all;
    if (!list.length) { el.innerHTML = '<div class="empty-state">ไม่พบลูกค้า</div>'; return; }
    el.innerHTML = list.map(_row).join('');
  }

  function _row(m) {
    const initials = (m.name||'?').slice(0, 2);
    return `<div class="list-item" style="gap:10px" onclick="MembersPage.edit('${m.id}')">
      <div style="width:38px;height:38px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--fs-sm);color:#000;flex-shrink:0">${_esc(initials)}</div>
      <div class="li-left">
        <div class="li-title">${_esc(m.name)}</div>
        <div class="li-sub">${_esc(m.phone||'-')}${m.code ? ' · '+_esc(m.code) : ''}</div>
      </div>
      <div class="li-right" style="align-items:flex-end">
        ${m.credit > 0 ? `<span class="tag tag-red">เชื่อ ฿${_fmt(m.credit)}</span>` : ''}
        ${m.pv_total > 0 ? `<div style="font-size:var(--fs-xs);color:var(--muted)">${_fmt(m.pv_total)} PV</div>` : ''}
        <div style="color:var(--muted);font-size:1rem;${m.credit > 0 || m.pv_total > 0 ? 'margin-top:4px' : ''}">›</div>
      </div>
    </div>`;
  }

  function _bindSearch() {
    const el = document.getElementById('mem-search');
    if (!el) return;
    let t;
    el.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { _q = e.target.value; _renderList(); }, 200); });
  }

  function _formHtml(m) {
    const isEdit = !!m.id;
    return `<div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 14px">
        <div style="font-size:var(--fs-lg);font-weight:700">${isEdit ? 'แก้ไขข้อมูลลูกค้า' : 'สร้างลูกค้าใหม่'}</div>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--muted);padding:0">✕</button>
      </div>
      ${isEdit ? `<div style="background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:var(--fs-xs);color:var(--muted)">
        รหัส: <strong style="color:var(--txt)">${_esc(m.code||'—')}</strong>
        &nbsp;·&nbsp; สมาชิกตั้งแต่: <strong style="color:var(--txt)">${App.fmtDate(m.created_at)}</strong>
        ${m.pv_total > 0 ? `&nbsp;·&nbsp; PV: <strong style="color:var(--gold)">${_fmt(m.pv_total)}</strong>` : ''}
      </div>` : ''}
      <div class="pm-field" style="margin-bottom:10px"><label>ชื่อ *</label>
        <input type="text" id="mf-name" value="${_esc(m.name||'')}" placeholder="ชื่อลูกค้า">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>เบอร์โทร</label>
          <input type="tel" id="mf-phone" value="${_esc(m.phone||'')}" placeholder="0812345678">
        </div>
        <div class="pm-field"><label>อีเมล</label>
          <input type="email" id="mf-email" value="${_esc(m.email||'')}" placeholder="email@example.com">
        </div>
      </div>
      <div class="pm-field" style="margin-bottom:10px"><label>ที่อยู่</label>
        <input type="text" id="mf-addr" value="${_esc(m.address||'')}" placeholder="ที่อยู่">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="pm-field"><label>วงเงินเชื่อ (฿)</label>
          <input type="number" id="mf-cl" value="${m.credit_limit||0}" min="0">
        </div>
        <div class="pm-field"><label>เลขภาษี</label>
          <input type="text" id="mf-tax" value="${_esc(m.tax_id||'')}" placeholder="เลขประจำตัวผู้เสียภาษี">
        </div>
      </div>
      <div class="pm-field" style="margin-bottom:16px"><label>หมายเหตุ</label>
        <input type="text" id="mf-note" value="${_esc(m.note||'')}" placeholder="บันทึกเพิ่มเติม">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="closeSheet()"
          style="flex:1;background:var(--card);border:1px solid var(--bdr);color:var(--txt);border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">
          ยกเลิก
        </button>
        <button id="mf-save-btn" onclick="MembersPage.save('${isEdit ? m.id : ''}')"
          style="flex:2;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ${isEdit ? 'บันทึกการแก้ไข' : 'สร้างลูกค้า'}
        </button>
      </div>
    </div>`;
  }

  window.MembersPage = {
    edit(id) {
      const m = _all.find(x => x.id === id);
      if (!m) return;
      openSheet(_formHtml(m));
    },
    openCreate() {
      openSheet(_formHtml({}));
    },
    async save(id) {
      const name = document.getElementById('mf-name')?.value.trim();
      if (!name) { App.toast('กรุณาระบุชื่อลูกค้า'); return; }
      const payload = {
        name,
        phone:        document.getElementById('mf-phone')?.value.trim()  || '',
        email:        document.getElementById('mf-email')?.value.trim()  || '',
        address:      document.getElementById('mf-addr')?.value.trim()   || '',
        credit_limit: parseFloat(document.getElementById('mf-cl')?.value) || 0,
        tax_id:       document.getElementById('mf-tax')?.value.trim()    || '',
        note:         document.getElementById('mf-note')?.value.trim()   || '',
      };
      const btn = document.getElementById('mf-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        if (id) {
          await App.api('/api/pos/members/update/' + id, { method: 'PUT', body: JSON.stringify(payload) });
          App.toast('✅ แก้ไขข้อมูลลูกค้าแล้ว');
        } else {
          await App.api('/api/pos/members/create', { method: 'POST', body: JSON.stringify(payload) });
          App.toast('✅ สร้างลูกค้าใหม่แล้ว');
        }
        closeSheet();
        await _reload();
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = id ? 'บันทึกการแก้ไข' : 'สร้างลูกค้า'; }
      }
    }
  };

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
