/* =====================================================================
   Creative Foundry — interactions & animations (no framework needed)

   Mechanics mirrored from the live demo:
     • Lenis smooth scroll (lerp .1) drives a small scroll "scrub" engine
     • Hero: bg "backwash" zoom-out (1.5 → 1, 1s), column rises 100px,
       "Design" is split into chars that rise 100% with a 20ms stagger
       (1s ease); the hero is sticky and fades to 0 over the first 100vh
     • Works: cards stick on top of each other; each enters from
       translateY(100vh) rotate(±30°) scale(.75) → identity, linear scrub,
       pivot top-center; card image zooms 1 → 1.2 while it travels
     • Awards: blue row grows from rotate(-10°) scale(.55), pivot bottom
     • Footer row fades in from 60% of the viewport
     • Marquees: scroll-linked ("Works", awards) and auto ("Let's Talk")
     • Journal: infinite horizontal strip, scroll-linked + draggable,
       images drift ±6% (parallax) and sit at scale 1.12
     • Header skin flips (white ↔ accent) over light/dark sections
     • Custom 20px cursor with 0.4s eased follow
   ===================================================================== */
(() => {
  'use strict';

  // Viewport height frozen per width so the iOS toolbar sliding in/out doesn't re-layout every card mid-scroll
  let vhPx = window.innerHeight, vhW = window.innerWidth;
  const setVh = () => { vhPx = window.innerHeight; vhW = window.innerWidth; document.documentElement.style.setProperty('--vh', `${vhPx / 100}px`); };
  setVh();
  const vh = () => vhPx;
  const vw = () => window.innerWidth;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;

  /* ------------------------------------------------------------------
     0. Tiny scroll-scrub engine
        addScrub({ start, end, update(progress, scrollY) })
        start/end are absolute scroll positions (numbers or functions),
        progress is linear 0→1 ("ease: none" in the original).
     ------------------------------------------------------------------ */
  const scrubs = [];
  const addScrub = (s) => { scrubs.push({ ...s, _s: 0, _e: 1, _p: -1 }); return s; };
  // brand bar = exactly half the white intro section's height
  const brandBars = [...document.querySelectorAll('.brand-bar')];
  const philosophy = document.getElementById('philosophy');
  const sizeBrandBar = () => { if (philosophy) brandBars.forEach(b => b.style.setProperty('--brand-bar-h', `${Math.round(philosophy.offsetHeight * 0.35)}px`)); };
  // Shrink a card title only as much as needed so no word runs into the badge.
  const fitTitles = () => {
    document.querySelectorAll('.card__title--bl').forEach((h3) => {
      const inner = h3.firstElementChild; if (!inner) return;
      inner.style.fontSize = '';
      const cs = getComputedStyle(h3);
      const avail = h3.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      let size = parseFloat(getComputedStyle(inner).fontSize);
      let guard = 40;
      while (inner.scrollWidth > avail + 0.5 && size > 20 && guard--) {
        size -= 1; inner.style.fontSize = size + 'px';
      }
    });
  };
  const refresh = () => {
    sizeBrandBar();
    fitTitles();
    scrubs.forEach((s) => {
      s._s = typeof s.start === 'function' ? s.start() : s.start;
      s._e = typeof s.end === 'function' ? s.end() : s.end;
      s._p = -1;
    });
    render(currentScroll(), true);
  };
  let lenis = null;
  const currentScroll = () => (lenis ? lenis.scroll : window.scrollY);
  const render = (y, force) => {
    for (const s of scrubs) {
      const p = clamp01((y - s._s) / Math.max(1, s._e - s._s));
      if (force || p !== s._p) { s._p = p; s.update(p, y); }
    }
  };

  /* ------------------------------------------------------------------
     1. Smooth scroll (Lenis)
     ------------------------------------------------------------------ */
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  // Diagnostic switches (?test=static | flow | nozoom) — temporary, for isolating phone jitter
  const testMode = new URLSearchParams(location.search).get('test') || '';
  if (testMode) document.documentElement.classList.add('test-' + testMode);
  if (!reduceMotion && window.Lenis && !touchDevice) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); render(lenis.scroll); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  } else {
    const raf = () => { render(window.scrollY); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* ------------------------------------------------------------------
     2. Hero — split "Design" into chars, then run the load sequence
     ------------------------------------------------------------------ */
  document.querySelectorAll('.t-split').forEach((el) => {
    const stagger = parseInt(el.dataset.stagger || '20', 10);
    const speed = parseInt(el.dataset.speed || '1000', 10);
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    let i = 0;
    words.forEach((word, wi) => {
      const w = document.createElement('span');
      w.className = 'split-word';
      [...word].forEach((ch) => {
        const c = document.createElement('span');
        c.className = 'split-char';
        c.textContent = ch;
        c.style.animationDelay = `${i * stagger}ms`;
        c.style.animationDuration = `${speed}ms`;
        w.appendChild(c);
        i++;
      });
      el.appendChild(w);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  const heroSticky = document.querySelector('.hero-sticky');
  const hero = document.getElementById('hero');
  const startHero = () => hero.querySelectorAll('.anim-col, .t-split').forEach((el) => el.classList.add('start_animation'));
  if (document.readyState === 'complete') startHero(); else window.addEventListener('load', startHero);

  // Fade the hero to 0 while the next section slides over it (0 → 100vh)
  addScrub({ start: 0, end: () => vh(), update: (p) => {
    hero.style.opacity = (1 - p).toFixed(3);
    heroSticky.style.visibility = p >= 1 ? 'hidden' : 'visible';
  } });

  /* ------------------------------------------------------------------
     3. Generic "animate when almost visible" columns
     ------------------------------------------------------------------ */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('start_animation'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.anim-col').forEach((el) => { if (!hero.contains(el)) io.observe(el); });

  /* ------------------------------------------------------------------
     4. Works — stacked cards
        Sticky item n sits at stackTop + n * (100vh + space). While it
        travels from below the viewport to the top (one viewport of
        scroll) its card also goes translateY(100vh) rotate(±30) scale(.75)
        → identity, so it visibly arrives at double speed from 2 screens
        below, straightening as it lands.
     ------------------------------------------------------------------ */
  const spaceH = () => (vw() <= 959 ? 0.20 : 0.25) * vh();
  document.querySelectorAll('.stack').forEach((stack) => {
  const items = [...stack.querySelectorAll('.stack__item')];
  const itemTop = (n) => absTop(stack) + n * (vh() + spaceH());

  items.forEach((item, n) => {
    const card = item.querySelector('.card');
    const img = item.querySelector('.card__img');
    const rot = parseFloat(item.dataset.rotate || '0');

    if (testMode === 'static' || testMode === 'flow') { card.style.transform = 'none'; } else
    addScrub({ start: () => itemTop(n) - vh(), end: () => itemTop(n), update: (p) => {
      const y = lerp(100, 0, p), r = lerp(rot, 0, p), s = lerp(0.75, 1, p);
      card.style.transform = `perspective(100vw) translate3d(0, ${y.toFixed(3)}vh, 0) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`;
    } });

    // "mask-scroll-zoom": image scales 1 → 1.2 as the card travels through the viewport.
    // Skipped on fitted (whole-photo) cards so the pen never grows out of frame.
    // card--fit-sm cards are fitted on phones only (whole photo in frame) and fill the frame on desktop
    const isFit = () => card.classList.contains('card--fit') || (card.classList.contains('card--fit-sm') && vw() <= 959);
    if (testMode) { img.style.transform = 'none'; } else
    addScrub({ start: () => itemTop(n) - vh(), end: () => itemTop(n) + vh(), update: (p) => {
      if (isFit()) {
        // fitted cards: arrive zoomed in and settle to the whole photo once the card is in place
        img.style.transform = `scale(${lerp(1.2, 1, Math.min(1, p * 2)).toFixed(4)})`;
      } else {
        img.style.transform = `scale(${lerp(1, 1.2, p).toFixed(4)})`;
      }
    } });
  });
  });

  /* ------------------------------------------------------------------
     6. Footer — fades in from 60% of the viewport until the page ends
     ------------------------------------------------------------------ */
  const footer = document.getElementById('footer');
  const footerRow = document.getElementById('footerRow');
  addScrub({ start: () => absTop(footer) - vh() * 0.6,
             end: () => Math.min(absTop(footer), document.documentElement.scrollHeight - vh()),
             update: (p) => { footerRow.style.opacity = p.toFixed(3); } });

  /* ------------------------------------------------------------------
     7. Subtle row parallax (theme "parallax-move", factor 0.1)
     ------------------------------------------------------------------ */
  document.querySelectorAll('[data-parallax]').forEach((sec) => {
    const target = sec.querySelector(':scope > .philosophy__grid, :scope > .statement__lead, :scope > .footer__row') || sec.firstElementChild;
    const f = 0.1 * parseFloat(sec.dataset.parallax || '1');
    addScrub({ start: () => absTop(sec) - vh(), end: () => absTop(sec) + sec.offsetHeight, update: (p) => {
      const amp = f * (sec.offsetHeight + vh()) / 2;
      target.style.transform = `translate3d(0, ${lerp(-amp, amp, p).toFixed(2)}px, 0)`;
    } });
  });

  /* ------------------------------------------------------------------
     8. Marquees
     ------------------------------------------------------------------ */
  const fillTrack = (track, minMultiple = 3) => {
    const item = track.querySelector('.marquee__item');
    track.querySelectorAll('.marquee__item:not(:first-child)').forEach((n) => n.remove());
    const w = item.getBoundingClientRect().width || 1;
    const need = Math.ceil((vw() * minMultiple) / w) + 1;
    for (let i = 1; i < need; i++) track.appendChild(item.cloneNode(true));
    return w;
  };
  const scrollMarquees = [...document.querySelectorAll('.marquee--scroll')].map((m) => ({
    el: m, track: m.querySelector('.marquee__track'), speed: parseFloat(m.dataset.marqueeSpeed || '0'), w: 1 }));
  const autoMarquees = [...document.querySelectorAll('.marquee--auto')].map((m) => ({ el: m, track: m.querySelector('.marquee__track'), w: 1 }));

  const setupMarquees = () => {
    scrollMarquees.forEach((m) => { m.w = fillTrack(m.track, 3); });
    autoMarquees.forEach((m) => {
      m.w = fillTrack(m.track, 2);
      m.track.style.setProperty('--marquee-shift', `${m.w}px`);
      m.track.style.setProperty('--marquee-duration', `${(m.w / 110).toFixed(2)}s`);   // ≈110px/s
    });
  };
  setupMarquees();

  // scroll-linked infinite marquees ("Works"): x = 41 − 0.53·scroll (matches the demo: −434px at 950px), wrapped to one item width
  const factorFor = (speed) => (speed === 0 ? 0.533 : 0.4 * speed);
  addScrub({ start: 0, end: () => document.documentElement.scrollHeight, update: (_p, y) => {
    scrollMarquees.forEach((m) => {
      const raw = 41 - y * factorFor(m.speed);
      const x = ((raw % m.w) + m.w) % m.w - m.w;         // wrap into [-w, 0)
      m.track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  } });

  // single-line "sweep" marquees (awards): one copy of the text, centred when the row is centred
  // in the viewport, sliding sideways with scroll. speed sign = direction, |speed| = rate.
  document.querySelectorAll('.marquee--sweep').forEach((m) => {
    const track = m.querySelector('.marquee__track');
    const row = m.closest('section') || m.parentElement;
    const speed = parseFloat(m.dataset.marqueeSpeed || '1') || 1;
    const dir = Math.sign(speed), k = Math.abs(speed) === 2 ? 1.6 : 1;
    addScrub({ start: () => absTop(row) - vh(), end: () => absTop(row) + row.offsetHeight, update: (_p, y) => {
      const yc = absTop(row) + row.offsetHeight / 2 - vh() / 2;      // scroll position where the row is centred
      track.style.transform = `translate3d(${(dir * (yc - y) * k).toFixed(2)}px,0,0)`;
    } });
  });

  /* ------------------------------------------------------------------
     10. Header skin — flips when the section under the header changes
     ------------------------------------------------------------------ */
  const skinSections = [...document.querySelectorAll('section[data-skin], footer[data-skin]')];
  let skinIO;
  const setupSkin = () => {
    skinIO?.disconnect();
    skinIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) document.body.dataset.skin = e.target.dataset.skin; });
    }, { rootMargin: `0px 0px -${Math.max(vh() - 89, 0)}px 0px`, threshold: 0 });
    skinSections.forEach((s) => skinIO.observe(s));
  };
  setupSkin();

  /* ------------------------------------------------------------------
     11. Custom cursor
     ------------------------------------------------------------------ */
  const cursor = document.getElementById('cursor');
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      cursor.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
      cursor.classList.add('is-visible');
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, .linear'));
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
    window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  }

  /* ------------------------------------------------------------------
     12. Overlay menu
     ------------------------------------------------------------------ */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('overlayMenu');
  const scrollToEl = (target) => (lenis ? lenis.scrollTo(target, { duration: 1.2 }) : target.scrollIntoView({ behavior: 'smooth' }));
  const toggleMenu = (open) => {
    const isOpen = open ?? !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', isOpen);
    burger.classList.toggle('is-open', isOpen);
    burger.setAttribute('aria-expanded', String(isOpen));
    menu.setAttribute('aria-hidden', String(!isOpen));
    document.body.classList.toggle('menu-open', isOpen);
    if (lenis) (isOpen ? lenis.stop() : lenis.start());
  };
  burger.addEventListener('click', () => toggleMenu());
  const goSearch = () => {
    const form = document.getElementById('penSearch');
    if (!form) return;
    const input = form.querySelector('.pen-search__input');
    const y = Math.max(0, absTop(form) - 120);
    setTimeout(() => { if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: 'smooth' }); }, 50);
    setTimeout(() => { input.focus({ preventScroll: true }); }, 1300);
  };
  document.querySelectorAll('.footer__menu a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    if (a.classList.contains('footer__search')) return goSearch();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) scrollToEl(target);
  }));
  menu.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); toggleMenu(false);
    if (a.id === 'menuSearch') {
      const form = document.getElementById('penSearch');
      if (!form) return;
      const input = form.querySelector('.pen-search__input');
      const y = Math.max(0, absTop(form) - 120);
      setTimeout(() => { if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: 'smooth' }); }, 50);
      setTimeout(() => { input.focus({ preventScroll: true }); }, 1300);
      return;
    }
    const target = document.querySelector(a.getAttribute('href'));
    if (target) setTimeout(() => scrollToEl(target), 50);
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) toggleMenu(false); });
  document.querySelectorAll('main a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href === '#') { e.preventDefault(); return; }
    const target = document.querySelector(href);
    if (!target) return; e.preventDefault(); scrollToEl(target);
  }));

  /* ------------------------------------------------------------------
     12a. Pen search — filters the card titles, jumps to the matching card
     ------------------------------------------------------------------ */
  const searchForm = document.getElementById('penSearch');
  if (searchForm) {
    const input = searchForm.querySelector('.pen-search__input');
    const list = document.getElementById('penSearchResults');
    const brandOf = (item) => {
      const bar = item.closest('.works')?.previousElementSibling;
      const name = bar && bar.classList.contains('brand-bar') ? bar.querySelector('.brand-bar__name')?.textContent.trim() : '';
      return name || '';
    };
    const index = [...document.querySelectorAll('.stack__item')].map((item) => {
      const t = item.querySelector('.card__title');
      return { item, title: (t ? t.textContent : '').trim(), brand: brandOf(item) };
    }).filter((e) => e.title);
    const docTop = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
    const jumpTo = (entry) => {
      list.hidden = true; input.blur();
      const y = docTop(entry.item);
      if (lenis) lenis.scrollTo(y, { duration: 1.4 }); else window.scrollTo({ top: y, behavior: 'smooth' });
    };
    let active = -1, matches = [];
    const renderList = () => {
      list.innerHTML = '';
      if (!matches.length) { list.innerHTML = '<li class="pen-search__empty">No pens found</li>'; return; }
      matches.forEach((m, i) => {
        const li = document.createElement('li'); li.setAttribute('role', 'option');
        if (i === active) li.classList.add('is-active');
        const b = document.createElement('button'); b.type = 'button';
        b.innerHTML = `<span>${m.title}</span>${m.brand ? `<small>${m.brand}</small>` : ''}`;
        b.addEventListener('click', () => jumpTo(m));
        li.appendChild(b); list.appendChild(li);
      });
    };
    /* brand filter */
    const brandBars = [...document.querySelectorAll('.brand-bar')].map((bar) => ({ name: bar.querySelector('.brand-bar__name').textContent.trim(), el: bar }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const filterToggle = document.getElementById('penFilterToggle');
    const filterPanel = document.getElementById('penFilter');
    const filterOpts = document.getElementById('penFilterOptions');
    const filterCount = filterToggle.querySelector('.pen-filter__count');
    let applied = new Set();
    brandBars.forEach((b) => {
      const n = index.filter((e) => e.brand === b.name).length;
      const lab = document.createElement('label');
      lab.innerHTML = `<input type="checkbox" value="${b.name}"><span>${b.name}</span><small>${n} pen${n === 1 ? '' : 's'}</small>`;
      filterOpts.appendChild(lab);
    });
    const checked = () => [...filterOpts.querySelectorAll('input:checked')].map((i) => i.value);
    const openFilter = (open) => { filterPanel.hidden = !open; filterToggle.setAttribute('aria-expanded', String(open)); if (open) list.hidden = true; };
    filterToggle.addEventListener('click', () => openFilter(filterPanel.hidden));
    document.getElementById('penFilterClear').addEventListener('click', () => {
      filterOpts.querySelectorAll('input').forEach((i) => { i.checked = false; });
      applied = new Set(); filterCount.hidden = true; update();
    });
    document.getElementById('penFilterApply').addEventListener('click', () => {
      const sel = checked().sort((a, b) => a.localeCompare(b));
      applied = new Set(sel);
      filterCount.hidden = !sel.length; filterCount.textContent = sel.length;
      openFilter(false);
      if (!sel.length) return;
      const bar = brandBars.find((b) => b.name === sel[0]);   // first alphabetically
      if (!bar) return;
      const y = docTop(bar.el);
      if (lenis) lenis.scrollTo(y, { duration: 1.4 }); else window.scrollTo({ top: y, behavior: 'smooth' });
    });
    const update = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { list.hidden = true; matches = []; active = -1; return; }
      const words = q.split(/\s+/);
      matches = index.filter((e) => !applied.size || applied.has(e.brand))
        .filter((e) => { const hay = (e.brand + ' ' + e.title).toLowerCase(); return words.every((w) => hay.includes(w)); }).slice(0, 12);
      active = matches.length ? 0 : -1; renderList(); list.hidden = false;
    };
    input.addEventListener('input', update);
    input.addEventListener('focus', () => { if (input.value.trim()) update(); });
    input.addEventListener('keydown', (e) => {
      if (list.hidden || !matches.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % matches.length; renderList(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + matches.length) % matches.length; renderList(); }
      else if (e.key === 'Escape') { list.hidden = true; }
    });
    searchForm.addEventListener('submit', (e) => { e.preventDefault(); if (matches[active]) jumpTo(matches[active]); else if (matches[0]) jumpTo(matches[0]); });
    document.addEventListener('click', (e) => { if (!searchForm.contains(e.target)) { list.hidden = true; openFilter(false); } });
    input.addEventListener('focus', () => openFilter(false));
  }

  /* ------------------------------------------------------------------
     12b. Card galleries — title opens a grid of thumbnails inside the card
     ------------------------------------------------------------------ */
  document.querySelectorAll('.card__title-btn[data-gallery]').forEach((btn) => {
    const gal = document.getElementById(btn.dataset.gallery);
    if (!gal) return;
    const open = () => {
      gal.querySelectorAll('img[data-src]').forEach((im) => { im.src = im.dataset.src; im.removeAttribute('data-src'); });   // thumbnails load on first open
      gal.hidden = false; requestAnimationFrame(() => gal.classList.add('is-open'));
    };
    const close = () => { gal.classList.remove('is-open'); setTimeout(() => { gal.hidden = true; }, 400); };
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(); });
    gal.querySelector('.card__gallery-close').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); close(); });
    gal.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (e.target === gal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !gal.hidden) close(); });
  });

  /* ------------------------------------------------------------------
     13. Layout refresh
     ------------------------------------------------------------------ */
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      // phones: ignore the height-only changes caused by the browser toolbar; only a width change (rotation) re-lays out
      if (window.innerWidth === vhW && Math.abs(window.innerHeight - vhPx) < 160 && window.innerWidth <= 959) { refresh(); return; }
      setVh(); setupMarquees(); setupSkin(); refresh();
    }, 150);
  });
  window.addEventListener('load', () => { setupMarquees(); refresh(); });
  document.fonts?.ready.then(() => { setupMarquees(); refresh(); });
  refresh();
})();
