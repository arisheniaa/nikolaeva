/* Гибрид A+B · главная. Без сборки. Порядок: оверлей сетки, меню, шапка, GSAP-режиссура.
   Круг 3: экраны просто пролистываются (Lenis), без WebGL, без растворения и без гашения кадра. */
(() => {
  const root = document.documentElement
  const q = new URLSearchParams(location.search)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) { root.classList.add('reduced'); document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager' }) }
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]

  /* оверлей сетки: ?grid или клавиша g */
  if (q.has('grid')) root.classList.add('show-grid')
  addEventListener('keydown', (e) => {
    if (e.key !== 'g' && e.key !== 'п') return
    if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return
    root.classList.toggle('show-grid')
  })

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

  /* шапка: светлая над кадрами, чернильная над бумагой; на 390 над светлым кадром (data-hdr-m="ink") — чернилами без подложки */
  const hdr = $('#hdr')
  const screens = $$('.scene, .field')
  const narrow = matchMedia('(max-width: 760px)')
  const hdrTone = () => {
    const under = screens.find(s => { const r = s.getBoundingClientRect(); return r.top <= 32 && r.bottom > 32 })
    const paperUnder = !!under && under.classList.contains('field')
    hdr.classList.toggle('hdr--ink', paperUnder)
    hdr.classList.toggle('hdr--dark', !paperUnder && !!under && narrow.matches && under.dataset.hdrM === 'ink')
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
        e.preventDefault(); snap.busy = true; lenis.scrollTo(el, { duration: 1.6, onComplete: () => { snap.busy = false } })
      }))
      magnet(lenis)
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

    // как у обложки в B: при уходе экрана подпись слегка поднимается и гаснет по scrub; кадр не трогаем
    $$('.scene').forEach(sc => {
      gsap.to($('.scene__text', sc), { y: -64, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: sc, start: '25% top', end: 'bottom top', scrub: true } })
    })

    // текст сцены входит снизу и держится
    $$('.scene:not(.scene--c)').forEach(sc => {
      gsap.from($$('.scene__h, .note, .more', sc), { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: .09,
        scrollTrigger: { trigger: sc, start: 'top 55%', toggleActions: 'play none none reverse' } })
    })

    // Scrubbing Text Reveal: слова «обо мне» проступают .14 → 1
    gsap.to('#aboutBody .w', { opacity: 1, ease: 'none', stagger: .1,
      scrollTrigger: { trigger: '#about', start: 'top 85%', end: 'top top', scrub: .6 } })   // при магните к верху экрана текст проявлен целиком
    gsap.from('.about__h', { y: 48, opacity: 0, duration: 1.3, ease: 'power3.out',
      scrollTrigger: { trigger: '.about__h', start: 'top 85%' } })
    gsap.from('.contact__h', { yPercent: 30, opacity: 0, duration: 1.4, ease: 'power3.out',
      scrollTrigger: { trigger: '.contact__h', start: 'top 88%' } })
  }

  /* ---------- магнит к краям экранов (круг 4) ----------
     После остановки скролла (колесо, тач, клавиши, полоса) страница сама доезжает до ближайшего края экрана
     с учётом направления: ушли от края больше чем на 15% экрана в сторону следующего — едем к следующему,
     иначе возвращаемся. Экран выше окна (обо мне/связь на телефоне) — свободное чтение внутри, магнит к его
     верху и низу. Доезд 0.7 с ease-out, любое новое касание/колесо/клавиша его прерывает.
     reduced-motion: Lenis не стартует — магнита нет. */
  const snap = { busy: false, off: false }
  window.__snap = snap
  function magnet(lenis) {
    let t = 0, touching = false, dir = 1
    const vh = () => innerHeight
    const points = () => {
      const max = document.documentElement.scrollHeight - vh(), pts = new Set([0, max]), free = []
      screens.forEach(s => {
        const top = Math.round(s.getBoundingClientRect().top + scrollY), h = s.offsetHeight
        pts.add(Math.min(top, max))
        if (h > vh() + 2) { const bot = Math.min(top + h - vh(), max); pts.add(bot); free.push([top, bot]) }
      })
      return { pts: [...pts].sort((a, b) => a - b), free }
    }
    const go = () => {
      if (snap.off || snap.busy || touching) return
      const y = lenis.scroll, { pts, free } = points()
      if (free.some(([a, b]) => y > a + 1 && y < b - 1)) return          // читаем внутри высокого экрана
      if (pts.some(p => Math.abs(p - y) < 2)) return                    // уже на краю
      const prev = Math.max(...pts.filter(p => p < y)), next = Math.min(...pts.filter(p => p > y))
      const th = vh() * .15
      const target = dir > 0 ? (y - prev > th ? next : prev) : (next - y > th ? prev : next)
      snap.busy = true
      lenis.scrollTo(target, { duration: .7, easing: (k) => 1 - Math.pow(1 - k, 3), onComplete: () => { snap.busy = false } })
    }
    const arm = () => { clearTimeout(t); t = setTimeout(go, 160) }
    lenis.on('scroll', (e) => { if (e.direction) dir = e.direction; if (!snap.busy) arm() })
    const interrupt = () => { snap.busy = false; clearTimeout(t) }
    addEventListener('wheel', interrupt, { passive: true })
    addEventListener('keydown', interrupt)
    addEventListener('touchstart', () => { touching = true; interrupt() }, { passive: true })
    addEventListener('touchend', () => { touching = false; arm() }, { passive: true })
    addEventListener('touchcancel', () => { touching = false; arm() }, { passive: true })
  }

  const boot = () => { direct() }
  if (document.readyState === 'complete') boot()
  else addEventListener('load', boot)
})()
