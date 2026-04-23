/* VIIV PWA — more.js */
Router.register('more', {
  title: 'more',
  async load(params) {
    const c = document.getElementById('page-container');
    c.innerHTML = '<div class="p" style="text-align:center;padding:40px;color:var(--muted);">Loading more...</div>';
  },
  destroy() {}
});
