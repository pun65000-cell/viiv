(function() {
  let _destroyed = false;
  let _tab = 'today';
  let _bills = [];

  Router.register('sales', {
    title: 'ยอดขาย',
    async load(params) {
      _destroyed = false;
      _tab = params?.tab || 'today';
      await _reload();
    },
    destroy() { _destroyed = true; }
  });

  async function _reload() {
    const c = document.getElementById('page-container');
    c.innerHTML = `<div style="max-width:768px;margin:0 auto">
      <div style="display:flex;border-bottom:2px solid var(--bdr)">
        ${['today','month','all'].map(t => `
        <button onclick="SalesPage.switchTab('${t}')" id="stab-${t}"
          style="flex:1;padding:13px 0;border:none;background:none;font-size:var(--fs-sm);font-weight:700;cursor:pointer;
                 font-family:inherit;letter-spacing:.2px;
                 border-bottom:2px solid ${_tab===t?'var(--gold)':'transparent'};margin-bottom:-2px;
                 color:${_tab===t?'var(--gold)':'var(--muted)'}">
          ${{today:'วันนี้',month:'เดือนนี้',all:'ทั้งหมด'}[t]}
        </button>`).join('')}
      </div>
      <div id="sales-summary" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:14px"></div>
      <div id="sales-list" style="padding:0 14px 80px">
        ${Array(5).fill('<div class="list-item skeleton-card" style="height:72px;margin-bottom:8px"></div>').join('')}
      </div>
    </div>`;
    await _loadBills();
  }

  async function _loadBills() {
    try {
      const data = await App.api('/api/pos/bills/list?status=paid&limit=500');
      if (_destroyed) return;
      _bills = Array.isArray(data) ? data : [];
      _render();
    } catch(e) {
      if (_destroyed) return;
      document.getElementById('sales-list').innerHTML = `<div class="empty-state">โหลดไม่ได้: ${e.message}</div>`;
    }
  }

  function _filter() {
    const now = new Date();
    const today = now.toISOString().slice(0,10);
    const month = now.toISOString().slice(0,7);
    if (_tab === 'today') return _bills.filter(b => (b.created_at||'').startsWith(today));
    if (_tab === 'month') return _bills.filter(b => (b.created_at||'').startsWith(month));
    return _bills;
  }

  function _render() {
    const list = _filter();
    const total = list.reduce((s,b) => s+(b.total||0), 0);
    const count = list.length;
    const avg = count ? total/count : 0;
    const payMap = {};
    list.forEach(b => { payMap[b.pay_method] = (payMap[b.pay_method]||0)+(b.total||0); });
    const payRows = Object.entries(payMap).map(([k,v]) =>
      `<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-top:4px">
        <span style="color:var(--muted)">${_fmtPay(k)}</span>
        <span style="font-weight:700">฿${_fmt(v)}</span>
      </div>`).join('') || `<div style="font-size:var(--fs-xs);color:var(--muted);margin-top:4px">ไม่มีข้อมูล</div>`;

    document.getElementById('sales-summary').innerHTML = `
      <div class="list-item" style="flex-direction:column;align-items:flex-start;gap:4px;padding:12px">
        <div style="font-size:var(--fs-xs);color:var(--muted)">ยอดขายรวม</div>
        <div style="font-size:1.3rem;font-weight:700;color:var(--gold)">฿${_fmt(total)}</div>
        <div style="font-size:var(--fs-xs);color:var(--muted)">${count} บิล</div>
      </div>
      <div class="list-item" style="flex-direction:column;align-items:flex-start;gap:4px;padding:12px">
        <div style="font-size:var(--fs-xs);color:var(--muted)">เฉลี่ย/บิล</div>
        <div style="font-size:1.3rem;font-weight:700">฿${_fmt(avg)}</div>
      </div>
      <div class="list-item" style="flex-direction:column;align-items:flex-start;gap:4px;padding:12px;grid-column:span 2">
        <div style="font-size:var(--fs-xs);color:var(--muted)">แยกตามช่องทางชำระ</div>
        ${payRows}
      </div>`;

    if (!list.length) {
      document.getElementById('sales-list').innerHTML = '<div class="empty-state">ไม่มีข้อมูลยอดขาย</div>';
      return;
    }
    const sorted = [...list].sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
    document.getElementById('sales-list').innerHTML = sorted.map(b => {
      const items = (b.items||[]).map(i=>i.name).join(', ');
      return `<div class="list-item" style="align-items:flex-start;gap:10px;margin-bottom:8px">
        <div class="li-left">
          <div class="li-title">${_esc(b.bill_no||b.id)}</div>
          <div class="li-sub">${_esc(b.customer_name||'ลูกค้าทั่วไป')} · ${_fmtPay(b.pay_method)}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted);margin-top:2px">${_esc(items||'—')}</div>
        </div>
        <div class="li-right" style="align-items:flex-end">
          <div style="font-weight:700;color:var(--gold)">฿${_fmt(b.total)}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">${App.fmtDate(b.created_at)}</div>
        </div>
      </div>`;
    }).join('');
  }

  window.SalesPage = {
    switchTab(tab) {
      _tab = tab;
      ['today','month','all'].forEach(t => {
        const btn = document.getElementById('stab-'+t);
        if (!btn) return;
        btn.style.borderBottomColor = t===tab ? 'var(--gold)' : 'transparent';
        btn.style.color = t===tab ? 'var(--gold)' : 'var(--muted)';
      });
      _render();
    }
  };

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _fmtPay(p) { return {cash:'เงินสด',transfer:'โอน',credit_card:'บัตรเครดิต',cod:'COD',cheque:'เช็ค'}[p]||p||'—'; }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
