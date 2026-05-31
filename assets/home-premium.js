(() => {
  if (window.__homePremiumInit) return;
  window.__homePremiumInit = true;

  const root = document.querySelector('[data-home-premium]');
  if (!root) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Scroll reveal */
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revealEls = root.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    root.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
  }

  /* Course category filter */
  const courseSection = root.querySelector('[data-course-filter]');
  if (courseSection) {
    const tabs = courseSection.querySelectorAll('[data-course-tab]');
    const cards = courseSection.querySelectorAll('[data-course-card]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const filter = tab.dataset.courseTab;
        tabs.forEach((t) => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        cards.forEach((card) => {
          const match = filter === 'all' || card.dataset.courseCategory === filter;
          card.hidden = !match;
          card.classList.toggle('is-filtered-out', !match);
        });
      });
    });
  }

  /* Testimonial carousel */
  const carousel = root.querySelector('[data-testimonial-carousel]');
  if (carousel) {
    const track = carousel.querySelector('[data-testimonial-track]');
    const slides = carousel.querySelectorAll('[data-testimonial-slide]');
    const prev = carousel.querySelector('[data-testimonial-prev]');
    const next = carousel.querySelector('[data-testimonial-next]');
    const dots = carousel.querySelector('[data-testimonial-dots]');
    let index = 0;

    if (slides.length > 1 && track) {
      const go = (i) => {
        index = (i + slides.length) % slides.length;
        track.style.transform = `translateX(-${index * 100}%)`;
        if (dots) {
          dots.querySelectorAll('button').forEach((btn, idx) => {
            btn.classList.toggle('is-active', idx === index);
            btn.setAttribute('aria-selected', idx === index ? 'true' : 'false');
          });
        }
      };

      if (dots) {
        slides.forEach((_, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'hp-testimonials__dot' + (idx === 0 ? ' is-active' : '');
          btn.setAttribute('aria-label', `Show testimonial ${idx + 1}`);
          btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
          btn.addEventListener('click', () => go(idx));
          dots.appendChild(btn);
        });
      }

      prev?.addEventListener('click', () => go(index - 1));
      next?.addEventListener('click', () => go(index + 1));

      if (!reducedMotion) {
        let autoplay = setInterval(() => go(index + 1), 7000);
        carousel.addEventListener('mouseenter', () => clearInterval(autoplay));
        carousel.addEventListener('focusin', () => clearInterval(autoplay));
      }
    }
  }

  /* Subtle hero parallax */
  if (!reducedMotion) {
    const heroVisual = root.querySelector('[data-hero-parallax]');
    if (heroVisual) {
      window.addEventListener(
        'scroll',
        () => {
          const y = window.scrollY;
          if (y < window.innerHeight) {
            heroVisual.style.transform = `translateY(${y * 0.06}px)`;
          }
        },
        { passive: true }
      );
    }
  }
})();
