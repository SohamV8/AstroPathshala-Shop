(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initHero(root) {
    const slides = Array.from(root.querySelectorAll('[data-home-hero-slide]'));
    if (slides.length <= 1) return;

    const dots = Array.from(root.querySelectorAll('[data-home-hero-dot]'));
    const prevBtn = root.querySelector('[data-home-hero-prev]');
    const nextBtn = root.querySelector('[data-home-hero-next]');
    const autoplay = root.dataset.autoplay === 'true' && !reducedMotion;
    const speed = parseInt(root.dataset.speed, 10) || 6000;

    let index = slides.findIndex((s) => s.classList.contains('is-active'));
    if (index < 0) index = 0;

    let timer = null;

    function setActive(next) {
      index = (next + slides.length) % slides.length;

      slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === index);
      });

      dots.forEach((dot, i) => {
        const active = i === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    function next() {
      setActive(index + 1);
    }

    function prev() {
      setActive(index - 1);
    }

    function stopAutoplay() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();
      if (!autoplay) return;
      timer = setInterval(next, speed);
    }

    prevBtn?.addEventListener('click', () => {
      prev();
      startAutoplay();
    });

    nextBtn?.addEventListener('click', () => {
      next();
      startAutoplay();
    });

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const i = parseInt(dot.dataset.index, 10);
        if (!Number.isNaN(i)) {
          setActive(i);
          startAutoplay();
        }
      });
    });

    root.addEventListener('mouseenter', stopAutoplay);
    root.addEventListener('mouseleave', startAutoplay);
    root.addEventListener('focusin', stopAutoplay);
    root.addEventListener('focusout', startAutoplay);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoplay();
      else startAutoplay();
    });

    startAutoplay();
  }

  function boot() {
    document.querySelectorAll('[data-home-hero]').forEach(initHero);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
