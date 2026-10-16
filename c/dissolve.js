/* Гибрид A+B · стык B на всех стыках главной: WebGL-растворение через тёплую дымку и зерно.
   Кадры: обложка → женский → мужской → пара → свадьба (растворение кадр в кадр по скроллу).
   Поля: «обо мне» и «связь» входят фронтом растворения, который поднимается вместе с секцией:
   последний кадр растворяется в текстуру-заливку цветом экрана, кромка та же (шум, дымка, зерно).
   Кадр в шейдере кладётся в тот же прямоугольник, что и DOM-фолбэк (.scene__frame, края на линиях
   колонок), с той же семантикой object-position, поэтому крупность одинакова в обоих режимах. */
(() => {
  const canvas = document.getElementById('gl')
  const scenes = [...document.querySelectorAll('.scene')]
  const fields = [...document.querySelectorAll('.field')]
  if (!canvas || !scenes.length) return
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true })
  if (!gl) return

  const VS = `#version 300 es
  in vec2 p; out vec2 v; void main(){ v = p*.5+.5; gl_Position = vec4(p,0.,1.); }`

  const FS = `#version 300 es
  precision highp float;
  in vec2 v; out vec4 o;
  uniform sampler2D A, B;
  uniform vec2 res, sa, sb, oa, ob;
  uniform vec4 ra, rb;               // прямоугольник кадра в долях экрана: x0, y0, x1, y1 (y снизу)
  uniform vec2 ga, gb;               // кромка к полю: сторона (0 нет, 1 лево, 2 право, 3 низ) и ширина растворения, px холста
  uniform vec3 ca, cb, ea, eb;       // цвет поля сцены; эффекты: тень под подписью, виньетка, зерно
  uniform vec3 c1, c2, e1, e2;       // поля «обо мне» и «связь»
  uniform float prog, time, f1, f2;  // f1/f2: высота фронта поля в долях экрана (y снизу)
  float h(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return s; }

  // кадр в прямоугольнике r, cover-обрезка с семантикой CSS object-position o (доли, y от верха)
  vec3 frame(sampler2D T, vec2 s, vec4 r, vec2 o, vec3 bg, float blur, float shade, vec2 ge){
    if (v.x < r.x || v.x > r.z || v.y < r.y || v.y > r.w) return bg;
    vec2 lu = (v - r.xy) / (r.zw - r.xy);
    float ra_ = (r.z - r.x) * res.x / ((r.w - r.y) * res.y), ia = s.x / s.y;
    vec2 t;
    if (ra_ > ia) { float k = ia / ra_; float top = 1. - o.y * (1. - k); t = vec2(lu.x, top - (1. - lu.y) * k); }
    else { float k = ra_ / ia; t = vec2(o.x * (1. - k) + lu.x * k, lu.y); }
    vec3 c = texture(T, t, blur).rgb;
    // тень под подписью: только внутри кадра, по нижним 46% экрана
    c *= 1. - shade * smoothstep(.46, 0., v.y);
    // кромка к полю растворяется в цвет поля линейно, как mask-image в DOM
    float d = ge.x < .5 ? 1e5 : ge.x < 1.5 ? (v.x - r.x) * res.x : ge.x < 2.5 ? (r.z - v.x) * res.x : (v.y - r.y) * res.y;
    return mix(bg, c, clamp(d / max(ge.y, 1.), 0., 1.));
  }

  // маска фронта поля: ниже линии фронта — поле, кромка рваная по шуму
  float front(float fy, float N){
    float d = fy - v.y + (N - .5) * .3;
    return smoothstep(-.07, .07, d);
  }

  void main(){
    vec2 asp = vec2(res.x/res.y, 1.);
    float soft = .32;
    float N = fbm(v*asp*2.4 + 3.1);
    float th = prog*(1.+2.*soft) - soft;
    float m = smoothstep(N-soft, N+soft, th);
    float N2 = fbm(v*asp*3.1 + 11.7);
    float m1 = front(f1, N2), m2 = front(f2, N2);
    float b0 = 4.*m*(1.-m), b1 = 4.*m1*(1.-m1), b2 = 4.*m2*(1.-m2);
    float band = max(b0, max(b1 * (1.-m2), b2));
    float blur = max(b0, b1) * 2.6;
    vec3 a = frame(A, sa, ra, oa, ca, blur, ea.x, ga);
    vec3 b = frame(B, sb, rb, ob, cb, blur, eb.x, gb);
    // проявка: новый кадр выходит из тёмного и плоского к полному контрасту
    float dev = smoothstep(0., .9, m);
    b = mix(vec3(dot(b, vec3(.33)))*.35, b, dev);
    a *= 1. - .2*m;
    vec3 c = mix(a, b, m);
    vec3 e = mix(ea, eb, m);
    // поля поднимаются фронтом
    c = mix(c, c1, m1); e = mix(e, e1, m1);
    c = mix(c, c2, m2); e = mix(e, e2, m2);
    // тёплая дымка проявителя по кромке (мёд из w14)
    c = mix(c, vec3(.79,.54,.24), band * .4);
    // зерно: тише на светлом, гуще на кромке; на обложке в покое ноль
    float L = dot(c, vec3(.3,.6,.1));
    float g = (h(v*res + fract(time)*91.) - .5) * (e.z + band*.09) * (1.15 - L);
    c += g;
    vec2 q = v - .5; c *= 1. - dot(q,q) * e.y;
    o = vec4(c, 1.);
  }`

  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x }
  let pr
  try {
    pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr)
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr))
  } catch (e) { console.warn('dissolve: фолбэк', e); return }
  gl.useProgram(pr)
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const U = {}
  ;['A', 'B', 'res', 'sa', 'sb', 'oa', 'ob', 'ra', 'rb', 'ga', 'gb', 'ca', 'cb', 'ea', 'eb', 'c1', 'c2', 'e1', 'e2', 'prog', 'time', 'f1', 'f2']
    .forEach(k => U[k] = gl.getUniformLocation(pr, k))

  const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] }
  const fx = (el) => (el.dataset.fx || '0,0,0').split(',').map(Number)
  const narrow = () => innerWidth <= 760
  const maxSide = narrow() ? 1500 : 2600
  const pct = (s, d) => { const x = parseFloat(s); return Number.isFinite(x) ? x / 100 : d }

  // десктоп и телефон: свой фокус (--ox/--oy и --oxm/--oym), своё поле (data-bg / data-bg-m), своя кромка
  const data = scenes.map(sc => {
    const img = sc.querySelector('.scene__photo'), st = (k) => img.style.getPropertyValue(k)
    const od = [pct(st('--ox'), .5), pct(st('--oy'), .5)]
    return {
      sc, img, frame: sc.querySelector('.scene__frame'), pin: sc.querySelector('.scene__pin'),
      od, om: [pct(st('--oxm'), od[0]), pct(st('--oym'), od[1])], o: od,
      bgd: hex(sc.dataset.bg || '#222222'), bgm: hex(sc.dataset.bgM || sc.dataset.bg || '#222222'), bg: null,
      side: { L: 1, R: 2 }[sc.dataset.edge] || 0, edge: [0, 1],
      fx: fx(sc), rect: [0, 0, 1, 1], tex: null, size: [1, 1]
    }
  })
  const fd = fields.map(f => ({ el: f, bg: hex(f.dataset.bg || '#f3eee6'), fx: fx(f) }))

  const upload = async (d, unit) => {
    d.img.loading = 'eager'
    try { await d.img.decode() } catch (e) { await new Promise(r => d.img.complete ? r() : d.img.addEventListener('load', r, { once: true })) }
    let src = d.img, w = d.img.naturalWidth, hh = d.img.naturalHeight
    const k = Math.min(1, maxSide / Math.max(w, hh))
    if (k < 1) {
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hh * k)
      c.getContext('2d').drawImage(d.img, 0, 0, c.width, c.height); src = c; w = c.width; hh = c.height
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, src)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    d.tex = t; d.unit = unit; d.size = [w, hh]
  }

  // прямоугольник кадра: меряем .scene__frame относительно своего pin (pin = экран, когда закреплён)
  function measure() {
    const n = narrow(), k = canvas.width / (canvas.clientWidth || 1)
    const fpx = (window.__fade ? window.__fade() : 96) * k
    data.forEach(d => {
      d.o = n ? d.om : d.od; d.bg = n ? d.bgm : d.bgd
      d.edge = [n ? 3 : d.side, fpx]
      const p = d.pin.getBoundingClientRect(), f = d.frame.getBoundingClientRect()
      const W = p.width || 1, H = p.height || 1
      const x0 = (f.left - p.left) / W, x1 = (f.right - p.left) / W
      const yTop = (f.top - p.top) / H, yBot = (f.bottom - p.top) / H
      d.rect = [x0, 1 - yBot, x1, 1 - yTop]
    })
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, narrow() ? 2 : 1.5)
    canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)
    measure()
  }

  // карта скролла: кадр → кадр занимает 0.8 экрана вокруг стыка секций (как в B)
  const docTop = (el) => el.getBoundingClientRect().top + scrollY
  const LEAD = .2   // фронт поля идёт на 0.2 экрана выше верха секции: текст поля всегда на бумаге
  function state() {
    const vh = innerHeight, y = scrollY
    let i = data.length - 2, p = 1
    for (let k = 0; k < data.length - 1; k++) {
      const edge = docTop(data[k + 1].sc)
      const a = edge - .92 * vh, b = edge - .12 * vh
      if (y < b) { i = k; p = Math.min(1, Math.max(0, (y - a) / (b - a))); break }
    }
    // высота фронта поля в долях экрана, снизу: 0 = низ экрана, 1 = верх
    // «обо мне»: фронт на LEAD выше секции (текст поля встаёт уже на бумагу).
    // «связь»: бумага на бумагу, текст читается и на кромке, поэтому фронт идёт в 1.4 раза быстрее секции:
    // стартует, когда верх «связи» внизу экрана, и закрывает экран, когда «связь» встаёт к верху
    // (иначе в конце страницы кромка застряла бы на экране).
    const t1 = fd[0].el.getBoundingClientRect().top / vh, t2 = fd[1].el.getBoundingClientRect().top / vh
    return { i, p, f1: 1 - (t1 - LEAD), f2: -.2 + 1.4 * (1 - t2) }
  }
  window.__dissolveState = state

  let t0 = performance.now(), ready = false

  function draw(now) {
    const { i, p, f1, f2 } = state()
    const A = data[i], B = data[i + 1]
    gl.uniform1i(U.A, A.unit); gl.uniform1i(U.B, B.unit)
    gl.uniform2f(U.res, canvas.width, canvas.height)
    gl.uniform2f(U.sa, ...A.size); gl.uniform2f(U.sb, ...B.size)
    gl.uniform2f(U.oa, ...A.o); gl.uniform2f(U.ob, ...B.o)
    gl.uniform4f(U.ra, ...A.rect); gl.uniform4f(U.rb, ...B.rect)
    gl.uniform2f(U.ga, ...A.edge); gl.uniform2f(U.gb, ...B.edge)
    gl.uniform3f(U.ca, ...A.bg); gl.uniform3f(U.cb, ...B.bg)
    gl.uniform3f(U.ea, ...A.fx); gl.uniform3f(U.eb, ...B.fx)
    gl.uniform3f(U.c1, ...fd[0].bg); gl.uniform3f(U.c2, ...fd[1].bg)
    gl.uniform3f(U.e1, ...fd[0].fx); gl.uniform3f(U.e2, ...fd[1].fx)
    gl.uniform1f(U.prog, p); gl.uniform1f(U.f1, f1); gl.uniform1f(U.f2, f2)
    gl.uniform1f(U.time, (now - t0) / 1000)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  window.__dissolveDraw = () => ready && draw(performance.now())
  let last = 0
  function loop(now) {
    requestAnimationFrame(loop)
    if (!ready || document.hidden) return
    if (now - last < 1000 / 30) return       // зерно живёт на 30 fps, этого хватает
    last = now; draw(now)
  }

  ;(async () => {
    try {
      for (let k = 0; k < data.length; k++) await upload(data[k], k)   // обложка первой
    } catch (e) { console.warn('dissolve: кадры не загрузились, фолбэк', e); return }
    resize(); addEventListener('resize', resize)
    ready = true; draw(performance.now())
    document.documentElement.classList.add('gl-on')
    window.__hdrTone && window.__hdrTone()
    requestAnimationFrame(loop)
  })()
})()
