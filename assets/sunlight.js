(() => {
  const layer = document.querySelector('.sunlight');
  const canvas = layer?.querySelector('canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return; // The CSS light pattern remains available without WebGL.

  const vertex = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;
  const fragment = `
    precision mediump float;
    uniform vec2 resolution;
    uniform float time;
    void main() {
      vec2 uv = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y) / resolution;
      vec2 p = uv * vec2(resolution.x / resolution.y, 1.0);

      // A distant window casts parallel slat shadows onto a matte wall.
      float drift = sin(time * 0.035) * 0.009;
      float slope = 0.42 + sin(time * 0.022) * 0.006;
      float spacing = 0.135;
      float slat = abs(fract((p.y + p.x * slope + drift) / spacing) - 0.5) * spacing;
      float softness = mix(0.009, 0.022, uv.y);
      float shade = 1.0 - smoothstep(0.022 - softness, 0.022 + softness, slat);

      vec2 distanceToWindow = (uv - vec2(0.96, 0.04)) * vec2(1.05, 0.88);
      float windowLight = exp(-dot(distanceToWindow, distanceToWindow) * 1.8);
      float falloff = 1.0 - smoothstep(0.35, 1.45, uv.y + (1.0 - uv.x) * 0.3);
      float sunlight = windowLight * falloff;

      vec3 wall = vec3(0.992, 0.986, 0.971);
      wall = mix(wall, vec3(1.0, 0.953, 0.847), sunlight * 0.22);
      wall = mix(wall, vec3(0.59, 0.56, 0.50), shade * sunlight * 0.14);
      gl_FragColor = vec4(wall, 1.0);
    }
  `;

  let frame = 0;
  let program;
  let buffer;
  let resolution;
  let time;
  let lastFrame = -Infinity;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function resize() {
    // Soft light needs no high-resolution buffer, even on a Retina display.
    const scale = Math.min(1, 1200 / Math.max(innerWidth, innerHeight));
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (program) draw(performance.now());
  }

  function draw(timestamp) {
    if (!program || gl.isContextLost()) return;
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(time, motion.matches ? 0 : timestamp / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(timestamp) {
    if (timestamp - lastFrame >= 1000 / 24) {
      draw(timestamp);
      lastFrame = timestamp;
    }
    frame = requestAnimationFrame(tick);
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    if (!program || document.hidden || gl.isContextLost()) return;
    draw(performance.now());
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }

  function setup() {
    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return;
    }
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      program = null;
      return;
    }
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    resolution = gl.getUniformLocation(program, 'resolution');
    time = gl.getUniformLocation(program, 'time');
    resize();
    layer.classList.add('is-rendered');
    updateMotion();
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    program = null;
    layer.classList.remove('is-rendered');
  });
  canvas.addEventListener('webglcontextrestored', setup);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', updateMotion);
  motion.addEventListener('change', updateMotion);
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
  window.addEventListener('pageshow', updateMotion);
  setup();
})();
