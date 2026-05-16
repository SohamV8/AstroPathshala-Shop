/**
 * Astro Pathshala — Premium Search (Shopify Predictive Search API)
 */
(() => {
  const RECENT_KEY = 'lux-search-recent-v1';
  const RECENT_MAX = 8;
  const DEBOUNCE_MS = 180;
  const CACHE_MAX = 40;

  const configEl = document.querySelector('[data-lux-search-config]');
  const config = configEl ? JSON.parse(configEl.textContent) : {};
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled])';

  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const highlight = (text, query) => {
    if (!query || !text) return escapeHtml(text);
    const q = query.trim();
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(text).replace(re, '<mark class="lux-search-mark">$1</mark>');
  };

  const formatMoney = (cents) => {
    if (cents == null || cents === '') return '';
    const amount = Number(cents) / 100;
    const fmt = config.moneyFormat || '${{amount}}';
    const value = amount.toFixed(2);
    return fmt.replace(/\{\{\s*amount\s*\}\}/, value).replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(amount).toString());
  };

  const getRecent = () => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const saveRecent = (term) => {
    const t = term.trim();
    if (!t) return;
    let list = getRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
    list.unshift(t);
    list = list.slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  };

  class LuxSearch {
    constructor() {
      this.modal = document.querySelector('[data-lux-search-modal]');
      if (!this.modal) return;

      this.panel = this.modal.querySelector('[data-lux-search-panel]');
      this.input = this.modal.querySelector('[data-lux-search-input]');
      this.form = this.modal.querySelector('[data-lux-search-form]');
      this.clearBtn = this.modal.querySelector('[data-lux-search-clear]');
      this.idle = this.modal.querySelector('[data-lux-search-idle]');
      this.live = this.modal.querySelector('[data-lux-search-live]');
      this.loading = this.modal.querySelector('[data-lux-search-loading]');
      this.groups = this.modal.querySelector('[data-lux-search-groups]');
      this.footer = this.modal.querySelector('[data-lux-search-footer]');
      this.viewAll = this.modal.querySelector('[data-lux-search-view-all]');
      this.status = this.modal.querySelector('[data-lux-search-status]');
      this.recentWrap = this.modal.querySelector('[data-lux-search-recent-wrap]');
      this.recentList = this.modal.querySelector('[data-lux-search-recent]');

      this.cache = new Map();
      this.abort = null;
      this.activeIndex = -1;
      this.items = [];
      this.isOpen = false;
      this.lastFocused = null;

      this.bind();
      this.renderRecent();
    }

    bind() {
      document.querySelectorAll('[data-lux-search-open]').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          this.open();
        });
      });

      document.querySelectorAll('.lux-search-inline--desktop').forEach((form) => {
        form.addEventListener('click', (e) => {
          if (e.target.closest('input')) {
            e.preventDefault();
            this.open();
          }
        });
        const input = form.querySelector('input');
        if (input) {
          input.addEventListener('focus', (e) => {
            e.preventDefault();
            input.blur();
            this.open();
          });
        }
      });

      this.modal.querySelectorAll('[data-lux-search-close]').forEach((b) =>
        b.addEventListener('click', () => this.close())
      );

      this.modal.querySelectorAll('[data-lux-search-chip]').forEach((chip) =>
        chip.addEventListener('click', () => this.applyTerm(chip.dataset.luxSearchChip))
      );

      this.clearBtn?.addEventListener('click', () => {
        this.input.value = '';
        this.onInput();
        this.input.focus();
      });

      this.form?.addEventListener('submit', (e) => {
        const q = this.input.value.trim();
        if (!q) {
          e.preventDefault();
          return;
        }
        saveRecent(q);
      });

      this.input?.addEventListener('input', debounce(() => this.onInput(), DEBOUNCE_MS));
      this.input?.addEventListener('keydown', (e) => this.onKeydown(e));

      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.isOpen ? this.close() : this.open();
        }
        if (e.key === 'Escape' && this.isOpen) this.close();
      });
    }

    renderRecent() {
      const recent = getRecent();
      if (!recent.length || !this.recentList) return;
      this.recentWrap.hidden = false;
      this.recentList.innerHTML = recent
        .map(
          (term) =>
            `<li><button type="button" class="lux-search-chip" data-lux-search-chip="${escapeHtml(term)}">${escapeHtml(term)}</button></li>`
        )
        .join('');
      this.recentList.querySelectorAll('[data-lux-search-chip]').forEach((chip) =>
        chip.addEventListener('click', () => this.applyTerm(chip.dataset.luxSearchChip))
      );
    }

    applyTerm(term) {
      this.input.value = term;
      this.onInput();
      this.input.focus();
    }

    open() {
      if (this.isOpen) return;
      this.isOpen = true;
      this.lastFocused = document.activeElement;
      this.modal.hidden = false;
      document.documentElement.classList.add('lux-search-open');
      requestAnimationFrame(() => {
        this.modal.classList.add('is-open');
        this.input.focus({ preventScroll: true });
        this.onInput();
      });
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.modal.classList.remove('is-open');
      document.documentElement.classList.remove('lux-search-open');
      this.abort?.abort();
      const finalize = () => {
        this.modal.hidden = true;
        this.resetResults();
      };
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) finalize();
      else setTimeout(finalize, 220);
      if (this.lastFocused?.focus) this.lastFocused.focus({ preventScroll: true });
    }

    onInput() {
      const q = this.input.value.trim();
      this.clearBtn.hidden = !q;
      this.viewAll.href = `${config.searchUrl}?q=${encodeURIComponent(q)}&options%5Bprefix%5D=last`;

      if (!q) {
        this.showIdle();
        return;
      }

      this.showLive();
      this.fetch(q);
    }

    showIdle() {
      this.idle.hidden = false;
      this.live.hidden = true;
      this.input.setAttribute('aria-expanded', 'false');
      this.activeIndex = -1;
      this.items = [];
    }

    showLive() {
      this.idle.hidden = true;
      this.live.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
    }

    resetResults() {
      this.groups.innerHTML = '';
      this.footer.hidden = true;
      this.loading.hidden = true;
      this.showIdle();
      this.input.value = '';
      this.clearBtn.hidden = true;
    }

    async fetch(term) {
      const key = term.toLowerCase();
      if (this.cache.has(key)) {
        this.render(term, this.cache.get(key));
        return;
      }

      this.loading.hidden = false;
      this.abort?.abort();
      this.abort = new AbortController();

      const url = new URL(config.suggestUrl, window.location.origin);
      url.searchParams.set('q', term);
      url.searchParams.set('resources[type]', 'product,article,page,collection,query');
      url.searchParams.set('resources[limit]', '8');
      url.searchParams.set('resources[limit_scope]', 'each');
      url.searchParams.set('resources[options][unavailable_products]', 'last');
      url.searchParams.set('resources[options][fields]', 'title,product_type,variants.title,vendor,tag,body');

      try {
        const res = await fetch(url.toString(), { signal: this.abort.signal });
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(key, data);
        if (this.input.value.trim().toLowerCase() === key) this.render(term, data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        this.renderEmpty(term);
      } finally {
        this.loading.hidden = true;
      }
    }

    normalize(data) {
      const r = data?.resources || {};
      const results = r.results || r;
      return {
        products: results.products || [],
        articles: results.articles || [],
        pages: results.pages || [],
        collections: results.collections || [],
        queries: r.queries || results.queries || [],
      };
    }

    typeLabel(type) {
      const map = {
        product: 'Product',
        article: 'Blog',
        page: 'Page',
        collection: 'Collection',
        query: 'Suggestion',
      };
      return map[type] || 'Result';
    }

    productBadge(p) {
      return p.product_type || p.vendor || 'Spiritual';
    }

    render(term, data) {
      const { products, articles, pages, collections, queries } = this.normalize(data);
      const q = term.trim();
      let html = '';
      this.items = [];

      const addGroup = (title, itemsHtml) => {
        if (!itemsHtml) return;
        html += `<section class="lux-search-group"><h3 class="lux-search-group__title">${escapeHtml(title)}</h3><ul class="lux-search-group__list" role="group">${itemsHtml}</ul></section>`;
      };

      let suggestionsHtml = '';
      queries.forEach((item, i) => {
        const text = item.text || item.styled_text?.replace(/<[^>]+>/g, '') || '';
        const url = item.url || `${config.searchUrl}?q=${encodeURIComponent(text)}`;
        const id = `lux-sr-q-${i}`;
        suggestionsHtml += `<li><a id="${id}" class="lux-search-result lux-search-result--compact" href="${escapeHtml(url)}" data-lux-search-item role="option"><span class="lux-search-result__meta">${highlight(text, q)}</span><span class="lux-search-result__badge">Suggestion</span></a></li>`;
        this.items.push({ elId: id, href: url });
      });
      collections.forEach((item, i) => {
        const id = `lux-sr-c-${i}`;
        suggestionsHtml += `<li><a id="${id}" class="lux-search-result lux-search-result--compact" href="${escapeHtml(item.url)}" data-lux-search-item role="option"><span class="lux-search-result__meta">${highlight(item.title, q)}</span><span class="lux-search-result__badge">Collection</span></a></li>`;
        this.items.push({ elId: id, href: item.url });
      });
      addGroup('Suggestions', suggestionsHtml);

      let productsHtml = '';
      products.forEach((p, i) => {
        const id = `lux-sr-p-${i}`;
        const img =
          (typeof p.image === 'string' ? p.image : p.image?.url) ||
          p.featured_image?.url ||
          '';
        const price =
          config.showPrice && p.price != null
            ? `<span class="lux-search-result__price">${formatMoney(p.price)}</span>`
            : '';
        productsHtml += `<li><a id="${id}" class="lux-search-result" href="${escapeHtml(p.url)}" data-lux-search-item role="option">
          ${img ? `<img class="lux-search-result__img" src="${escapeHtml(img)}" alt="" width="48" height="48" loading="lazy">` : '<span class="lux-search-result__img lux-search-result__img--placeholder" aria-hidden="true"></span>'}
          <span class="lux-search-result__body">
            <span class="lux-search-result__title">${highlight(p.title, q)}</span>
            <span class="lux-search-result__row"><span class="lux-search-result__badge">${escapeHtml(this.productBadge(p))}</span>${price}</span>
          </span>
        </a></li>`;
        this.items.push({ elId: id, href: p.url });
      });
      addGroup('Products', productsHtml);

      let contentHtml = '';
      [...articles, ...pages].forEach((item, i) => {
        const id = `lux-sr-a-${i}`;
        const type = item.published_at != null ? 'Blog' : 'Page';
        contentHtml += `<li><a id="${id}" class="lux-search-result lux-search-result--compact" href="${escapeHtml(item.url)}" data-lux-search-item role="option">
          <span class="lux-search-result__meta">${highlight(item.title, q)}</span>
          <span class="lux-search-result__badge">${type}</span>
        </a></li>`;
        this.items.push({ elId: id, href: item.url });
      });
      addGroup('Articles & pages', contentHtml);

      if (!html) {
        this.renderEmpty(term);
        return;
      }

      this.groups.innerHTML = html;
      this.footer.hidden = false;
      this.activeIndex = -1;
      const total = this.items.length;
      this.status.textContent = `${total} suggestion${total === 1 ? '' : 's'} for ${q}`;
    }

    renderEmpty(term) {
      const q = term.trim();
      const chips = Array.from(this.modal.querySelectorAll('.lux-search-modal__idle [data-lux-search-chip]'))
        .slice(0, 6)
        .map(
          (chip) =>
            `<li><button type="button" class="lux-search-chip" data-lux-search-chip="${escapeHtml(chip.dataset.luxSearchChip)}">${escapeHtml(chip.dataset.luxSearchChip)}</button></li>`
        )
        .join('');

      this.groups.innerHTML = `
        <div class="lux-search-empty">
          <p class="lux-search-empty__title">No results for “${escapeHtml(q)}”</p>
          <p class="lux-search-empty__text">Try a different spelling or explore trending topics.</p>
          <ul class="lux-search-chips lux-search-chips--wrap" role="list">${chips}</ul>
        </div>`;

      this.groups.querySelectorAll('[data-lux-search-chip]').forEach((chip) =>
        chip.addEventListener('click', () => this.applyTerm(chip.dataset.luxSearchChip))
      );
      this.footer.hidden = false;
      this.status.textContent = `No results for ${q}`;
      this.items = [];
    }

    onKeydown(e) {
      if (!this.isOpen) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        const nodes = this.getItemNodes();
        if (!nodes.length) return;
        this.activeIndex = (this.activeIndex + dir + nodes.length) % nodes.length;
        this.setActive(nodes);
      } else if (e.key === 'Enter' && this.activeIndex >= 0) {
        const nodes = this.getItemNodes();
        if (nodes[this.activeIndex]) {
          e.preventDefault();
          saveRecent(this.input.value.trim());
          nodes[this.activeIndex].click();
        }
      }
    }

    getItemNodes() {
      return Array.from(this.groups.querySelectorAll('[data-lux-search-item]'));
    }

    setActive(nodes) {
      nodes.forEach((n, i) => {
        const active = i === this.activeIndex;
        n.setAttribute('aria-selected', active ? 'true' : 'false');
        n.classList.toggle('is-active', active);
        if (active) {
          this.input.setAttribute('aria-activedescendant', n.id || '');
          n.scrollIntoView({ block: 'nearest' });
        }
      });
    }
  }

  const boot = () => {
    if (window.__luxSearch) return;
    window.__luxSearch = new LuxSearch();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  document.addEventListener('shopify:section:load', boot);
})();
