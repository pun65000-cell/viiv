/* VIIV PWA — products.js */
Router.register('products', {
  title: 'products',
  async load(params) {
    const c = document.getElementById('page-container');
    c.innerHTML = '<div class="p" style="text-align:center;padding:40px;color:var(--muted);">Loading products...</div>';
  },
  destroy() {}
});
