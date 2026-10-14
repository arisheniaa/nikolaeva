/* направление A · apple-design · маска-проявка
   Средство по лестнице: position:sticky + rAF + Lenis (~3 КБ). GSAP не тянем: пин решён sticky,
   скраб — прямым отображением прокрутки, пружины — собственные (10 строк ниже). */
(() => {
  const qs = new URLSearchParams(location.search)
  const SHOT = qs.has('shot')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || qs.has('static')
  const root = document.documentElement
  const clamp01 = (x) => Math.max(0, Math.min(1, x))

  /* ── зерно: шум генерируется кодом один раз, статичный (apple §14: без мерцания на весь экран) ── */
  {
    const c = document.createElement('canvas'); c.width = c.height = 160
    const x = c.getContext('2d'), d = x.createImageData(160, 160)
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255 }
    x.putImageData(d, 0, 0); root.style.setProperty('--grain', `url(${c.toDataURL()})`)
  }

  /* ── меню на телефоне, сетка по «g» ── */
  const top = document.getElementById('top'), menuBtn = document.getElementById('menuBtn')
  menuBtn.addEventListener('click', () => { const o = top.classList.toggle('open'); menuBtn.textContent = o ? 'закрыть' : 'меню'; menuBtn.setAttribute('aria-expanded', o) })
  document.querySelectorAll('#nav a').forEach((a) => a.addEventListener('click', () => { top.classList.remove('open'); menuBtn.textContent = 'меню' }))
  addEventListener('keydown', (e) => { if (e.key === 'g' && !e.metaKey && !e.ctrlKey) root.classList.toggle('show-grid') })

  if (reduced) { // статика: шапка берёт цвет из секции под ней
    const upd = () => { const el = document.elementsFromPoint(innerWidth / 2, 32).map((e) => e.closest('[data-ink]')).find(Boolean)
      if (el) root.style.setProperty('--chrome', el.dataset.ink === 'dark' ? 'var(--ink)' : 'var(--milk)') }
    addEventListener('scroll', upd, { passive: true }); upd()
  }
  if (reduced) return // статика: секции подряд, весь текст виден, кадры без обработки

  root.classList.add('motion')

  /* ── пружина Apple: damping ratio + response вместо mass/stiffness/damping (apple §4) ── */
  class Spring {
    constructor(v, { damping = 1, response = 0.4 } = {}) { this.value = this.target = v; this.vel = 0; this.set(damping, response) }
    set(damping, response) { const w = (2 * Math.PI) / response; this.k = w * w; this.c = 2 * damping * w }
    step(dt) { // полунеявный Эйлер, дробим шаг — устойчиво при любом fps
      const n = Math.ceil(dt / 0.008), h = dt / n
      for (let i = 0; i < n; i++) { const a = -this.k * (this.value - this.target) - this.c * this.vel; this.vel += a * h; this.value += this.vel * h }
      return this.value
    }
    snap(v) { this.value = this.target = v; this.vel = 0 }
  }
  // кривая критически задемпфированной пружины, нормированная на отрезок — для программной прокрутки
  const springEase = (response = 0.42, T = 0.62) => { const w = (2 * Math.PI) / response, end = 1 - (1 + w * T) * Math.exp(-w * T); return (u) => (1 - (1 + w * T * u) * Math.exp(-w * T * u)) / end }

  /* ── сцены ── */
  const story = document.getElementById('story')
  const scenes = [...story.querySelectorAll('.scene')].map((el) => {
    const dim = document.createElement('div'); dim.className = 'dim'; el.appendChild(dim)
    return { el, dim, imgs: [...el.querySelectorAll('.ph img')], cap: el.querySelector('.cap'), ink: el.dataset.ink }
  })
  const N = scenes.length
  const HOLD = 0.16 // доля стыка, на которой кадр стоит неподвижно (плато)

  /* ── рельс ── */
  const rail = document.getElementById('rail')
  const railBtns = scenes.map((s, k) => {
    const li = document.createElement('li'), b = document.createElement('button')
    b.setAttribute('aria-label', (s.el.querySelector('h1,h2')?.textContent || '').trim()); li.appendChild(b); rail.appendChild(li)
    b.addEventListener('click', () => scrollToY(yFor(k), 0.9)); return b
  })

  /* ── Lenis: инерция колеса; на касании — родная прокрутка ОС ── */
  let lenis = null
  if (!SHOT && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, smoothWheel: true, syncTouch: false })
  }
  function scrollToY(y, T = 0.62) {
    if (lenis) lenis.scrollTo(y, { duration: T, easing: springEase(0.42, T), onComplete: () => { snapping = false } })
    else scrollTo({ top: y, behavior: SHOT ? 'instant' : 'smooth' })
  }

  /* ── геометрия прокрутки ── */
  let sTop = 0, sLen = 1
  const measure = () => { sTop = story.offsetTop; sLen = Math.max(1, story.offsetHeight - innerHeight) }
  measure(); addEventListener('resize', measure)
  const yFor = (k, f = 0) => sTop + sLen * ((k + f) / (N - 1))
  function posFromY(y) {
    const p = clamp01((y - sTop) / sLen), raw = p * (N - 1), i = Math.min(N - 2, Math.floor(raw)), f = raw - i
    const fr = clamp01((f - HOLD) / (1 - 2 * HOLD))
    return { p, i, f, fr, pos: i + fr }
  }

  /* ── маска-проявка: кромка шириной F% поднимается снизу, под ней проступает новый кадр ── */
  const feather = new Spring(34, { damping: 1, response: 0.35 })
  function maskFor(r, F) { const e = r * (100 + F); return `linear-gradient(to top, #000 ${(e - F).toFixed(2)}%, transparent ${e.toFixed(2)}%)` }
  let lastPos = -1, lastF = -1
  function render(pos, F) {
    if (Math.abs(pos - lastPos) < 1e-4 && Math.abs(F - lastF) < 0.05) return
    lastPos = pos; lastF = F
    scenes.forEach((s, k) => {
      const r = k === 0 ? 1 : clamp01(pos - (k - 1)) // насколько кадр проявлен
      const gone = clamp01(pos - k)                    // насколько он уже ушёл под следующий
      const vis = r > 0 && gone < 1
      s.el.style.visibility = vis ? 'visible' : 'hidden'
      if (!vis) return
      const m = r >= 1 ? 'none' : maskFor(r, F)
      s.el.style.webkitMaskImage = m; s.el.style.maskImage = m
      // входящий кадр «подходит» к зрителю: 1.06 → 1; уходящий отступает вглубь и темнеет (apple §12: dim to focus)
      const z = (k === 0 ? 1 : 1.06 - 0.06 * r) + 0.035 * gone
      s.imgs.forEach((im) => im.style.setProperty('--z', z.toFixed(4)))
      s.dim.style.opacity = (0.55 * gone).toFixed(3)
      if (s.cap && k > 0) { s.cap.style.opacity = (1 - clamp01(gone * 2.2)).toFixed(3); s.cap.style.transform = `translateY(${(-gone * 28).toFixed(1)}px)` }
      if (k === 0) { s.cap.style.opacity = (1 - clamp01(gone * 2.2)).toFixed(3); s.cap.style.transform = `translateY(${(-gone * 28).toFixed(1)}px)` }
    })
  }

  /* ── обложка: осветление под рукой (dodging, как под увеличителем в лаборатории) ── */
  const cover = scenes[0], coverPh = cover.el.querySelector('.ph')
  const mobile = () => innerWidth <= 760
  const LX = new Spring(0), LY = new Spring(0), LR = new Spring(0, { damping: 1, response: 0.9 })
  const CAPO = new Spring(0, { damping: 1, response: 0.7 })
  let pointerActive = false, pSpeed = 0, lastPt = null
  function restLight() {
    const b = coverPh.getBoundingClientRect()
    return mobile() ? { x: b.width * 0.6, y: b.height * 0.42, r: Math.max(b.width, b.height) * 0.42 }
                    : { x: b.width * 0.63, y: b.height * 0.5, r: Math.max(b.width, b.height) * 0.3 }
  }
  { const r0 = restLight(); LX.snap(r0.x); LY.snap(r0.y) }
  function aim(e) {
    const b = coverPh.getBoundingClientRect()
    const x = e.clientX - b.left, y = e.clientY - b.top
    if (y < 0 || y > b.height) return
    const t = performance.now()
    if (lastPt) { const dt = Math.max(1, t - lastPt.t); pSpeed = Math.hypot(x - lastPt.x, y - lastPt.y) / dt * 1000 }
    lastPt = { x, y, t }; pointerActive = true
    LX.target = x; LY.target = y // X и Y — независимые пружины (apple §3)
  }
  addEventListener('pointermove', aim, { passive: true })
  addEventListener('pointerdown', aim, { passive: true }) // отклик на касание, не на отпускание
  document.addEventListener('pointerleave', () => { pointerActive = false })
  addEventListener('touchend', () => { pointerActive = false })

  // вход сцены: свет включается из точки лица, подпись проявляется следом
  let t0 = performance.now()
  const startEntrance = () => { t0 = performance.now(); LR.target = restLight().r }
  const coverImg = cover.imgs[0]
  if (coverImg.complete) startEntrance(); else coverImg.addEventListener('load', startEntrance, { once: true })

  /* ── about: строки дневника проявляются по одной ── */
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return
    const lines = [...e.target.querySelectorAll('.ln')]
    lines.forEach((l, i) => setTimeout(() => l.classList.add('in'), i * 90)); io.unobserve(e.target)
  }), { threshold: 0.25 })
  io.observe(document.querySelector('.about-t'))

  /* ── шапка и рельс: цвет по тому, что под ними ── */
  const about = document.getElementById('obo-mne'), contact = document.getElementById('svyaz')
  let lastChrome = '', lastActive = -1
  function chrome(state) {
    let ink = 'light'
    const yh = 32
    const ab = about.getBoundingClientRect(), cb = contact.getBoundingClientRect()
    if (cb.top <= yh) ink = 'dark'
    else if (ab.top <= yh) ink = (yh - ab.top) / ab.height > 0.84 ? 'dark' : 'light'
    else ink = scenes[Math.round(state.pos)].ink
    const v = ink === 'dark' ? 'var(--ink)' : 'var(--milk)'
    if (v !== lastChrome) { root.style.setProperty('--chrome', v); lastChrome = v }
    const inStory = scrollY < sTop + sLen + innerHeight * 0.3
    rail.style.opacity = inStory ? 1 : 0
    const a = Math.round(state.pos)
    if (a !== lastActive) { railBtns.forEach((b, k) => b.setAttribute('aria-current', k === a)); lastActive = a }
  }

  /* ── доводка: решение «вперёд/назад» по знаку скорости, не по позиции (apple §6, quick ref) ── */
  let snapping = false, lastInput = 0, touching = false, lastDir = 1, vel = 0, prevY = scrollY, stillFrames = 0
  const markInput = () => { lastInput = performance.now(); snapping = false }
  addEventListener('wheel', markInput, { passive: true })
  addEventListener('keydown', markInput)
  addEventListener('touchstart', () => { touching = true; markInput() }, { passive: true })
  addEventListener('touchend', () => { touching = false; lastInput = performance.now() }, { passive: true })
  function maybeSnap(st, now) {
    if (SHOT || snapping || touching) return
    if (now - lastInput < 90 || Math.abs(vel) > 10) { stillFrames = 0; return }
    if (++stillFrames < 3) return
    if (st.p <= 0 || st.p >= 1 || st.fr <= 0.001 || st.fr >= 0.999) return
    // вперёд, если двигались вперёд и прошли хотя бы 18% стыка; назад — симметрично
    const fwd = lastDir > 0 ? st.fr > 0.18 : st.fr > 0.82
    const y = fwd ? yFor(st.i, 1 - HOLD * 0.5) : yFor(st.i, HOLD * 0.5)
    snapping = true; scrollToY(y, 0.62)
  }

  /* ── один цикл кадра ── */
  let prevT = performance.now()
  function frame(now) {
    const dt = Math.min(0.05, (now - prevT) / 1000); prevT = now
    if (lenis) lenis.raf(now)
    const y = scrollY
    const iv = (y - prevY) / Math.max(dt, 1e-3); prevY = y
    vel += (iv - vel) * 0.35
    if (Math.abs(vel) > 40) lastDir = Math.sign(vel)

    const st = posFromY(y)
    // кромка шире на скорости: скорость кодируется размытием, а не резким срезом (apple §11)
    feather.target = 34 + Math.min(30, Math.abs(vel) / 45)
    const F = feather.step(dt)
    render(st.pos, F)

    // свет обложки
    if (st.pos < 1.05) {
      const rest = restLight()
      if (!pointerActive) { LX.target = rest.x; LY.target = rest.y }
      pSpeed *= 0.9
      if (now - t0 > 0) LR.target = rest.r * (pointerActive && !mobile() ? 0.82 : 1) + Math.min(90, pSpeed / 18)
      if (now - t0 > 380) CAPO.target = 1
      LX.step(dt); LY.step(dt); LR.step(dt); CAPO.step(dt)
      coverPh.style.setProperty('--lx', LX.value.toFixed(1) + 'px')
      coverPh.style.setProperty('--ly', LY.value.toFixed(1) + 'px')
      coverPh.style.setProperty('--lr', Math.max(0, LR.value).toFixed(1) + 'px')
      cover.cap.style.setProperty('--capo', clamp01(CAPO.value).toFixed(3))
    }
    chrome(st)
    maybeSnap(st, now)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  /* ── крючки для съёмки доказательств ── */
  window.__nn = {
    go(p) { measure(); const y = sTop + sLen * p; scrollTo(0, y); prevY = y; vel = 0 },
    goY(y) { scrollTo(0, y); prevY = y; vel = 0 },
    settle() { feather.snap(34); const r = restLight(); LX.snap(r.x); LY.snap(r.y); LR.snap(r.r); CAPO.snap(1); lastPos = -1 },
    light(x, y) { pointerActive = true; LX.snap(x); LY.snap(y); LR.snap(restLight().r * 0.82) },
    geom: () => ({ sTop, sLen, N, HOLD }),
  }
})()
