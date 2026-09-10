/**
 * APEX INFRASTRUCTURE — Application Controller
 * Manages all UI interactions, scroll control, frame sync, nav, forms.
 */
(function () {
  'use strict';

  // ─── DOM References ────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // ─── Scene Configuration ───────────────────────────────────────────────────
  // Maps frame ranges to HUD architectural sequence phases
  const SCENES = [
    { start: 0,   end: 50,  label: 'EXTERIOR PERSPECTIVE',        sub: 'Modern Architectural Scale' },
    { start: 51,  end: 105, label: 'APPROACH BUILDING',           sub: 'Engineered Precision & Facade' },
    { start: 106, end: 160, label: 'MOVE TOWARD ENTRANCE',        sub: 'Structural Symmetry & Portal' },
    { start: 161, end: 205, label: 'ENTER ARCHITECTURAL SPACE',   sub: 'Interior Atrium & Volume' },
    { start: 206, end: 245, label: 'MOVE THROUGH INTERIOR',       sub: 'Steel, Concrete & Craftsmanship' },
    { start: 246, end: 268, label: 'REVEAL ARCHITECTURAL WORLD',  sub: 'Shaping Tomorrow\'s Infrastructure' },
  ];

  // ─── State ─────────────────────────────────────────────────────────────────
  let experienceStarted = false;
  let totalScrollHeight = 0;    // pixels allocated to the scroll zone
  let frameScrollStart = 0;     // where pinned zone starts
  const SCROLL_ZONE_VH = 5;     // 500vh of smooth scroll travel for 268 frames

  // ─── Utility ───────────────────────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  // ─── Preloader ─────────────────────────────────────────────────────────────
  function initPreloader() {
    const loader = $('preloader');
    const bar = $('loader-bar');
    const pct = $('loader-pct');
    const loaderText = $('loader-text');
    const canvas = $('cinema-canvas');

    if (!canvas) return;
    FrameEngine.init(canvas, {
      onProgress(p) {
        if (bar) bar.style.width = p + '%';
        if (pct) pct.textContent = p + '%';
      },
      onReady() {
        if (loaderText) loaderText.textContent = 'EXPERIENCE READY';
        setTimeout(() => {
          if (loader) loader.classList.add('fade-out');
          setTimeout(() => {
            if (loader) loader.style.display = 'none';
            activateExperience();
          }, 600);
        }, 300);
      },
      onFrameChange(frameIdx) {
        updateHUD(frameIdx);
      }
    });
  }

  function activateExperience() {
    experienceStarted = true;
    setupScrollZone();
    document.body.style.overflow = '';
    // Process initial scroll position
    processScroll();
  }

  // ─── Scroll Zone Setup ─────────────────────────────────────────────────────
  function setupScrollZone() {
    const spacer = $('scroll-spacer');
    const vh = window.innerHeight;
    totalScrollHeight = SCROLL_ZONE_VH * vh;
    if (spacer) spacer.style.height = totalScrollHeight + 'px';

    const pinContainer = $('pin-container');
    if (pinContainer) {
      frameScrollStart = pinContainer.offsetTop;
    }
  }

  window.addEventListener('resize', debounce(() => {
    setupScrollZone();
    processScroll();
  }, 200));

  // ─── Scroll → Frame Sync ───────────────────────────────────────────────────
  let lastScrollY = 0;
  let ticking = false;

  function onScroll() {
    lastScrollY = window.scrollY;
    if (!ticking) {
      requestAnimationFrame(processScroll);
      ticking = true;
    }
  }

  function processScroll() {
    ticking = false;
    const pinContainer = $('pin-container');
    if (!pinContainer) return;

    const scrollTop = lastScrollY;
    const pinStart = frameScrollStart;
    const pinEnd = pinStart + totalScrollHeight;
    const progress = clamp((scrollTop - pinStart) / (pinEnd - pinStart), 0, 1);

    FrameEngine.setProgress(progress);
    updateScrollIndicator(progress);
    updateNavVisibility(progress);
    updateParallaxContent(progress);

    if (progress >= 0.85) {
      document.querySelectorAll('#about [data-reveal]').forEach(el => el.classList.add('revealed'));
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ─── HUD Text Overlays ─────────────────────────────────────────────────────
  let currentSceneIdx = -1;

  function updateHUD(frameIdx) {
    const hudLabel = $('hud-label');
    const hudSub = $('hud-sub');
    const hudFrame = $('hud-frame');

    if (hudFrame) {
      hudFrame.textContent = String(frameIdx + 1).padStart(3, '0') + ' / 268';
    }

    // Hide HUD text during initial brand overlay (first 12 frames)
    if (frameIdx < 12) {
      if (hudLabel) hudLabel.classList.remove('visible');
      if (hudSub) hudSub.classList.remove('visible');
      currentSceneIdx = -1;
      return;
    }

    let sceneIdx = -1;
    for (let i = 0; i < SCENES.length; i++) {
      if (frameIdx >= SCENES[i].start && frameIdx <= SCENES[i].end) {
        sceneIdx = i; break;
      }
    }

    if (sceneIdx !== currentSceneIdx && sceneIdx >= 0) {
      currentSceneIdx = sceneIdx;
      const scene = SCENES[sceneIdx];

      if (hudLabel) {
        hudLabel.classList.remove('visible');
        setTimeout(() => {
          hudLabel.textContent = scene.label;
          hudLabel.classList.add('visible');
        }, 120);
      }
      if (hudSub) {
        hudSub.classList.remove('visible');
        setTimeout(() => {
          hudSub.textContent = scene.sub;
          hudSub.classList.add('visible');
        }, 200);
      }
    }
  }

  function updateScrollIndicator(progress) {
    const bar = $('scroll-progress-bar');
    if (bar) bar.style.width = (progress * 100) + '%';
  }

  // ─── Navigation & Brand Overlay Fade ───────────────────────────────────────
  let navOpaque = false;

  function updateNavVisibility(progress) {
    const nav = $('main-nav');
    if (!nav) return;
    if (progress > 0.05 && !navOpaque) {
      navOpaque = true;
      nav.classList.add('solid');
    } else if (progress <= 0.05 && navOpaque) {
      navOpaque = false;
      nav.classList.remove('solid');
    }
  }

  function updateParallaxContent(progress) {
    // Fade out hero brand overlay during first 12% of scroll travel
    const heroOverlay = $('hero-brand-overlay');
    if (heroOverlay) {
      const fadeVal = clamp(1 - progress * 9, 0, 1);
      heroOverlay.style.opacity = fadeVal;
      heroOverlay.style.transform = `translateY(${-progress * 50}px)`;
      heroOverlay.style.pointerEvents = fadeVal < 0.08 ? 'none' : 'auto';
    }
  }

  // Post-animation navigation (after scroll zone)
  function initSmoothNav() {
    $$('a[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    if (window.location.hash) {
      setTimeout(() => {
        const target = document.querySelector(window.location.hash);
        if (target) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }, 300);
    }
  }

  // Active nav link highlight based on section visibility
  function initScrollSpy() {
    const sections = $$('section[id]');
    const navLinks = $$('#main-nav a[href^="#"]');

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(l => {
            l.classList.toggle('active', l.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(s => observer.observe(s));
  }

  // ─── Portfolio Filtering + Pagination ─────────────────────────────────────
  function initPortfolio() {
    const filterBtns = $$('.filter-btn');
    const allCards   = $$('.project-card');
    const CARDS_PER_PAGE = 6; // show 2 rows of 3
    let currentPage = 0;
    let visibleCards = [...allCards];

    function updateCounter() {
      const total = visibleCards.length;
      const shown = Math.min((currentPage + 1) * CARDS_PER_PAGE, total);
      const currentEl = $('prj-current');
      const totalEl   = $('prj-total');
      if (currentEl) currentEl.textContent = String(shown).padStart(2, '0');
      if (totalEl)   totalEl.textContent   = String(total).padStart(2, '0');
    }

    function renderPage() {
      const start = currentPage * CARDS_PER_PAGE;
      const end   = start + CARDS_PER_PAGE;
      allCards.forEach((card, i) => {
        const isVisible = visibleCards.includes(card);
        const inPage    = visibleCards.indexOf(card) >= start && visibleCards.indexOf(card) < end;
        card.style.display = (isVisible && inPage) ? '' : 'none';
        if (isVisible && inPage) {
          card.style.animation = 'none';
          void card.offsetHeight;
          card.style.animation = 'fadeSlideUp 0.4s ease forwards';
        }
      });
      updateCounter();
    }

    // Filter buttons
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-selected','true');
        const filter = btn.dataset.filter;
        visibleCards = filter === 'all'
          ? [...allCards]
          : allCards.filter(c => c.dataset.category === filter);
        currentPage = 0;
        renderPage();
      });
    });

    // Prev / Next buttons
    const prevBtn = $('prj-prev');
    const nextBtn = $('prj-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 0) { currentPage--; renderPage(); }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const maxPage = Math.ceil(visibleCards.length / CARDS_PER_PAGE) - 1;
        if (currentPage < maxPage) { currentPage++; renderPage(); }
      });
    }

    // 3D tilt effect on cards
    allCards.forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });

    // Modal
    $$('.project-card .card-cta').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const card = btn.closest('.project-card');
        openProjectModal(card);
      });
    });
    const closeModalBtn = $('modal-close');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeProjectModal);
    const overlay = $('modal-overlay');
    if (overlay) overlay.addEventListener('click', closeProjectModal);

    // Initial render
    renderPage();
  }

  function openProjectModal(card) {
    const modal = $('project-modal');
    const overlay = $('modal-overlay');
    if (!modal || !overlay) return;
    $('modal-title').textContent = card.dataset.name || card.querySelector('.card-title')?.textContent || '';
    $('modal-type').textContent = card.dataset.type || '';
    $('modal-location').textContent = card.dataset.location || '';
    $('modal-desc').textContent = card.dataset.desc || card.querySelector('.card-desc')?.textContent || '';
    const img = card.querySelector('img');
    if (img && $('modal-img')) $('modal-img').src = img.src;
    modal.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeProjectModal() {
    const modal = $('project-modal');
    const overlay = $('modal-overlay');
    if (modal) modal.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ─── Process Timeline ──────────────────────────────────────────────────────
  function initProcessTimeline() {
    const steps = $$('.process-box');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active');
      });
    }, { threshold: 0.2 });
    steps.forEach(s => observer.observe(s));
  }

  // ─── Counter Animation ─────────────────────────────────────────────────────
  function initCounters() {
    const counters = $$('.stat-arch-value[data-target], .stat-number[data-target]');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(c => observer.observe(c));
  }

  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const duration = 2000;
    const start = performance.now();
    function update(now) {
      const t = Math.min((now - start) / duration, 1);
      const val = lerp(0, target, easeInOut(t));
      el.textContent = prefix + (Number.isInteger(target) ? Math.round(val) : val.toFixed(1)) + suffix;
      if (t < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  // ─── Reveal Animations ─────────────────────────────────────────────────────
  function initRevealAnimations() {
    const els = $$('[data-reveal]');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '100px' });
    els.forEach(el => observer.observe(el));
  }

  // ─── Service Card 3D Tilt ──────────────────────────────────────────────────
  function initServiceCards() {
    $$('.service-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.03)`;
        card.querySelector('.service-glow') && (card.querySelector('.service-glow').style.background =
          `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(200,157,104,0.18), transparent 70%)`);
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  // ─── Why Apex Cards ────────────────────────────────────────────────────────
  function initWhyCards() {
    $$('.why-card').forEach(card => {
      card.addEventListener('mouseenter', () => card.classList.add('hovered'));
      card.addEventListener('mouseleave', () => card.classList.remove('hovered'));
    });
  }

  // ─── Quote Form ────────────────────────────────────────────────────────────
  function initQuoteForm() {
    const form = $('quote-form');
    if (!form) return;

    let isSubmitting = false;

    // Submission
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (isSubmitting) return;

      // Hide any previous form error banner
      const banner = $('form-error-banner');
      if (banner) banner.style.display = 'none';

      if (!validateForm(form)) return;

      isSubmitting = true;
      const submitBtn = form.querySelector('[type="submit"]');
      const btnSpan = submitBtn ? submitBtn.querySelector('span') : null;
      if (submitBtn) submitBtn.disabled = true;
      if (btnSpan) btnSpan.textContent = 'Submitting...';
      else if (submitBtn) submitBtn.textContent = 'Submitting...';

      const data = {};
      new FormData(form).forEach((v, k) => { data[k] = v; });

      try {
        let submissionId = null;
        let isSuccess = false;
        let errorMessage = 'Unable to submit your enquiry right now. Please try again.';

        // Support direct Google Apps Script URL if configured in window, otherwise default to /api/quote
        const directScriptUrl = window.GOOGLE_SCRIPT_URL || '';

        if (directScriptUrl) {
          const res = await fetch(directScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
          });
          const json = await res.json();
          if (json.status === 'success' && json.submissionId) {
            isSuccess = true;
            submissionId = json.submissionId;
          } else {
            errorMessage = json.message || errorMessage;
          }
        } else {
          const res = await fetch('/api/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          const json = await res.json();
          if (json.success && json.submissionId) {
            isSuccess = true;
            submissionId = json.submissionId;
          } else {
            errorMessage = json.error || errorMessage;
          }
        }

        if (isSuccess && submissionId) {
          showSuccessScreen(submissionId);
          form.reset();
          if (estimateBadge) estimateBadge.style.display = 'none';
        } else {
          // Do NOT lose the user's entered form data
          showFormError(errorMessage);
        }
      } catch (err) {
        console.error('Submission error:', err);
        // Do NOT lose the user's entered form data
        showFormError('Unable to submit your enquiry right now. Please try again.');
      } finally {
        isSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
        if (btnSpan) btnSpan.textContent = 'REQUEST A QUOTE';
        else if (submitBtn) submitBtn.textContent = 'REQUEST A QUOTE';
      }
    });
  }

  function validateForm(form) {
    let valid = true;
    $$('.field-error').forEach(el => el.remove());

    // Required fields: B) Name, C) Phone Number, D) Mail ID, F) Project Type, G) Project Location, H) Estimation Budget
    // (E: Company Name is Optional)
    const requiredFields = [
      { name: 'name', label: 'Name' },
      { name: 'phone', label: 'Phone Number' },
      { name: 'email', label: 'Mail ID' },
      { name: 'projectType', label: 'Project Type' },
      { name: 'projectLocation', label: 'Project Location' },
      { name: 'estimatedBudget', label: 'Estimation Budget' }
    ];

    requiredFields.forEach(({ name, label }) => {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field || !field.value.trim()) {
        valid = false;
        if (field) showFieldError(field, `${label} is required`);
      } else if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) {
        valid = false;
        showFieldError(field, 'Enter a valid email address');
      }
    });

    return valid;
  }

  function showFieldError(field, msg) {
    const err = document.createElement('span');
    err.className = 'field-error';
    err.textContent = msg;
    field.parentNode.appendChild(err);
    field.classList.add('error');
    const clear = () => {
      field.classList.remove('error');
      err.remove();
    };
    field.addEventListener('input', clear, { once: true });
    field.addEventListener('change', clear, { once: true });
  }

  function showFormError(msg) {
    const banner = $('form-error-banner');
    if (banner) {
      banner.textContent = msg;
      banner.style.display = 'block';
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function showSuccessScreen(submissionId) {
    const overlay = $('success-overlay');
    const idEl = $('display-submission-id');
    if (idEl && submissionId) {
      idEl.textContent = submissionId;
    }
    if (overlay) {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
    }

    const successClose = $('success-close');
    if (successClose) {
      successClose.onclick = () => {
        if (overlay) {
          overlay.classList.remove('open');
          overlay.setAttribute('aria-hidden', 'true');
        }
        // Smooth scroll back to top/home
        const homeSection = document.getElementById('home');
        if (homeSection) {
          homeSection.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
    }
  }

  // ─── Services Carousel ─────────────────────────────────────────────────────
  function initServiceCards() {
    const track    = $('svc-track');
    const wrapper  = track && track.closest('.svc-track-wrapper');
    const prevBtn  = $('svc-prev');
    const nextBtn  = $('svc-next');
    if (!track || !wrapper) return;

    const cards = Array.from(track.querySelectorAll('.svc-card'));
    let offset = 0; // current scroll offset in px

    function getCardWidth() {
      return cards[0] ? cards[0].offsetWidth : 0;
    }

    function maxOffset() {
      return Math.max(0, track.scrollWidth - wrapper.offsetWidth);
    }

    function setActive(idx) {
      cards.forEach((c, i) => c.classList.toggle('active', i === idx));
    }

    function applyOffset() {
      offset = Math.max(0, Math.min(offset, maxOffset()));
      track.style.transform = `translateX(-${offset}px)`;
      // Figure out which card is mostly visible
      const cw = getCardWidth();
      if (cw > 0) setActive(Math.round(offset / cw));
    }

    prevBtn && prevBtn.addEventListener('click', () => {
      offset -= getCardWidth() * 2;
      applyOffset();
    });

    nextBtn && nextBtn.addEventListener('click', () => {
      offset += getCardWidth() * 2;
      applyOffset();
    });

    // Click on card to activate
    cards.forEach((card, i) => {
      card.addEventListener('click', () => {
        setActive(i);
        offset = Math.max(0, Math.min(i * getCardWidth(), maxOffset()));
        applyOffset();
      });
    });

    // Mouse-wheel horizontal scroll inside cards panel
    const panel = wrapper.closest('.svc-cards-panel');
    if (panel) {
      panel.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.preventDefault();
          offset += e.deltaX;
          applyOffset();
        }
      }, { passive: false });
    }

    // Touch swipe support for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartOffset = 0;
    let isSwiping = false;

    track.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartOffset = offset;
      isSwiping = false;
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (!isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        isSwiping = true;
      }
      if (isSwiping) {
        offset = touchStartOffset - dx;
        applyOffset();
      }
    }, { passive: true });

    track.addEventListener('touchend', () => {
      if (isSwiping) {
        const cw = getCardWidth();
        if (cw > 0) {
          const targetIdx = Math.round(offset / cw);
          offset = targetIdx * cw;
          applyOffset();
        }
      }
    }, { passive: true });

    // Set initial active
    setActive(0);

    // Recalculate on resize
    window.addEventListener('resize', debounce(applyOffset, 120));
  }

  // ─── Mobile Burger Nav ─────────────────────────────────────────────────────
  function initMobileNav() {
    const burger = $('nav-burger');
    const navMenu = $('nav-menu');
    const backdrop = $('nav-backdrop');

    function closeNav() {
      if (navMenu) navMenu.classList.remove('open');
      if (burger) {
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
      if (backdrop) backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }

    function openNav() {
      if (navMenu) navMenu.classList.add('open');
      if (burger) {
        burger.classList.add('open');
        burger.setAttribute('aria-expanded', 'true');
      }
      if (backdrop) backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function toggleNav() {
      if (navMenu && navMenu.classList.contains('open')) {
        closeNav();
      } else {
        openNav();
      }
    }

    if (burger) {
      burger.addEventListener('click', toggleNav);
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeNav);
    }

    $$('#nav-menu a').forEach(link => {
      link.addEventListener('click', closeNav);
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navMenu && navMenu.classList.contains('open')) {
        closeNav();
      }
    });

    window.addEventListener('resize', debounce(() => {
      if (window.innerWidth > 768 && navMenu && navMenu.classList.contains('open')) {
        closeNav();
      }
    }, 150));
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Lock scroll while loading experience
    document.body.style.overflow = 'hidden';

    initPreloader();
    initSmoothNav();
    initScrollSpy();
    initPortfolio();
    initProcessTimeline();
    initCounters();
    initRevealAnimations();
    initServiceCards();
    initWhyCards();
    initQuoteForm();
    initMobileNav();

    // Allow scrolling to trigger experience if user scrolls before loader completes
    window.addEventListener('wheel', () => {
      if (!experienceStarted && FrameEngine.isReady()) activateExperience();
    }, { passive: true, once: true });

    window.addEventListener('touchmove', () => {
      if (!experienceStarted && FrameEngine.isReady()) activateExperience();
    }, { passive: true, once: true });
  });

})();
