/* nastya nico · внутренние страницы: вход первого экрана, проявка кадров серий, просмотрщик.
   Общее (меню, шапка, Lenis, магнит) — site.js, грузится раньше. Без JS и при reduced-motion всё видно сразу. */
(() => {
  const { reduced, $, $$ } = window.__site

  /* ---------- просмотрщик: кадры своей серии, стрелки/свайп/Esc, фокус заперт внутри ---------- */
  const v = $('#viewer'), vImg = $('#viewerImg'), vCount = $('#viewerCount')
  const vClose = $('#viewerClose'), vPrev = $('#viewerPrev'), vNext = $('#viewerNext')
  let list = [], idx = 0, opener = null
  const pad = (n) => String(n).padStart(2, '0')
  const show = (k) => {
    idx = (k + list.length) % list.length
    const img = $('img', list[idx])
    vImg.removeAttribute('src')
    vImg.sizes = '100vw'; vImg.srcset = img.getAttribute('srcset'); vImg.src = list[idx].href; vImg.alt = img.alt
    vCount.textContent = `${pad(idx + 1)} / ${pad(list.length)}`
  }
  const open = (a) => {
    list = $$('.shot__a', a.closest('.series')); opener = a
    show(list.indexOf(a))
    v.hidden = false; requestAnimationFrame(() => v.classList.add('is-open'))
    if (window.__lenis) window.__lenis.stop()
    if (window.__snap) window.__snap.off = true
    document.body.style.overflow = 'hidden'
    vClose.focus()
  }
  const close = () => {
    v.classList.remove('is-open'); v.hidden = true
    document.body.style.overflow = ''
    if (window.__lenis) window.__lenis.start()
    if (window.__snap) window.__snap.off = false
    if (opener) opener.focus({ preventScroll: true })
  }
  $$('.shot__a').forEach(a => a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return   // открыть файл в новой вкладке — как обычная ссылка
    e.preventDefault(); open(a)
  }))
  vClose.addEventListener('click', close)
  vPrev.addEventListener('click', () => show(idx - 1))
  vNext.addEventListener('click', () => show(idx + 1))
  vImg.addEventListener('click', () => show(idx + 1))
  addEventListener('keydown', (e) => {
    if (v.hidden) return
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1) }
    else if (e.key === 'Tab') {   // фокус по кругу: закрыть → назад → вперёд
      const f = [vClose, vPrev, vNext], i = f.indexOf(document.activeElement)
      e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus()
    }
  })
  let x0 = null, y0 = 0
  // жесты внутри просмотрщика не уходят к Lenis и магниту страницы
  v.addEventListener('touchstart', (e) => { e.stopPropagation(); x0 = e.touches[0].clientX; y0 = e.touches[0].clientY }, { passive: true })
  v.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true })
  v.addEventListener('touchend', (e) => {
    e.stopPropagation()
    if (x0 === null) return
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1))
  })

  /* ---------- режиссура (как на главной): подпись первого экрана входит снизу, при уходе поднимается и гаснет ---------- */
  function direct() {
    if (reduced || !window.gsap || !window.ScrollTrigger) return
    const sc = $('.scene')
    gsap.from($$('.scene__h, .note', sc), { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: .09, delay: .15 })
    gsap.to($('.scene__text', sc), { y: -64, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: sc, start: '25% top', end: 'bottom top', scrub: true } })
    // подзаголовки серий и кадры: мягкий подъём на 32 px один раз при входе; кадр не затемняется и не масштабируется
    $$('.series__h, .series__note').forEach(el => gsap.from(el, { y: 32, opacity: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true } }))
    const below = $$('.shot').filter(el => el.getBoundingClientRect().top > innerHeight * .92)   // видимые сразу не прячем
    gsap.set(below, { y: 32, opacity: 0 })
    ScrollTrigger.batch(below, { start: 'top 92%', once: true,
      onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: .08, overwrite: true }) })
    gsap.from('.contact__h', { yPercent: 30, opacity: 0, duration: 1.4, ease: 'power3.out',
      scrollTrigger: { trigger: '.contact__h', start: 'top 88%' } })
  }
  if (document.readyState === 'complete') direct()
  else addEventListener('load', direct)
})()
