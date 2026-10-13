import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

import { VISEMAS } from "./lipsync";

/**
 * A CENA DO MASCOTE (ADR-158) — portada do PoC `poc-mascote-visemas`.
 *
 * Carrega o mascote (GLB com os 15 visemas como morph targets), aplica os pesos
 * da boca e dá um pouco de vida (respiração, balanço, aceno na fala).
 *
 * O que mudou do PoC, e por quê:
 * - **Sem `OrbitControls`**: no PoC a câmera girava para conferir a boca; na
 *   Ajuda o mascote é o rosto de quem atende, e girar seria um controle sem
 *   função (e roubaria o arraste do celular).
 * - **Enquadramento fixo do corpo inteiro**, com a boca no terço de baixo.
 * - **O GLB vem comprimido com meshopt** (12,7 MB → 3,4 MB, texturas em 1024):
 *   o decodificador é o do próprio pacote `three`, sem CDN — rede de escola
 *   filtra domínio.
 * - **`descartar()`**: a janela abre e fecha várias vezes por sessão; sem
 *   liberar geometria, texturas e o contexto WebGL, cada abertura vazaria GPU.
 * - A luz de recorte usa o roxo da marca: o canvas é transparente, e o fundo
 *   (o degradê da janela) vem dos tokens do DS no CSS de quem monta a cena.
 */
export class CenaDoMascote {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly cena = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
  private readonly pivo = new THREE.Group();
  private malha: THREE.Mesh | null = null;
  private indices: number[] = [];
  private tempo = 0;
  private aceno = 0;
  private altura = 2;
  private readonly observador: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement) {
    // canvas transparente: o fundo é o da janela
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    // 1,5 e não 2: num Chromebook a GPU é o gargalo, e a diferença não se vê na janela pequena
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.NeutralToneMapping;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const chave = new THREE.DirectionalLight(0xffffff, 1.6);
    chave.position.set(1.5, 3, 4);
    const recorte = new THREE.DirectionalLight(0xb8a6f5, 1.4);
    recorte.position.set(-3, 2.5, -3);
    this.cena.add(chave, recorte, this.pivo);

    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(canvas);
    this.redimensionar();
  }

  /** Carrega o GLB e devolve os visemas que faltam nele (lista vazia = tudo certo). */
  async carregar(url: string, aoProgresso?: (fracao: number) => void): Promise<string[]> {
    const carregador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await carregador.loadAsync(url, (e) => {
      if (e.total) aoProgresso?.(e.loaded / e.total);
    });
    const raiz = gltf.scene;
    raiz.traverse((o) => {
      if (!this.malha && o instanceof THREE.Mesh && o.morphTargetDictionary) this.malha = o;
    });
    if (!this.malha) throw new Error("o modelo não tem morph targets (shape keys)");
    const caixa = new THREE.Box3().setFromObject(raiz);
    const centro = caixa.getCenter(new THREE.Vector3());
    raiz.position.sub(new THREE.Vector3(centro.x, caixa.min.y, centro.z)); // pés no chão, no eixo
    this.pivo.add(raiz);
    this.pivo.updateMatrixWorld(true);
    this.altura = caixa.max.y - caixa.min.y;
    const dicionario = this.malha.morphTargetDictionary ?? {};
    this.indices = VISEMAS.map((nome) => dicionario[nome] ?? -1);
    this.enquadrar();
    return VISEMAS.filter((_, i) => this.indices[i]! < 0);
  }

  /**
   * O mascote inteiro, com folga — o enquadramento "corpo" do PoC. Ele é quase
   * só cabeça: cortar nos ombros, como numa chamada de vídeo, deixava a BOCA
   * fora do quadro (visto na janela em 2026-10-12).
   */
  private enquadrar(): void {
    const h = this.altura;
    const distancia = (h * 0.6) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.set(0, h * 0.56, distancia);
    this.camera.lookAt(new THREE.Vector3(0, h * 0.5, 0));
  }

  /** Pesos na ordem de `VISEMAS`. */
  definirPesos(pesos: ArrayLike<number>): void {
    const influencias = this.malha?.morphTargetInfluences;
    if (!influencias) return;
    for (let i = 0; i < this.indices.length; i++) {
      const indice = this.indices[i]!;
      if (indice >= 0) influencias[indice] = pesos[i] ?? 0;
    }
  }

  /** `energia` (0 a 1) é o nível da fala: vira um aceno leve para a frente. */
  quadro(dt: number, energia: number): void {
    this.tempo += dt;
    this.aceno += (energia - this.aceno) * (1 - Math.exp(-dt / 0.15));
    const t = this.tempo;
    this.pivo.position.y = 0.006 * Math.sin(t * 1.6);
    this.pivo.rotation.z = 0.02 * Math.sin(t * 0.55);
    this.pivo.rotation.y = 0.05 * Math.sin(t * 0.31);
    this.pivo.rotation.x = 0.025 * this.aceno;
    this.renderer.render(this.cena, this.camera);
  }

  private redimensionar(): void {
    const largura = this.canvas.clientWidth;
    const altura = this.canvas.clientHeight;
    if (!largura || !altura) return;
    this.renderer.setSize(largura, altura, false);
    this.camera.aspect = largura / altura;
    this.camera.updateProjectionMatrix();
  }

  /** Libera GPU e o contexto: a janela da Ajuda abre e fecha muitas vezes. */
  descartar(): void {
    this.observador.disconnect();
    this.cena.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      const materiais: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materiais) {
        for (const valor of Object.values(m)) if (valor instanceof THREE.Texture) valor.dispose();
        m.dispose();
      }
    });
    this.cena.environment?.dispose();
    this.renderer.dispose();
  }
}
