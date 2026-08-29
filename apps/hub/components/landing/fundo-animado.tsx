"use client";

import { useEffect, useRef } from "react";

/**
 * Fundo animado da landing: o shader do modelo do Stitch (ondas em navy, azul
 * e lilás, com um brilho suave que segue o ponteiro), portado do `<script>`
 * inline para um componente com ciclo de vida — cancela o `requestAnimationFrame`
 * ao desmontar, para na aba oculta e desenha um quadro só com movimento reduzido.
 *
 * O cleanup NÃO chama `WEBGL_lose_context.loseContext()`: o Strict Mode do React
 * (dev) monta, desmonta e remonta o efeito no MESMO canvas, e um canvas só tem
 * um contexto — perdido de propósito na primeira desmontagem, ele volta perdido
 * na segunda montagem e o fundo fica em branco. O canvas sai do DOM com o
 * componente, e o navegador recolhe o contexto sozinho.
 *
 * Fica ATRÁS do conteúdo (`.landing__fundo`, opacidade 0,3): é textura. Sem
 * WebGL, o canvas fica vazio e o gradiente institucional do DS declarado no CSS
 * ocupa o lugar. Com `prefers-reduced-motion`, desenha UM quadro e para.
 */

const VERTEX = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;
  vec2 mouse = u_mouse / u_resolution;

  float speed = 0.2;
  vec3 color1 = vec3(0.02, 0.05, 0.2);
  vec3 color2 = vec3(0.5, 0.6, 0.9);
  vec3 color3 = vec3(0.4, 0.3, 0.6);

  float noise = sin(uv.x * 10.0 + u_time * speed) * cos(uv.y * 8.0 - u_time * speed * 0.5);
  noise += sin(uv.y * 12.0 + u_time * speed * 0.7) * cos(uv.x * 6.0 + u_time * speed * 0.3);

  float distToMouse = distance(uv, mouse);
  float glow = smoothstep(0.4, 0.0, distToMouse) * 0.15;

  vec3 color = mix(color1, color2, noise * 0.5 + 0.5);
  color = mix(color, color3, sin(u_time * 0.1) * 0.5 + 0.5);
  color += glow;

  gl_FragColor = vec4(color, 1.0);
}`;

function compilar(gl: WebGLRenderingContext, tipo: number, fonte: string): WebGLShader | null {
  const shader = gl.createShader(tipo);
  if (!shader) return null;
  gl.shaderSource(shader, fonte);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function FundoAnimado() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!(gl instanceof WebGLRenderingContext)) return;

    const vs = compilar(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const programa = gl.createProgram();
    if (!vs || !fs || !programa) return;
    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) return;
    gl.useProgram(programa);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const posicao = gl.getAttribLocation(programa, "a_position");
    gl.enableVertexAttribArray(posicao);
    gl.vertexAttribPointer(posicao, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(programa, "u_time");
    const uRes = gl.getUniformLocation(programa, "u_resolution");
    const uMouse = gl.getUniformLocation(programa, "u_mouse");

    // Sincroniza o buffer de desenho com o tamanho de layout do canvas.
    const ajustar = () => {
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(canvas);

    // u_mouse em pixels, mesma convenção do ShaderToy (origem embaixo à esquerda).
    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    const aoMover = (evento: MouseEvent) => {
      const caixa = canvas.getBoundingClientRect();
      if (!caixa.width || !caixa.height) return;
      mouse.x = ((evento.clientX - caixa.left) / caixa.width) * canvas.width;
      mouse.y = (1 - (evento.clientY - caixa.top) / caixa.height) * canvas.height;
    };
    window.addEventListener("mousemove", aoMover, { passive: true });

    const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    let quadro = 0;

    const desenhar = (t: number) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // Movimento reduzido: um quadro basta. Aba oculta: para até voltar.
      if (!reduzirMovimento.matches && document.visibilityState === "visible") {
        quadro = requestAnimationFrame(desenhar);
      }
    };
    const aoMudarVisibilidade = () => {
      cancelAnimationFrame(quadro);
      if (document.visibilityState === "visible") quadro = requestAnimationFrame(desenhar);
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    quadro = requestAnimationFrame(desenhar);

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("mousemove", aoMover);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  return (
    <div className="landing__fundo" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
