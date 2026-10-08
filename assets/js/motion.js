// Дизайн-система «Nastya Nico» · движение и мелкое поведение (основа — студийная ДС v0.8).
// Тихо (решение G1): проявка кадров, строки заголовка въезжают один раз,
// лёгкий параллакс, видео-петля с паузой. При prefers-reduced-motion
// ничего не анимируется, видео не запускается само.
(() => {
  const root = document.documentElement;
  // ?shot — статичный режим для скриншотов: всё сразу в конечном состоянии.
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    || new URLSearchParams(location.search).has("shot");
  root.classList.toggle("js-motion", !reduced);

  // ---------- Проявка и каллиграфия ----------
  const reveal = (els) => {
    if (reduced || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    els.forEach((el) => io.observe(el));
  };
  reveal([...document.querySelectorAll("[data-reveal]")]);
  // Строки заголовка ждут шрифт: иначе въезжает запасная гарнитура.
  const lines = [...document.querySelectorAll("[data-lines]")];
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => reveal(lines));

  // ---------- Видео-петля ----------
  document.querySelectorAll("[data-loop]").forEach((box) => {
    const video = box.querySelector("video");
    const btn = box.querySelector(".nn-video__toggle");
    if (!video) return;
    // В статичном режиме ?shot петля стоит на первом кадре, как у постера.
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches
      || new URLSearchParams(location.search).has("shot");
    let userPaused = still;
    const sync = () => {
      if (btn) btn.textContent = video.paused ? "смотреть" : "пауза";
    };
    if (still) {
      video.removeAttribute("autoplay");
      video.pause();
      video.currentTime = 0;
    }
    btn?.addEventListener("click", () => {
      userPaused = !video.paused;
      video.paused ? video.play() : video.pause();
    });
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    sync();
    // Вне экрана петля стоит — бережём батарею телефона.
    new IntersectionObserver(([e]) => {
      if (userPaused) return;
      e.isIntersecting ? video.play().catch(() => {}) : video.pause();
    }, { threshold: 0.1 }).observe(box);
  });

  // ---------- Меню телефона ----------
  const toggle = document.querySelector(".nn-menu-toggle");
  const menu = document.getElementById("menu");
  if (toggle && menu) {
    const close = menu.querySelector("[data-close]");
    const set = (open) => {
      menu.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
      (open ? close : toggle)?.focus();
    };
    toggle.addEventListener("click", () => set(true));
    close?.addEventListener("click", () => set(false));
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => set(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) set(false);
    });
  }

  // ---------- Параллакс ----------
  const layers = [...document.querySelectorAll("[data-parallax]")];
  if (reduced || !layers.length) return;
  const max = parseFloat(getComputedStyle(root).getPropertyValue("--parallax-max")) || 28;
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = innerHeight;
    for (const el of layers) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      // −1 … 1: положение центра блока относительно центра экрана.
      const p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
      const k = parseFloat(el.dataset.parallax) || 1;
      el.style.transform = `translate3d(0, ${(p * max * k).toFixed(1)}px, 0)`;
    }
  };
  addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();
