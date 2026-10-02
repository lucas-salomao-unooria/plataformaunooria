import { FRACAO_VISIVEL, PERMANENCIA_MS } from "./regras";

/**
 * A PERMANÊNCIA num post — o "ficou mais de 5 s" que vale 1 ponto para a área
 * no motor do feed (`vocabulario.ts#PESO_DA_PERMANENCIA`). A ideia é a de
 * `exp08ef1b/src/lib/dwell.ts`: `IntersectionObserver` com o limiar de 60%,
 * o relógio abre com o post na tela e fecha quando ele sai.
 *
 * A diferença é o que se mede. Lá é o TEMPO (somado nas revisitas); aqui é um
 * FATO, uma vez por post: passou de 5 s seguidos com ≥ 60% visível, avisa, e
 * aquele post não avisa mais. Quem soma o peso é o servidor — a tela só conta o
 * que o servidor não tem como saber, e não sabe o que o peso faz.
 *
 * A aba oculta pausa: o post que ficou na tela enquanto a criança trocou de
 * janela não foi lido.
 */
export interface RastreadorDePermanencia {
  observar: (elemento: Element, postId: string) => void;
  esquecer: (elemento: Element) => void;
  liberar: () => void;
}

export function criarRastreadorDePermanencia(
  aoPermanecer: (postId: string) => void,
  jaContados: Iterable<string> = [],
): RastreadorDePermanencia {
  const idPorElemento = new WeakMap<Element, string>();
  const relogios = new Map<string, number>();
  const visiveis = new Set<string>();
  const contados = new Set(jaContados);

  const parar = (postId: string) => {
    const relogio = relogios.get(postId);
    if (relogio !== undefined) window.clearTimeout(relogio);
    relogios.delete(postId);
  };

  const comecar = (postId: string) => {
    if (contados.has(postId) || relogios.has(postId)) return;
    relogios.set(
      postId,
      window.setTimeout(() => {
        relogios.delete(postId);
        if (!visiveis.has(postId) || contados.has(postId)) return;
        contados.add(postId);
        aoPermanecer(postId);
      }, PERMANENCIA_MS + 1),
    );
  };

  const observer = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        const postId = idPorElemento.get(entrada.target);
        if (!postId) continue;
        if (entrada.isIntersecting && entrada.intersectionRatio >= FRACAO_VISIVEL) {
          visiveis.add(postId);
          if (document.visibilityState !== "hidden") comecar(postId);
        } else {
          visiveis.delete(postId);
          parar(postId);
        }
      }
    },
    { threshold: [0, FRACAO_VISIVEL, 1] },
  );

  const aoTrocarVisibilidade = () => {
    if (document.visibilityState === "hidden") {
      for (const postId of [...relogios.keys()]) parar(postId);
    } else {
      for (const postId of visiveis) comecar(postId);
    }
  };
  document.addEventListener("visibilitychange", aoTrocarVisibilidade);

  return {
    observar(elemento, postId) {
      idPorElemento.set(elemento, postId);
      observer.observe(elemento);
    },
    esquecer(elemento) {
      const postId = idPorElemento.get(elemento);
      if (postId) {
        visiveis.delete(postId);
        parar(postId);
      }
      observer.unobserve(elemento);
    },
    liberar() {
      for (const postId of [...relogios.keys()]) parar(postId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
    },
  };
}
