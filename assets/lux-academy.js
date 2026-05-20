/**
 * Academy catalog — search, filters, quiet-luxury reveals
 */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NAD_RE = /\bnadi\b/;

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function isNadiItem(el) {
    const blob = (el.dataset.search || '').toLowerCase();
    return NAD_RE.test(blob);
  }

  function initReveal(section) {
    const headers = section.querySelectorAll('[data-academy-reveal]');
    const items = section.querySelectorAll('.lux-academy__grid-item:not([hidden])');

    items.forEach((el, i) => {
      el.style.setProperty('--reveal-i', String(Math.min(i, 14)));
    });

    if (REDUCED) {
      headers.forEach((el) => el.classList.add('is-visible'));
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const targets = [...headers, ...items];
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
    );

    targets.forEach((el) => observer.observe(el));
  }

  function initSection(section) {
    section.classList.add('lux-academy--animate');

    const search = section.querySelector('[data-academy-search]');
    const emptyEl = section.querySelector('[data-academy-empty]');

    section.querySelectorAll('[data-academy-item]').forEach((el) => {
      if (isNadiItem(el)) el.hidden = true;
    });

    const items = () =>
      Array.from(section.querySelectorAll('[data-academy-item]')).filter((el) => !el.hidden && !isNadiItem(el));

    function update(query) {
      const q = query.trim().toLowerCase();
      const all = items();
      let visible = 0;

      all.forEach((el) => {
        const blob = el.dataset.search || '';
        const show = !q || blob.includes(q);
        el.hidden = !show;
        if (show) {
          visible += 1;
          if (!REDUCED) el.classList.add('is-visible');
        }
      });

      if (emptyEl) emptyEl.hidden = visible > 0;
    }

    initReveal(section);
    update('');

    if (search) {
      search.addEventListener('input', debounce(() => update(search.value), 100));
      search.addEventListener('search', () => update(search.value));
    }
  }

  function initHeroNav() {
    document.querySelectorAll('.lux-academy-hero__btn[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        const target = id && document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', id);
      });
    });
  }

  function boot() {
    document.querySelectorAll('[data-lux-academy]').forEach(initSection);
    initHeroNav();

    window.setTimeout(() => {
      document
        .querySelectorAll('.lux-academy__grid-item:not(.is-visible), [data-academy-reveal]:not(.is-visible)')
        .forEach((el) => el.classList.add('is-visible'));
    }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
