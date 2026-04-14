/**
 * VIIV Bill Logic — shared between billing/create.html and easysale/pos.html
 * expose via window.BillLogic
 */
(function(){
'use strict';

var API = (location.hostname === 'merchant.viiv.me') ? '' : 'https://concore.viiv.me';
var TOKEN = '';
var allProducts = [];
var billItems = [];
window._billTotal = 0;

window.BillLogic = {

  init: function(token){
    TOKEN = token || window.VIIV_TOKEN || localStorage.getItem('viiv_token') || '';
    this.loadProducts();
  },

  loadProducts: function(){
    fetch(API+'/api/pos/products/list', {headers:{'Authorization':'Bearer '+TOKEN}})
      .then(function(r){ return r.json(); })
      .then(function(d){
        allProducts = d.products || d || [];
        if(typeof window.BillUI !== 'undefined' && window.BillUI.onProductsLoaded)
          window.BillUI.onProductsLoaded(allProducts);
      });
  },

  getProducts: function(){ return allProducts; },
  getItems: function(){ return billItems; },

  searchProducts: function(q){
    if(!q) return [];
    q = q.toLowerCase();
    return allProducts.filter(function(p){
      return (p.name||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q);
    }).slice(0,8);
  },

  addItem: function(id){
    var p = allProducts.find(function(x){ return x.id === id; });
    if(!p) return null;
    var existing = billItems.find(function(i){ return i.id === id; });
    if(existing){
      existing.qty++;
    } else {
      billItems.push({
        id: p.id, sku: p.sku||'', name: p.name,
        qty: 1,
        price: parseFloat(p.price)||0,
        price_min: parseFloat(p.price_min)||parseFloat(p.price)||0,
        price_options: [
          {label:'ราคาขาย P1', value: parseFloat(p.price)||0},
          ...(p.price_min && p.price_min < p.price
            ? [{label:'ราคาต่ำสุด PL', value: parseFloat(p.price_min)}]
            : []),
        ],
      });
    }
    return billItems;
  },

  updateQty: function(i, v){ billItems[i].qty = parseInt(v)||1; },
  updatePrice: function(i, v){ billItems[i].price = parseFloat(v)||0; },
  removeItem: function(i){ billItems.splice(i,1); },
  clearItems: function(){ billItems = []; },

  calc: function(discountVal, discountType, vatRate){
    var sub = billItems.reduce(function(s,i){ return s+(i.qty*i.price); }, 0);
    var disc = discountType==='percent' ? sub*discountVal/100 : discountVal;
    var afterDisc = Math.max(0, sub-disc);
    var vat = afterDisc * vatRate / 100;
    var total = afterDisc + vat;
    window._billTotal = total;
    return { subtotal: sub, discount: disc, vat: vat, total: total };
  },

  calcChange: function(paid){
    return paid - (window._billTotal||0);
  },

  buildBill: function(opts){
    return {
      id: 'BILL_'+Date.now(),
      doc_type: opts.docType||'receipt',
      items: billItems.slice(),
      customer: opts.customer||'',
      note: opts.note||'',
      subtotal: billItems.reduce(function(s,i){return s+(i.qty*i.price);},0),
      discount: opts.discount||0,
      discount_type: opts.discountType||'amount',
      vat: opts.vat||0,
      total: window._billTotal||0,
      pay_method: opts.payMethod||'cash',
      paid: opts.paid||0,
      delivery_date: opts.deliveryDate||null,
      quotation_days: opts.quotationDays||null,
      reserve_date: opts.reserveDate||null,
      created_at: new Date().toISOString(),
      status: opts.status||'paid',
    };
  },

  saveBill: function(bill){
    var bills = JSON.parse(localStorage.getItem('viiv_bills')||'[]');
    bills.unshift(bill);
    localStorage.setItem('viiv_bills', JSON.stringify(bills.slice(0,500)));
    return bill;
  },

  getBills: function(filter){
    var bills = JSON.parse(localStorage.getItem('viiv_bills')||'[]');
    if(!filter) return bills;
    return bills.filter(function(b){
      if(filter.doc_type && b.doc_type !== filter.doc_type) return false;
      if(filter.status && b.status !== filter.status) return false;
      if(filter.q){
        var q = filter.q.toLowerCase();
        return (b.customer||'').toLowerCase().includes(q) ||
               (b.id||'').toLowerCase().includes(q);
      }
      return true;
    });
  },

};

// รับ token จาก parent
window.addEventListener('viiv_token_ready', function(e){
  if(e.detail && e.detail.token) BillLogic.init(e.detail.token);
});

})();
