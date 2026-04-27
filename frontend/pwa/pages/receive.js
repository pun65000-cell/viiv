/* VIIV PWA - receive.js v1.2 */
(function(){
  var R = window.ReceivePage = {};
  var _items = [], _products = [];
  var _createItems = [], _itemIdx = null;

  R.render = async function(params){
    var app = document.getElementById('app');
    app.innerHTML = '<div style="max-width:768px;margin:0 auto">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10">'
      + '<button onclick="Router.back()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:4px 8px">&#8592;</button>'
      + '<div style="font-size:var(--fs-lg);font-weight:700;color:var(--text)">รับสินค้า</div>'
      + '<button onclick="ReceivePage.openCreate()" style="background:var(--primary);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:var(--fs-sm);font-weight:600;cursor:pointer">+ รับสินค้า</button>'
      + '</div>'
      + '<div style="padding:12px 16px"><input id="rcv-search" type="text" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32 supplier / \u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38\u2026" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:var(--fs-sm);background:var(--surface)" oninput="ReceivePage.search(this.value)"></div>'
      + '<div id="rcv-list" style="padding:0 16px 120px"></div>'
      + '</div>'
      + '<div id="rcv-detail-sheet" class="bottom-sheet" style="display:none"><div class="sheet-handle" onclick="ReceivePage.closeDetail()"></div><div id="rcv-detail-body" style="padding:0 16px 32px;overflow-y:auto;max-height:80vh"></div></div>'
      + '<div id="rcv-detail-overlay" class="sheet-overlay" style="display:none" onclick="ReceivePage.closeDetail()"></div>'
      + '<div id="rcv-create-sheet" class="bottom-sheet" style="display:none;max-height:92vh;overflow-y:auto"><div class="sheet-handle" onclick="ReceivePage.closeCreate()"></div>'
      + '<div style="padding:0 16px 32px">'
      + '<div style="font-size:var(--fs-lg);font-weight:700;margin-bottom:12px">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>'
      + '<div style="margin-bottom:10px"><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:4px">Supplier</div><input id="rcv-partner-name" type="text" placeholder="Supplier..." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:var(--fs-sm);background:var(--surface)"></div>'
      + '<div style="margin-bottom:10px"><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:4px">\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e23\u0e31\u0e1a</div><input id="rcv-date" type="date" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:var(--fs-sm);background:var(--surface)"></div>'
      + '<div style="margin-bottom:10px"><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:4px">\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38</div><input id="rcv-note" type="text" placeholder="\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38..." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:var(--fs-sm);background:var(--surface)"></div>'
      + '<div style="margin-bottom:10px"><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:4px">\u0e23\u0e39\u0e1b\u0e43\u0e1a\u0e2a\u0e48\u0e07\u0e02\u0e2d\u0e07</div><input id="rcv-image" type="file" accept="image/*"></div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:var(--fs-sm);font-weight:600">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div><button class="btn-outline" style="padding:4px 10px;font-size:var(--fs-xs)" onclick="ReceivePage.addItem()">+ \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</button></div>'
      + '<div id="rcv-items-list"></div>'
      + '<div style="margin-top:8px;padding:10px 0;border-top:1px solid var(--border);display:flex;justify-content:space-between"><div style="font-size:var(--fs-sm);font-weight:600">\u0e23\u0e27\u0e21</div><div id="rcv-total" style="font-size:var(--fs-sm);font-weight:700">\u0e3f0</div></div>'
      + '<button id="rcv-save-btn" class="btn-primary" style="width:100%;margin-top:8px;padding:12px" onclick="ReceivePage.save()">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</button>'
      + '</div></div>'
      + '<div id="rcv-create-overlay" class="sheet-overlay" style="display:none" onclick="ReceivePage.closeCreate()"></div>'
      + '<div id="rcv-prod-sheet" class="bottom-sheet" style="display:none"><div class="sheet-handle" onclick="ReceivePage.closeProdSheet()"></div>'
      + '<div style="padding:0 16px 32px"><div style="font-size:var(--fs-md);font-weight:700;margin-bottom:10px">\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>'
      + '<input id="rcv-prod-search" type="text" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32..." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:var(--fs-sm);background:var(--surface);margin-bottom:10px" oninput="ReceivePage.filterProd(this.value)">'
      + '<div id="rcv-prod-list" style="max-height:50vh;overflow-y:auto"></div></div></div>'
      + '<div id="rcv-prod-overlay" class="sheet-overlay" style="display:none" onclick="ReceivePage.closeProdSheet()"></div>';
    await R.load();
    var d = document.getElementById('rcv-date');
    if(d) d.value = new Date().toISOString().split('T')[0];
  };

  R.load = async function(){
    var el = document.getElementById('rcv-list');
    if(!el) return;
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...</div>';
    try {
      var data = await App.api('/api/pos/receive/list?limit=50');
      _items = data.items || [];
      R.renderList(_items);
    } catch(e){
      el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08</div>';
    }
  };

  R.renderList = function(items){
    var el = document.getElementById('rcv-list');
    if(!el) return;
    if(!items.length){
      el.innerHTML = '<div style="padding:48px 0;text-align:center;color:var(--text-muted)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>';
      return;
    }
    var html = '';
    for(var i=0;i<items.length;i++){
      var r = items[i];
      var dt = r.receive_date || r.created_at || '';
      var dateStr = dt ? new Date(dt).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'}) : '-';
      var cnt = (r.items||[]).length;
      var total = parseFloat(r.total_amount||0).toLocaleString('th-TH',{minimumFractionDigits:0});
      html += '<div class="card" style="margin-bottom:10px;cursor:pointer" onclick="ReceivePage.openDetail(\'' + r.id + '\')">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
        + '<div><div style="font-size:var(--fs-sm);font-weight:600">' + (r.partner_name||'\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38 supplier') + '</div>'
        + '<div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:2px">' + dateStr + ' \u00b7 ' + cnt + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u00b7 ' + (r.staff_name||'-') + '</div>'
        + (r.note ? '<div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:2px">' + r.note + '</div>' : '')
        + '</div><div style="text-align:right">'
        + '<div style="font-size:var(--fs-md);font-weight:700;color:var(--primary)">\u0e3f' + total + '</div>'
        + (r.bill_image_url ? '<div style="font-size:var(--fs-xs);color:var(--text-muted)">\u0e21\u0e35\u0e23\u0e39\u0e1b</div>' : '')
        + '</div></div></div>';
    }
    el.innerHTML = html;
  };

  R.search = function(q){
    var kw = q.toLowerCase();
    var filtered = [];
    for(var i=0;i<_items.length;i++){
      var r = _items[i];
      if((r.partner_name||'').toLowerCase().indexOf(kw)>=0
        ||(r.note||'').toLowerCase().indexOf(kw)>=0
        ||(r.staff_name||'').toLowerCase().indexOf(kw)>=0){
        filtered.push(r);
      }
    }
    R.renderList(filtered);
  };

  R.openDetail = function(id){
    var r = null;
    for(var i=0;i<_items.length;i++){ if(_items[i].id===id){ r=_items[i]; break; } }
    if(!r) return;
    var dt = r.receive_date || r.created_at || '';
    var dateStr = dt ? new Date(dt).toLocaleDateString('th-TH',{day:'2-digit',month:'long',year:'numeric'}) : '-';
    var items = r.items || [];
    var total = parseFloat(r.total_amount||0).toLocaleString('th-TH',{minimumFractionDigits:2});
    var h = '<div style="font-size:var(--fs-lg);font-weight:700;margin-bottom:16px">\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
    h += '<div><div style="font-size:var(--fs-xs);color:var(--text-muted)">Supplier</div><div style="font-size:var(--fs-sm);font-weight:600">'+(r.partner_name||'-')+'</div></div>';
    h += '<div><div style="font-size:var(--fs-xs);color:var(--text-muted)">\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e23\u0e31\u0e1a</div><div style="font-size:var(--fs-sm)">'+dateStr+'</div></div>';
    h += '<div><div style="font-size:var(--fs-xs);color:var(--text-muted)">\u0e1c\u0e39\u0e49\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01</div><div style="font-size:var(--fs-sm)">'+(r.staff_name||'-')+'</div></div>';
    h += '<div><div style="font-size:var(--fs-xs);color:var(--text-muted)">\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38</div><div style="font-size:var(--fs-sm)">'+(r.note||'-')+'</div></div>';
    h += '</div>';
    if(r.bill_image_url) h += '<img src="'+r.bill_image_url+'" style="width:100%;border-radius:8px;margin-bottom:16px;max-height:200px;object-fit:contain">';
    h += '<div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:8px">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 ('+items.length+')</div>';
    h += '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">';
    for(var j=0;j<items.length;j++){
      var it = items[j];
      h += '<div style="padding:10px 12px;'+(j?'border-top:1px solid var(--border)':'')+'"><div style="display:flex;justify-content:space-between">'
        +'<div><div style="font-size:var(--fs-sm);font-weight:500">'+(it.product_name||'-')+'</div>'
        +'<div style="font-size:var(--fs-xs);color:var(--text-muted)">'+(it.sku||'')+' \u00b7 \u0e04\u0e25\u0e31\u0e07: '+(it.warehouse||'back')+'</div></div>'
        +'<div style="text-align:right"><div style="font-size:var(--fs-sm)">'+it.qty+' \u0e2b\u0e19\u0e48\u0e27\u0e22</div>'
        +'<div style="font-size:var(--fs-xs);color:var(--text-muted)">\u0e15\u0e49\u0e19\u0e17\u0e38\u0e19 \u0e3f'+parseFloat(it.cost_price||0).toLocaleString()+'</div></div>'
        +'</div></div>';
    }
    h += '</div><div style="display:flex;justify-content:space-between;font-weight:700;font-size:var(--fs-md);padding:8px 0;border-top:1px solid var(--border)">'
      +'<span>\u0e23\u0e27\u0e21\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14</span><span style="color:var(--primary)">\u0e3f'+total+'</span></div>';
    document.getElementById('rcv-detail-body').innerHTML = h;
    document.getElementById('rcv-detail-sheet').style.display = 'flex';
    document.getElementById('rcv-detail-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
  };

  R.closeDetail = function(){
    document.getElementById('rcv-detail-sheet').style.display = 'none';
    document.getElementById('rcv-detail-overlay').style.display = 'none';
    document.body.style.overflow = '';
  };

  R.openCreate = function(){
    _createItems = [];
    R.renderItems();
    R.updateTotal();
    document.getElementById('rcv-partner-name').value = '';
    document.getElementById('rcv-note').value = '';
    document.getElementById('rcv-image').value = '';
    document.getElementById('rcv-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('rcv-create-sheet').style.display = 'flex';
    document.getElementById('rcv-create-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
  };

  R.closeCreate = function(){
    document.getElementById('rcv-create-sheet').style.display = 'none';
    document.getElementById('rcv-create-overlay').style.display = 'none';
    document.body.style.overflow = '';
  };

  R.renderItems = function(){
    var el = document.getElementById('rcv-items-list');
    if(!el) return;
    if(!_createItems.length){
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:var(--fs-xs)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</div>';
      return;
    }
    var h = '';
    for(var i=0;i<_createItems.length;i++){
      var it = _createItems[i];
      h += '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<div style="font-size:var(--fs-sm);font-weight:500">'+it.product_name+'</div>'
        +'<button onclick="ReceivePage.removeItem('+i+')" style="background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer">X</button></div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
        +'<div><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:2px">\u0e08\u0e33\u0e19\u0e27\u0e19</div>'
        +'<input type="number" min="0.01" step="0.01" value="'+it.qty+'" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:var(--fs-sm);background:var(--surface)" onchange="ReceivePage.updateItem('+i+',\'qty\',this.value)"></div>'
        +'<div><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:2px">\u0e15\u0e49\u0e19\u0e17\u0e38\u0e19/\u0e2b\u0e19\u0e48\u0e27\u0e22</div>'
        +'<input type="number" min="0" step="0.01" value="'+it.cost_price+'" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:var(--fs-sm);background:var(--surface)" onchange="ReceivePage.updateItem('+i+',\'cost_price\',this.value)"></div>'
        +'</div></div>';
    }
    el.innerHTML = h;
  };

  R.addItem = async function(){
    if(!_products.length){
      try {
        var d = await App.api('/api/pos/products/list?limit=200');
        _products = d.items || d || [];
      } catch(e){ _products = []; }
    }
    R.openProdSheet();
  };

  R.updateItem = function(i, field, val){
    _createItems[i][field] = parseFloat(val)||0;
    R.updateTotal();
  };

  R.removeItem = function(i){
    _createItems.splice(i,1);
    R.renderItems();
    R.updateTotal();
  };

  R.updateTotal = function(){
    var total = 0;
    for(var i=0;i<_createItems.length;i++){
      total += (parseFloat(_createItems[i].qty)||0) * (parseFloat(_createItems[i].cost_price)||0);
    }
    var el = document.getElementById('rcv-total');
    if(el) el.textContent = '\u0e3f' + total.toLocaleString('th-TH',{minimumFractionDigits:2});
  };

  R.openProdSheet = function(){
    document.getElementById('rcv-prod-search').value = '';
    R.filterProd('');
    document.getElementById('rcv-prod-sheet').style.display = 'flex';
    document.getElementById('rcv-prod-overlay').style.display = 'block';
  };

  R.closeProdSheet = function(){
    document.getElementById('rcv-prod-sheet').style.display = 'none';
    document.getElementById('rcv-prod-overlay').style.display = 'none';
  };

  R.filterProd = function(q){
    var kw = q.toLowerCase();
    var list = [];
    for(var i=0;i<_products.length;i++){
      var p = _products[i];
      if((p.name||'').toLowerCase().indexOf(kw)>=0||(p.sku||'').toLowerCase().indexOf(kw)>=0) list.push(p);
    }
    var el = document.getElementById('rcv-prod-list');
    if(!el) return;
    if(!list.length){ el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>'; return; }
    var h = '';
    for(var j=0;j<list.length;j++){
      var p = list[j];
      h += '<div style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between" onclick="ReceivePage.pickProduct(\''+p.id+'\')">'
        +'<div><div style="font-size:var(--fs-sm);font-weight:500">'+p.name+'</div>'
        +'<div style="font-size:var(--fs-xs);color:var(--text-muted)">'+(p.sku||'')+' \u00b7 \u0e2a\u0e15\u0e47\u0e2d\u0e01 '+(p.stock_qty||0)+'</div></div>'
        +'<div style="font-size:var(--fs-xs);color:var(--text-muted);align-self:center">\u0e3f'+parseFloat(p.cost_price||0).toLocaleString()+'</div></div>';
    }
    el.innerHTML = h;
  };

  R.pickProduct = function(pid){
    var p = null;
    for(var i=0;i<_products.length;i++){ if(_products[i].id===pid){ p=_products[i]; break; } }
    if(!p) return;
    var exist = null;
    for(var j=0;j<_createItems.length;j++){ if(_createItems[j].product_id===pid){ exist=_createItems[j]; break; } }
    if(exist){ exist.qty += 1; }
    else {
      _createItems.push({ product_id:p.id, product_name:p.name, sku:p.sku||'', qty:1, cost_price:parseFloat(p.cost_price||0), warehouse:'back' });
    }
    R.closeProdSheet();
    R.renderItems();
    R.updateTotal();
  };

  R.save = async function(){
    if(!_createItems.length){ App.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 1 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23'); return; }
    var btn = document.getElementById('rcv-save-btn');
    if(btn){ btn.disabled=true; btn.textContent='\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01...'; }
    try {
      var payload = {
        partner_name: document.getElementById('rcv-partner-name').value.trim(),
        receive_date: document.getElementById('rcv-date').value,
        note: document.getElementById('rcv-note').value.trim(),
        items: _createItems
      };
      var result = await App.api('/api/pos/receive/create',{method:'POST',body:JSON.stringify(payload)});
      var imgFile = document.getElementById('rcv-image').files[0];
      if(imgFile && result.id){
        var fd = new FormData();
        fd.append('file', imgFile);
        await fetch('/api/pos/receive/upload-bill/'+result.id,{method:'POST',headers:{'Authorization':'Bearer '+App.getToken()},body:fd});
      }
      App.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27');
      R.closeCreate();
      await R.load();
    } catch(e){
      App.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: '+e.message);
    } finally {
      if(btn){ btn.disabled=false; btn.textContent='\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32'; }
    }
  };

  Router.register('receive', {
    title: '\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32',
    load: function(params){ return R.render(params); },
    destroy: function(){}
  });
})();
