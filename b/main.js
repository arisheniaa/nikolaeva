/* Направление B · главная. Без сборки. Порядок: часы, меню, туман обложки, GSAP-режиссура, ленивый WebGL. */
(() => {
  const root = document.documentElement
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) { root.classList.add('reduced'); document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager' }) }
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]

  /* часы: живое московское время в шапке, как метка в дневнике */
  const clock = $('#clock')
  const fmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
  const tick = () => { clock.textContent = fmt.format(new Date()) }
  tick(); setInterval(tick, 15000)

  /* меню телефона */
  const mb = $('#menuBtn'), menu = $('#menu')
  mb.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden')
    menu.toggleAttribute('hidden', !open)
    mb.setAttribute('aria-expanded', String(open))
    mb.textContent = open ? 'закрыть' : 'меню'
  })
  $$('a', menu).forEach(a => a.addEventListener('click', () => mb.click()))

  /* ---------- механика hero: «проявка пальцем» ----------
     Кадр лежит под тёплой мутью проявителя. Там, где курсор или палец, муть расходится
     и кадр проступает резким; без касания муть затягивает обратно (~3 с).
     Пока человек не трогает, пятно само медленно бродит по лицу и рукам. */
  function fog() {
    const cv = $('#fog'); if (!cv || reduced) { cv && cv.remove(); return }
    const cx = cv.getContext('2d')
    const frame = cv.parentElement
    let W = 0, H = 0, S = .5
    // зерно для мути: тайл шума 128 px
    const tile = document.createElement('canvas'); tile.width = tile.height = 128
    const tc = tile.getContext('2d'), id = tc.createImageData(128, 128)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 200 + Math.random() * 40
      id.data[i] = v; id.data[i + 1] = v * .9; id.data[i + 2] = v * .76; id.data[i + 3] = 255
    }
    tc.putImageData(id, 0, 0)
    const haze = () => {
      cx.fillStyle = 'rgb(222,206,182)'; cx.fillRect(0, 0, W, H)
      cx.globalAlpha = .55; cx.fillStyle = cx.createPattern(tile, 'repeat'); cx.fillRect(0, 0, W, H); cx.globalAlpha = 1
    }
    const size = () => {
      const r = frame.getBoundingClientRect()
      W = cv.width = Math.max(1, Math.round(r.width * S)); H = cv.height = Math.max(1, Math.round(r.height * S))
      haze()
    }
    size(); addEventListener('resize', size)
    cv.style.opacity = '.5'
    cv.style.mixBlendMode = 'screen'

    // точка проявки: цель от курсора или автопилота, сама точка догоняет мягко
    const p = { x: W * .62, y: H * .3 }, t = { ...p }
    let lastMove = -1e9
    const onMove = (e) => {
      const r = frame.getBoundingClientRect()
      const pt = e.touches ? e.touches[0] : e
      t.x = (pt.clientX - r.left) * S; t.y = (pt.clientY - r.top) * S; lastMove = performance.now()
    }
    frame.closest('.cover').addEventListener('pointermove', onMove, { passive: true })
    frame.closest('.cover').addEventListener('touchmove', onMove, { passive: true })

    let visible = true
    new IntersectionObserver(([en]) => { visible = en.isIntersecting }).observe(frame)
    const t0 = performance.now()
    const loop = (now) => {
      requestAnimationFrame(loop)
      if (!visible) return
      const idle = now - lastMove > 2200
      if (idle) {
        // автопилот: восьмёрка вокруг лица и рук (f05: лицо ~62% / 30%)
        const k = (now - t0) / 1000
        t.x = W * (.6 + .16 * Math.sin(k * .37)); t.y = H * (.36 + .16 * Math.sin(k * .74 + 1))
      }
      p.x += (t.x - p.x) * .08; p.y += (t.y - p.y) * .08
      // муть возвращается
      cx.globalCompositeOperation = 'source-over'
      cx.globalAlpha = .028; cx.fillStyle = 'rgb(222,206,182)'; cx.fillRect(0, 0, W, H)
      cx.globalAlpha = .016; cx.fillStyle = cx.createPattern(tile, 'repeat'); cx.fillRect(0, 0, W, H)
      // проявка вокруг точки
      const R = Math.max(W, H) * (idle ? .2 : .17)
      const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R)
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      cx.globalCompositeOperation = 'destination-out'; cx.globalAlpha = .22
      cx.fillStyle = g; cx.fillRect(p.x - R, p.y - R, R * 2, R * 2)
      cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'
    }
    requestAnimationFrame(loop)
  }
  fog()

  /* разбивка слов «обо мне» для проявки по скроллу (текст остаётся в DOM) */
  const body = $('#aboutBody')
  const splitWords = (el) => {
    const walk = [...el.childNodes]
    walk.forEach(n => {
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
  if (!reduced) splitWords(body)

  /* шапка: светлая над кадрами, чернильная над бумагой */
  const hdr = $('#hdr'), paper = $('#about')
  const hdrTone = () => { hdr.classList.toggle('hdr--ink', paper.getBoundingClientRect().top < 40) }
  addEventListener('scroll', hdrTone, { passive: true }); hdrTone()

  /* ---------- GSAP + Lenis ---------- */
  function direct() {
    if (reduced || !window.gsap || !window.ScrollTrigger) { $$('.w').forEach(w => w.style.opacity = 1); return }
    gsap.registerPlugin(ScrollTrigger)
    if (window.Lenis) {
      const lenis = new Lenis({ lerp: .085, wheelMultiplier: .9 })
      window.__lenis = lenis
      lenis.on('scroll', ScrollTrigger.update)
      gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0)
      $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
        const el = $(a.getAttribute('href')); if (!el) return
        e.preventDefault(); lenis.scrollTo(el, { duration: 1.6 })
      }))
    }
    // имя проявляется по буквам: из размытия и тёплой мути к резкости
    const name = $('#name')
    name.setAttribute('aria-label', name.textContent)
    const chars = [...name.textContent].map(ch => {
      const s = document.createElement('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true')
      s.style.display = 'inline-block'; if (ch === ' ' || ch === ' ') s.style.width = '.28em'
      return s
    })
    name.textContent = ''; name.append(...chars)
    gsap.from(chars, { opacity: 0, filter: 'blur(14px)', yPercent: 18, duration: 1.6, ease: 'power3.out', stagger: .055, delay: .15 })
    gsap.from('.cover__sub, .hdr', { opacity: 0, duration: 1.2, delay: .9, ease: 'power2.out' })

    // Image Scale & Fade (gpt-taste): обложка уходит, темнея до .2
    gsap.to('.cover__img', { opacity: .2, scale: 1.05, ease: 'none',
      scrollTrigger: { trigger: '#cover', start: 'top top', end: 'bottom top', scrub: true } })
    gsap.to('.cover__text', { yPercent: -40, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '#cover', start: '30% top', end: 'bottom top', scrub: true } })

    // текст сцены: входит снизу, держится, уходит вверх вместе с кадром
    $$('.scene').forEach(sc => {
      const items = $$('.scene__h, .note, .door__link', sc)
      gsap.from(items, { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: .09,
        scrollTrigger: { trigger: sc, start: 'top 55%', toggleActions: 'play none none reverse' } })
      const mini = $('.door__mini', sc)
      if (mini) gsap.from(mini, { scale: .8, opacity: 0, duration: 1.2, ease: 'power3.out',
        scrollTrigger: { trigger: sc, start: 'top 40%', toggleActions: 'play none none reverse' } })
    })

    // Scrubbing Text Reveal: слова «обо мне» проступают .14 → 1
    gsap.to('#aboutBody .w', { opacity: 1, ease: 'none', stagger: .1,
      scrollTrigger: { trigger: '#aboutBody', start: 'top 82%', end: 'bottom 52%', scrub: .6 } })
    gsap.from('.about__h', { y: 60, opacity: 0, duration: 1.3, ease: 'power3.out',
      scrollTrigger: { trigger: '.about__h', start: 'top 85%' } })
    gsap.from('.contact__h', { yPercent: 30, opacity: 0, duration: 1.4, ease: 'power3.out',
      scrollTrigger: { trigger: '.contact__h', start: 'top 88%' } })
  }

  /* ---------- ленивый WebGL (П7): после load и простоя, не раньше первого экрана ---------- */
  function lazyGL() {
    if (reduced) return
    const go = () => {
      const s = document.createElement('script'); s.src = 'dissolve.js'; s.async = true; document.body.append(s)
    }
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 600))
    idle(go, { timeout: 2500 })
  }

  const boot = () => { direct(); lazyGL() }
  if (document.readyState === 'complete') boot()
  else addEventListener('load', boot)
})()
