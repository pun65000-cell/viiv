/* VIIV PWA — statement.js (ใบวางบิล) */
(function () {
  'use strict';

  let _destroyed = false;
  let _refreshHandler = null;
  let _statements = [];
  let _billDetails = {};
  let _q = '';

  // selector state
  let _unpaidBills = [];
  let _selectedBillIds = [];
  let _lockedCustomerId = null;
  let _selectorTimer = null;

  // create-form calc state
  let _stTotal = 0, _stDisc = 0, _stVat = 0, _stNet = 0;
  let _stSelectedIds = [];

  // detail mode
  let _currentMode = 'delivered';

  const SL = { pending: 'รอชำระ', partial: 'ชำระบางส่วน', paid: 'ชำระแล้ว', cancelled: 'ยกเลิก' };
  const SL_COLOR = { pending: '#d97706', partial: '#2563eb', paid: '#16a34a', cancelled: '#9ca3af' };
  const SL_BG   = { pending: '#fef3c7', partial: '#dbeafe', paid: '#dcfce7', cancelled: '#f3f4f6' };

  // ── ROUTER ──
  Router.register('statement', {
    title: 'ใบวางบิล',
    async load() {
      _destroyed = false;
      _q = '';
      _refreshHandler = () => _render();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _render();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    },
  });

  // ── LOAD & RENDER ──
  async function _render() {
    const c = document.getElementById('page-container');
    c.innerHTML = _shell(_skeleton());
    _bindSearch();
    try {
      const data = await App.api('/api/pos/statements/list');
      _statements = Array.isArray(data) ? data : [];
      if (_destroyed) return;
      const details = await Promise.all(
        _statements.map(s => App.api(`/api/pos/statements/${s.id}/bills`).catch(() => []))
      );
      details.forEach((bills, i) => { _billDetails[_statements[i].id] = Array.isArray(bills) ? bills : []; });
      if (_destroyed) return;
      _renderList();
    } catch (e) {
      if (_destroyed) return;
      const el = document.getElementById('stmt-list');
      if (el) el.innerHTML = `<div class="empty-state">โหลดไม่ได้: ${_esc(e.message)}</div>`;
    }
  }

  function _shell(inner) {
    return `<div style="max-width:768px;margin:0 auto;padding-bottom:80px">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px 6px">
        <div style="position:relative;flex:1">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;pointer-events:none">🔍</span>
          <input id="stmt-search" type="text" autocomplete="off" placeholder="ค้นหา run_id / ลูกค้า..."
            style="width:100%;box-sizing:border-box;background:var(--card);border:1.5px solid var(--bdr);border-radius:10px;padding:9px 10px 9px 30px;color:var(--txt);font-size:16px;outline:none;-webkit-appearance:none;appearance:none"/>
        </div>
        <button onclick="StmtPage.openCreate()"
          style="flex-shrink:0;background:var(--gold);color:#000;border:none;border-radius:10px;padding:9px 14px;font-size:var(--fs-sm);font-weight:700;cursor:pointer;white-space:nowrap">+ สร้างใหม่</button>
      </div>
      <div id="stmt-count" style="padding:0 14px 4px;font-size:var(--fs-xs);color:var(--muted)"></div>
      <div id="stmt-list" style="padding:0 14px">${inner}</div>
    </div>`;
  }

  function _skeleton() {
    return Array(4).fill('<div class="list-item skeleton-card" style="height:80px;margin-bottom:8px"></div>').join('');
  }

  function _bindSearch() {
    const sq = document.getElementById('stmt-search');
    if (!sq) return;
    let timer;
    sq.addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => { _q = e.target.value; _renderList(); }, 300);
    });
  }

  function _filtered() {
    if (!_q) return _statements;
    const q = _q.toLowerCase();
    return _statements.filter(s =>
      (s.run_id || '').toLowerCase().includes(q) ||
      (s.customer_name || '').toLowerCase().includes(q) ||
      (s.customer_code || '').toLowerCase().includes(q)
    );
  }

  function _renderList() {
    const el = document.getElementById('stmt-list');
    const cnt = document.getElementById('stmt-count');
    if (!el) return;
    const list = _filtered();
    if (cnt) cnt.textContent = 'พบ ' + list.length + ' รายการ';
    el.innerHTML = list.length ? list.map(_stmtCard).join('') : '<div class="empty-state">ไม่มีรายการใบวางบิล</div>';
  }

  function _stmtCard(s) {
    const fc = SL_COLOR[s.status] || '#9ca3af';
    const fb = SL_BG[s.status] || '#f3f4f6';
    const borderColor = s.status === 'paid' ? '#16a34a' : s.status === 'partial' ? '#2563eb' : '#d97706';
    const bCount = (_billDetails[s.id] || []).length;
    return `<div class="list-item" onclick="StmtPage.openDetail(${s.id})"
      style="flex-direction:column;align-items:stretch;gap:5px;padding:11px 14px;margin-bottom:8px;cursor:pointer;border-left:3px solid ${borderColor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="min-width:0;flex:1">
          <div style="font-size:var(--fs-sm);font-weight:700">${_esc(s.run_id)}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted);margin-top:2px">${_esc(s.customer_name || '—')}${s.customer_code ? ' · ' + _esc(s.customer_code) : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:10px">
          <div style="font-size:var(--fs-md);font-weight:700;color:var(--gold)">฿${_fmt(s.net_amt)}</div>
          <div style="font-size:10px;color:var(--muted)">${_fmtDate(s.created_at)}</div>
        </div>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
        <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${fb};color:${fc};font-weight:600">${SL[s.status] || s.status}</span>
        ${bCount ? `<span style="font-size:10px;color:var(--muted)">${bCount} บิล</span>` : ''}
        ${s.due_single ? `<span style="font-size:10px;color:var(--muted)">ครบ ${_fmtDate(s.due_single)}</span>` : ''}
      </div>
    </div>`;
  }

  // ── DETAIL SHEET ──
  function _openDetail(id) {
    const s = _statements.find(x => x.id === id);
    if (!s) return;
    const bills = _billDetails[id] || [];
    const notPaid = s.status !== 'paid' && s.status !== 'cancelled';
    const fc = SL_COLOR[s.status] || '#9ca3af';
    const fb = SL_BG[s.status] || '#f3f4f6';
    const overdue = _isOverdue(s.due_single);

    const initMode = s.payment_method === 'cheque' ? 'cheque'
      : (s.appointment_dt || s.payment_method === 'appointment') ? 'appointment'
      : 'delivered';
    _currentMode = initMode;

    openSheet(`
      <div style="padding:0 0 20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
          <div>
            <div style="font-size:var(--fs-md);font-weight:700">${_esc(s.run_id)}</div>
            <span style="display:inline-block;margin-top:4px;font-size:10px;padding:2px 8px;border-radius:10px;background:${fb};color:${fc};font-weight:600">${SL[s.status] || s.status}</span>
          </div>
          <div style="text-align:right">
            <div style="font-size:var(--fs-lg);font-weight:800;color:var(--gold)">฿${_fmt(s.net_amt)}</div>
            <div style="font-size:10px;color:var(--muted)">${_fmtDate(s.created_at)}</div>
          </div>
        </div>

        ${s.customer_name ? `
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">ลูกค้า</div>
          <div style="font-weight:700">${_esc(s.customer_name)}</div>
          ${s.customer_code ? `<div style="font-size:var(--fs-xs);color:var(--muted)">รหัส: ${_esc(s.customer_code)}</div>` : ''}
          ${s.customer_phone ? `<div style="font-size:var(--fs-xs);color:var(--muted)">โทร: ${_esc(s.customer_phone)}</div>` : ''}
        </div>` : ''}

        ${bills.length ? `
        <div style="margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:6px">รายการบิล (${bills.length})</div>
          ${bills.map(b => `
            <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);padding:5px 0;border-bottom:1px solid var(--bdr)">
              <span>${_esc(b.bill_no)} · ${_fmtDate(b.created_at)}</span>
              <span style="font-weight:600">฿${_fmt(b.total)}</span>
            </div>`).join('')}
        </div>` : ''}

        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:12px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);padding:2px 0"><span>ยอดรวม</span><span>฿${_fmt(s.total_amt)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);padding:2px 0"><span>ส่วนลด</span><span>-฿${_fmt(s.discount)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);padding:2px 0"><span>VAT</span><span>฿${_fmt(s.vat_amt)}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;padding:6px 0 0;border-top:1px solid var(--bdr);margin-top:4px">
            <span style="font-size:var(--fs-sm)">ยอดสุทธิ</span>
            <span style="font-size:var(--fs-sm);color:var(--gold)">฿${_fmt(s.net_amt)}</span>
          </div>
        </div>

        ${s.due_single ? `
        <div style="background:${overdue ? '#fee2e2' : '#fef9c3'};border:1px solid ${overdue ? '#fca5a5' : '#fde68a'};border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:var(--fs-xs)">📅 กำหนดชำระ: ${_fmtDate(s.due_single)}</span>
          <span style="font-size:11px;font-weight:700;color:${overdue ? '#b91c1c' : '#92400e'}">${overdue ? '⚠ เกินกำหนด' : 'รอชำระ'}</span>
        </div>` : ''}

        ${notPaid ? `
        <div style="margin-bottom:14px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px">บันทึกการชำระ</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
            ${['delivered', 'cheque', 'appointment'].map(m => {
              const labels = { delivered: '📋 วางบิลแล้ว', cheque: '🏦 เก็บเช็ค', appointment: '📅 นัดชำระ' };
              const active = m === initMode;
              return `<button id="stm-mode-${m}" onclick="StmtPage.setMode('${m}',${id})"
                style="padding:7px 4px;font-size:11px;border:1.5px solid ${active ? 'var(--gold)' : 'var(--bdr)'};border-radius:8px;background:${active ? 'var(--gold-a)' : 'var(--card)'};color:${active ? 'var(--gold-d)' : 'var(--txt)'};font-weight:${active ? '700' : '400'};cursor:pointer">${labels[m]}</button>`;
            }).join('')}
          </div>
          <div id="stm-mode-extra">${_modeHtml(initMode, s)}</div>
          <div style="margin-top:10px">
            <div style="font-size:10px;font-weight:600;margin-bottom:4px">สถานะ</div>
            <select id="stm-status" style="width:100%;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px;font-size:var(--fs-sm);color:var(--txt);outline:none">
              <option value="pending"${s.status === 'pending' ? ' selected' : ''}>รอชำระ</option>
              <option value="partial"${s.status === 'partial' ? ' selected' : ''}>ชำระบางส่วน</option>
              <option value="paid"${s.status === 'paid' ? ' selected' : ''}>ชำระแล้ว</option>
            </select>
          </div>
        </div>
        <button onclick="StmtPage.save(${id})"
          style="width:100%;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer;margin-bottom:10px">บันทึก</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <button onclick="StmtPage.openPartial(${id})"
            style="background:var(--card);border:1.5px solid #2563eb;border-radius:12px;padding:11px;font-size:var(--fs-xs);font-weight:700;color:#2563eb;cursor:pointer">💰 ชำระบางส่วน</button>
          <button onclick="StmtPage.openPaid(${id})"
            style="background:#dcfce7;border:none;border-radius:12px;padding:11px;font-size:var(--fs-xs);font-weight:700;color:#16a34a;cursor:pointer">✓ ชำระแล้ว</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button onclick="StmtPage.printStmt(${id})"
            style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:11px;font-size:var(--fs-xs);color:var(--muted);cursor:pointer">🖨 พิมพ์</button>
          <button onclick="StmtPage.deleteStmt(${id},'${_esc(s.run_id)}')"
            style="background:#fee2e2;border:none;border-radius:12px;padding:11px;font-size:var(--fs-xs);font-weight:700;color:#dc2626;cursor:pointer">🗑 ลบ</button>
        </div>` : `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button onclick="StmtPage.printStmt(${id})"
            style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:13px;font-size:var(--fs-xs);color:var(--muted);cursor:pointer">🖨 พิมพ์</button>
          <button onclick="closeSheet()"
            style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:13px;font-size:var(--fs-xs);color:var(--txt);cursor:pointer">ปิด</button>
        </div>`}
      </div>
    `);
  }

  function _modeHtml(mode, s) {
    s = s || {};
    const inp = (id, val, ph, type) =>
      `<input id="${id}" type="${type || 'text'}" value="${_esc(val || '')}" placeholder="${ph || ''}"
        style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px;font-size:var(--fs-sm);color:var(--txt);outline:none"/>`;

    if (mode === 'cheque') {
      let cd = {};
      try { cd = typeof s.cheque_detail === 'string' ? JSON.parse(s.cheque_detail) : (s.cheque_detail || {}); } catch (e) {}
      const banks = ['กรุงเทพ','กสิกรไทย','ไทยพาณิชย์','กรุงไทย','ทหารไทยธนชาต','ออมสิน','อาคารสงเคราะห์','เกียรตินาคินภัทร','ซีไอเอ็มบีไทย','ยูโอบี','ทิสโก้','อิสลาม'];
      return `
        <select id="stm-ch-bank" style="width:100%;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px;font-size:var(--fs-sm);color:var(--txt);outline:none;margin-bottom:8px">
          <option value="">-- ธนาคาร --</option>
          ${banks.map(b => `<option value="${_esc(b)}"${cd.bank === b ? ' selected' : ''}>${_esc(b)}</option>`).join('')}
        </select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          ${inp('stm-ch-payee', cd.payee, 'ชื่อผู้รับ')}
          ${inp('stm-ch-payer', cd.payer, 'ชื่อผู้จ่าย')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${inp('stm-ch-no', cd.cheque_no, 'เลขที่เช็ค')}
          ${inp('stm-ch-due', cd.due_date, '', 'date')}
        </div>`;
    }
    if (mode === 'appointment') {
      const dt = s.appointment_dt ? String(s.appointment_dt).replace(' ', 'T').slice(0, 16) : '';
      return `
        ${inp('stm-appt-dt', dt, '', 'datetime-local')}
        <textarea id="stm-appt-note" rows="2" placeholder="หมายเหตุ..."
          style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px;font-size:var(--fs-sm);color:var(--txt);outline:none;resize:none;margin-top:8px">${_esc(s.appointment_note || '')}</textarea>
        <textarea id="stm-neg-note" rows="2" placeholder="บันทึกการเจรจา..."
          style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:9px;font-size:var(--fs-sm);color:var(--txt);outline:none;resize:none;margin-top:8px">${_esc(s.negotiation_note || '')}</textarea>`;
    }
    // delivered
    const dueVal = s.due_single ? String(s.due_single).slice(0, 10) : '';
    return inp('stm-due', dueVal, 'วันกำหนดชำระ', 'date');
  }

  // ── SELECTOR SHEET ──
  function _openSelector() {
    _selectedBillIds = [];
    _lockedCustomerId = null;
    _unpaidBills = [];

    openSheet(`
      <div>
        <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:12px">📋 สร้างใบวางบิลใหม่</div>
        <input id="stm-sel-search" type="text" autocomplete="off" placeholder="พิมพ์ชื่อลูกค้า หรือเลขบิล..."
          style="width:100%;box-sizing:border-box;background:var(--card);border:1.5px solid var(--bdr);border-radius:10px;padding:10px 12px;font-size:16px;color:var(--txt);outline:none;margin-bottom:10px;-webkit-appearance:none"
          oninput="StmtPage.searchBills(this.value)"/>
        <div id="stm-sel-member-info" style="display:none;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:var(--fs-xs)"></div>
        <div id="stm-sel-list" style="min-height:60px;max-height:38vh;overflow-y:auto;margin-bottom:12px">
          <div class="empty-state">กำลังโหลด...</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div id="stm-sel-count" style="font-size:var(--fs-xs);color:var(--muted)">เลือก 0 รายการ</div>
        </div>
        <button id="stm-sel-confirm" disabled onclick="StmtPage.confirmSelector()"
          style="width:100%;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer;opacity:0.4">ยืนยัน →</button>
      </div>
    `);

    App.api('/api/pos/statements/unpaid-bills?q=').then(data => {
      _unpaidBills = Array.isArray(data) ? data : [];
      _renderSelector();
    }).catch(() => {
      const el = document.getElementById('stm-sel-list');
      if (el) el.innerHTML = '<div class="empty-state">โหลดไม่สำเร็จ</div>';
    });
  }

  function _renderSelector() {
    const el = document.getElementById('stm-sel-list');
    if (!el) return;
    if (!_unpaidBills.length) { el.innerHTML = '<div class="empty-state">ไม่มีบิลค้างชำระ</div>'; return; }
    el.innerHTML = _unpaidBills.map(b => {
      const sel = _selectedBillIds.includes(String(b.id));
      const locked = _lockedCustomerId && b.customer_id && String(b.customer_id) !== String(_lockedCustomerId);
      return `<div onclick="${locked ? '' : `StmtPage.toggleBill('${b.id}')`}"
        style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid ${sel ? 'var(--gold)' : 'var(--bdr)'};border-radius:10px;margin-bottom:6px;cursor:${locked ? 'not-allowed' : 'pointer'};background:${sel ? 'var(--gold-a)' : 'var(--card)'};${locked ? 'opacity:.4' : ''}">
        <input type="checkbox" ${sel ? 'checked' : ''} ${locked ? 'disabled' : ''} onclick="event.stopPropagation()"
          style="accent-color:var(--gold);width:16px;height:16px;flex-shrink:0"/>
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--fs-xs);font-weight:700">${_esc(b.bill_no)}</div>
          <div style="font-size:10px;color:var(--muted)">${_esc(b.customer_name || '—')} · ${_fmtDate(b.created_at)}</div>
        </div>
        <div style="font-size:var(--fs-xs);font-weight:700;color:var(--gold);flex-shrink:0">฿${_fmt(b.total)}</div>
      </div>`;
    }).join('');
  }

  function _updateSelectorUI() {
    const cnt = document.getElementById('stm-sel-count');
    const btn = document.getElementById('stm-sel-confirm');
    if (cnt) cnt.textContent = 'เลือก ' + _selectedBillIds.length + ' รายการ';
    if (btn) { btn.disabled = !_selectedBillIds.length; btn.style.opacity = _selectedBillIds.length ? '1' : '0.4'; }
  }

  // ── CREATE FORM SHEET ──
  function _openCreateForm(selected) {
    const total = selected.reduce((s, b) => s + parseFloat(b.total || 0), 0);
    _stTotal = total; _stNet = total; _stDisc = 0; _stVat = 0;
    _stSelectedIds = selected.map(b => String(b.id));
    const firstBill = selected[0] || {};

    openSheet(`
      <div>
        <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:12px">สร้างใบวางบิล</div>

        ${firstBill.customer_name ? `
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px">
          <div style="font-weight:700">${_esc(firstBill.customer_name)}</div>
          ${firstBill.customer_code ? `<div style="font-size:var(--fs-xs);color:var(--muted)">รหัส: ${_esc(firstBill.customer_code)}</div>` : ''}
        </div>` : ''}

        <div style="margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:6px">บิลที่เลือก (${selected.length} รายการ)</div>
          ${selected.map(b => `
            <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);padding:4px 0;border-bottom:1px solid var(--bdr)">
              <span>${_esc(b.bill_no)} · ${_esc(b.customer_name || '—')}</span>
              <span style="font-weight:600">฿${_fmt(b.total)}</span>
            </div>`).join('')}
        </div>

        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:12px;margin-bottom:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div>
              <div style="font-size:10px;font-weight:600;margin-bottom:4px">ส่วนลด (บาท)</div>
              <input id="stm-cr-disc" type="number" value="0" oninput="StmtPage.calcCreate()"
                style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px;font-size:var(--fs-sm);color:var(--txt);outline:none"/>
            </div>
            <div>
              <div style="font-size:10px;font-weight:600;margin-bottom:4px">VAT (%)</div>
              <input id="stm-cr-vat" type="number" value="0" oninput="StmtPage.calcCreate()"
                style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px;font-size:var(--fs-sm);color:var(--txt);outline:none"/>
            </div>
          </div>
          <div style="margin-bottom:10px">
            <div style="font-size:10px;font-weight:600;margin-bottom:4px">ประเภท VAT</div>
            <select id="stm-cr-vat-type" onchange="StmtPage.calcCreate()"
              style="width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:9px;font-size:var(--fs-sm);color:var(--txt);outline:none">
              <option value="none">ไม่มี VAT</option>
              <option value="included">รวมในราคา</option>
              <option value="excluded">แยกจากราคา</option>
            </select>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);padding:2px 0"><span>ยอดรวม</span><span>฿${_fmt(total)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);padding:2px 0"><span>ส่วนลด</span><span id="stm-cr-s-disc">-฿0</span></div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);padding:2px 0"><span>VAT</span><span id="stm-cr-s-vat">฿0</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;padding:6px 0 0;border-top:1px solid var(--bdr);margin-top:4px">
            <span style="font-size:var(--fs-sm)">ยอดสุทธิ</span>
            <span id="stm-cr-s-net" style="font-size:var(--fs-sm);color:var(--gold)">฿${_fmt(total)}</span>
          </div>
        </div>

        <div style="margin-bottom:14px">
          <div style="font-size:10px;font-weight:600;margin-bottom:4px">วันกำหนดชำระ</div>
          <input id="stm-cr-due" type="date"
            style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:10px;font-size:var(--fs-sm);color:var(--txt);outline:none"/>
        </div>

        <button onclick="StmtPage.create()"
          style="width:100%;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">สร้างใบวางบิล</button>
      </div>
    `);
  }

  // ── SLIP UPLOAD (shared) ──
  async function _uploadSlip(id, fileInputId) {
    const slip = document.getElementById(fileInputId);
    if (!slip || !slip.files || !slip.files[0]) throw new Error('กรุณาแนบสลิป');
    const fd = new FormData();
    fd.append('file', slip.files[0]);
    const token = window.VIIV_TOKEN || localStorage.getItem('viiv_token') || '';
    const res = await fetch(`/api/pos/statements/upload-slip/${id}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd,
    }).then(r => r.json());
    if (!res || !res.slip_url) throw new Error('อัปโหลดสลิปไม่สำเร็จ');
    return res.slip_url;
  }

  // ── PRINT ──
  function _buildPrintHtml(s, bills, banks, store) {
    const fp = n => (parseFloat(n) || 0).toLocaleString('th', { minimumFractionDigits: 2 });
    const hp = v => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fd = ds => { if (!ds) return '-'; const d = new Date(ds); return isNaN(d) ? ds : d.toLocaleDateString('th', { day: '2-digit', month: 'short', year: 'numeric' }); };
    const first = bills[0] || {};
    const billRows = bills.map((b, i) => `<tr><td>${i + 1}</td><td>${hp(b.bill_no)}</td><td>${fd(b.created_at)}</td><td style="text-align:right">฿${fp(b.total)}</td></tr>`).join('');
    const bankRows = banks.map(bk => `<tr><td>${hp(bk.bank_name || '')}</td><td>${hp(bk.acc_no || '')}</td><td>${hp(bk.acc_name || '')}</td></tr>`).join('');
    const logoHtml = store.logo_url ? `<img src="${hp(store.logo_url)}" style="height:48px;margin-bottom:4px;display:block"/>` : '';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"/>
      <title>ใบวางบิล ${hp(s.run_id)}</title>
      <style>
        @page{size:A4;margin:15mm}
        @media print{.no-print{display:none}}
        body{font-family:'Sarabun',sans-serif;font-size:13px;color:#1f2937;margin:0}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th,td{border:1px solid #d1d5db;padding:6px 10px;font-size:12px}
        th{background:#f9fafb;font-weight:700;text-align:left}
        .hdr{display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:2px solid #e8b93e;padding-bottom:12px;margin-bottom:14px}
        .doc-title{font-size:20px;font-weight:700;margin-bottom:4px}
        .cust{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin:12px 0;font-size:12px}
        .totals{text-align:right;font-size:13px;margin:10px 0;line-height:2}
        .tot-final{font-weight:700;font-size:15px;color:#b45309}
        .sig{display:flex;justify-content:space-around;margin-top:60px}
        .sig-box{text-align:center;min-width:160px}
        .sig-line{border-top:1px solid #333;margin-bottom:6px}
      </style></head><body>
      <div class="hdr">
        <div>${logoHtml}<div style="font-size:16px;font-weight:700">${hp(store.store_name || store.name || '')}</div>${store.address ? '<div>' + hp(store.address) + '</div>' : ''}${store.phone ? '<div>☎ ' + hp(store.phone) + '</div>' : ''}${store.tax_id ? '<div>TAX ID: ' + hp(store.tax_id) + '</div>' : ''}</div>
        <div style="text-align:right"><div class="doc-title">ใบวางบิล / Statement</div><div>เลขที่: <b>${hp(s.run_id)}</b></div><div>วันที่: ${fd(s.created_at)}</div><div>กำหนดชำระ: <b>${fd(s.due_single)}</b></div></div>
      </div>
      <div class="cust"><div style="font-weight:700;margin-bottom:4px">ผู้รับใบวางบิล</div><div>ชื่อ: ${hp(first.customer_name || s.customer_name || '-')}</div>${first.customer_code || s.customer_code ? '<div>รหัส: ' + hp(first.customer_code || s.customer_code || '') + '</div>' : ''}</div>
      <table><thead><tr><th>#</th><th>เลขบิล</th><th>วันที่</th><th style="text-align:right">ยอด</th></tr></thead><tbody>${billRows}</tbody></table>
      <div class="totals"><div>ยอดรวม: ฿${fp(s.total_amt)}</div><div>ส่วนลด: -฿${fp(s.discount)}</div><div>VAT: ฿${fp(s.vat_amt)}</div><div class="tot-final">ยอดสุทธิ: ฿${fp(s.net_amt)}</div></div>
      ${bankRows ? '<table><thead><tr><th>ธนาคาร</th><th>เลขบัญชี</th><th>ชื่อบัญชี</th></tr></thead><tbody>' + bankRows + '</tbody></table>' : ''}
      <div class="sig"><div class="sig-box"><div class="sig-line">&nbsp;</div>ผู้วางบิล</div><div class="sig-box"><div class="sig-line">&nbsp;</div>ผู้รับ</div></div>
      </body></html>`;
  }

  // ── UTILS ──
  function _fmt(n) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function _fmtDate(s) { if (!s) return '-'; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString('th', { day: '2-digit', month: 'short', year: '2-digit' }); }
  function _isOverdue(s) { if (!s) return false; const d = new Date(s); d.setHours(0, 0, 0, 0); const t = new Date(); t.setHours(0, 0, 0, 0); return d < t; }
  function _toast(msg, color) {
    let el = document.getElementById('viiv-stmt-toast');
    if (!el) { el = document.createElement('div'); el.id = 'viiv-stmt-toast'; el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:8px 18px;border-radius:18px;font-size:12px;font-weight:600;z-index:99999;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.18)'; document.body.appendChild(el); }
    el.textContent = msg; el.style.background = color || '#1f2937'; el.style.color = '#fff'; el.style.display = 'block';
    clearTimeout(el._t); el._t = setTimeout(() => { el.style.display = 'none'; }, 2500);
  }

  // ── PUBLIC API ──
  window.StmtPage = {
    openDetail(id) { _openDetail(id); },
    openCreate() { _openSelector(); },

    setMode(mode, id) {
      _currentMode = mode;
      const extra = document.getElementById('stm-mode-extra');
      const s = _statements.find(x => x.id === id) || {};
      if (extra) extra.innerHTML = _modeHtml(mode, s);
      ['delivered', 'cheque', 'appointment'].forEach(m => {
        const btn = document.getElementById('stm-mode-' + m);
        if (!btn) return;
        const active = m === mode;
        btn.style.borderColor = active ? 'var(--gold)' : 'var(--bdr)';
        btn.style.background = active ? 'var(--gold-a)' : 'var(--card)';
        btn.style.color = active ? 'var(--gold-d)' : 'var(--txt)';
        btn.style.fontWeight = active ? '700' : '400';
      });
    },

    async save(id) {
      const payload = {};
      const stEl = document.getElementById('stm-status');
      if (stEl) payload.status = stEl.value;
      if (_currentMode === 'cheque') {
        payload.payment_method = 'cheque';
        payload.cheque_detail = {
          bank: (document.getElementById('stm-ch-bank') || {}).value || '',
          payee: ((document.getElementById('stm-ch-payee') || {}).value || '').trim(),
          payer: ((document.getElementById('stm-ch-payer') || {}).value || '').trim(),
          cheque_no: ((document.getElementById('stm-ch-no') || {}).value || '').trim(),
          due_date: (document.getElementById('stm-ch-due') || {}).value || '',
        };
      } else if (_currentMode === 'appointment') {
        payload.payment_method = 'appointment';
        const apptDt = document.getElementById('stm-appt-dt');
        if (apptDt && apptDt.value) payload.appointment_dt = apptDt.value;
        const apptNote = document.getElementById('stm-appt-note');
        if (apptNote && apptNote.value.trim()) payload.appointment_note = apptNote.value.trim();
        const negNote = document.getElementById('stm-neg-note');
        if (negNote && negNote.value.trim()) payload.negotiation_note = negNote.value.trim();
      } else {
        payload.payment_method = 'cash';
        const due = document.getElementById('stm-due');
        if (due && due.value) payload.due_single = due.value;
      }
      try {
        await App.api(`/api/pos/statements/record/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        _toast('บันทึกแล้ว', '#16a34a');
        closeSheet();
        _render();
      } catch (e) { _toast('ไม่สำเร็จ: ' + e.message, '#ef4444'); }
    },

    async deleteStmt(id, runId) {
      const s = _statements.find(x => x.id === id);
      if (s && s.status === 'paid') { _toast('ไม่สามารถลบใบวางบิลที่ชำระแล้ว', '#ef4444'); return; }
      if (!confirm('ยืนยันการลบใบวางบิล ' + (runId || '') + ' ?')) return;
      try {
        await App.api(`/api/pos/statements/${id}`, { method: 'DELETE' });
        _toast('ลบแล้ว', '#6b7280');
        closeSheet();
        _render();
      } catch (e) { _toast('ไม่สำเร็จ: ' + e.message, '#ef4444'); }
    },

    openPartial(id) {
      openSheet(`
        <div>
          <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:14px">💰 ชำระบางส่วน</div>
          <div style="margin-bottom:10px">
            <div style="font-size:10px;font-weight:600;margin-bottom:4px">ยอดที่ชำระ (บาท) *</div>
            <input id="stm-partial-amt" type="number" min="0.01" step="0.01" placeholder="0.00"
              style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:10px;font-size:var(--fs-sm);color:var(--txt);outline:none"/>
          </div>
          <div style="margin-bottom:14px">
            <div style="font-size:10px;font-weight:600;margin-bottom:4px">แนบสลิป *</div>
            <input id="stm-partial-slip" type="file" accept="image/*,.pdf" style="width:100%;font-size:var(--fs-xs)"/>
          </div>
          <button onclick="StmtPage.confirmPartial(${id})"
            style="width:100%;background:#2563eb;color:#fff;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">ยืนยันการชำระ</button>
        </div>
      `);
    },

    async confirmPartial(id) {
      const amt = parseFloat((document.getElementById('stm-partial-amt') || {}).value || 0);
      if (!amt || amt <= 0) { _toast('กรุณาระบุยอดที่ชำระ', '#ef4444'); return; }
      try {
        const slipUrl = await _uploadSlip(id, 'stm-partial-slip');
        await App.api(`/api/pos/statements/record/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ partial_amount: amt, slip_url: slipUrl, status: 'partial' }),
        });
        _toast('บันทึกการชำระบางส่วนแล้ว', '#16a34a');
        closeSheet();
        _render();
      } catch (e) { _toast(e.message, '#ef4444'); }
    },

    openPaid(id) {
      openSheet(`
        <div>
          <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:14px">✓ ชำระเงินแล้ว</div>
          <div style="margin-bottom:14px">
            <div style="font-size:10px;font-weight:600;margin-bottom:4px">แนบสลิป *</div>
            <input id="stm-paid-slip" type="file" accept="image/*,.pdf" style="width:100%;font-size:var(--fs-xs)"/>
          </div>
          <button onclick="StmtPage.confirmPaid(${id})"
            style="width:100%;background:#16a34a;color:#fff;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">ยืนยันการชำระ</button>
        </div>
      `);
    },

    async confirmPaid(id) {
      try {
        const slipUrl = await _uploadSlip(id, 'stm-paid-slip');
        await App.api(`/api/pos/statements/record/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ slip_url: slipUrl, status: 'paid' }),
        });
        _toast('บันทึกการชำระเงินแล้ว', '#16a34a');
        closeSheet();
        _render();
      } catch (e) { _toast(e.message, '#ef4444'); }
    },

    async printStmt(id) {
      const s = _statements.find(x => x.id === id);
      if (!s) return;
      try {
        const [store, banks, bills] = await Promise.all([
          App.api('/api/pos/store/info').catch(() => ({})),
          App.api('/api/pos/bank/list').catch(() => []),
          App.api(`/api/pos/statements/${id}/bills`).catch(() => []),
        ]);
        const w = window.open('', '_blank', 'width=820,height=960');
        if (!w) { _toast('กรุณาอนุญาต popup', '#ef4444'); return; }
        w.document.write(_buildPrintHtml(s, Array.isArray(bills) ? bills : [], Array.isArray(banks) ? banks : [], store));
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 800);
      } catch (e) { _toast('โหลดข้อมูลพิมพ์ไม่สำเร็จ', '#ef4444'); }
    },

    searchBills(q) {
      clearTimeout(_selectorTimer);
      const el = document.getElementById('stm-sel-list');
      if (el) el.innerHTML = '<div class="empty-state">กำลังค้นหา...</div>';
      _selectorTimer = setTimeout(() => {
        App.api('/api/pos/statements/unpaid-bills?q=' + encodeURIComponent(q || '')).then(data => {
          _unpaidBills = Array.isArray(data) ? data : [];
          _renderSelector();
        }).catch(() => {
          if (el) el.innerHTML = '<div class="empty-state">โหลดไม่สำเร็จ</div>';
        });
      }, 400);
    },

    toggleBill(idStr) {
      const bid = String(idStr);
      const idx = _selectedBillIds.indexOf(bid);
      if (idx >= 0) {
        _selectedBillIds.splice(idx, 1);
        if (!_selectedBillIds.length) {
          _lockedCustomerId = null;
          const si = document.getElementById('stm-sel-member-info');
          if (si) { si.style.display = 'none'; si.innerHTML = ''; }
        }
      } else {
        _selectedBillIds.push(bid);
        if (!_lockedCustomerId) {
          const b = _unpaidBills.find(x => String(x.id) === bid);
          if (b && b.customer_id) {
            _lockedCustomerId = String(b.customer_id);
            const si = document.getElementById('stm-sel-member-info');
            if (si) {
              si.innerHTML = `<div style="font-weight:700">${_esc(b.customer_name || '—')}</div>${b.customer_code ? '<div style="color:var(--muted)">รหัส: ' + _esc(b.customer_code) + '</div>' : ''}`;
              si.style.display = 'block';
            }
          }
        }
      }
      _updateSelectorUI();
      _renderSelector();
    },

    confirmSelector() {
      if (!_selectedBillIds.length) { _toast('กรุณาเลือกบิลอย่างน้อย 1 รายการ', '#ef4444'); return; }
      const selected = _unpaidBills.filter(b => _selectedBillIds.includes(String(b.id)));
      _openCreateForm(selected);
    },

    calcCreate() {
      const disc = parseFloat((document.getElementById('stm-cr-disc') || {}).value) || 0;
      const vr = parseFloat((document.getElementById('stm-cr-vat') || {}).value) || 0;
      const vt = (document.getElementById('stm-cr-vat-type') || {}).value || 'none';
      const after = Math.max(0, _stTotal - disc);
      let vat = 0, net = after;
      if (vr > 0 && vt === 'included') { vat = Math.round((after - after / (1 + vr / 100)) * 100) / 100; }
      else if (vr > 0 && vt === 'excluded') { vat = Math.round(after * vr / 100 * 100) / 100; net = after + vat; }
      const sD = document.getElementById('stm-cr-s-disc'); if (sD) sD.textContent = '-฿' + _fmt(disc);
      const sV = document.getElementById('stm-cr-s-vat'); if (sV) sV.textContent = '฿' + _fmt(vat);
      const sN = document.getElementById('stm-cr-s-net'); if (sN) sN.textContent = '฿' + _fmt(net);
      _stNet = net; _stVat = vat; _stDisc = disc;
    },

    async create() {
      if (_stNet <= 0) { _toast('ยอดสุทธิต้องมากกว่า 0', '#ef4444'); return; }
      const payload = {
        bill_ids: _stSelectedIds,
        total_amt: _stTotal,
        discount: _stDisc || 0,
        vat_amt: _stVat || 0,
        vat_type: (document.getElementById('stm-cr-vat-type') || {}).value || 'none',
        vat_rate: parseFloat((document.getElementById('stm-cr-vat') || {}).value) || 0,
        net_amt: _stNet || _stTotal,
        due_single: (document.getElementById('stm-cr-due') || {}).value || null,
      };
      try {
        const res = await App.api('/api/pos/statements/create', { method: 'POST', body: JSON.stringify(payload) });
        _toast('สร้างใบวางบิล ' + (res.run_id || '') + ' แล้ว', '#16a34a');
        closeSheet();
        _render();
      } catch (e) { _toast('ไม่สำเร็จ: ' + e.message, '#ef4444'); }
    },
  };
})();
