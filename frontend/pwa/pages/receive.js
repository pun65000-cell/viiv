/* VIIV PWA - receive.js v5 */
(function(){
  var _destroyed = false;
  var _items = [];
  var _products = [];
  var _partners = [];
  var _createItems = [];
  var _q = '';

  Router.register('receive', {
    title: '\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32',
    load: async function(params){
      _destroyed = false;
      _q = '';
      await _reload();
    },
    destroy: function(){ _destroyed = true; }
  });

  function _esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function _fmt(n){ return Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:0}); }

  async function _reload(){
    var c = document.getElementById('page-container');
    var html = '<div style="max-width:768px;margin:0 auto">';
    html += '<div style="padding:10px 14px 8px;display:flex;gap:8px;align-items:center">';
    html += '<input id="rcv-q" type="text" autocomplete="off" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32 supplier..." style="flex:1;min-width:0;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none">';
    html += '<button onclick="RcvPage.openCreate()" style="background:var(--gold,#C9A84C);color:#fff;border:none;border-radius:10px;padding:9px 14px;font-size:var(--fs-sm);font-weight:700;cursor:pointer;white-space:nowrap">+ \u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</button>';
    html += '<button onclick="RcvPage.openHistory()" style="background:var(--card);color:var(--txt);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;font-size:var(--fs-sm);font-weight:600;cursor:pointer;white-space:nowrap">\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34</button>';
    html += '</div>';
    html += '<div id="rcv-count" style="padding:0 14px 4px;font-size:var(--fs-xs);color:var(--muted)"></div>';
    html += '<div id="rcv-list" style="padding:0 14px 80px"></div>';
    html += '</div>';

    // CREATE SHEET
    html += '<div id="rcv-overlay" onclick="RcvPage.closeCreate()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:300"></div>';
    html += '<div id="rcv-sheet" style="display:none;position:fixed;bottom:0;left:0;right:0;max-width:768px;margin:0 auto;background:var(--bg,#fff);border-radius:18px 18px 0 0;max-height:88vh;overflow-y:auto;z-index:301;padding-bottom:calc(var(--navbar-h,58px) + 16px)">';
    html += '<div onclick="RcvPage.closeCreate()" style="width:40px;height:4px;background:var(--bdr);border-radius:2px;margin:12px auto 0;cursor:pointer"></div>';
    html += '<div style="padding:14px 16px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    html += '<div style="font-size:var(--fs-md);font-weight:700">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>';
    html += '<button onclick="RcvPage.closeCreate()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);padding:4px">x</button></div>';

    // partner + note row
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
    html += '<div><div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:4px">\u0e04\u0e39\u0e48\u0e04\u0e49\u0e32 / \u0e1c\u0e39\u0e49\u0e08\u0e33\u0e2b\u0e19\u0e48\u0e32\u0e22</div>';
    html += '<input id="rcv-partner" type="text" list="rcv-plist" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e0a\u0e37\u0e48\u0e2d / \u0e23\u0e2b\u0e31\u0e2a / \u0e40\u0e1a\u0e2d\u0e23\u0e4c..." style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--bdr);border-radius:10px;font-size:var(--fs-xs);background:var(--card);color:var(--txt);outline:none">';
    html += '<datalist id="rcv-plist"></datalist></div>';
    html += '<div><div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:4px">\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38 (\u0e16\u0e49\u0e32\u0e21\u0e35)</div>';
    html += '<input id="rcv-note" type="text" placeholder="PO-001 \u0e2b\u0e23\u0e37\u0e2d\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38\u0e2d\u0e37\u0e48\u0e19" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--bdr);border-radius:10px;font-size:var(--fs-xs);background:var(--card);color:var(--txt);outline:none">';
    html += '</div></div>';

    // items header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    html += '<div style="font-size:var(--fs-xs);font-weight:700;color:#e07a00">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 *</div>';
    html += '<button onclick="RcvPage.rcAddItem()" style="font-size:var(--fs-xs);font-weight:700;color:var(--gold);background:none;border:none;cursor:pointer">+ \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</button></div>';

    // items search input
    html += '<input id="rcv-prod-search" type="text" list="rcv-prod-list" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e34\u0e48\u0e21..." oninput="RcvPage.rcSearchProd(this.value)" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--bdr);border-radius:10px;font-size:var(--fs-sm);background:var(--card);color:var(--txt);outline:none;margin-bottom:8px">';
    html += '<datalist id="rcv-prod-list"></datalist>';

    // items table header
    html += '<div style="display:grid;grid-template-columns:1fr 64px 80px 28px;gap:6px;margin-bottom:4px;padding:0 2px">';
    html += '<div style="font-size:10px;color:var(--muted)">\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>';
    html += '<div style="font-size:10px;color:var(--muted);text-align:center">\u0e08\u0e33\u0e19\u0e27\u0e19 *</div>';
    html += '<div style="font-size:10px;color:var(--muted);text-align:right">\u0e23\u0e32\u0e04\u0e32\u0e23\u0e31\u0e1a</div>';
    html += '<div></div></div>';
    html += '<div id="rcv-items"></div>';

    // total
    html += '<div style="text-align:right;margin:8px 0 12px;font-size:var(--fs-sm)">\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21: <strong style="color:var(--gold)" id="rcv-total">\u0e3f0</strong></div>';

    // image
    html += '<div style="margin-bottom:14px"><div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:4px">\u0e23\u0e39\u0e1b\u0e1a\u0e34\u0e25 / \u0e43\u0e1a\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d (\u0e44\u0e21\u0e48\u0e1a\u0e31\u0e07\u0e04\u0e31\u0e1a)</div>';
    html += '<label style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid var(--bdr);border-radius:8px;cursor:pointer;font-size:var(--fs-xs);background:var(--card);color:var(--txt)">';
    html += '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e23\u0e39\u0e1b / \u0e01\u0e25\u0e49\u0e2d\u0e07<input type="file" id="rcv-img" accept="image/*" capture="environment" style="display:none"></label>';
    html += '<span id="rcv-img-name" style="font-size:var(--fs-xs);color:var(--muted);margin-left:8px"></span></div>';

    // buttons
    html += '<div style="display:flex;gap:8px">';
    html += '<button onclick="RcvPage.closeCreate()" style="flex:1;padding:12px;background:var(--card);color:var(--txt);border:1px solid var(--bdr);border-radius:12px;font-size:var(--fs-sm);cursor:pointer">\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01</button>';
    html += '<button id="rcv-save" onclick="RcvPage.save()" style="flex:2;padding:12px;background:var(--gold,#C9A84C);color:#000;border:none;border-radius:12px;font-size:var(--fs-sm);font-weight:700;cursor:pointer">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01</button>';
    html += '</div>';
    html += '</div></div>';

    // HISTORY SHEET
    html += '<div id="rcv-hist-overlay" onclick="RcvPage.closeHistory()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:300"></div>';
    html += '<div id="rcv-hist-sheet" style="display:none;position:fixed;bottom:0;left:0;right:0;max-width:768px;margin:0 auto;background:var(--bg,#fff);border-radius:18px 18px 0 0;max-height:88vh;overflow-y:auto;z-index:301;padding-bottom:calc(var(--navbar-h,58px) + 16px)">';
    html += '<div onclick="RcvPage.closeHistory()" style="width:40px;height:4px;background:var(--bdr);border-radius:2px;margin:12px auto 12px;cursor:pointer"></div>';
    html += '<div style="padding:0 14px">';
    html += '<div style="font-size:var(--fs-md);font-weight:700;margin-bottom:10px">\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>';
    html += '<input id="rcv-hq" type="text" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32 supplier / \u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38 / \u0e1c\u0e39\u0e49\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01..." style="width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;color:var(--txt);font-size:var(--fs-sm);outline:none;margin-bottom:8px">';
    html += '<div id="rcv-hist-count" style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:6px"></div>';
    html += '<div id="rcv-hist-list"></div></div></div>';

    // DETAIL SHEET
    html += '<div id="rcv-det-overlay" onclick="RcvPage.closeDetail()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:400"></div>';
    html += '<div id="rcv-det-sheet" style="display:none;position:fixed;bottom:0;left:0;right:0;max-width:768px;margin:0 auto;background:var(--bg,#fff);border-radius:18px 18px 0 0;max-height:88vh;overflow-y:auto;z-index:401;padding:0 16px calc(var(--navbar-h,58px) + 16px)">';
    html += '<div onclick="RcvPage.closeDetail()" style="width:40px;height:4px;background:var(--bdr);border-radius:2px;margin:12px auto 12px;cursor:pointer"></div>';
    html += '<div id="rcv-det-body"></div></div>';

    c.innerHTML = html;

    var q = document.getElementById('rcv-q');
    if(q){ var t; q.addEventListener('input',function(e){ clearTimeout(t); t=setTimeout(function(){ _q=e.target.value; _renderList(); },200); }); }
    var hq = document.getElementById('rcv-hq');
    if(hq){ var t2; hq.addEventListener('input',function(e){ clearTimeout(t2); t2=setTimeout(function(){ _renderHistList(e.target.value); },200); }); }
    var img = document.getElementById('rcv-img');
    if(img){ img.addEventListener('change',function(){ var n=document.getElementById('rcv-img-name'); if(n) n.textContent=this.files[0]?this.files[0].name:''; }); }

    await _load();
    _loadMeta();
  }

  async function _load(){
    var el=document.getElementById('rcv-list');
    if(el) el.innerHTML='<div style="text-align:center;padding:32px;color:var(--muted)">\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...</div>';
    try{
      var data=await App.api('/api/pos/receive/list?limit=50');
      if(_destroyed) return;
      _items=data.items||[];
      _renderList();
    }catch(e){
      if(_destroyed) return;
      var el2=document.getElementById('rcv-list');
      if(el2) el2.innerHTML='<div style="text-align:center;padding:32px;color:var(--muted)">\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08</div>';
    }
  }

  async function _loadMeta(){
    try{
      var dp=await App.api('/api/pos/products/list?limit=300');
      _products=dp.items||dp||[];
      var dl=document.getElementById('rcv-prod-list');
      if(dl) dl.innerHTML=_products.map(function(p){ return '<option value="'+_esc(p.name)+'" data-id="'+p.id+'" data-sku="'+_esc(p.sku||'')+'" data-cost="'+(p.cost_price||0)+'">'; }).join('');
    }catch(e){}
    try{
      var dpa=await App.api('/api/pos/partners/list?limit=100');
      _partners=dpa.items||dpa||[];
      var dlp=document.getElementById('rcv-plist');
      if(dlp) dlp.innerHTML=_partners.map(function(p){ return '<option value="'+_esc(p.company_name||'')+'">'; }).join('');
    }catch(e){}
  }

  function _renderList(){
    var el=document.getElementById('rcv-list');
    var cnt=document.getElementById('rcv-count');
    if(!el) return;
    var kw=_q.toLowerCase();
    var list=_items.filter(function(r){
      return !kw||(r.partner_name||'').toLowerCase().indexOf(kw)>=0||(r.note||'').toLowerCase().indexOf(kw)>=0||(r.staff_name||'').toLowerCase().indexOf(kw)>=0;
    });
    if(cnt) cnt.textContent='\u0e41\u0e2a\u0e14\u0e07 '+list.length+' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23';
    if(!list.length){ el.innerHTML='<div style="text-align:center;padding:48px 0;color:var(--muted)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34</div>'; return; }
    var h='';
    for(var i=0;i<list.length;i++) h+=_cardHtml(list[i],'RcvPage.openDetail(\''+list[i].id+'\')');
    el.innerHTML=h;
  }

  function _renderHistList(q){
    var el=document.getElementById('rcv-hist-list');
    var cnt=document.getElementById('rcv-hist-count');
    if(!el) return;
    var kw=(q||'').toLowerCase();
    var list=_items.filter(function(r){
      return !kw||(r.partner_name||'').toLowerCase().indexOf(kw)>=0||(r.note||'').toLowerCase().indexOf(kw)>=0||(r.staff_name||'').toLowerCase().indexOf(kw)>=0;
    });
    if(cnt) cnt.textContent='\u0e41\u0e2a\u0e14\u0e07 '+list.length+' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23';
    if(!list.length){ el.innerHTML='<div style="text-align:center;padding:32px 0;color:var(--muted)">\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</div>'; return; }
    var h='';
    for(var i=0;i<list.length;i++) h+=_cardHtml(list[i],'RcvPage.openDetailFromHist(\''+list[i].id+'\')');
    el.innerHTML=h;
  }

  function _cardHtml(r,onclick){
    var dt=r.receive_date||r.created_at||'';
    var ds=dt?new Date(dt).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'}):'-';
    var total=parseFloat(r.total_amount||0).toLocaleString('th-TH',{minimumFractionDigits:0});
    var cnt=(r.items||[]).length;
    var h='<div onclick="'+onclick+'" style="background:var(--card);border-radius:10px;padding:12px 14px;margin-bottom:8px;cursor:pointer;border:1px solid var(--bdr)">';
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-start">';
    h+='<div style="flex:1;min-width:0"><div style="font-size:var(--fs-sm);font-weight:600;color:var(--txt)">'+(r.partner_name||'\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38 supplier')+'</div>';
    h+='<div style="font-size:var(--fs-xs);color:var(--muted);margin-top:3px">'+ds+' \u00b7 '+cnt+' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u00b7 '+(r.staff_name||'-')+'</div>';
    if(r.note) h+='<div style="font-size:var(--fs-xs);color:var(--muted);margin-top:2px">'+_esc(r.note)+'</div>';
    h+='</div><div style="text-align:right;flex-shrink:0;margin-left:10px">';
    h+='<div style="font-size:var(--fs-md);font-weight:700;color:var(--gold)">\u0e3f'+total+'</div>';
    if(r.bill_image_url) h+='<div style="font-size:10px;color:var(--muted)">\u0e21\u0e35\u0e23\u0e39\u0e1b</div>';
    h+='</div></div></div>';
    return h;
  }

  function _renderItems(){
    var el=document.getElementById('rcv-items'); if(!el) return;
    if(!_createItems.length){ el.innerHTML='<div style="text-align:center;padding:12px;color:var(--muted);font-size:var(--fs-xs)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</div>'; return; }
    var h='';
    for(var i=0;i<_createItems.length;i++){
      var it=_createItems[i];
      h+='<div style="display:grid;grid-template-columns:1fr 64px 80px 28px;gap:6px;align-items:center;margin-bottom:6px">';
      h+='<input type="text" list="rcv-prod-list" value="'+_esc(it.product_name)+'" placeholder="\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32..." oninput="RcvPage.rcSetProduct('+i+',this.value)" style="background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 9px;color:var(--txt);font-size:var(--fs-xs);outline:none;width:100%;box-sizing:border-box">';
      h+='<input type="number" value="'+it.qty+'" min="0.01" step="0.01" oninput="RcvPage.rcSetQty('+i+',this.value)" style="background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 4px;color:var(--txt);font-size:var(--fs-xs);outline:none;text-align:center;width:100%;box-sizing:border-box">';
      h+='<input type="number" value="'+(it.cost_price||'')+'" min="0" step="0.01" placeholder="\u0e23\u0e32\u0e04\u0e32\u0e23\u0e31\u0e1a" oninput="RcvPage.rcSetCost('+i+',this.value)" style="background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px 4px;color:var(--txt);font-size:var(--fs-xs);outline:none;text-align:right;width:100%;box-sizing:border-box">';
      h+='<button onclick="RcvPage.rcRemove('+i+')" style="width:28px;height:34px;border:none;border-radius:8px;background:#fee2e2;color:#e53e3e;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0">x</button>';
      h+='</div>';
    }
    el.innerHTML=h;
  }

  function _calcTotal(){
    var t=0; for(var i=0;i<_createItems.length;i++) t+=(parseFloat(_createItems[i].qty)||0)*(parseFloat(_createItems[i].cost_price)||0);
    var el=document.getElementById('rcv-total'); if(el) el.textContent='\u0e3f'+_fmt(t);
  }

  window.RcvPage = {
    openCreate: function(){
      _createItems=[{product_id:'',product_name:'',sku:'',qty:1,cost_price:0}];
      var p=document.getElementById('rcv-partner'); if(p) p.value='';
      var n=document.getElementById('rcv-note'); if(n) n.value='';
      var img=document.getElementById('rcv-img'); if(img) img.value='';
      var imgn=document.getElementById('rcv-img-name'); if(imgn) imgn.textContent='';
      var ps=document.getElementById('rcv-prod-search'); if(ps) ps.value='';
      _renderItems();
      _calcTotal();
      document.getElementById('rcv-sheet').style.display='block';
      document.getElementById('rcv-overlay').style.display='block';
      document.body.style.overflow='hidden';
    },
    closeCreate: function(){
      document.getElementById('rcv-sheet').style.display='none';
      document.getElementById('rcv-overlay').style.display='none';
      document.body.style.overflow='';
    },
    openHistory: function(){
      _renderHistList('');
      var hq=document.getElementById('rcv-hq'); if(hq) hq.value='';
      document.getElementById('rcv-hist-sheet').style.display='block';
      document.getElementById('rcv-hist-overlay').style.display='block';
      document.body.style.overflow='hidden';
    },
    closeHistory: function(){
      document.getElementById('rcv-hist-sheet').style.display='none';
      document.getElementById('rcv-hist-overlay').style.display='none';
      document.body.style.overflow='';
    },
    openDetail: function(id){
      var r=null; for(var i=0;i<_items.length;i++){ if(_items[i].id===id){ r=_items[i]; break; } }
      if(!r) return;
      RcvPage._showDetail(r);
      document.getElementById('rcv-det-sheet').style.display='block';
      document.getElementById('rcv-det-overlay').style.display='block';
      document.body.style.overflow='hidden';
    },
    openDetailFromHist: function(id){
      var r=null; for(var i=0;i<_items.length;i++){ if(_items[i].id===id){ r=_items[i]; break; } }
      if(!r) return;
      RcvPage._showDetail(r);
      document.getElementById('rcv-det-sheet').style.display='block';
      document.getElementById('rcv-det-overlay').style.display='block';
    },
    _showDetail: function(r){
      var dt=r.receive_date||r.created_at||'';
      var ds=dt?new Date(dt).toLocaleDateString('th-TH',{day:'2-digit',month:'long',year:'numeric'}):'-';
      var items=r.items||[];
      var total=parseFloat(r.total_amount||0).toLocaleString('th-TH',{minimumFractionDigits:2});
      var h='<div style="font-size:var(--fs-md);font-weight:700;margin-bottom:14px">\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">';
      h+='<div><div style="font-size:var(--fs-xs);color:var(--muted)">\u0e04\u0e39\u0e48\u0e04\u0e49\u0e32</div><div style="font-size:var(--fs-sm);font-weight:600">'+(r.partner_name||'-')+'</div></div>';
      h+='<div><div style="font-size:var(--fs-xs);color:var(--muted)">\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48</div><div style="font-size:var(--fs-sm)">'+ds+'</div></div>';
      h+='<div><div style="font-size:var(--fs-xs);color:var(--muted)">\u0e1c\u0e39\u0e49\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01</div><div style="font-size:var(--fs-sm)">'+(r.staff_name||'-')+'</div></div>';
      h+='<div><div style="font-size:var(--fs-xs);color:var(--muted)">\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38</div><div style="font-size:var(--fs-sm)">'+(r.note||'-')+'</div></div>';
      h+='</div>';
      if(r.bill_image_url) h+='<img src="'+r.bill_image_url+'" style="width:100%;border-radius:8px;margin-bottom:14px;max-height:180px;object-fit:contain">';
      h+='<div style="font-size:var(--fs-xs);font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 ('+items.length+')</div>';
      h+='<div style="border:1px solid var(--bdr);border-radius:10px;overflow:hidden;margin-bottom:14px">';
      for(var j=0;j<items.length;j++){
        var it=items[j];
        h+='<div style="padding:10px 12px;'+(j?'border-top:1px solid var(--bdr)':'')+'"><div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center">';
        h+='<div><div style="font-size:var(--fs-sm);font-weight:500">'+(it.product_name||'-')+'</div>';
        h+='<div style="font-size:var(--fs-xs);color:var(--muted)">'+(it.sku||'')+' \u00b7 '+(it.warehouse||'back')+'</div></div>';
        h+='<div style="font-size:var(--fs-xs);color:var(--muted)">x'+it.qty+'</div>';
        h+='<div style="font-size:var(--fs-xs);color:var(--muted)">\u0e3f'+parseFloat(it.cost_price||0).toLocaleString()+'</div>';
        h+='<div style="font-size:var(--fs-sm);font-weight:600">\u0e3f'+_fmt((it.qty||0)*(it.cost_price||0))+'</div>';
        h+='</div></div>';
      }
      h+='</div>';
      h+='<div style="display:flex;justify-content:space-between;font-weight:700;font-size:var(--fs-md);padding:8px 0;border-top:1px solid var(--bdr)">';
      h+='<span>\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21</span><span style="color:var(--gold)">\u0e3f'+total+'</span></div>';
      document.getElementById('rcv-det-body').innerHTML=h;
    },
    closeDetail: function(){
      document.getElementById('rcv-det-sheet').style.display='none';
      document.getElementById('rcv-det-overlay').style.display='none';
      document.body.style.overflow='';
    },
    rcSearchProd: function(val){
      if(!val) return;
      var dl=document.getElementById('rcv-prod-list');
      if(!dl) return;
      var opt=dl.querySelector('option[value="'+val.replace(/"/g,'\\"')+'"]');
      if(opt){
        var pid=opt.getAttribute('data-id');
        var p=null; for(var i=0;i<_products.length;i++){ if(_products[i].id===pid){ p=_products[i]; break; } }
        if(p){
          _createItems.push({product_id:p.id,product_name:p.name,sku:p.sku||'',qty:1,cost_price:parseFloat(p.cost_price||0),warehouse:'back'});
          _renderItems();
          _calcTotal();
          var ps=document.getElementById('rcv-prod-search'); if(ps) ps.value='';
        }
      }
    },
    rcAddItem: function(){
      _createItems.push({product_id:'',product_name:'',sku:'',qty:1,cost_price:0,warehouse:'back'});
      _renderItems();
      _calcTotal();
    },
    rcSetProduct: function(i,name){
      var dl=document.getElementById('rcv-prod-list');
      if(dl){
        var opt=dl.querySelector('option[value="'+name.replace(/"/g,'\\"')+'"]');
        if(opt){
          _createItems[i].product_id=opt.getAttribute('data-id');
          _createItems[i].product_name=name;
          _createItems[i].sku=opt.getAttribute('data-sku')||'';
          _createItems[i].cost_price=parseFloat(opt.getAttribute('data-cost'))||0;
          _renderItems();
        } else {
          _createItems[i].product_name=name;
        }
      }
      _calcTotal();
    },
    rcSetQty: function(i,v){ _createItems[i].qty=parseFloat(v)||1; _calcTotal(); },
    rcSetCost: function(i,v){ _createItems[i].cost_price=parseFloat(v)||0; _calcTotal(); },
    rcRemove: function(i){
      _createItems.splice(i,1);
      if(!_createItems.length) _createItems.push({product_id:'',product_name:'',sku:'',qty:1,cost_price:0,warehouse:'back'});
      _renderItems();
      _calcTotal();
    },
    save: async function(){
      var valid=_createItems.filter(function(it){ return it.product_id && it.qty>0; });
      if(!valid.length){ App.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 1 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23'); return; }
      var btn=document.getElementById('rcv-save');
      if(btn){ btn.disabled=true; btn.textContent='\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01...'; }
      try{
        var pName=(document.getElementById('rcv-partner').value||'').trim();
        var partner=null; for(var i=0;i<_partners.length;i++){ if(_partners[i].company_name===pName){ partner=_partners[i]; break; } }
        var payload={
          partner_id: partner?partner.id:'',
          partner_name: pName,
          partner_code: partner?partner.partner_code||'':'',
          note: (document.getElementById('rcv-note').value||'').trim(),
          items: valid.map(function(it){ return {product_id:it.product_id,product_name:it.product_name,sku:it.sku,qty:it.qty,cost_price:it.cost_price,warehouse:'back'}; }),
          total_amount: valid.reduce(function(s,it){ return s+it.qty*(it.cost_price||0); },0)
        };
        var result=await App.api('/api/pos/receive/create',{method:'POST',body:JSON.stringify(payload)});
        var imgFile=document.getElementById('rcv-img').files[0];
        if(imgFile&&result.id){
          var fd=new FormData(); fd.append('file',imgFile);
          await fetch('/api/pos/receive/upload-bill/'+result.id,{method:'POST',headers:{'Authorization':'Bearer '+App.getToken()},body:fd}).catch(function(){});
        }
        App.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e31\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27');
        RcvPage.closeCreate();
        _createItems=[];
        await _load();
      }catch(e){
        App.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: '+e.message);
      }finally{
        if(btn){ btn.disabled=false; btn.textContent='\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01'; }
      }
    }
  };
})();
