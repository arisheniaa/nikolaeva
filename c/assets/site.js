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
      const y = (lenis.targetScroll ?? lenis.scroll), { pts, free } = points()   // решаем по цели Lenis, а не по догоняющей позиции
      if (free.some(([a, b]) => y > a + 1 && y < b - 1)) return          // читаем внутри высокого экрана
      if (pts.some(p => Math.abs(p - y) < 2)) return                    // уже на краю
      const prev = Math.max(...pts.filter(p => p < y)), next = Math.min(...pts.filter(p => p > y))
      const th = vh() * .15
      const target = dir > 0 ? (y - prev > th ? next : prev) : (next - y > th ? prev : next)
      snap.busy = true
      lenis.scrollTo(target, { duration: .42, easing: (k) => 1 - Math.pow(1 - k, 3), onComplete: () => { snap.busy = false } })
    }
    const arm = () => { clearTimeout(t); t = setTimeout(go, 90) }
    lenis.on('scroll', (e) => { if (e.direction) dir = e.direction; if (!snap.busy) arm() })
    const interrupt = () => { snap.busy = false; clearTimeout(t) }
    addEventListener('wheel', interrupt, { passive: true })
    addEventListener('keydown', interrupt)
    addEventListener('touchstart', () => { touching = true; interrupt() }, { passive: true })
    addEventListener('touchend', () => { touching = false; arm() }, { passive: true })
    addEventListener('touchcancel', () => { touching = false; arm() }, { passive: true })
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
