import { type Desfecho } from "../catalogo";

/**
 * A rede que o Aha! da Etapa 4 desenha — calculada AQUI, no servidor.
 *
 * Duas razões, e a segunda é a que dita a forma:
 *
 * 1. **Segredo de servidor** (regra inviolável nº 3). A matriz de propagação é
 *    parte do gabarito: com ela no bundle, o estudante lê no DevTools que a
 *    opção B corta a corrente antes de escolher, e a decisão que a missão mede
 *    deixa de ser uma decisão.
 * 2. **Performance no aparelho da escola.** O PRD desenha 1.200 micro-nós, e
 *    1.200 elementos SVG numa thread de Chromebook de entrada engasgam. A
 *    resposta não é "desenhar menos e mentir no número": é o servidor mandar a
 *    rede já AGRUPADA em clusters, com o total real escrito por extenso ao
 *    lado. O estudante lê 1.200 e vê a mancha — sem 1.200 nós no DOM.
 */

/** Um nível da malha, do nó de origem até a borda. */
export interface AnelDaRede {
  /** 0 = a origem do boato; 3 = o nó do estudante. */
  nivel: number;
  /** Quantos nós este anel representa DE VERDADE. */
  nos: number;
  /** Quantos círculos desenhar. Igual a `nos` enquanto couber; menos depois. */
  desenhar: number;
  /** O anel está aceso (o boato chegou) ou apagado (a corrente parou antes)? */
  aceso: boolean;
}

export interface Topologia {
  desfecho: Desfecho;
  /** Alcance final, em pessoas. É o número que a tela escreve por extenso. */
  alcance: number;
  /** O anel do estudante — sempre o 3, é a leitura que a missão constrói. */
  nivelDoEstudante: number;
  /** O nó do estudante cortou a transmissão? Decide o anel duplo e o cadeado. */
  interrompeu: boolean;
  aneis: AnelDaRede[];
  /** A leitura do nó, em uma frase. */
  legenda: string;
}

/** Teto de círculos por anel. Acima disto o anel vira mancha agrupada. */
const TETO_POR_ANEL = 36;

/** O nó do estudante é sempre o terceiro salto — é a leitura que a copy usa. */
const NIVEL_DO_ESTUDANTE = 3;

/**
 * A malha até o nó do estudante. Idêntica nos três caminhos: o que o estudante
 * fez não muda o que aconteceu ANTES dele, e mostrar um começo diferente por
 * escolha seria a revelação mentindo (PROD-09).
 */
const ANTES_DO_ESTUDANTE: readonly number[] = [1, 4, 18];

/**
 * O que acontece DEPOIS do nó do estudante, por desfecho.
 *
 * `amplificou` e `silenciou` não são o mesmo número, e a diferença é o ponto da
 * missão: encaminhar acelera (1.200), calar deixa correr sem você (850). Se os
 * dois dessem no mesmo, a tela ensinaria que a inação é neutra — e o que a
 * missão descobre é justamente o contrário.
 */
const DEPOIS_DO_ESTUDANTE: Record<Desfecho, readonly number[]> = {
  interrompeu: [],
  amplificou: [96, 341, 739],
  silenciou: [71, 246, 509],
};

const LEGENDAS: Record<Desfecho, string> = {
  interrompeu: "Nó 3: Cadeia interrompida por checagem e denúncia",
  amplificou: "Nó 3: Repasse automático gerou 1.200 ramificações ativas",
  silenciou: "Nó 3: Sem resposta, a corrente seguiu por 850 conexões",
};

/**
 * Quantos círculos desenhar para representar `nos`.
 *
 * Acima do teto o anel é agrupado, e o cliente engrossa o traço na proporção.
 * O número REAL vai no `nos` — a tela nunca escreve o número de círculos.
 */
function desenhar(nos: number): number {
  return Math.min(nos, TETO_POR_ANEL);
}

export function topologiaDe(desfecho: Desfecho): Topologia {
  const depois = DEPOIS_DO_ESTUDANTE[desfecho];
  const interrompeu = desfecho === "interrompeu";

  const aneis: AnelDaRede[] = [
    ...ANTES_DO_ESTUDANTE.map((nos, i) => ({
      nivel: i,
      nos,
      desenhar: desenhar(nos),
      aceso: true,
    })),
    /* O nó do estudante. Aceso nos três caminhos: ele RECEBEU a mensagem em
       todos — o que muda é o que sai dele. */
    { nivel: NIVEL_DO_ESTUDANTE, nos: 1, desenhar: 1, aceso: true },
    ...depois.map((nos, i) => ({
      nivel: NIVEL_DO_ESTUDANTE + 1 + i,
      nos,
      desenhar: desenhar(nos),
      aceso: true,
    })),
  ];

  /* Na interrupção, os anéis que existiriam continuam na tela — APAGADOS. É a
     leitura inteira do Aha!: o estudante precisa ver o que NÃO aconteceu, e um
     grafo que simplesmente acaba no nó 3 não mostra o que foi evitado. */
  if (interrompeu) {
    for (const [i, nos] of DEPOIS_DO_ESTUDANTE.amplificou.entries()) {
      aneis.push({
        nivel: NIVEL_DO_ESTUDANTE + 1 + i,
        nos,
        desenhar: desenhar(nos),
        aceso: false,
      });
    }
  }

  const alcance = aneis
    .filter((a) => a.aceso)
    .reduce((soma, a) => soma + a.nos, 0);

  return {
    desfecho,
    alcance,
    nivelDoEstudante: NIVEL_DO_ESTUDANTE,
    interrompeu,
    aneis,
    legenda: LEGENDAS[desfecho],
  };
}

/**
 * As duas curvas do gráfico da Etapa 4: o boato e a nota oficial, minuto a
 * minuto. Não dependem da escolha — descrevem o que já tinha acontecido antes
 * de o estudante decidir, e é contra elas que ele lê a própria intervenção.
 */
export interface Curvas {
  minutos: number[];
  boato: number[];
  laudo: number[];
  /** Quantas vezes o boato correu mais que a nota, ao fim da janela. */
  razao: number;
}

export function curvas(): Curvas {
  const minutos = [0, 3, 6, 9, 12, 15];
  const boato = [4, 47, 180, 470, 830, 1200];
  const laudo = [0, 3, 9, 19, 31, 45];
  const ultimoBoato = boato[boato.length - 1] ?? 0;
  const ultimoLaudo = laudo[laudo.length - 1] ?? 1;
  return {
    minutos,
    boato,
    laudo,
    /* Para BAIXO, não para o mais próximo: a razão vai por extenso na tela
       ("26 vezes mais rápido"), e arredondar para cima exageraria a assimetria
       que a missão está justamente ensinando a ler com cuidado. */
    razao: Math.floor(ultimoBoato / Math.max(ultimoLaudo, 1)),
  };
}
