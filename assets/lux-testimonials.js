(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initCarousel(carousel) {
    const track = carousel.querySelector('[data-lux-t-track]');
    const slides = Array.from(carousel.querySelectorAll('[data-lux-t-slide]'));
    if (!track) return;

    if (slides.length <= 1) {
      track.style.transform = 'translate3d(0, 0, 0)';
      return;
    }

    const viewport = carousel.querySelector('[data-lux-t-viewport]');
    const prevBtn = carousel.querySelector('[data-lux-t-prev]');
    const nextBtn = carousel.querySelector('[data-lux-t-next]');
    const dots = Array.from(carousel.querySelectorAll('[data-lux-t-dot]'));
    const section = carousel.closest('[data-lux-testimonials]');
    const autoplay = section?.dataset.autoplay === 'true' && !reducedMotion;
    const speed = parseInt(section?.dataset.speed, 10) || 6000;

    let index = slides.findIndex((s) => s.classList.contains('is-active'));
    if (index < 0) index = 0;

    let timer = null;
    let touchStartX = 0;
    let touchDeltaX = 0;

    function setActive(next) {
      index = (next + slides.length) % slides.length;
      track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;

      slides.forEach((slide, i) => {
        const active = i === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
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

    viewport?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
        startAutoplay();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
        startAutoplay();
      }
    });

    viewport?.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchDeltaX = 0;
        stopAutoplay();
      },
      { passive: true }
    );

    viewport?.addEventListener(
      'touchmove',
      (e) => {
        touchDeltaX = e.changedTouches[0].screenX - touchStartX;
      },
      { passive: true }
    );

    viewport?.addEventListener(
      'touchend',
      () => {
        if (Math.abs(touchDeltaX) > 48) {
          if (touchDeltaX < 0) next();
          else prev();
        }
        startAutoplay();
      },
      { passive: true }
    );

    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
    carousel.addEventListener('focusin', stopAutoplay);
    carousel.addEventListener('focusout', startAutoplay);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoplay();
      else startAutoplay();
    });

    setActive(index);
    startAutoplay();
  }

  function init(root) {
    if (!root || root.dataset.luxTInit === 'true') return;
    root.dataset.luxTInit = 'true';
    const carousel = root.querySelector('[data-lux-t-carousel]');
    if (carousel) initCarousel(carousel);
  }

  document.querySelectorAll('[data-lux-testimonials]').forEach(init);
  document.addEventListener('shopify:section:load', (e) => {
    const section = e.target.querySelector?.('[data-lux-testimonials]') || e.target.closest?.('[data-lux-testimonials]');
    if (section) init(section);
  });
})();
