/* Morph transition: the outgoing wallpaper tears away in noise into the new one.
   Plain WebGL port of the MorphGallery shader. Images must be same-origin or
   served with CORS headers; otherwise the change falls back to an instant swap. */
(function () {
  const VS = `attribute vec2 a_position;
varying vec2 v_uv;
void main(){ v_uv = a_position*0.5+0.5; gl_Position = vec4(a_position,0.0,1.0); }`;

  const FS = `precision highp float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
uniform vec2 u_resolution;
uniform float u_fromAspect;
uniform float u_toAspect;
uniform float u_scale;
uniform float u_direction;
uniform float u_edge;
uniform float u_drift;
varying vec2 v_uv;

vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0*fract(p*C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314*(a0*a0 + h*h);
  vec3 g;
  g.x = a0.x*x0.x + h.x*x0.y;
  g.yz = a0.yz*x12.xz + h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 v){
  float value = 0.0; float amp = 0.5;
  for (int i = 0; i < 5; i++){ value += amp*snoise(v); v *= 2.0; amp *= 0.5; }
  return value;
}
vec2 mirror(vec2 uv){ return 1.0 - abs(1.0 - mod(uv, 2.0)); }
vec2 coverUV(vec2 uv, float imgAspect){
  float canvasAspect = u_resolution.x / u_resolution.y;
  vec2 scale = (canvasAspect > imgAspect) ? vec2(1.0, imgAspect/canvasAspect) : vec2(canvasAspect/imgAspect, 1.0);
  return mirror((uv - 0.5)*scale + 0.5);
}
void main(){
  float adjusted = u_progress*(1.0 + 2.0*u_edge) - u_edge;
  float noise = fbm(v_uv*u_scale + vec2(0.0, u_progress*u_direction))*0.5 + 0.5;
  noise = smoothstep(0.0, 2.0, length(texture2D(u_to, coverUV(v_uv, u_toAspect)).rgb) + noise);
  float mixFactor = 1.0 - smoothstep(adjusted - u_edge, adjusted + u_edge, noise);
  vec2 fromUV = coverUV(v_uv + vec2(0.0, noise*u_progress*u_drift*u_direction), u_fromAspect);
  vec2 toUV = coverUV(v_uv + vec2(0.0, noise*(1.0 - u_progress)*-0.5*u_drift*u_direction), u_toAspect);
  gl_FragColor = mix(texture2D(u_from, fromUV), texture2D(u_to, toUV), mixFactor);
}`;

  const ease = t => { const x = Math.min(Math.max(t, 0), 1); return x < 0.5 ? 16*x**5 : 1 - (-2*x + 2)**5/2; };
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bgCss = src => 'url("' + encodeURI(src) + '") center/cover #000';
  const loadImg = src => new Promise((res, rej) => {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => res(im); im.onerror = rej; im.src = src;
  });

  const shown = new WeakMap();   // element -> poster currently shown
  const runId = new WeakMap();   // element -> latest transition id

  function runGL(el, a, b, dur, finish) {
    const c = document.createElement("canvas");
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block;border-radius:inherit";
    el.prepend(c);
    try {
      const gl = c.getContext("webgl", { alpha: false, antialias: false });
      if (!gl) throw new Error("no webgl");
      const sh = (t, s) => {
        const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x);
        if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x));
        return x;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      gl.useProgram(p);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(p, "a_position");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const U = n => gl.getUniformLocation(p, "u_" + n);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      const tex = img => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return t;
      };
      const ta = tex(a), tb = tex(b);
      const aA = a.naturalWidth / a.naturalHeight, bA = b.naturalWidth / b.naturalHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const draw = pr => {
        const w = Math.max(1, Math.round(el.clientWidth * dpr));
        const h = Math.max(1, Math.round(el.clientHeight * dpr));
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        gl.viewport(0, 0, w, h);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ta); gl.uniform1i(U("from"), 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tb); gl.uniform1i(U("to"), 1);
        gl.uniform1f(U("progress"), ease(pr));
        gl.uniform2f(U("resolution"), w, h);
        gl.uniform1f(U("fromAspect"), aA);
        gl.uniform1f(U("toAspect"), bA);
        gl.uniform1f(U("scale"), 3.5);
        gl.uniform1f(U("direction"), 1);
        gl.uniform1f(U("edge"), 0.15);
        gl.uniform1f(U("drift"), 0.5);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };

      const t0 = performance.now();
      const step = now => {
        const pr = Math.min((now - t0) / dur, 1);
        draw(pr);
        if (pr < 1) requestAnimationFrame(step);
        else { gl.deleteTexture(ta); gl.deleteTexture(tb); gl.deleteBuffer(buf); gl.deleteProgram(p); finish(c); }
      };
      requestAnimationFrame(step);
    } catch (e) {
      finish(c);
    }
  }

  // Public: morph `el` to the poster at `toSrc`. `onDone` runs when the new
  // picture is fully in place (use it to start the video).
  window.morphTo = function (el, toSrc, opts) {
    const o = opts || {};
    const id = (runId.get(el) || 0) + 1;
    runId.set(el, id);
    const fromSrc = shown.get(el);
    shown.set(el, toSrc);

    const apply = () => {
      if (runId.get(el) !== id) return;      // a newer click has taken over
      el.style.background = bgCss(toSrc);
      if (o.onDone) o.onDone();
    };
    const finish = c => { if (c && c.parentNode) c.remove(); apply(); };

    if (!fromSrc || fromSrc === toSrc || reduced()) return apply();
    if (getComputedStyle(el).position === "static") el.style.position = "relative";

    Promise.all([loadImg(fromSrc), loadImg(toSrc)]).then(
      ([a, b]) => runGL(el, a, b, o.duration || 1200, finish),
      () => apply()
    );
  };
})();
