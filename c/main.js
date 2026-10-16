/* Гибрид A+B · главная. Без сборки. Порядок: оверлей сетки, меню, шапка, GSAP-режиссура, ленивый WebGL.
   Обложка без мути и без реакции на курсор (лок гейта 3). */
(() => {
  const root = document.documentElement
  const q = new URLSearchParams(location.search)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const noGL = q.has('nogl')
  if (reduced) { root.classList.add('reduced'); document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager' }) }
  if (noGL) root.classList.add('nogl')
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]

  /* оверлей сетки: ?grid или клавиша g */
  if (q.has('grid')) root.classList.add('show-grid')
  addEventListener('keydown', (e) => {
    if (e.key !== 'g' && e.key !== 'п') return
    if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return
    root.classList.toggle('show-grid')
  })

  /* ширина растворения кромки кадра: колонка + гаттер на десктопе, 96 px на телефоне.
     Одно число для DOM-маски (--fade) и для шейдера (window.__fade), чтобы кромка не прыгала при стыке. */
  const fade = () => {
    const cs = getComputedStyle(root), W = root.clientWidth
    const cols = parseInt(cs.getPropertyValue('--cols')), m = parseFloat(cs.getPropertyValue('--m')), g = parseFloat(cs.getPropertyValue('--g'))
    return cols <= 4 ? 96 : (W - 2 * m - (cols - 1) * g) / cols + g
  }
  const setFade = () => root.style.setProperty('--fade', fade().toFixed(2) + 'px')
  window.__fade = fade
  setFade(); addEventListener('resize', setFade)

  /* меню телефона */
  const mb = $('#menuBtn'), menu = $('#menu')
  mb.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden')
    menu.toggleAttribute('hidden', !open)
    mb.setAttribute('aria-expanded', String(open))
    mb.textContent = open ? 'закрыть' : 'меню'
  })
  $$('a', menu).forEach(a => a.addEventListener('click', () => mb.click()))
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hasAttribute('hidden')) mb.click() })

  /* разбивка слов «обо мне» для проявки по скроллу (текст остаётся в DOM) */
  const body = $('#aboutBody')
  const splitWords = (el) => {
    [...el.childNodes].forEach(n => {
      if (n.nodeType === 1) { splitWords(n); return }
      if (n.nodeType !== 3) return
      const frag = document.createDocumentFragment()
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return
        if (/^\s+$/.test(part) && !/ /.test(part)) { frag.append(document.createTextNode(' ')); return }
        const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.append(s)
      })
      n.replaceWith(frag)
    })
  }
  const canDirect = () => !reduced && window.gsap && window.ScrollTrigger

  /* шапка: светлая над кадрами, чернильная над бумагой.
     В WebGL-режиме бумага идёт фронтом на 0.2 экрана выше секции — шапка темнеет вместе с фронтом. */
  const hdr = $('#hdr'), paper = $('#about')
  const hdrTone = () => {
    const lead = root.classList.contains('gl-on') ? innerHeight * .2 : 0
    hdr.classList.toggle('hdr--ink', paper.getBoundingClientRect().top - lead < 64)
  }
  addEventListener('scroll', hdrTone, { passive: true }); addEventListener('resize', hdrTone); hdrTone()
  window.__hdrTone = hdrTone

  /* ---------- GSAP + Lenis ---------- */
  function direct() {
    if (!canDirect()) return
    splitWords(body)
    gsap.registerPlugin(ScrollTrigger)
    if (window.Lenis) {
      const lenis = new Lenis({ lerp: .085, wheelMultiplier: .9 })
      window.__lenis = lenis
      lenis.on('scroll', ScrollTrigger.update)
      lenis.on('scroll', hdrTone)
      gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0)
      $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
        const el = $(a.getAttribute('href')); if (!el) return
        e.preventDefault(); lenis.scrollTo(el, { duration: 1.6 })
      }))
    }
    // имя проявляется по буквам (текст, не кадр: кадр обложки чистый с первого кадра)
    const name = $('#name')
    name.setAttribute('aria-label', name.textContent)
    const chars = [...name.textContent].map(ch => {
      const s = document.createElement('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true')
      s.style.display = 'inline-block'; if (ch === ' ' || ch === ' ') s.style.width = '.28em'
      return s
    })
    name.textContent = ''; name.append(...chars)
    gsap.from(chars, { opacity: 0, filter: 'blur(14px)', yPercent: 18, duration: 1.6, ease: 'power3.out', stagger: .055, delay: .15 })
    gsap.from('.cover__sub, .hdr', { opacity: 0, duration: 1.2, delay: .9, ease: 'power2.out' })

    // подпись обложки уходит вверх, кадр не трогаем (без затемнения)
    gsap.to('.scene--c .scene__text', { yPercent: -24, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '#cover', start: '20% top', end: '55% top', scrub: true } })

    // текст сцены входит снизу и держится
    $$('.scene:not(.scene--c)').forEach(sc => {
      gsap.from($$('.scene__h, .note, .more', sc), { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: .09,
        scrollTrigger: { trigger: sc, start: 'top 55%', toggleActions: 'play none none reverse' } })
    })

    // подпись свадьбы уходит до того, как к ней поднимется фронт бумаги (светлый текст на бумаге не читается)
    gsap.to('.scene--w .scene__text', { opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '#about', start: () => `top ${innerHeight * 1.45}px`, end: () => `top ${innerHeight * 1.2}px`, scrub: true, invalidateOnRefresh: true } })

    // Scrubbing Text Reveal: слова «обо мне» проступают .14 → 1
    gsap.to('#aboutBody .w', { opacity: 1, ease: 'none', stagger: .1,
      scrollTrigger: { trigger: '#aboutBody', start: 'top 82%', end: 'bottom 72%', scrub: .6 } })
    gsap.from('.about__h', { y: 48, opacity: 0, duration: 1.3, ease: 'power3.out',
      scrollTrigger: { trigger: '.about__h', start: 'top 85%' } })
    gsap.from('.contact__h', { yPercent: 30, opacity: 0, duration: 1.4, ease: 'power3.out',
      scrollTrigger: { trigger: '.contact__h', start: 'top 88%' } })
  }

  /* ---------- ленивый WebGL (П7): после load и простоя ---------- */
  function lazyGL() {
    if (reduced || noGL) return
    const go = () => { const s = document.createElement('script'); s.src = 'dissolve.js'; s.async = true; document.body.append(s) }
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 600))
    idle(go, { timeout: 2500 })
  }

  const boot = () => { direct(); lazyGL() }
  if (document.readyState === 'complete') boot()
  else addEventListener('load', boot)
})()
