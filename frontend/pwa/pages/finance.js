/* VIIV PWA — finance.js (บัญชีการเงิน) */
(function() {
  let _destroyed = false;
  let _refreshHandler = null;
  let _tab = 'overview';
  let _selMonth = _curMonth();
  let _incomeAll = [];
  let _expenseAll = [];
  let _incMap = {};
  let _expMap = {};
  let _chart = null;
  let _incPayType = 'cash';
  let _expPayType = 'cash';

  const PAY = [
    {id:'cash',     label:'เงินสด', bg:'#dcfce7', color:'#166534'},
    {id:'transfer', label:'โอน',    bg:'#dbeafe', color:'#1e40af'},
    {id:'cheque',   label:'เช็ค',   bg:'#fef9c3', color:'#854d0e'},
  ];

  function _curMonth() {
    const d = new Date();
    return String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
  }

  Router.register('finance', {
    title: 'บัญชี',
    async load(params) {
      _destroyed = false;
      _tab = params?.tab || 'overview';
      _refreshHandler = () => _render();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _render();
    },
    destroy() {
      _destroyed = true;
      if (_chart) { try { _chart.destroy(); } catch {} _chart = null; }
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  async function _render() {
    const c = document.getElementById('page-container');
    c.innerHTML = _shell(_skeleton());
    if (_tab === 'overview') await _loadOverview();
    else if (_tab === 'income') await _loadIncome();
    else await _loadExpense();
  }

  function _shell(inner) {
    const tabs = [
      {id:'overview', icon:'📊', label:'ภาพรวม'},
      {id:'income',   icon:'💚', label:'รายรับ'},
      {id:'expense',  icon:'🔴', label:'รายจ่าย'},
    ];
    return `<div style="max-width:768px;margin:0 auto">
      <div style="display:flex;border-bottom:2px solid var(--bdr);background:var(--card);position:sticky;top:0;z-index:10">
        ${tabs.map(t => `<button onclick="FinancePage.switchTab('${t.id}')"
          style="flex:1;padding:11px 4px;border:none;background:none;font-size:11px;font-weight:700;cursor:pointer;
                 border-bottom:2px solid ${_tab===t.id?'var(--gold)':'transparent'};margin-bottom:-2px;
                 color:${_tab===t.id?'var(--gold)':'var(--muted)'};white-space:nowrap">
          ${t.icon} ${t.label}
        </button>`).join('')}
      </div>
      <div id="fin-content" style="padding:12px 14px 80px">${inner}</div>
    </div>`;
  }

  function _skeleton() {
    return Array(4).fill('<div class="skeleton-card" style="height:64px;margin-bottom:10px;border-radius:12px"></div>').join('');
  }

  // ─── TAB 1: OVERVIEW ──────────────────────────────────────────

  async function _loadOverview(month) {
    if (month) _selMonth = month;
    const cc = document.getElementById('fin-content');
    if (!cc) return;
    try {
      await _ensureChartJs();
      const data = await App.api('/api/pos/finance/summary?month=' + _selMonth);
      if (_destroyed) return;
      cc.innerHTML = _overviewHtml(data);
      _renderChart(data.daily || []);
    } catch(e) {
      if (_destroyed || !document.getElementById('fin-content')) return;
      document.getElementById('fin-content').innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + _esc(e.message) + '</div>';
    }
  }

  function _monthOpts() {
    const THAI = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const now = new Date();
    let html = '';
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
      const label = THAI[d.getMonth()] + ' ' + (d.getFullYear() + 543);
      html += `<option value="${val}"${val===_selMonth?' selected':''}>${label}</option>`;
    }
    return html;
  }

  function _overviewHtml(d) {
    const s = d.sales?.total || 0;
    const inc = d.income?.total || 0;
    const exp = d.expense?.total || 0;
    const net = d.net || 0;
    const tS = d.today?.sales || 0;
    const tI = d.today?.income || 0;
    const tE = d.today?.expense || 0;
    const tNet = tI - tE;

    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700">สรุปเดือน</div>
        <div style="position:relative">
          <select onchange="FinancePage.changeMonth(this.value)"
            style="appearance:none;-webkit-appearance:none;background:var(--card);border:1.5px solid var(--bdr);border-radius:20px;padding:7px 28px 7px 12px;color:var(--txt);font-size:12px;font-weight:600;outline:none;cursor:pointer">
            ${_monthOpts()}
          </select>
          <span style="position:absolute;right:9px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--gold);font-size:9px;font-weight:700">▾</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        ${_sCard('ยอดขายรวม', s, 'var(--gold)', '#fff9e6', '฿', String(d.sales?.count||0)+' บิล')}
        ${_sCard('ต้นทุนรวม', exp, '#dc2626', '#fee2e2', '฿', String(d.expense?.count||0)+' รายการ')}
        ${_sCard('กำไรสุทธิ', net, net>=0?'#166534':'#dc2626', net>=0?'#dcfce7':'#fff0f0', '฿', '')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="background:var(--card);border:1.5px solid var(--bdr);border-left:4px solid #16a34a;border-radius:12px;padding:12px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px">รายรับรวม</div>
          <div style="font-size:18px;font-weight:700;color:#16a34a">+฿${_fmt(inc)}</div>
          <div style="font-size:10px;color:var(--muted)">${d.income?.count||0} รายการ</div>
        </div>
        <div style="background:var(--card);border:1.5px solid var(--bdr);border-left:4px solid #dc2626;border-radius:12px;padding:12px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px">รายจ่ายรวม</div>
          <div style="font-size:18px;font-weight:700;color:#dc2626">-฿${_fmt(exp)}</div>
          <div style="font-size:10px;color:var(--muted)">${d.expense?.count||0} รายการ</div>
        </div>
      </div>

      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:12px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;margin-bottom:10px">กราฟรายรับ-รายจ่ายรายวัน</div>
        <canvas id="fin-chart" height="160"></canvas>
      </div>

      <div style="font-size:12px;font-weight:700;margin-bottom:8px">สรุปวันนี้</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        ${_sCard('รายรับวันนี้', tI, '#16a34a', '#dcfce7', '฿', '')}
        ${_sCard('รายจ่ายวันนี้', tE, '#dc2626', '#fee2e2', '฿', '')}
        ${_sCard('คงเหลือสุทธิ', tNet, tNet>=0?'#16a34a':'#dc2626', tNet>=0?'#dcfce7':'#fee2e2', '฿', '')}
      </div>`;
  }

  function _sCard(label, val, color, bg, prefix, sub) {
    return `<div style="background:${bg};border:1px solid ${color}44;border-radius:12px;padding:10px 8px">
      <div style="font-size:9px;color:var(--muted);margin-bottom:3px">${label}</div>
      <div style="font-size:14px;font-weight:700;color:${color}">${prefix}${_fmt(val)}</div>
      ${sub?'<div style="font-size:9px;color:'+color+';opacity:.7;margin-top:2px">'+sub+'</div>':''}
    </div>`;
  }

  async function _ensureChartJs() {
    if (window.Chart) return;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function _renderChart(daily) {
    const canvas = document.getElementById('fin-chart');
    if (!canvas || !window.Chart) return;
    if (_chart) { try { _chart.destroy(); } catch {} _chart = null; }
    _chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: daily.map(d => { const dt = new Date(d.date); return (dt.getDate())+'/'+(dt.getMonth()+1); }),
        datasets: [
          {label:'รายรับ',  data: daily.map(d => d.income||0),  backgroundColor:'rgba(22,163,74,.75)',  borderRadius:4},
          {label:'รายจ่าย', data: daily.map(d => d.expense||0), backgroundColor:'rgba(220,38,38,.75)',  borderRadius:4},
        ]
      },
      options: {
        responsive:true,
        plugins:{legend:{labels:{font:{size:11}}}},
        scales:{
          x:{ticks:{font:{size:10}}},
          y:{ticks:{font:{size:10}, callback: v => '฿'+Number(v).toLocaleString('th-TH')}}
        }
      }
    });
  }

  // ─── TAB 2: INCOME ────────────────────────────────────────────

  async function _loadIncome(q) {
    const cc = document.getElementById('fin-content');
    if (!cc) return;
    cc.innerHTML = _incomeShell(_skeleton());
    _bindSearch('inc-search', v => _loadIncome(v));
    try {
      const data = await App.api('/api/pos/finance/income?limit=100' + (q ? '&q='+encodeURIComponent(q) : ''));
      if (_destroyed) return;
      _incomeAll = data.income || [];
      _incMap = {};
      _incomeAll.forEach(r => { _incMap[r.id] = r; });
      const el = document.getElementById('inc-list');
      if (el) el.innerHTML = _incomeAll.length
        ? _incomeAll.map(r => _incomeRow(r)).join('')
        : '<div class="empty-state">ยังไม่มีรายรับ</div>';
    } catch(e) {
      if (_destroyed) return;
      const el = document.getElementById('inc-list');
      if (el) el.innerHTML = '<div class="empty-state">โหลดไม่ได้: '+_esc(e.message)+'</div>';
    }
  }

  function _incomeShell(inner) {
    return `<div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
        <input id="inc-search" type="search" autocomplete="off" placeholder="🔍 ค้นหารายรับ..."
          style="flex:1;background:var(--card);border:1.5px solid var(--bdr);border-radius:20px;padding:9px 14px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
        <button onclick="FinancePage.openAddIncome()"
          style="flex-shrink:0;background:var(--gold);color:#000;border:none;border-radius:20px;padding:9px 16px;font-size:var(--fs-sm);font-weight:700;cursor:pointer;white-space:nowrap">
          + เพิ่ม
        </button>
      </div>
      <div id="inc-list">${inner}</div>
    </div>`;
  }

  function _incomeRow(r) {
    const pt = PAY.find(x => x.id === r.pay_type) || PAY[0];
    const dt = r.txn_at ? new Date(r.txn_at).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
    return `<div class="list-item" style="margin-bottom:8px;border-radius:12px;border:1px solid var(--bdr);background:var(--card)"
        onclick="FinancePage.openIncomeDetail('${_esc(r.id)}')">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:var(--fs-sm)">${_esc(r.source||'—')}</span>
          <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;background:${pt.bg};color:${pt.color}">${pt.label}</span>
        </div>
        <div style="font-size:11px;color:var(--muted)">${dt}${r.noted_by?' · '+_esc(r.noted_by):''}</div>
      </div>
      <div style="font-size:16px;font-weight:700;color:#16a34a;flex-shrink:0;padding-left:8px">+฿${_fmt(r.amount||0)}</div>
    </div>`;
  }

  // ─── TAB 3: EXPENSE ───────────────────────────────────────────

  async function _loadExpense(q) {
    const cc = document.getElementById('fin-content');
    if (!cc) return;
    cc.innerHTML = _expenseShell(_skeleton());
    _bindSearch('exp-search', v => _loadExpense(v));
    try {
      const data = await App.api('/api/pos/finance/expense?limit=100' + (q ? '&q='+encodeURIComponent(q) : ''));
      if (_destroyed) return;
      _expenseAll = data.expense || [];
      _expMap = {};
      _expenseAll.forEach(r => { _expMap[r.id] = r; });
      const el = document.getElementById('exp-list');
      if (el) el.innerHTML = _expenseAll.length
        ? _expenseAll.map(r => _expenseRow(r)).join('')
        : '<div class="empty-state">ยังไม่มีรายจ่าย</div>';
    } catch(e) {
      if (_destroyed) return;
      const el = document.getElementById('exp-list');
      if (el) el.innerHTML = '<div class="empty-state">โหลดไม่ได้: '+_esc(e.message)+'</div>';
    }
  }

  function _expenseShell(inner) {
    return `<div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
        <input id="exp-search" type="search" autocomplete="off" placeholder="🔍 ค้นหารายจ่าย..."
          style="flex:1;background:var(--card);border:1.5px solid var(--bdr);border-radius:20px;padding:9px 14px;color:var(--txt);font-size:var(--fs-sm);outline:none"/>
        <button onclick="FinancePage.openAddExpense()"
          style="flex-shrink:0;background:#dc2626;color:#fff;border:none;border-radius:20px;padding:9px 16px;font-size:var(--fs-sm);font-weight:700;cursor:pointer;white-space:nowrap">
          + เพิ่ม
        </button>
      </div>
      <div id="exp-list">${inner}</div>
    </div>`;
  }

  function _expenseRow(r) {
    const pt = PAY.find(x => x.id === r.pay_type) || PAY[0];
    const dt = r.txn_at ? new Date(r.txn_at).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
    const name = r.partner_name || r.source || '—';
    return `<div class="list-item" style="margin-bottom:8px;border-radius:12px;border:1px solid var(--bdr);background:var(--card)"
        onclick="FinancePage.openExpenseDetail('${_esc(r.id)}')">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:var(--fs-sm)">${_esc(name)}</span>
          <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;background:${pt.bg};color:${pt.color}">${pt.label}</span>
        </div>
        <div style="font-size:11px;color:var(--muted)">${dt}${r.noted_by?' · '+_esc(r.noted_by):''}</div>
      </div>
      <div style="font-size:16px;font-weight:700;color:#dc2626;flex-shrink:0;padding-left:8px">-฿${_fmt(r.amount||0)}</div>
    </div>`;
  }

  // ─── SHARED HELPERS ───────────────────────────────────────────

  function _bindSearch(id, fn) {
    setTimeout(() => {
      const inp = document.getElementById(id);
      if (!inp) return;
      let tm = null;
      inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => fn(inp.value.trim()), 400); });
    }, 50);
  }

  function _dtNow() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0,16);
  }

  function _payToggleHtml(prefix, cur) {
    return `<div style="display:flex;gap:6px">` + PAY.map(pt =>
      `<button type="button" onclick="FinancePage.setPay('${prefix}','${pt.id}')"
        id="pt-${prefix}-${pt.id}"
        style="flex:1;padding:9px 4px;border-radius:10px;border:2px solid ${cur===pt.id?pt.color:'var(--bdr)'};
               background:${cur===pt.id?pt.bg:'var(--card)'};color:${cur===pt.id?pt.color:'var(--muted)'};
               font-size:11px;font-weight:700;cursor:pointer">${pt.label}</button>`
    ).join('') + `</div>`;
  }

  const _IS = 'width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--bdr);border-radius:10px;padding:10px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none;margin-top:6px';

  async function _uploadSlip(entryType, fid, file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/pos/finance/upload-slip/' + entryType + '/' + fid, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('viiv_token')||'') },
      body: fd
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  function _detailHtml(r, type) {
    const pt = PAY.find(x => x.id === r.pay_type) || PAY[0];
    const dt = r.txn_at ? new Date(r.txn_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}) : '';
    const name = type === 'expense' ? (r.partner_name || r.source || '—') : (r.source || '—');
    const amtColor = type === 'income' ? '#16a34a' : '#dc2626';
    const amtSign  = type === 'income' ? '+' : '-';
    const delFn    = type === 'income' ? 'FinancePage.deleteIncome' : 'FinancePage.deleteExpense';
    let html = '<div style="padding:4px 0 16px">';
    html += '<div style="font-size:15px;font-weight:700;margin-bottom:14px">รายละเอียด' + (type==='income'?'รายรับ':'รายจ่าย') + '</div>';
    html += '<div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:14px">';
    html += '<div style="font-size:22px;font-weight:700;color:' + amtColor + ';margin-bottom:6px">' + amtSign + '฿' + _fmt(r.amount||0) + '</div>';
    html += '<div style="font-size:14px;font-weight:700;margin-bottom:6px">' + _esc(name) + '</div>';
    html += '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;background:' + pt.bg + ';color:' + pt.color + '">' + pt.label + '</span>';
    if (dt) html += '<div style="font-size:11px;color:var(--muted);margin-top:8px">🕐 ' + dt + '</div>';
    if (r.noted_by) html += '<div style="font-size:11px;color:var(--muted);margin-top:4px">👤 ' + _esc(r.noted_by) + '</div>';
    if (r.slip_url) {
      html += '<div style="margin-top:10px"><img src="' + _esc(r.slip_url) + '" onclick="window._viewPhoto(\'' + _esc(r.slip_url) + '\')"' +
              ' style="max-width:100%;border-radius:8px;border:1px solid var(--bdr);cursor:pointer"/></div>';
    }
    html += '</div>';
    html += '<button onclick="' + delFn + '(\'' + r.id + '\')" style="width:100%;background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;border-radius:12px;padding:12px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">🗑 ลบรายการนี้</button>';
    html += '</div>';
    return html;
  }

  // ─── EXPOSED ──────────────────────────────────────────────────

  window.FinancePage = {
    switchTab(tab) {
      _tab = tab;
      const c = document.getElementById('page-container');
      if (!c) return;
      c.innerHTML = _shell(_skeleton());
      if (tab === 'overview') _loadOverview();
      else if (tab === 'income') _loadIncome();
      else _loadExpense();
    },

    changeMonth(val) { _loadOverview(val); },

    setPay(prefix, val) {
      if (prefix === 'inc') _incPayType = val;
      else _expPayType = val;
      PAY.forEach(pt => {
        const btn = document.getElementById('pt-' + prefix + '-' + pt.id);
        if (!btn) return;
        const active = pt.id === val;
        btn.style.border = '2px solid ' + (active ? pt.color : 'var(--bdr)');
        btn.style.background = active ? pt.bg : 'var(--card)';
        btn.style.color = active ? pt.color : 'var(--muted)';
      });
    },

    // ── ADD INCOME ──
    openAddIncome() {
      _incPayType = 'cash';
      openSheet(`<div style="padding:4px 0 16px">
        <div style="font-size:15px;font-weight:700;margin-bottom:14px">+ เพิ่มรายรับ</div>
        <label style="font-size:11px;color:var(--muted)">แหล่งรายได้</label>
        <input id="inc-src" type="text" placeholder="ค่าบริการ / เงินสด / อื่นๆ" style="${_IS}"/>
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px;margin-bottom:6px">ชนิดการชำระ</label>
        ${_payToggleHtml('inc', _incPayType)}
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px">รูปภาพบิล</label>
        <input id="inc-file" type="file" accept="image/*,.pdf" style="${_IS}"/>
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px">จำนวนเงิน (฿)</label>
        <input id="inc-amt" type="number" min="0" step="0.01" placeholder="0.00" style="${_IS}"/>
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px">วันและเวลา</label>
        <input id="inc-at" type="datetime-local" value="${_dtNow()}" style="${_IS}"/>
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px">ผู้รับ</label>
        <input id="inc-nb" type="text" placeholder="ชื่อผู้รับ" style="${_IS}"/>
        <button onclick="FinancePage.saveIncome()"
          style="width:100%;margin-top:16px;background:var(--gold);color:#000;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          บันทึกรายรับ
        </button>
      </div>`);
    },

    async saveIncome() {
      const source = (document.getElementById('inc-src')?.value||'').trim();
      const amount = parseFloat(document.getElementById('inc-amt')?.value||'0');
      const atVal  = document.getElementById('inc-at')?.value||'';
      const nb     = (document.getElementById('inc-nb')?.value||'').trim();
      const fileEl = document.getElementById('inc-file');
      if (amount <= 0) { App.toast('❌ กรุณาระบุจำนวนเงิน'); return; }
      const btn = document.querySelector('[onclick="FinancePage.saveIncome()"]');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        const body = { source, pay_type: _incPayType, amount, noted_by: nb };
        if (atVal) body.txn_at = new Date(atVal).toISOString();
        const res = await App.api('/api/pos/finance/income', { method:'POST', body: JSON.stringify(body) });
        if (fileEl?.files?.[0]) { try { await _uploadSlip('income', res.id, fileEl.files[0]); } catch {} }
        closeSheet();
        App.toast('✅ บันทึกรายรับสำเร็จ');
        await _loadIncome();
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'บันทึกรายรับ'; }
      }
    },

    openIncomeDetail(id) {
      const r = _incMap[id];
      if (!r) return;
      openSheet(_detailHtml(r, 'income'));
    },

    async deleteIncome(id) {
      if (!confirm('ยืนยันลบรายรับนี้?')) return;
      try {
        await App.api('/api/pos/finance/income/' + id, { method:'DELETE' });
        closeSheet(); App.toast('✅ ลบสำเร็จ');
        await _loadIncome();
      } catch(e) { App.toast('❌ ' + e.message); }
    },

    // ── ADD EXPENSE ──
    openAddExpense() {
      _expPayType = 'cash';
      openSheet(`<div style="padding:4px 0 16px">
        <div style="font-size:15px;font-weight:700;margin-bottom:14px">+ เพิ่มรายจ่าย</div>
        <label style="font-size:11px;color:var(--muted)">คู่ค้า / แหล่งรายจ่าย <span style="color:#dc2626">*</span></label>
        <input id="exp-src" type="text" placeholder="ชื่อคู่ค้า / รายการจ่าย" style="${_IS}"/>
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px;margin-bottom:6px">ชนิดการชำระ</label>
        ${_payToggleHtml('exp', _expPayType)}
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px">รูปภาพบิล <span style="color:#dc2626">*</span></label>
        <input id="exp-file" type="file" accept="image/*,.pdf" style="${_IS}"/>
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px">จำนวนเงิน (฿)</label>
        <input id="exp-amt" type="number" min="0" step="0.01" placeholder="0.00" style="${_IS}"/>
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px">วันและเวลา</label>
        <input id="exp-at" type="datetime-local" value="${_dtNow()}" style="${_IS}"/>
        <label style="font-size:11px;color:var(--muted);display:block;margin-top:12px">ผู้ส่งจ่าย</label>
        <input id="exp-nb" type="text" placeholder="ชื่อผู้ส่งจ่าย" style="${_IS}"/>
        <button onclick="FinancePage.saveExpense()"
          style="width:100%;margin-top:16px;background:#dc2626;color:#fff;border:none;border-radius:12px;padding:13px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          บันทึกรายจ่าย
        </button>
      </div>`);
    },

    async saveExpense() {
      const source = (document.getElementById('exp-src')?.value||'').trim();
      const amount = parseFloat(document.getElementById('exp-amt')?.value||'0');
      const atVal  = document.getElementById('exp-at')?.value||'';
      const nb     = (document.getElementById('exp-nb')?.value||'').trim();
      const fileEl = document.getElementById('exp-file');
      if (!source) { App.toast('❌ กรุณาระบุคู่ค้า/แหล่งรายจ่าย'); return; }
      if (amount <= 0) { App.toast('❌ กรุณาระบุจำนวนเงิน'); return; }
      if (!fileEl?.files?.[0]) { App.toast('❌ กรุณาแนบรูปภาพบิล'); return; }
      const btn = document.querySelector('[onclick="FinancePage.saveExpense()"]');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      try {
        const body = { source, pay_type: _expPayType, amount, noted_by: nb };
        if (atVal) body.txn_at = new Date(atVal).toISOString();
        const res = await App.api('/api/pos/finance/expense', { method:'POST', body: JSON.stringify(body) });
        try { await _uploadSlip('expense', res.id, fileEl.files[0]); } catch {}
        closeSheet(); App.toast('✅ บันทึกรายจ่ายสำเร็จ');
        await _loadExpense();
      } catch(e) {
        App.toast('❌ ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'บันทึกรายจ่าย'; }
      }
    },

    openExpenseDetail(id) {
      const r = _expMap[id];
      if (!r) return;
      openSheet(_detailHtml(r, 'expense'));
    },

    async deleteExpense(id) {
      if (!confirm('ยืนยันลบรายจ่ายนี้?')) return;
      try {
        await App.api('/api/pos/finance/expense/' + id, { method:'DELETE' });
        closeSheet(); App.toast('✅ ลบสำเร็จ');
        await _loadExpense();
      } catch(e) { App.toast('❌ ' + e.message); }
    },
  };

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
