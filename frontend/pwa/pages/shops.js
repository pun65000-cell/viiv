/* PWA — Shops page
 * รายการร้านสาขา + เพิ่ม/แก้ไข/ลบ ผ่าน popup
 */

(function(){
  const ShpPage = {
    _shops: [],
    _curTid: null,
    _editMode: null,  // null | 'add' | {id, subdomain, role}

    async load(){
      const c = document.getElementById('page-container');
      c.innerHTML = renderShell();
      bindHandlers();
      try {
        try {
          const t = (window.Auth && Auth.token) || localStorage.getItem('viiv_token') || '';
          const b = t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
          const p = JSON.parse(atob(b + '=='.slice((b.length%4)||4)));
          this._curTid = p.tenant_id || null;
        } catch(_) {}
        this._shops = await App.api('/api/platform/my-shops');
        this._render();
      } catch(e) {
        document.getElementById('shp-grid').innerHTML =
          '<div class="shp-empty"><div class="shp-empty-icon">⚠</div><div>โหลดไม่สำเร็จ — '+(e.message||'')+'</div></div>';
      }
    },

    destroy(){
      this._editMode = null;
    },

    _render(){
      const grid = document.getElementById('shp-grid');
      if (!grid) return;
      if (!this._shops.length) {
        grid.innerHTML = '<div class="shp-empty"><div class="shp-empty-icon">🏪</div><div>ยังไม่มีร้าน — กดปุ่ม "เพิ่มสาขา" เพื่อเริ่มต้น</div></div>';
        return;
      }
      grid.innerHTML = this._shops.map(s => {
        const active = s.id === this._curTid ? ' active' : '';
        const isOwner = s.role === 'owner';
        const initial = (s.store_name || s.subdomain || '?').charAt(0).toUpperCase();
        return '<div class="shp-card'+active+'" data-action="switch" data-subdomain="'+esc(s.subdomain)+'">' +
          (isOwner ? '' :
            '<button class="shp-edit" data-action="edit" data-id="'+esc(s.id)+'" data-subdomain="'+esc(s.subdomain)+'" data-role="'+esc(s.role)+'">⋮</button>') +
          '<div class="shp-card-row">' +
            '<div class="shp-card-av">'+initial+'</div>' +
            '<div class="shp-card-info">' +
              '<div class="shp-card-name">'+esc(s.store_name||s.subdomain)+'</div>' +
              '<div class="shp-card-sub">'+esc(s.subdomain||s.id)+'.viiv.me</div>' +
              '<div class="shp-badge'+(isOwner?' owner':'')+'">'+esc(s.role||'staff')+'</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    },

    openAdd(){
      this._editMode = 'add';
      setModal('เพิ่มสาขา', '', false, false);
      document.getElementById('shp-mask').classList.add('open');
      setTimeout(()=>document.getElementById('shp-input').focus(), 50);
    },

    openEdit(id, subdomain, role){
      this._editMode = { id, subdomain, role };
      setModal('แก้ไขสาขา', subdomain, true, true);
      document.getElementById('shp-mask').classList.add('open');
    },

    close(){
      document.getElementById('shp-mask').classList.remove('open');
      this._editMode = null;
    },

    async save(){
      const sd = (document.getElementById('shp-input').value||'').trim().toLowerCase();
      const err = document.getElementById('shp-err');
      err.textContent = '';
      if (!sd) { err.textContent = 'กรุณาใส่ Shop ID'; return; }
      const btn = document.getElementById('shp-save');
      btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
      try {
        const data = await App.api('/api/platform/join-shop', {
          method:'POST', body: JSON.stringify({ subdomain: sd })
        });
        if (data && data.access_token) this._redirect(data.subdomain, data.access_token);
        else err.textContent = 'ตอบกลับจาก server ผิดรูปแบบ';
      } catch(e) {
        err.textContent = (e && e.message) || 'เกิดข้อผิดพลาด';
      } finally {
        btn.disabled = false; btn.textContent = 'บันทึก';
      }
    },

    async switchTo(subdomain){
      try {
        const data = await App.api('/api/platform/join-shop', {
          method:'POST', body: JSON.stringify({ subdomain })
        });
        if (data && data.access_token) this._redirect(data.subdomain, data.access_token);
        else App.toast('สลับร้านไม่สำเร็จ');
      } catch(e) { App.toast(e.message || 'สลับร้านไม่สำเร็จ'); }
    },

    async del(){
      if (!this._editMode || this._editMode === 'add') return;
      if (!confirm('ลบสาขานี้ออกจากรายการ?')) return;
      const tid = this._editMode.id;
      const btn = document.getElementById('shp-del');
      btn.disabled = true;
      try {
        await App.api('/api/platform/my-shops/'+encodeURIComponent(tid), { method:'DELETE' });
        this.close();
        App.toast('ลบสาขาเรียบร้อย');
        await this.load();
      } catch(e) {
        document.getElementById('shp-err').textContent = e.message || 'ลบไม่สำเร็จ';
      } finally { btn.disabled = false; }
    },

    _redirect(subdomain, token){
      window.location.href = 'https://' + subdomain + '.viiv.me/pwa/?token=' + encodeURIComponent(token);
    },
  };

  function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function setModal(title, value, disabled, showDel){
    document.getElementById('shp-mtitle').textContent = title;
    const inp = document.getElementById('shp-input');
    inp.value = value;
    inp.disabled = !!disabled;
    document.getElementById('shp-err').textContent = '';
    document.getElementById('shp-del').style.display = showDel ? '' : 'none';
  }

  function bindHandlers(){
    const grid = document.getElementById('shp-grid');
    if (grid) {
      grid.addEventListener('click', e => {
        const editBtn = e.target.closest('[data-action="edit"]');
        if (editBtn) {
          e.stopPropagation();
          ShpPage.openEdit(editBtn.dataset.id, editBtn.dataset.subdomain, editBtn.dataset.role);
          return;
        }
        const card = e.target.closest('[data-action="switch"]');
        if (card) ShpPage.switchTo(card.dataset.subdomain);
      });
    }
    document.getElementById('shp-add-btn')?.addEventListener('click', () => ShpPage.openAdd());
    document.getElementById('shp-save')?.addEventListener('click', () => ShpPage.save());
    document.getElementById('shp-cancel')?.addEventListener('click', () => ShpPage.close());
    document.getElementById('shp-del')?.addEventListener('click', () => ShpPage.del());
  }

  function renderShell(){
    return `
<style>
  .shp-wrap { padding:16px; padding-bottom:84px; }
  .shp-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; gap:10px; }
  .shp-head h2 { font-size:1.05rem; font-weight:700; margin:0; }
  .shp-head p { font-size:11px; color:var(--muted); margin:2px 0 0; }
  .shp-btn-add {
    display:inline-flex; align-items:center; gap:6px;
    padding:8px 14px; border:0; border-radius:10px;
    background:var(--gold,#C9A84C); color:#1a1200;
    font-weight:700; font-size:12px; cursor:pointer;
  }
  .shp-grid { display:flex; flex-direction:column; gap:10px; }
  .shp-card {
    position:relative; background:var(--card,#fff);
    border:1px solid var(--bdr,rgba(0,0,0,.08));
    border-radius:12px; padding:14px; cursor:pointer;
    transition:border-color .15s, transform .1s;
  }
  .shp-card:active { transform:scale(.99); }
  .shp-card.active { border-color:var(--gold,#C9A84C); background:#fffdf5; }
  .shp-card-row { display:flex; align-items:center; gap:12px; }
  .shp-card-av {
    width:42px; height:42px; border-radius:10px;
    background:var(--gold,#C9A84C); color:#1a1200;
    display:flex; align-items:center; justify-content:center;
    font-weight:800; font-size:17px; flex-shrink:0; overflow:hidden;
  }
  .shp-card-av img { width:100%; height:100%; object-fit:cover; }
  .shp-card-info { flex:1; min-width:0; }
  .shp-card-name { font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .shp-card-sub { font-size:11px; color:var(--muted); font-family:monospace; margin-top:2px; }
  .shp-badge {
    display:inline-block; font-size:10px; font-weight:700;
    padding:2px 8px; border-radius:10px; margin-top:6px;
    background:rgba(201,168,76,.15); color:#7a5a00;
    border:1px solid rgba(201,168,76,.4);
  }
  .shp-badge.owner { background:rgba(34,139,84,.12); color:#1e6b42; border-color:rgba(34,139,84,.4); }
  .shp-edit {
    position:absolute; top:8px; right:8px;
    width:30px; height:30px; border-radius:8px;
    border:0; background:transparent; color:var(--muted);
    cursor:pointer; font-size:18px;
  }
  .shp-edit:active { background:rgba(0,0,0,.06); }
  .shp-empty { text-align:center; padding:50px 20px; color:var(--muted); }
  .shp-empty-icon { font-size:42px; margin-bottom:10px; opacity:.5; }

  .shp-mask {
    display:none; position:fixed; inset:0; background:rgba(0,0,0,.5);
    z-index:9000; align-items:center; justify-content:center; padding:16px;
  }
  .shp-mask.open { display:flex; }
  .shp-modal {
    background:var(--card,#fff); border-radius:16px; width:100%; max-width:340px;
    padding:20px; box-shadow:0 12px 32px rgba(0,0,0,.3);
  }
  .shp-modal h3 { font-size:1rem; font-weight:700; margin:0 0 12px; }
  .shp-modal label { display:block; font-size:11px; color:var(--muted); margin-bottom:5px; }
  .shp-modal input {
    width:100%; padding:10px 12px; border:1px solid var(--bdr,rgba(0,0,0,.12));
    border-radius:10px; font-size:14px; outline:none; box-sizing:border-box;
  }
  .shp-modal input:focus { border-color:var(--gold,#C9A84C); }
  .shp-modal input:disabled { background:#f5f3ef; color:var(--muted); }
  .shp-modal .hint { font-size:11px; color:var(--muted); margin-top:6px; }
  .shp-modal .err { font-size:12px; color:#d03030; margin-top:8px; min-height:16px; }
  .shp-modal-actions { display:flex; gap:8px; margin-top:16px; flex-wrap:wrap; }
  .shp-modal-actions button {
    flex:1; min-width:80px; padding:10px 14px; border-radius:10px;
    font-size:13px; font-weight:700; cursor:pointer; border:1px solid;
  }
  .shp-modal-actions .save { background:var(--gold,#C9A84C); border-color:var(--gold,#C9A84C); color:#1a1200; }
  .shp-modal-actions .save:disabled { background:#d0cdc8; border-color:#bbb; color:#888; }
  .shp-modal-actions .cancel { background:var(--card,#fff); border-color:var(--bdr,rgba(0,0,0,.12)); color:var(--text); }
  .shp-modal-actions .del { background:var(--card,#fff); border-color:#d03030; color:#d03030; }
</style>

<div class="shp-wrap">
  <div class="shp-head">
    <div>
      <h2>ร้านสาขา</h2>
      <p>แตะการ์ดเพื่อสลับร้าน · กด + เพื่อเพิ่มสาขา</p>
    </div>
    <button class="shp-btn-add" id="shp-add-btn">
      <span style="font-size:14px;line-height:1">+</span>
      <span>เพิ่มสาขา</span>
    </button>
  </div>

  <div id="shp-grid" class="shp-grid">
    <div class="shp-empty">
      <div class="shp-empty-icon">⏳</div>
      <div>กำลังโหลด...</div>
    </div>
  </div>
</div>

<div class="shp-mask" id="shp-mask">
  <div class="shp-modal">
    <h3 id="shp-mtitle">เพิ่มสาขา</h3>
    <label>Shop ID (subdomain)</label>
    <input id="shp-input" type="text" placeholder="เช่น testshop" autocomplete="off" inputmode="text" />
    <div class="hint">ใส่ subdomain ของร้านที่ต้องการเข้าร่วม</div>
    <div class="err" id="shp-err"></div>
    <div class="shp-modal-actions">
      <button class="save" id="shp-save">บันทึก</button>
      <button class="cancel" id="shp-cancel">ยกเลิก</button>
      <button class="del" id="shp-del" style="display:none">ลบ</button>
    </div>
  </div>
</div>
`;
  }

  Router.register('shops', {
    title: 'ร้านสาขา',
    load: (params) => ShpPage.load(params),
    destroy: () => ShpPage.destroy(),
  });

  window.ShpPage = ShpPage;
})();
