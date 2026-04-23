/* VIIV PWA — affiliate.js */
(function(){
  let _destroyed = false;
  let _refreshHandler = null;
  let _products = [];
  let _editId = null;
  let _imgs = [], _vids = [], _opts = [];
  let _tab = 'all';

  Router.register('affiliate', {
    title: 'Affiliate',
    async load() {
      _destroyed = false;
      _refreshHandler = () => _loadList();
      document.addEventListener('viiv:refresh', _refreshHandler);
      await _loadList();
    },
    destroy() {
      _destroyed = true;
      if (_refreshHandler) { document.removeEventListener('viiv:refresh', _refreshHandler); _refreshHandler = null; }
    }
  });

  // ── LOAD ─────────────────────────────────────────────────────────────
  async function _loadList() {
    const c = document.getElementById('page-container');
    c.innerHTML = _skeleton();
    try {
      _products = await App.api('/api/pos/affiliate/list') || [];
    } catch(e) { _products = []; }
    if (_destroyed) return;
    _renderShell(c);
    _renderTab();
  }

  // ── SHELL ─────────────────────────────────────────────────────────────
  function _renderShell(c) {
    const active = _products.filter(p => p.status === 'active').length;
    const clicks = _products.reduce((s, p) => s + (p.click_count || 0), 0);
    const income = _products.reduce((s, p) => s + (p.click_count || 0) * parseFloat(p.commission || 0), 0);

    c.innerHTML = `<div class="sb-wrap">

      <!-- STATS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div class="card" style="text-align:center;padding:12px 8px">
          <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${_products.length}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">สินค้าทั้งหมด</div>
        </div>
        <div class="card" style="text-align:center;padding:12px 8px">
          <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${active}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">จำหน่ายอยู่</div>
        </div>
        <div class="card" style="text-align:center;padding:12px 8px">
          <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${clicks.toLocaleString()}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">คลิกรวม</div>
        </div>
        <div class="card" style="background:linear-gradient(135deg,var(--card),#fef9ee);border:1.5px solid var(--gold);text-align:center;padding:12px 8px">
          <div style="font-size:1.3rem;font-weight:700;color:#22c55e">฿${income.toLocaleString('th-TH',{maximumFractionDigits:0})}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">รายได้โดยประมาณ</div>
        </div>
      </div>

      <!-- TABS -->
      <div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px">
        <button class="aff-tab ${_tab==='all'?'aff-tab-active':''}" onclick="AffPage.tab('all')">ทั้งหมด</button>
        <button class="aff-tab ${_tab==='store'?'aff-tab-active':''}" onclick="AffPage.tab('store')">สโตร์</button>
        <button class="aff-tab ${_tab==='trend'?'aff-tab-active':''}" onclick="AffPage.tab('trend')">เทรน</button>
      </div>

      <!-- ADD BTN -->
      <button class="btn btn-primary" style="width:100%;margin-bottom:14px" onclick="AffPage.showCreate()">+ สร้างสินค้า Affiliate</button>

      <!-- CONTENT -->
      <div id="aff-content"></div>
      <div style="height:24px"></div>
    </div>`;
  }

  function _renderTab() {
    if (_tab === 'all') _renderAll();
    else if (_tab === 'store') _renderStore();
    else if (_tab === 'trend') _renderTrend();
  }

  // ── ALL ───────────────────────────────────────────────────────────────
  function _renderAll() {
    const el = document.getElementById('aff-content');
    if (!el) return;
    if (!_products.length) {
      el.innerHTML = '<div class="empty-state">ยังไม่มีสินค้า Affiliate<br><small>กด "+ สร้างสินค้า" เพื่อเริ่มต้น</small></div>';
      return;
    }
    el.innerHTML = _products.map(p => {
      const img = (p.images||[])[0];
      const st = p.status === 'active';
      return `<div class="list-item" onclick="AffPage.edit('${_esc(p.id)}')">
        ${img
          ? `<img src="${_esc(img)}" style="width:52px;height:52px;object-fit:cover;border-radius:9px;flex-shrink:0;">`
          : `<div style="width:52px;height:52px;background:var(--card);border:1px solid var(--bdr);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">🔗</div>`}
        <div class="li-left">
          <div class="li-title">${_esc(p.title)}</div>
          <div class="li-sub" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.aff_url)}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">
            <span class="tag ${st?'tag-green':'tag-red'}">${st?'จำหน่าย':'หยุดขาย'}</span>
            <span style="font-size:var(--fs-xs);color:var(--muted)">฿${_fmt(p.price)}</span>
            <span style="font-size:var(--fs-xs);color:var(--gold);font-weight:600">คลิก: ${p.click_count||0}</span>
          </div>
        </div>
        <div style="color:var(--muted)">›</div>
      </div>`;
    }).join('');
  }

  // ── STORE ─────────────────────────────────────────────────────────────
  function _renderStore() {
    const el = document.getElementById('aff-content');
    if (!el) return;
    if (!_products.length) { el.innerHTML = '<div class="empty-state">ยังไม่มีสินค้า</div>'; return; }
    el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">` +
      _products.map(p => {
        const img = (p.images||[])[0];
        return `<div class="card" style="padding:0;overflow:hidden;cursor:pointer" onclick="AffPage.edit('${_esc(p.id)}')">
          ${img
            ? `<img src="${_esc(img)}" style="width:100%;height:100px;object-fit:cover;display:block">`
            : `<div style="width:100%;height:100px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:2rem">🔗</div>`}
          <div style="padding:8px">
            <div style="font-size:var(--fs-sm);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.title)}</div>
            <div style="font-size:var(--fs-xs);color:var(--gold);font-weight:600;margin-top:2px">฿${_fmt(p.price)}</div>
            <div style="font-size:var(--fs-xs);color:var(--muted);margin-top:1px">คลิก: ${p.click_count||0}</div>
          </div>
        </div>`;
      }).join('') + `</div>`;
  }

  // ── TREND ─────────────────────────────────────────────────────────────
  function _renderTrend() {
    const el = document.getElementById('aff-content');
    if (!el) return;
    const sorted = [..._products].sort((a, b) => (b.click_count||0) - (a.click_count||0));
    if (!sorted.length) { el.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูล</div>'; return; }
    const rankBg = ['var(--gold)','#9ca3af','#cd7f32'];
    el.innerHTML = sorted.map((p, i) => {
      const img = (p.images||[])[0];
      return `<div class="list-item">
        <div style="width:30px;height:30px;border-radius:50%;background:${i<3?rankBg[i]:'var(--card)'};color:${i<3?'#1a1200':'var(--muted)'};display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;flex-shrink:0">${i+1}</div>
        ${img
          ? `<img src="${_esc(img)}" style="width:44px;height:44px;object-fit:cover;border-radius:7px;flex-shrink:0">`
          : `<div style="width:44px;height:44px;background:var(--card);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">🔗</div>`}
        <div class="li-left">
          <div class="li-title">${_esc(p.title)}</div>
          <div class="li-sub">฿${_fmt(p.price)} · คอม ${p.commission||0}${p.commission_type==='percent'?'%':'฿'}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:1.2rem;font-weight:700;color:var(--gold)">${p.click_count||0}</div>
          <div style="font-size:var(--fs-xs);color:var(--muted)">คลิก</div>
        </div>
      </div>`;
    }).join('');
  }

  // ── FORM (bottom sheet) ───────────────────────────────────────────────
  function _openForm(p) {
    const isEdit = !!p; p = p || {};
    const stVal = p.status || 'active';
    openSheet(`
      <div style="padding:4px 0 8px">
        <div style="font-size:var(--fs-lg);font-weight:700;padding:0 16px 12px">${isEdit ? '✏️ แก้ไขสินค้า' : '✨ สร้างสินค้า Affiliate'}</div>
        <div style="padding:0 16px;display:flex;flex-direction:column;gap:12px">
          <div class="pm-field"><label>ชื่อสินค้า / ไตเติ้ล *</label><input type="text" id="af-title" value="${_esc(p.title||'')}" placeholder="ชื่อที่ดึงดูด..."></div>
          <div class="pm-field"><label>ลิ้งค์ Affiliate *</label><input type="url" id="af-url" value="${_esc(p.aff_url||'')}" placeholder="https://..."></div>
          <div class="pm-row2">
            <div class="pm-field"><label>แหล่งที่มา</label><input type="text" id="af-source" value="${_esc(p.source||'')}" placeholder="Shopee / Lazada..."></div>
            <div class="pm-field"><label>ราคา (฿)</label><input type="number" id="af-price" value="${p.price||0}" min="0"></div>
          </div>
          <div class="pm-row2">
            <div class="pm-field"><label>ค่าคอม</label><input type="number" id="af-comm" value="${p.commission||0}" min="0" step="0.01"></div>
            <div class="pm-field"><label>ประเภท</label>
              <select id="af-ctype" style="padding:10px 12px;border:1.5px solid var(--bdr);border-radius:10px;font-size:var(--fs-sm);background:var(--bg);color:var(--txt)">
                <option value="percent"${p.commission_type==='percent'?' selected':''}>% เปอร์เซ็นต์</option>
                <option value="amount"${p.commission_type==='amount'?' selected':''}>฿ จำนวนเงิน</option>
              </select>
            </div>
          </div>
          <div class="pm-field"><label>คำบรรยาย</label><textarea id="af-desc" rows="2" style="padding:10px;border:1.5px solid var(--bdr);border-radius:10px;font-size:var(--fs-sm);background:var(--bg);color:var(--txt);resize:none;width:100%;font-family:inherit" placeholder="จุดเด่น ข้อดี...">${_esc(p.description||'')}</textarea></div>

          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:var(--fs-xs);color:var(--muted)">สถานะ:</span>
            <button id="af-stbtn" data-status="${stVal}" onclick="AffPage._toggleStatus(this)" style="padding:5px 14px;border:none;border-radius:20px;font-size:var(--fs-xs);font-weight:700;cursor:pointer;background:${stVal==='active'?'#dcfce7':'#fee2e2'};color:${stVal==='active'?'#166534':'#991b1b'}">${stVal==='active'?'จำหน่าย':'หยุดขาย'}</button>
          </div>

          <div id="af-msg" style="display:none;font-size:var(--fs-xs);color:#ef4444;margin-top:4px"></div>
        </div>
        <div class="pm-actions" style="padding:16px 16px 0">
          ${isEdit ? `<button class="pm-btn" style="background:#fee2e2;color:#991b1b;border:none" onclick="AffPage.del('${_esc(_editId)}')">ลบ</button>` : '<div></div>'}
          <div style="display:flex;gap:8px">
            <button class="pm-btn pm-btn-cancel" onclick="closeSheet()">ยกเลิก</button>
            <button class="pm-btn pm-btn-save" id="af-savebtn" onclick="AffPage.save()">บันทึก</button>
          </div>
        </div>
      </div>`);
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────
  window.AffPage = {
    tab(t) {
      _tab = t;
      document.querySelectorAll('.aff-tab').forEach(b => {
        b.classList.toggle('aff-tab-active', b.textContent.includes(t==='all'?'ทั้งหมด':t==='store'?'สโตร์':'เทรน'));
      });
      _renderTab();
    },
    showCreate() {
      _editId = null; _imgs = []; _vids = []; _opts = [];
      _openForm(null);
    },
    edit(id) {
      const p = _products.find(x => x.id === id);
      if (!p) return;
      _editId = id;
      _imgs = (p.images||[]).slice();
      _vids = (p.videos||[]).slice();
      _opts = (p.options||[]).slice();
      _openForm(p);
    },
    _toggleStatus(btn) {
      btn.dataset.status = btn.dataset.status === 'active' ? 'inactive' : 'active';
      const st = btn.dataset.status === 'active';
      btn.textContent = st ? 'จำหน่าย' : 'หยุดขาย';
      btn.style.background = st ? '#dcfce7' : '#fee2e2';
      btn.style.color = st ? '#166534' : '#991b1b';
    },
    async save() {
      const title = (document.getElementById('af-title')?.value || '').trim();
      const url   = (document.getElementById('af-url')?.value || '').trim();
      const msg   = document.getElementById('af-msg');
      const btn   = document.getElementById('af-savebtn');
      if (!title || !url) { msg.textContent='กรุณากรอกชื่อและลิ้งค์'; msg.style.display='block'; return; }
      btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;
      const stBtn = document.getElementById('af-stbtn');
      const payload = {
        title, aff_url: url,
        source:          (document.getElementById('af-source')?.value||'').trim(),
        price:           parseFloat(document.getElementById('af-price')?.value)||0,
        commission:      parseFloat(document.getElementById('af-comm')?.value)||0,
        commission_type: document.getElementById('af-ctype')?.value || 'percent',
        description:     (document.getElementById('af-desc')?.value||'').trim(),
        images: _imgs.slice(), videos: _vids.slice(),
        options: _opts.filter(o => o.name),
        status: stBtn?.dataset.status || 'active'
      };
      try {
        const ep = _editId ? `/api/pos/affiliate/update/${_editId}` : '/api/pos/affiliate/create';
        const d = await App.api(ep, { method: _editId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
        if (d.id || d.message) {
          closeSheet();
          App.toast('✅ บันทึกสำเร็จ');
          _editId = null; _imgs = []; _vids = []; _opts = [];
          await _loadList();
        } else {
          msg.textContent = d.detail || 'เกิดข้อผิดพลาด'; msg.style.display='block';
          btn.textContent='บันทึก'; btn.disabled=false;
        }
      } catch(e) {
        msg.textContent='เชื่อมต่อไม่ได้'; msg.style.display='block';
        btn.textContent='บันทึก'; btn.disabled=false;
      }
    },
    async del(id) {
      const p = _products.find(x => x.id === id);
      if (!p || !confirm(`ลบ "${p.title}" ?`)) return;
      await App.api(`/api/pos/affiliate/delete/${id}`, { method: 'DELETE' });
      closeSheet();
      App.toast('ลบเรียบร้อย');
      await _loadList();
    }
  };

  // CSS (inject once)
  if (!document.getElementById('aff-style')) {
    const s = document.createElement('style');
    s.id = 'aff-style';
    s.textContent = `
      .aff-tab{padding:6px 14px;border:1.5px solid var(--bdr);border-radius:20px;font-size:var(--fs-xs);font-weight:600;cursor:pointer;background:var(--card);color:var(--muted);white-space:nowrap;-webkit-tap-highlight-color:transparent;}
      .aff-tab-active{background:var(--gold);color:#1a1200;border-color:var(--gold);}
    `;
    document.head.appendChild(s);
  }

  function _skeleton() {
    return `<div class="sb-wrap">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${Array(4).fill('<div class="skeleton-card" style="height:70px;border-radius:12px"></div>').join('')}
      </div>
      ${Array(4).fill('<div class="list-item skeleton-card" style="height:62px;margin-bottom:8px"></div>').join('')}
    </div>`;
  }

  function _fmt(n) { return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0}); }
  function _esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
