/* Направление B · стык «Б»: WebGL-растворение кадра в кадр через тёплую дымку и зерно.
   Ленивый модуль: грузится после load. Пока не готов или если WebGL2 нет, работает
   DOM-фолбэк (у каждой сцены свой <img>, следующая наезжает на предыдущую). */
(() => {
  const canvas = document.getElementById('gl')
  const scenes = [...document.querySelectorAll('.scene')]
  if (!canvas || !scenes.length) return
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true })
  if (!gl) return

  const VS = `#version 300 es
  in vec2 p; out vec2 v; void main(){ v = p*.5+.5; gl_Position = vec4(p,0.,1.); }`

  const FS = `#version 300 es
  precision highp float;
  in vec2 v; out vec4 o;
  uniform sampler2D A, B;
  uniform vec2 res, sa, sb, fa, fb;
  uniform vec3 ca, cb;
  uniform float prog, time, contain, topPx;
  float h(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return s; }

  // кадр: на десктопе обрезка по точке фокуса, на телефоне вертикаль целиком сверху, вокруг цвет кадра
  vec3 frame(sampler2D T, vec2 s, vec2 f, vec3 bg, float blur){
    float va = res.x/res.y, ia = s.x/s.y;
    vec2 cu; bool inside = true;
    if (contain > .5) {
      float hgt = va/ia;                       // доля высоты экрана под кадром
      float top = 1. - topPx/res.y;
      cu = vec2(v.x, (v.y - (top - hgt))/hgt);
      inside = cu.y >= 0. && cu.y <= 1.;
    } else if (va > ia) {
      float k = ia/va; float fy = 1. - f.y;
      float off = clamp(fy - k*.5, 0., 1. - k);
      cu = vec2(v.x, off + v.y*k);
    } else {
      float k = va/ia;
      float off = clamp(f.x - k*.5, 0., 1. - k);
      cu = vec2(off + v.x*k, v.y);
    }
    vec3 c = inside ? textureLod(T, cu, blur).rgb : bg;
    return c;
  }

  void main(){
    vec2 asp = vec2(res.x/res.y, 1.);
    float soft = .32;
    float N = fbm(v*asp*2.4 + 3.1);
    float th = prog*(1.+2.*soft) - soft;
    float m = smoothstep(N-soft, N+soft, th);
    float band = 4.*m*(1.-m);                 // 1 на кромке, 0 вдали
    float blur = band * 2.6;
    vec3 a = frame(A, sa, fa, ca, blur);
    vec3 b = frame(B, sb, fb, cb, blur);
    // проявка: новый кадр выходит из тёмного и плоского к полному контрасту
    float dev = smoothstep(0., .9, m);
    b = mix(vec3(dot(b, vec3(.33)))*.35, b, dev);
    a *= 1. - .2*m;
    vec3 c = mix(a, b, m);
    // тёплая дымка проявителя по кромке (мёд из w14)
    c += band * vec3(.79,.54,.24) * .38;
    // читаемость текста на десктопе: мягкая тень снизу
    c *= 1. - (1.-contain) * .32 * smoothstep(.42, 0., v.y);
    // живое зерно: тише на светлом, гуще на кромке
    float L = dot(c, vec3(.3,.6,.1));
    float g = (h(v*res + fract(time)*91.) - .5) * (.055 + band*.09) * (1.15 - L);
    c += g;
    vec2 q = v - .5; c *= 1. - dot(q,q)*.35;
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
  const U = {}; ['A', 'B', 'res', 'sa', 'sb', 'fa', 'fb', 'ca', 'cb', 'prog', 'time', 'contain', 'topPx'].forEach(k => U[k] = gl.getUniformLocation(pr, k))

  const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] }
  const narrow = () => innerWidth < 760
  const maxSide = narrow() ? 1500 : 2600

  const data = scenes.map(sc => ({
    sc, img: sc.querySelector('.scene__photo'),
    f: [parseFloat(sc.dataset.fx || .5), parseFloat(sc.dataset.fy || .5)],
    bg: hex(sc.dataset.bg || '#222222'), tex: null, size: [1, 1]
  }))

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

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, narrow() ? 2 : 1.5)
    canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  // карта скролла: переход i → i+1 занимает 0.8 экрана вокруг стыка секций
  const docTop = (el) => el.getBoundingClientRect().top + scrollY
  function state() {
    const vh = innerHeight, y = scrollY
    for (let i = 0; i < data.length - 1; i++) {
      const edge = docTop(data[i + 1].sc)          // верх следующей секции
      const a = edge - .92 * vh, b = edge - .12 * vh
      if (y < b) return { i, p: Math.min(1, Math.max(0, (y - a) / (b - a))) }
    }
    return { i: data.length - 2, p: 1 }
  }
  window.__dissolveState = state

  let visible = true, t0 = performance.now(), ready = false
  new IntersectionObserver(([en]) => { visible = en.isIntersecting }, { rootMargin: '10% 0px' }).observe(document.getElementById('reel'))

  function draw(now) {
    const { i, p } = state()
    const A = data[i], B = data[i + 1]
    gl.uniform1i(U.A, A.unit); gl.uniform1i(U.B, B.unit)
    gl.uniform2f(U.res, canvas.width, canvas.height)
    gl.uniform2f(U.sa, ...A.size); gl.uniform2f(U.sb, ...B.size)
    gl.uniform2f(U.fa, ...A.f); gl.uniform2f(U.fb, ...B.f)
    gl.uniform3f(U.ca, ...A.bg); gl.uniform3f(U.cb, ...B.bg)
    gl.uniform1f(U.prog, p); gl.uniform1f(U.time, (now - t0) / 1000)
    gl.uniform1f(U.contain, narrow() ? 1 : 0); gl.uniform1f(U.topPx, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  let last = 0
  function loop(now) {
    requestAnimationFrame(loop)
    if (!ready || !visible) return
    if (now - last < 1000 / 30) return       // зерно живёт на 30 fps, этого хватает
    last = now; draw(now)
  }

  ;(async () => {
    try {
      // первым грузим кадр, ближайший к экрану, остальные следом
      for (let k = 0; k < data.length; k++) await upload(data[k], k)
    } catch (e) { console.warn('dissolve: кадры не загрузились, фолбэк', e); return }
    resize(); addEventListener('resize', resize)
    ready = true; draw(performance.now())
    document.documentElement.classList.add('gl-on')
    requestAnimationFrame(loop)
  })()
})()
