document.addEventListener("DOMContentLoaded", initMark);

function initMark() {
  var canvas = document.getElementById("mark");
  if (!canvas) return;

  var gl =
    canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false }) ||
    canvas.getContext("experimental-webgl", { alpha: true });

  if (!gl) {
    var img = document.createElement("img");
    img.src = "favicon.svg";
    img.alt = "";
    img.className = "mark";
    canvas.replaceWith(img);
    return;
  }

  var vert = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

  var frag = [
    "precision mediump float;",
    "uniform vec2 u_res;",
    "uniform float u_t;",
    "float bayer(vec2 p){",
    "vec2 q=floor(mod(p,4.0));int i=int(q.x+q.y*4.0);float t=5.0;",
    "if(i==0)t=0.0;else if(i==1)t=8.0;else if(i==2)t=2.0;else if(i==3)t=10.0;",
    "else if(i==4)t=12.0;else if(i==5)t=4.0;else if(i==6)t=14.0;else if(i==7)t=6.0;",
    "else if(i==8)t=3.0;else if(i==9)t=11.0;else if(i==10)t=1.0;else if(i==11)t=9.0;",
    "else if(i==12)t=15.0;else if(i==13)t=7.0;else if(i==14)t=13.0;",
    "return (t+0.5)/16.0;}",
    "vec3 rot(vec3 v,vec3 k,float a){float c=cos(a),s=sin(a);return v*c+cross(k,v)*s+k*dot(k,v)*(1.0-c);}",
    "void main(){",
    "vec2 uv=(gl_FragCoord.xy*2.0-u_res)/u_res.y;",
    "float r=length(uv);",
    "if(r>1.0){gl_FragColor=vec4(0.0);return;}",
    "float edge=smoothstep(1.0,0.96,r);",
    "float z=sqrt(max(0.0,1.0-r*r));",
    "vec3 n=vec3(uv,z);",
    "vec3 k=normalize(vec3(1.0,1.0,0.0));",
    "vec3 sp=rot(n,k,u_t*0.6);",
    "float g=0.5+0.5*sp.x;",
    "g=clamp(g,0.0,1.0);",
    "g=pow(g,2.2);",
    "float c=step(bayer(gl_FragCoord.xy),g);",
    "gl_FragColor=vec4(vec3(0.96),c*edge);",
    "}",
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "u_res");
  var uT = gl.getUniformLocation(prog, "u_t");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function size() {
    var s = canvas.clientWidth || 42;
    var px = Math.max(1, Math.round(s * dpr));
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(t) {
    size();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, t);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var running = false;

  function loop(ms) {
    render(ms * 0.001);
    if (!document.hidden) {
      requestAnimationFrame(loop);
    } else {
      running = false;
    }
  }

  if (reduce) {
    render(0);
    return;
  }

  running = true;
  requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !running) {
      running = true;
      requestAnimationFrame(loop);
    }
  });
}
