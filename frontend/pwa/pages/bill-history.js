/* VIIV PWA — bill-history.js (ประวัติบิลที่ถูกลบ) */
(function() {
  let _bills = [];

  Router.register('bill-history', {
    title: 'ประวัติบิล (ถูกลบ)',
    load: async function(_params) {
      const c = document.getElementById('page-container');
      c.innerHTML = `<div id="bhist-root" style="max-width:768px;margin:0 auto;padding:0 0 80px">
        <div id="bhist-list" style="padding:0 14px;padding-top:8px">
          <div style="padding-top:40px;text-align:center;color:var(--muted);font-size:var(--fs-sm)">กำลังโหลด...</div>
        </div>
      </div>`;
      await _load();
    },
    destroy: function() {
      _bills = [];
    }
  });

  async function _load() {
    const el = document.getElementById('bhist-list');
    if (!el) return;
    try {
      const data = await App.api('/api/pos/bills/deleted');
      _bills = data.deleted_bills || [];
      el.innerHTML = _bills.length === 0
        ? '<div style="padding-top:40px;text-align:center;color:var(--muted);font-size:var(--fs-sm)">ไม่มีประวัติบิลที่ถูกลบ</div>'
        : _bills.map(_cardHtml).join('');
    } catch(e) {
      el.innerHTML = `<div style="padding-top:40px;text-align:center;color:var(--muted);font-size:var(--fs-sm)">โหลดไม่ได้: ${_esc(e.message)}</div>`;
    }
  }

  function _cardHtml(b) {
    const voidType = b.void_type || '';
    const typeLabel = voidType.includes('with_stock') ? '📦 ลบ+คืนสต็อก' : '🗑 ลบบิล';

    const raw = b.void_reason || '';
    const m = raw.match(/^\[(.+?)\|(.+?)\]\s*([\s\S]*)/);
    const deleterInfo = m ? `${m[1]} (${m[2]})` : '';
    const cleanReason = m ? (m[3] || '-') : (raw || '-');

    const items = (() => { try { return JSON.parse(b.items || '[]'); } catch { return []; } })();

    return `<div style="background:var(--card);border:1px solid #fca5a5;border-radius:14px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:var(--fs-sm);font-weight:700;color:var(--txt)">${_esc(b.bill_no)}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">${_esc(b.doc_type||'')} · ลบ ${App.fmtDate(b.voided_at)}</div>
        </div>
        <span style="font-size:var(--fs-xs);background:#fee2e2;color:#991b1b;padding:3px 8px;border-radius:999px;font-weight:600;white-space:nowrap">${typeLabel}</span>
      </div>
      ${b.customer_name ? `<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:3px">ลูกค้า: <span style="color:var(--txt)">${_esc(b.customer_name)}</span></div>` : ''}
      <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:3px">
        ยอด: <span style="color:var(--txt);font-weight:600">฿${Number(b.total||0).toLocaleString()}</span>
        <span style="margin-left:10px">สร้าง: <span style="color:var(--txt)">${App.fmtDate(b.created_at)}</span></span>
      </div>
      ${deleterInfo ? `<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:3px">ลบโดย: <span style="color:var(--txt)">${_esc(deleterInfo)}</span></div>` : ''}
      <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:${items.length > 0 ? '8' : '0'}px">เหตุผล: <span style="color:var(--txt)">${_esc(cleanReason)}</span></div>
      ${items.length > 0 ? `<div style="border-top:1px solid var(--bdr);padding-top:8px;margin-top:4px">
        <div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:4px">รายการสินค้า:</div>
        ${items.slice(0,5).map(it => `<div style="font-size:var(--fs-xs);color:var(--txt);margin-bottom:2px">${_esc(it.name||'')} ×${it.qty} = ฿${((it.qty||0)*(it.price||0)).toLocaleString()}</div>`).join('')}
        ${items.length > 5 ? `<div style="font-size:var(--fs-xs);color:var(--muted)">และอีก ${items.length-5} รายการ</div>` : ''}
      </div>` : ''}
    </div>`;
  }

  function _esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.BillHistoryPage = {};
})();
