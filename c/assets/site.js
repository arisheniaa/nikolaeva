/* nastya nico · общее для всех страниц (вынесено из главной гибрида, Ф4). Без сборки.
   Оверлей сетки, меню телефона, тон шапки, Lenis-скролл, якоря, магнит к краям экранов.
   Страничные скрипты грузятся после и ждут window.load: к этому моменту site.js уже поднял Lenis (window.__lenis). */
(() => {
  const root = document.documentElement
  const q = new URLSearchParams(location.search)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) { root.classList.add('reduced'); document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager' }) }
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]
  window.__site = { reduced, $, $$ }

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

  /* экраны: кадр (.scene), поле (.field), длинная серия (.series — свободное чтение внутри) */
  const screens = $$('.scene, .field, .series')

  /* шапка: светлая над кадрами, чернильная над бумагой; на 390 над светлым кадром (data-hdr-m="ink") — чернилами без подложки */
  const hdr = $('#hdr')
  const narrow = matchMedia('(max-width: 760px)')
  const hdrTone = () => {
    const under = screens.find(s => { const r = s.getBoundingClientRect(); return r.top <= 32 && r.bottom > 32 })
    const paperUnder = !!under && under.classList.contains('field')
    hdr.classList.toggle('hdr--ink', paperUnder)
    hdr.classList.toggle('hdr--dark', !paperUnder && !!under && narrow.matches && under.dataset.hdrM === 'ink')
    // 390: над серией кадры едут под шапкой непрерывно — шапка на сплошной полосе цвета страницы (не плашка на фото)
    hdr.classList.toggle('hdr--solid', !!under && narrow.matches && under.classList.contains('series'))
  }
  addEventListener('scroll', hdrTone, { passive: true }); addEventListener('resize', hdrTone); hdrTone()
  window.__hdrTone = hdrTone

  /* ---------- магнит к краям экранов (круг 4) ----------
     После остановки скролла (колесо, тач, клавиши, полоса) страница сама доезжает до ближайшего края экрана
     с учётом направления: ушли от края больше чем на 15% экрана в сторону следующего — едем к следующему,
     иначе возвращаемся. Экран выше окна (серия кадров; обо мне/связь на телефоне) — свободное чтение внутри,
     магнит к его верху и низу. Доезд 0.42 с ease-out (ускорено по просьбе владельца 17.10), любое новое
     касание/колесо/клавиша его прерывает. reduced-motion: Lenis не стартует — магнита нет. */
  const snap = { busy: false, off: false }
  window.__snap = snap
  /* Постраничный скролл (владелец 17.10: «как в варианте B» — один жест = один экран, без проскока).
     Колесо/тачпад, свайп и клавиши на краю экрана перехватываются: страница едет ровно к соседнему экрану,
     пока она едет и пока не стихла инерция тачпада — новые жесты гасятся. Внутри экрана выше окна (серия кадров;
     обо мне/связь, если выше окна) — свободное чтение, на его краях снова листается по экрану. */
  function magnet(lenis) {
    const vh = () => innerHeight
    let lockUntil = 0, busy = false, ty = null, t = 0, lastT = 0, lastD = 0
    const map = () => {
      const max = document.documentElement.scrollHeight - vh(), pts = new Set([0, max]), free = []
      screens.forEach(s => {
        const top = Math.round(s.getBoundingClientRect().top + scrollY), h = s.offsetHeight
        pts.add(Math.min(top, max))
        if (h > vh() + 2) { const bot = Math.min(top + h - vh(), max); pts.add(bot); free.push([top, bot]) }
      })
      return { pts: [...pts].sort((x, y) => x - y), free }
    }
    const y0 = () => (busy ? (lenis.targetScroll ?? lenis.scroll) : lenis.scroll)
    // свободная зона: внутри высокого экрана и движение не упирается в его край
    const isFree = (dir) => {
      const y = lenis.scroll, { free } = map()
      return free.some(([a, b]) => (dir > 0 ? y >= a - 2 && y < b - 2 : y > a + 2 && y <= b + 2))
    }
    const page = (dir) => {
      if (busy) return
      clearTimeout(t)
      const y = y0(), { pts } = map()
      const target = dir > 0 ? Math.min(...pts.filter(p => p > y + 2)) : Math.max(...pts.filter(p => p < y - 2))
      if (!isFinite(target)) return
      busy = true; snap.busy = true
      lenis.scrollTo(target, { duration: .8, easing: (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
        onComplete: () => { busy = false; snap.busy = false; lockUntil = performance.now() + 200 } })
    }
    const intercept = (dir) => !snap.off && !isFree(dir)
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      const dir = Math.sign(e.deltaY); if (!dir || !intercept(dir)) return
      e.preventDefault(); e.stopImmediatePropagation()
      // новый жест: пауза > 220 мс или рывок сильнее затухающей инерции; хвост инерции тачпада страниц не листает
      const now = performance.now(), d = Math.abs(e.deltaY)
      const fresh = now - lastT > 220 || d > lastD * 1.6 + 4
      lastT = now; lastD = d
      if (!fresh || busy || now < lockUntil) return
      page(dir)
    }, { passive: false, capture: true })
    addEventListener('keydown', (e) => {
      const k = e.key, dir = (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) ? 1
        : (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) ? -1 : 0
      if (!dir || e.target.closest('input, textarea, [contenteditable], dialog[open]') || !intercept(dir)) return
      e.preventDefault(); if (!busy) page(dir)
    })
    addEventListener('touchstart', (e) => { ty = e.touches[0].clientY }, { passive: true })
    addEventListener('touchmove', (e) => {
      if (ty == null) return
      const dir = Math.sign(ty - e.touches[0].clientY)
      if (dir && intercept(dir)) e.preventDefault()
    }, { passive: false })
    addEventListener('touchend', (e) => {
      if (ty == null) return
      const dy = ty - e.changedTouches[0].clientY, dir = Math.sign(dy); ty = null
      if (Math.abs(dy) > 40 && intercept(dir) && !busy) page(dir)
    }, { passive: true })
    // свободная зона: после остановки внутри неё на краю — мягко доводим к краю, если чуть перелетели
    lenis.on('scroll', () => { if (busy) return; clearTimeout(t); t = setTimeout(() => {
      if (busy || performance.now() < lockUntil) return
      const y = lenis.scroll, { pts, free } = map()
      if (free.some(([a, b]) => y > a + 1 && y < b - 1) || pts.some(p => Math.abs(p - y) < 2)) return
      const near = pts.reduce((m, p) => Math.abs(p - y) < Math.abs(m - y) ? p : m, pts[0])
      busy = true; lenis.scrollTo(near, { duration: .42, onComplete: () => { busy = false } })
    }, 120) })
  }

  /* ---------- Lenis + ScrollTrigger ---------- */
  function boot() {
    if (reduced || !window.gsap || !window.ScrollTrigger) return
    gsap.registerPlugin(ScrollTrigger)
    if (!window.Lenis) return
    const lenis = new Lenis({ lerp: .12, wheelMultiplier: .9 })
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
  if (document.readyState === 'complete') boot()
  else addEventListener('load', boot)
})()
