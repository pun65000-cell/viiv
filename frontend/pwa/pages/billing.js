/* VIIV PWA — billing.js */
Router.register('billing', {
  title: 'billing',
  async load(params) {
    const c = document.getElementById('page-container');
    c.innerHTML = '<div class="p" style="text-align:center;padding:40px;color:var(--muted);">Loading billing...</div>';
  },
  destroy() {}
});
