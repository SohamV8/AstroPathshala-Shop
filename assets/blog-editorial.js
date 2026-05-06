/**
 * Editorial blog: reading progress, optional TOC from headings.
 * Passive listeners + rAF throttle for INP.
 */
(() => {
  function throttleRaf(fn) {
    let ticking = false;
    return function handler() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        fn();
      });
    };
  }

  function setupProgress() {
    const bar = document.querySelector('[data-article-progress]');
    if (!bar) return;

    const article = document.querySelector('[data-editorial-article]');
    if (!article) return;

    const rootArticle = article.closest('article.article-editorial');
    if (rootArticle && rootArticle.hasAttribute('data-hide-reading-progress')) {
      bar.style.display = 'none';
      return;
    }

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function update() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const start = article.offsetTop;
      const end = Math.max(start + article.offsetHeight - window.innerHeight, start + 1);
      let pct = 0;
      if (scrollTop <= start) pct = 0;
      else if (scrollTop >= end) pct = 100;
      else pct = ((scrollTop - start) / (end - start)) * 100;

      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    if (prefersReduced) {
      bar.style.display = 'none';
      bar.setAttribute('aria-hidden', 'true');
      return;
    }

    bar.removeAttribute('aria-hidden');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuetext', 'Reading progress');

    const run = throttleRaf(update);
    window.addEventListener('scroll', run, { passive: true });
    window.addEventListener('resize', run, { passive: true });
    update();
  }

  function setupToc() {
    const root = document.querySelector('[data-editorial-toc-root]');
    if (!root) return;

    const host = root.closest('.article-editorial');
    if (host && host.classList.contains('article-editorial--no-toc')) return;

    const list = root.querySelector('[data-toc-list]');
    const prose = document.querySelector('[data-editorial-prose]');
    if (!list || !prose) return;

    const headings = prose.querySelectorAll('h2, h3');
    if (!headings.length) return;

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    headings.forEach((el, i) => {
      const id = el.id || `heading-${i + 1}-${Math.random().toString(36).slice(2, 8)}`;
      el.id = id;
      el.setAttribute('tabindex', '-1');

      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#' + id;
      link.textContent = el.textContent.trim() || 'Section ' + (i + 1);
      if (el.tagName === 'H3') link.classList.add('article-editorial__toc-h3');

      if (!prefersReduced) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          try {
            history.replaceState(null, '', '#' + id);
          } catch (_) {
            /* ignore */
          }
        });
      }

      item.appendChild(link);
      list.appendChild(item);
    });

    root.classList.remove('is-empty');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupProgress();
      setupToc();
    });
  } else {
    setupProgress();
    setupToc();
  }
})();
