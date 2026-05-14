(function () {
  var KEY = 'viiv_lang';

  function get() { return localStorage.getItem(KEY) || 'th'; }
  function set(lang) { localStorage.setItem(KEY, lang); apply(lang); }

  function apply(lang) {
    document.querySelectorAll('[data-lang]').forEach(function (el) {
      el.style.display = el.getAttribute('data-lang') === lang ? '' : 'none';
    });
    var btn = document.querySelector('.lang-toggle');
    if (btn) btn.textContent = lang === 'th' ? 'EN' : 'TH';
    document.documentElement.lang = lang;
  }

  document.addEventListener('DOMContentLoaded', function () {
    apply(get());
    var btn = document.querySelector('.lang-toggle');
    if (btn) btn.addEventListener('click', function () {
      set(get() === 'th' ? 'en' : 'th');
    });
  });
})();
