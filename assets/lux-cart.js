/**
 * Keeps Lux header cart badges in sync with Shopify cart AJAX updates.
 * Dawn's cart-notification/cart-drawer update #cart-icon-bubble; this theme uses [data-cart-count].
 */
(function () {
  if (window.__luxCartInit) return;
  window.__luxCartInit = true;

  function syncLuxCartCount(itemCount) {
    const count = Number(itemCount);
    if (!Number.isFinite(count) || count < 0) return;

    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      if (count > 0) {
        el.textContent = count < 100 ? String(count) : '99+';
        el.hidden = false;
        el.classList.add('is-active');
      } else {
        el.textContent = '';
        el.hidden = true;
        el.classList.remove('is-active');
      }
    });

    document.querySelectorAll('.lux-icon-btn--cart').forEach((link) => {
      link.setAttribute('aria-label', count > 0 ? `Cart, ${count} items` : 'Cart');
    });
  }

  window.syncLuxCartCount = syncLuxCartCount;

  if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
    subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      const cartData = event?.cartData;
      if (cartData && typeof cartData.item_count !== 'undefined') {
        syncLuxCartCount(cartData.item_count);
      }
    });
  }
})();
