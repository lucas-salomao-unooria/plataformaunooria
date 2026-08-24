/**
 * Medição de dwell time (doc 04 §1): IntersectionObserver com threshold 0.6.
 * O cronômetro abre com ≥60% do card visível e fecha ao sair; revisitas somam.
 * Pausa quando a aba fica oculta. Sheets abertos sobre o feed NÃO pausam —
 * comentário aberto continua contando para o post.
 */
export interface RastreadorDeDwell {
  observar: (elemento: Element, postId: string) => void;
  esquecer: (elemento: Element) => void;
  /** Pausa/retoma por ordem externa (a casca esconde o aparelho). */
  pausar: () => void;
  retomar: () => void;
  liberar: () => void;
}

export function criarRastreadorDeDwell(
  aoSair: (postId: string, dwellMs: number, revisita: boolean) => void,
): RastreadorDeDwell {
  const idPorElemento = new WeakMap<Element, string>();
  const inicios = new Map<string, number>();
  const vezes = new Map<string, number>();
  /** Quem está com ≥60% na tela agora — permite RETOMAR após a aba voltar. */
  const visiveis = new Set<string>();

  const fechar = (postId: string) => {
    const inicio = inicios.get(postId);
    if (inicio === undefined) return;
    inicios.delete(postId);

    const dwellMs = Math.round(performance.now() - inicio);
    const contagem = (vezes.get(postId) ?? 0) + 1;
    vezes.set(postId, contagem);

    if (dwellMs >= 150) aoSair(postId, dwellMs, contagem > 1);
  };

  const abrir = (postId: string) => {
    if (inicios.has(postId)) return;
    inicios.set(postId, performance.now());
  };

  const observer = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        const postId = idPorElemento.get(entrada.target);
        if (!postId) continue;
        if (entrada.isIntersecting && entrada.intersectionRatio >= 0.6) {
          visiveis.add(postId);
          if (document.visibilityState !== 'hidden') abrir(postId);
        } else {
          visiveis.delete(postId);
          fechar(postId);
        }
      }
    },
    { threshold: [0, 0.6, 1] },
  );

  const pausar = () => {
    for (const postId of [...inicios.keys()]) fechar(postId);
  };

  const retomar = () => {
    // Retoma a medição do que está na tela. Sem isto, o post que o aluno estava
    // lendo deixava de ser medido até sair e voltar ao viewport.
    for (const postId of visiveis) abrir(postId);
  };

  const aoTrocarVisibilidade = () => {
    if (document.visibilityState === 'hidden') pausar();
    else retomar();
  };

  document.addEventListener('visibilitychange', aoTrocarVisibilidade);

  return {
    observar(elemento, postId) {
      idPorElemento.set(elemento, postId);
      observer.observe(elemento);
    },
    esquecer(elemento) {
      const postId = idPorElemento.get(elemento);
      if (postId) {
        fechar(postId);
        visiveis.delete(postId);
      }
      observer.unobserve(elemento);
    },
    pausar,
    retomar,
    liberar() {
      for (const postId of [...inicios.keys()]) fechar(postId);
      observer.disconnect();
      document.removeEventListener('visibilitychange', aoTrocarVisibilidade);
    },
  };
}
