/* Quota Bar — shared helper for Superboard PC modules */
(function() {
  'use strict';

  function _getToken() {
    try {
      return localStorage.getItem('viiv_token')
          || (window.parent && window.parent.localStorage.getItem('viiv_token'))
          || '';
    } catch(e) {
      return localStorage.getItem('viiv_token') || '';
    }
  }

  var API = '';

  window.loadQuotaBar = async function(type, customElId) {
    try {
      var elId = customElId || ('quota-bar-' + type);
      var el = document.getElementById(elId);
      if (!el) return;
      var token = _getToken();
      if (!token) return;

      var apiKey = type.replace('-list', '').replace('-modal', '');

      var res = await fetch(API + '/api/platform/gateway/quota-status', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return;
      var data = await res.json();
      var q = data[apiKey];
      if (q) renderQuotaBar(elId, apiKey, q);
    } catch(e) {}
  };

  function renderQuotaBar(elId, type, q) {
    var el = document.getElementById(elId);
    if (!el) return;

    var labelText = type === 'members' ? 'สมาชิก + คู่ค้า' : 'สินค้า + Affiliate';
    var unitText  = type === 'members' ? 'ที่นั่ง' : 'ชิ้น';

    if (q.limit === -1 || q.limit === null) {
      el.innerHTML =
        '<div class="qbar"><div class="qbar-row">' +
        '<span class="qbar-label">' + labelText + '</span>' +
        '<span class="qbar-unlim">ไม่จำกัด (' + (q.current||0).toLocaleString() + ' รายการ)</span>' +
        '</div></div>';
      return;
    }
    var cur = q.current || 0, lim = q.limit;
    var pct = lim > 0 ? Math.min(100, Math.round(cur/lim*100)) : 0;
    var rem = Math.max(0, lim - cur);
    var color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f97316' : '#e8b93e';
    var remCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : '';

    el.innerHTML =
      '<div class="qbar">' +
        '<div class="qbar-row"><span class="qbar-label">' + labelText + '</span>' +
        '<span class="qbar-num">' + cur.toLocaleString() + ' / ' + lim.toLocaleString() + '</span></div>' +
        '<div class="qbar-track"><div class="qbar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
        '<div class="qbar-row"><span class="qbar-rem ' + remCls + '">เหลือ ' + rem.toLocaleString() + ' ' + unitText + '</span>' +
        '<span class="qbar-pct">' + pct + '%</span></div>' +
      '</div>';
  }

  // Inject CSS once
  if (!document.getElementById('qbar-css')) {
    var style = document.createElement('style');
    style.id = 'qbar-css';
    style.textContent =
      '.qbar{padding:10px 12px;background:#fffbf0;border:1px solid #f0e4b8;border-radius:8px;margin:8px 0 12px;font-family:inherit}' +
      '.qbar-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}' +
      '.qbar-row:last-child{margin-bottom:0}' +
      '.qbar-label{font-size:12px;color:#6b7280;font-weight:500}' +
      '.qbar-num{font-size:12px;font-weight:600;color:#1f2937}' +
      '.qbar-track{height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden;margin:4px 0}' +
      '.qbar-fill{height:100%;border-radius:3px;transition:width .3s}' +
      '.qbar-rem{font-size:11px;color:#6b7280}' +
      '.qbar-rem.warning{color:#f97316;font-weight:600}' +
      '.qbar-rem.danger{color:#ef4444;font-weight:600}' +
      '.qbar-pct{font-size:11px;color:#9ca3af}' +
      '.qbar-unlim{font-size:12px;color:#6b7280}';
    document.head.appendChild(style);
  }
})();
