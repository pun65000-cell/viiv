/* VIIV PWA — orders.js */
Router.register('orders', {
  title: 'orders',
  async load(params) {
    const c = document.getElementById('page-container');
    c.innerHTML = '<div class="p" style="text-align:center;padding:40px;color:var(--muted);">Loading orders...</div>';
  },
  destroy() {}
});
