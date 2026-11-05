(() => {
  const wrap = document.querySelector('.avatar-wrap');
  if (!wrap) return;

  const SIZE = 160;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.round(SIZE * dpr);
  const scale = px / SIZE;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const WGSL = `
struct U { a: vec4f, b: vec4f }
@group(0) @binding(0) var<uniform> u: U;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

fn hash(q: vec3f) -> f32 {
  let p = fract(q * 0.3183099 + 0.1) * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

fn noise(x: vec3f) -> f32 {
  let i = floor(x);
  let g = fract(x);
  let f = g * g * (3.0 - 2.0 * g);
  return mix(
    mix(mix(hash(i), hash(i + vec3f(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3f(0.0, 1.0, 0.0)), hash(i + vec3f(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3f(0.0, 0.0, 1.0)), hash(i + vec3f(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3f(0.0, 1.0, 1.0)), hash(i + vec3f(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

fn fbm(q: vec3f) -> f32 {
  var p = q;
  var v = 0.0;
  var a = 0.5;
  for (var i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec3f(3.1, 7.7, 1.3);
    a *= 0.5;
  }
  return v;
}

fn fbm3(q: vec3f) -> f32 {
  var p = q;
  var v = 0.0;
  var a = 0.5;
  for (var i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec3f(3.1, 7.7, 1.3);
    a *= 0.5;
  }
  return v / 0.875;
}

fn bolt(q: vec2f, len: f32, seed: f32) -> f32 {
  let x = q.x - 28.0;
  if (x < -3.0 || x > len + 4.0) { return 0.0; }
  let y = (fbm(vec3f(x * 0.11, seed, 0.5)) - 0.5) * 20.0 * smoothstep(0.0, 8.0, x);
  let d = abs(q.y - y);
  let tip = 1.0 - smoothstep(len * 0.55, len, x);
  let base = smoothstep(-3.0, 1.0, x);
  return ((1.0 - smoothstep(0.0, 0.8, d)) * 1.6 + 0.35 / (1.0 + d * d * 0.07)) * tip * base;
}

fn strike(p: vec2f, theta: f32, len: f32, seed: f32) -> f32 {
  let c = cos(theta);
  let s = sin(theta);
  let q = vec2f(c * p.x + s * p.y, c * p.y - s * p.x);
  if (q.x < 20.0 || abs(q.y) > len + 10.0) { return 0.0; }
  var v = bolt(q, len, seed);
  let xb = len * (0.3 + 0.2 * hash(vec3f(seed, 1.0, 2.0)));
  let yb = (fbm(vec3f(xb * 0.11, seed, 0.5)) - 0.5) * 20.0 * smoothstep(0.0, 8.0, xb);
  let side = select(-1.0, 1.0, hash(vec3f(seed, 3.0, 4.0)) > 0.5);
  let ang = side * (0.5 + 0.4 * hash(vec3f(seed, 5.0, 6.0)));
  let ca = cos(ang);
  let sa = sin(ang);
  let o = q - vec2f(28.0 + xb, yb);
  let fq = vec2f(ca * o.x + sa * o.y, ca * o.y - sa * o.x) + vec2f(28.0, 0.0);
  v += 0.7 * bolt(fq, (len - xb) * 0.7, seed + 17.0);
  return v;
}

fn strikes(p: vec2f, t: f32) -> f32 {
  var v = 0.0;
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    let period = 1.9 + fi * 0.67;
    let tt = t + fi * 0.83;
    let cyc = floor(tt / period);
    let life = tt - cyc * period;
    if (life < 0.3) {
      let theta = 0.7 + hash(vec3f(cyc, fi, 11.0)) * 4.8832;
      let len = 12.0 + 12.0 * hash(vec3f(cyc, fi, 12.0));
      let fl = 0.55 + 0.45 * step(0.35, hash(vec3f(floor(tt * 30.0), fi, 13.0)));
      v += strike(p, theta, len, cyc * 7.0 + fi * 31.0) * (1.0 - life / 0.3) * fl;
    }
  }
  return v;
}

fn burst(p: vec2f, age: f32, seed: f32, count: i32, t: f32) -> f32 {
  if (age < 0.0 || age > 0.6) { return 0.0; }
  var v = 0.0;
  let grow = 0.6 + 0.4 * smoothstep(0.0, 0.08, age);
  for (var i = 0; i < count; i++) {
    let fi = f32(i);
    let theta = 0.7 + (fi + 0.5 * hash(vec3f(seed, fi, 22.0))) / f32(count) * 4.8832;
    let len = (16.0 + 12.0 * hash(vec3f(seed, fi, 23.0))) * grow;
    v += strike(p, theta, len, seed * 13.0 + fi * 5.0);
  }
  let fl = 0.6 + 0.4 * step(0.3, hash(vec3f(floor(t * 32.0), seed, 21.0)));
  return v * (1.0 - age / 0.6) * fl;
}

@fragment
fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let res = u.a.xy;
  let t = u.a.z;
  let sc = u.a.w;
  let p = (fc.xy - 0.5 * res) / sc;
  let r = length(p);
  let dir = p / max(r, 0.0001);
  let edge = 0.5 * res.x / sc;

  let pulseAge = fract(t * 0.23) / 0.23;
  let pulseSeed = floor(t * 0.23) + 50.0;
  let userAge = u.b.x;
  let energy = max(exp(-pulseAge * 1.4), select(0.0, exp(-userAge * 1.5), userAge >= 0.0));
  let flicker = 0.82 + 0.18 * noise(vec3f(t * 9.0, 0.0, 0.0));

  var col = vec3f(0.0);
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    let n = fbm(vec3f(dir * (2.0 + fi * 0.8) + fi * 5.3, t * (1.4 + fi * 0.45)));
    let rr = 30.0 + (n - 0.5) * (8.0 + 10.0 * energy);
    let d = abs(r - rr);
    let gate = noise(vec3f(dir * 1.4 + fi * 3.7, t * 1.1 + fi * 7.0));
    let seg = smoothstep(0.45 - 0.3 * energy, 0.6 - 0.3 * energy, gate);
    let core = 1.0 - smoothstep(0.0, 0.9, d);
    let glow = 0.3 / (1.0 + d * d * 0.1);
    col += seg * (vec3f(0.94, 0.95, 1.0) * core * 1.3 + vec3f(0.67, 0.62, 0.95) * glow);
  }

  let warp = fbm3(vec3f(dir * 1.7, t * 0.5));
  let plasma = fbm3(vec3f(dir * 3.2 + warp * 1.6, t * 0.8 - r * 0.04));
  let kb = (r - 33.0) / 8.0;
  col += mix(vec3f(0.36, 0.26, 0.95), vec3f(0.8, 0.38, 1.0), plasma) * exp(-kb * kb) * plasma * plasma * (0.5 + 0.9 * energy);

  let sv = strikes(p, t) + burst(p, pulseAge, pulseSeed, 3, t) + burst(p, userAge, u.b.y, 6, t);
  col += sv * mix(vec3f(0.6, 0.52, 1.0), vec3f(1.0), clamp(sv - 0.6, 0.0, 1.0));

  col *= flicker * smoothstep(23.0, 27.5, r) * (1.0 - smoothstep(edge - 14.0, edge, r));
  col += vec3f(0.6, 0.5, 1.0) * select(0.0, exp(-(28.0 - r) / 2.5), r < 28.0) * (0.12 + 0.45 * energy);

  col = 1.0 - exp(-col * 1.5);
  let alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), alpha);
}
`;

  const GLSL_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

  const GLSL_FS = `#version 300 es
precision highp float;
uniform vec4 uA;
uniform vec4 uB;
out vec4 outColor;

float hash(vec3 q) {
  vec3 p = fract(q * 0.3183099 + 0.1) * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 g = fract(x);
  vec3 f = g * g * (3.0 - 2.0 * g);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float fbm(vec3 q) {
  vec3 p = q;
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec3(3.1, 7.7, 1.3);
    a *= 0.5;
  }
  return v;
}

float fbm3(vec3 q) {
  vec3 p = q;
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec3(3.1, 7.7, 1.3);
    a *= 0.5;
  }
  return v / 0.875;
}

float bolt(vec2 q, float len, float seed) {
  float x = q.x - 28.0;
  if (x < -3.0 || x > len + 4.0) return 0.0;
  float y = (fbm(vec3(x * 0.11, seed, 0.5)) - 0.5) * 20.0 * smoothstep(0.0, 8.0, x);
  float d = abs(q.y - y);
  float tip = 1.0 - smoothstep(len * 0.55, len, x);
  float base = smoothstep(-3.0, 1.0, x);
  return ((1.0 - smoothstep(0.0, 0.8, d)) * 1.6 + 0.35 / (1.0 + d * d * 0.07)) * tip * base;
}

float strike(vec2 p, float theta, float len, float seed) {
  float c = cos(theta);
  float s = sin(theta);
  vec2 q = vec2(c * p.x + s * p.y, c * p.y - s * p.x);
  if (q.x < 20.0 || abs(q.y) > len + 10.0) return 0.0;
  float v = bolt(q, len, seed);
  float xb = len * (0.3 + 0.2 * hash(vec3(seed, 1.0, 2.0)));
  float yb = (fbm(vec3(xb * 0.11, seed, 0.5)) - 0.5) * 20.0 * smoothstep(0.0, 8.0, xb);
  float side = hash(vec3(seed, 3.0, 4.0)) > 0.5 ? 1.0 : -1.0;
  float ang = side * (0.5 + 0.4 * hash(vec3(seed, 5.0, 6.0)));
  float ca = cos(ang);
  float sa = sin(ang);
  vec2 o = q - vec2(28.0 + xb, yb);
  vec2 fq = vec2(ca * o.x + sa * o.y, ca * o.y - sa * o.x) + vec2(28.0, 0.0);
  v += 0.7 * bolt(fq, (len - xb) * 0.7, seed + 17.0);
  return v;
}

float strikes(vec2 p, float t) {
  float v = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float period = 1.9 + fi * 0.67;
    float tt = t + fi * 0.83;
    float cyc = floor(tt / period);
    float life = tt - cyc * period;
    if (life < 0.3) {
      float theta = 0.7 + hash(vec3(cyc, fi, 11.0)) * 4.8832;
      float len = 12.0 + 12.0 * hash(vec3(cyc, fi, 12.0));
      float fl = 0.55 + 0.45 * step(0.35, hash(vec3(floor(tt * 30.0), fi, 13.0)));
      v += strike(p, theta, len, cyc * 7.0 + fi * 31.0) * (1.0 - life / 0.3) * fl;
    }
  }
  return v;
}

float burst(vec2 p, float age, float seed, int count, float t) {
  if (age < 0.0 || age > 0.6) return 0.0;
  float v = 0.0;
  float grow = 0.6 + 0.4 * smoothstep(0.0, 0.08, age);
  for (int i = 0; i < count; i++) {
    float fi = float(i);
    float theta = 0.7 + (fi + 0.5 * hash(vec3(seed, fi, 22.0))) / float(count) * 4.8832;
    float len = (16.0 + 12.0 * hash(vec3(seed, fi, 23.0))) * grow;
    v += strike(p, theta, len, seed * 13.0 + fi * 5.0);
  }
  float fl = 0.6 + 0.4 * step(0.3, hash(vec3(floor(t * 32.0), seed, 21.0)));
  return v * (1.0 - age / 0.6) * fl;
}

void main() {
  vec2 res = uA.xy;
  float t = uA.z;
  float sc = uA.w;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / sc;
  float r = length(p);
  vec2 dir = p / max(r, 0.0001);
  float edge = 0.5 * res.x / sc;

  float pulseAge = fract(t * 0.23) / 0.23;
  float pulseSeed = floor(t * 0.23) + 50.0;
  float userAge = uB.x;
  float energy = max(exp(-pulseAge * 1.4), userAge >= 0.0 ? exp(-userAge * 1.5) : 0.0);
  float flicker = 0.82 + 0.18 * noise(vec3(t * 9.0, 0.0, 0.0));

  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float n = fbm(vec3(dir * (2.0 + fi * 0.8) + fi * 5.3, t * (1.4 + fi * 0.45)));
    float rr = 30.0 + (n - 0.5) * (8.0 + 10.0 * energy);
    float d = abs(r - rr);
    float gate = noise(vec3(dir * 1.4 + fi * 3.7, t * 1.1 + fi * 7.0));
    float seg = smoothstep(0.45 - 0.3 * energy, 0.6 - 0.3 * energy, gate);
    float core = 1.0 - smoothstep(0.0, 0.9, d);
    float glow = 0.3 / (1.0 + d * d * 0.1);
    col += seg * (vec3(0.94, 0.95, 1.0) * core * 1.3 + vec3(0.67, 0.62, 0.95) * glow);
  }

  float warp = fbm3(vec3(dir * 1.7, t * 0.5));
  float plasma = fbm3(vec3(dir * 3.2 + warp * 1.6, t * 0.8 - r * 0.04));
  float kb = (r - 33.0) / 8.0;
  col += mix(vec3(0.36, 0.26, 0.95), vec3(0.8, 0.38, 1.0), plasma) * exp(-kb * kb) * plasma * plasma * (0.5 + 0.9 * energy);

  float sv = strikes(p, t) + burst(p, pulseAge, pulseSeed, 3, t) + burst(p, userAge, uB.y, 6, t);
  col += sv * mix(vec3(0.6, 0.52, 1.0), vec3(1.0), clamp(sv - 0.6, 0.0, 1.0));

  col *= flicker * smoothstep(23.0, 27.5, r) * (1.0 - smoothstep(edge - 14.0, edge, r));
  col += vec3(0.6, 0.5, 1.0) * (r < 28.0 ? exp(-(28.0 - r) / 2.5) : 0.0) * (0.12 + 0.45 * energy);

  col = 1.0 - exp(-col * 1.5);
  float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  outColor = vec4(clamp(col, 0.0, 1.0), alpha);
}
`;

  function makeCanvas() {
    const canvas = document.createElement('canvas');
    canvas.className = 'avatar-fx';
    canvas.width = px;
    canvas.height = px;
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
  }

  async function webgpu(canvas) {
    if (!navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) return null;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const module = device.createShaderModule({ code: WGSL });
    const pipeline = await device.createRenderPipelineAsync({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    const buffer = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    });
    return {
      name: 'webgpu',
      lost: device.lost,
      draw(data) {
        device.queue.writeBuffer(buffer, 0, data);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          }],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
      },
    };
  }

  function webgl(canvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    if (!gl) return null;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, GLSL_VS));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, GLSL_FS));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    gl.bindVertexArray(gl.createVertexArray());
    gl.clearColor(0, 0, 0, 0);
    const uA = gl.getUniformLocation(program, 'uA');
    const uB = gl.getUniformLocation(program, 'uB');
    return {
      name: 'webgl2',
      draw(data) {
        gl.viewport(0, 0, data[0], data[1]);
        gl.uniform4f(uA, data[0], data[1], data[2], data[3]);
        gl.uniform4f(uB, data[4], data[5], data[6], data[7]);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  function run(canvas, renderer) {
    wrap.append(canvas);
    wrap.dataset.fx = renderer.name;
    const start = performance.now();
    const data = new Float32Array(8);
    let burstAt = start + 250;
    let burstSeed = 100 + Math.floor(Math.random() * 900);
    let raf = 0;
    let visible = true;
    let stopped = false;

    const frame = (now) => {
      raf = 0;
      if (stopped) return;
      const still = motion.matches;
      data[0] = px;
      data[1] = px;
      data[2] = still ? 1.6 : (now - start) / 1000;
      data[3] = scale;
      data[4] = still ? 99 : (now - burstAt) / 1000;
      data[5] = burstSeed;
      renderer.draw(data);
      canvas.classList.add('is-ready');
      if (visible && !still) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && !stopped) raf = requestAnimationFrame(frame);
    };
    const trigger = () => {
      if (motion.matches) return;
      burstAt = performance.now();
      burstSeed = 100 + Math.floor(Math.random() * 900);
      kick();
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) kick();
    });
    observer.observe(wrap);
    motion.addEventListener('change', kick);
    wrap.addEventListener('pointerenter', trigger);
    wrap.addEventListener('pointerdown', trigger);
    kick();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      motion.removeEventListener('change', kick);
      wrap.removeEventListener('pointerenter', trigger);
      wrap.removeEventListener('pointerdown', trigger);
      canvas.remove();
    };
  }

  function fallback() {
    const canvas = makeCanvas();
    const renderer = webgl(canvas);
    if (renderer) run(canvas, renderer);
  }

  async function init() {
    const canvas = makeCanvas();
    let renderer = null;
    try {
      renderer = await webgpu(canvas);
    } catch {
      renderer = null;
    }
    if (!renderer) {
      fallback();
      return;
    }
    const stop = run(canvas, renderer);
    renderer.lost.then(() => {
      stop();
      fallback();
    });
  }

  init();
})();
