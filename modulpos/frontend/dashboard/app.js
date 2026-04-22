/* VIIV POS Mobile — app.js */
const S = {
  token: null, page: 'home',
  data: { summary:{}, bills:[], products:[], members:[] }
};

const $ = id => document.getElementById(id);
const fmtB = n => '฿' + Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});
const fmtTime = s => {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
};

// ── TOKEN ──────────────────────────────────────
window.addEventListener('message', e => {
  if (e.data?.type === 'viiv_token') {
    S.token = e.data.token;
    loadAll();
  }
});

// ── CLOCK ──────────────────────────────────────
function tick() {
  const e = $('tb-clock');
  if (e) e.textContent = new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
}
tick(); setInterval(tick, 1000);

// ── API ────────────────────────────────────────
const API_BASE = '/api/pos-mobile';
async function api(path) {
  if (!S.token) return null;
  try {
    const r = await fetch(API_BASE + path, { headers: { Authorization: 'Bearer ' + S.token } });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

async function loadAll() {
  const [sum, bills, prods] = await Promise.all([
    api('/summary'), api('/bills/recent?limit=10'), api('/products/list')
  ]);
  if (sum)   { S.data.summary = sum;  renderSummary(); }
  if (bills) { S.data.bills = bills.bills || []; renderBills(); }
  if (prods) { S.data.products = prods.products || []; renderProducts(); }
}

// ── RENDERS ────────────────────────────────────
function renderSummary() {
  const s = S.data.summary;
  const setText = (id, v) => { const e=$(id); if(e) e.textContent = v; };
  setText('s-today',  fmtB(s.today_sales));
  setText('s-orders', s.today_orders || 0);
  setText('s-msales', fmtB(s.month_sales));
  setText('s-morders',s.month_orders || 0);
  if (s.low_stock > 0) {
    const el = $('stock-alert');
    if (el) { el.style.display = 'flex'; el.querySelector('span').textContent = s.low_stock + ' รายการสต็อกต่ำ'; }
  }
}

function renderBills() {
  const el = $('bill-list'); if (!el) return;
  if (!S.data.bills.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-txt">ยังไม่มีบิลวันนี้</div></div>'; return; }
  el.innerHTML = S.data.bills.map(b => `
    <div class="bill-item">
      <div class="bill-status ${b.status === 'paid' ? 'paid' : b.status === 'void' ? 'void' : 'pending'}"></div>
      <div class="bill-info">
        <div class="bill-no">${b.bill_no || b.id?.slice(-6) || '—'}</div>
        <div class="bill-name">${b.customer_name || 'ลูกค้าทั่วไป'}</div>
        <div class="bill-time">${fmtTime(b.created_at)}</div>
      </div>
      <div class="bill-amount">${fmtB(b.total)}</div>
    </div>`).join('');
}

function renderProducts() {
  const el = $('prod-list'); if (!el) return;
  const prods = S.data.products.slice(0, 20);
  if (!prods.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div class="empty-txt">ยังไม่มีสินค้า</div></div>'; return; }
  el.innerHTML = prods.map(p => `
    <div class="prod-item">
      <div class="prod-img">${p.image_url ? `<img src="${p.image_url}" style="width:100%;height:100%;border-radius:8px;object-fit:cover">` : '📦'}</div>
      <div class="prod-info">
        <div class="prod-name">${p.name}</div>
        <div class="prod-price">${fmtB(p.price)} / ${p.unit||'ชิ้น'}</div>
      </div>
      <div class="prod-stock ${(p.stock_qty||0) <= 5 ? 'low' : 'ok'}">${p.stock_qty||0}</div>
    </div>`).join('');
}

// ── NAVIGATION ─────────────────────────────────
function goPage(name) {
  if (S.page === name) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  const pg = $('page-' + name);
  if (pg) pg.classList.add('active');
  S.page = name;
  // update topbar
  const titles = { home:'POS', bills:'รายการบิล', products:'สินค้า', members:'ลูกค้า', bill_new:'ออกบิล' };
  const tb = $('tb-title'); if (tb) tb.textContent = titles[name] || 'POS';
  const back = $('tb-back'); if (back) back.style.display = (name==='home'?'none':'flex');
}

window.goPage = goPage;
