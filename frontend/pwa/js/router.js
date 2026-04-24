/* VIIV PWA Router
   SPA navigation — no iframe, no reload
   Pull-to-refresh: native (works because no iframe)
*/

const Router = {
  stack: [],      // navigation history
  current: null,  // current page id
  pages: {},      // registered pages

  // register a page
  register(id, { title, load, destroy }) {
    Router.pages[id] = { id, title, load, destroy };
  },

  // navigate to page
  async go(id, params = {}, opts = {}) {
    const page = Router.pages[id];
    if (!page) { console.warn('Page not found:', id); return; }

    // save to stack
    if (!opts.replace) {
      Router.stack.push({ id: Router.current, params: Router._currentParams });
    }

    // update history for back button
    history.pushState({ page: id, params }, '', `#${id}`);

    // render
    await Router._render(page, params);
  },

  // go back
  async back() {
    if (Router.stack.length === 0) {
      await Router.go('home', {}, { replace: true });
      return;
    }
    history.back();
  },

  async _render(page, params) {
    // destroy previous page — clears timers & event listeners (prevents PTR overlap)
    const prevId = Router.current;
    if (prevId && prevId !== page.id && Router.pages[prevId]?.destroy) {
      Router.pages[prevId].destroy();
    }

    Router.current = page.id;
    Router._currentParams = params;

    // topbar
    const title = document.getElementById('tb-title');
    const logo  = document.getElementById('tb-logo');
    const back  = document.getElementById('tb-back');

    if (page.id === 'home') {
      if (title) title.style.display = 'none';
      if (logo)  logo.style.display = 'block';
      if (back)  back.classList.remove('show');
    } else {
      if (title) { title.textContent = page.title || ''; title.style.display = 'block'; }
      if (logo)  logo.style.display = 'none';
      if (back)  back.classList.add('show');
    }

    // navbar active
    document.querySelectorAll('.nb-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page.id);
    });

    // scroll to top
    const container = document.getElementById('page-container');
    if (container) container.scrollTop = 0;

    // load page content
    await page.load(params);
  },

  // init
  init() {
    // bind all methods to Router object
    Router.go = Router.go.bind(this);
    Router.back = Router.back.bind(this);
    Router._render = Router._render.bind(this);
    // Android back button
    window.addEventListener('popstate', async (e) => {
      const id = e.state?.page;
      const params = e.state?.params || {};
      if (id && Router.pages[id]) {
        await Router._render(Router.pages[id], params);
      } else {
        await Router._render(Router.pages['home'], {});
      }
    });

    // initial state
    const hash = location.hash.replace('#', '') || 'home';
    const startPage = Router.pages[hash] ? hash : 'home';
    history.replaceState({ page: startPage, params: {} }, '', '#' + startPage);
    Router.go(startPage, {}, { replace: true });
  }
};
