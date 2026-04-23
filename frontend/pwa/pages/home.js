/* VIIV PWA — home.js */
Router.register('home', {
  title: 'home',
  async load(params) {
    const c = document.getElementById('page-container');
    c.innerHTML = '<div class="p" style="text-align:center;padding:40px;color:var(--muted);">Loading home...</div>';
  },
  destroy() {}
});
