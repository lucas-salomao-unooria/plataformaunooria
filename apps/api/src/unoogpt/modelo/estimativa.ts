import { CONJUNTO_POR_SLUG } from './conjuntos';
import { PARAMETROS } from './parametros';
import { aleatorio, ruido } from './aleatorio';

/**
 * O que o modelo ENXERGA — nunca o que é (ADR-0006). PURO.
 *
 * A verdade do mundo (parametros.ts) entra aqui e sai deformada por três
 * coisas, nesta ordem:
 *
 * 1. COBERTURA: sem conjunto que cubra o bairro, não há estimativa nenhuma.
 *    Bairro em branco no mapa é o modelo dizendo "eu não sei", e isso é dado.
 * 2. VIÉS: cada conjunto empurra a estimativa para um lado, e nunca confessa.
 * 3. INCERTEZA: a faixa min–max encolhe com cobertura. Ponto único é a mentira
 *    que a Missão existe para desmontar, então nada aqui devolve número seco.
 */
export interface Faixa {
  min: number;
  esperado: number;
  max: number;
}

export interface EstimativaDoBairro {
  bairro: string;
  cobertura: number;
  chanceDeEventoSevero: Faixa;
  pessoasEmRisco: Faixa;
  confianca: 'alta' | 'média' | 'baixa';
  sustentadaPor: string[];
}

function confiancaDe(cobertura: number): EstimativaDoBairro['confianca'] {
  // "Alta" é rara de propósito: exige quase o teto. O aluno tem que conviver
  // com confiança média na maior parte da cidade.
  if (cobertura >= 0.7) return 'alta';
  if (cobertura >= 0.35) return 'média';
  return 'baixa';
}

/**
 * Cobertura combinada: conjuntos se somam com retorno decrescente e TETO.
 *
 * O teto existe porque nenhuma combinação pode fazer o modelo "saber" um
 * bairro. Sem ele, três conjuntos generosos chegavam a 98% da cidade e a
 * Missão perdia o ponto: com dado suficiente, existiria resposta certa.
 */
const TETO_DE_COBERTURA = 0.78;

function combinar(valores: number[]): number {
  const soma = valores.reduce((restante, v) => restante + (1 - restante) * v, 0);
  return Math.min(TETO_DE_COBERTURA, soma);
}

export function estimar(conjuntos: readonly string[], semente: number): EstimativaDoBairro[] {
  const ativos = conjuntos.map((s) => CONJUNTO_POR_SLUG.get(s)).filter((c) => c !== undefined);
  const sorteio = aleatorio(semente);

  return PARAMETROS.map((p) => {
    const cobrindo = ativos.filter((c) => (c.cobertura[p.slug] ?? 0) > 0);
    // O `?? 0` não muda a conta: `cobrindo` acabou de ser filtrado por
    // cobertura > 0. Ele existe porque a api roda com índice checado.
    const cobertura = combinar(cobrindo.map((c) => c.cobertura[p.slug] ?? 0));

    // Sem cobertura o modelo não estima: devolve zeros e confiança baixa. É o
    // ponto cego, e ele precisa aparecer como ausência, não como número ruim.
    if (cobertura === 0) {
      return {
        bairro: p.slug,
        cobertura: 0,
        chanceDeEventoSevero: { min: 0, esperado: 0, max: 0 },
        pessoasEmRisco: { min: 0, esperado: 0, max: 0 },
        confianca: 'baixa' as const,
        sustentadaPor: [],
      };
    }

    // Viés multiplicativo dos conjuntos que cobrem o bairro.
    const vies = cobrindo.reduce((acc, c) => acc * (c.vies[p.slug] ?? 1), 1);

    // DISCORDÂNCIA: quando as fontes carregadas puxam o mesmo bairro para
    // lados opostos — o cadastro diz muita gente, os chamados dizem pouca —, o
    // modelo fica MENOS certo, não mais. É o que torna "carregue tudo" uma
    // estratégia ruim sem precisar de um teto artificial: empilhar fonte
    // conflitante alarga a faixa em vez de estreitá-la.
    // Discordar é puxar para lados OPOSTOS: uma fonte inflando o bairro e
    // outra encolhendo. Fonte neutra não discorda de ninguém — tratá-la como
    // discordância fazia qualquer camada nova alargar a faixa, e aí investigar
    // nunca compensava.
    const vieses = cobrindo.map((c) => c.vies[p.slug] ?? 1);
    const inflam = vieses.filter((v) => v > 1.02);
    const encolhem = vieses.filter((v) => v < 0.98);
    const discordancia =
      inflam.length > 0 && encolhem.length > 0
        ? Math.min(0.35, Math.max(...inflam) / Math.min(...encolhem) - 1)
        : 0;

    // Erro residual: cai com cobertura, sobe com discordância, e nunca zera —
    // o modelo nunca sabe.
    const erro = 0.45 * (1 - cobertura) + 0.08 + 0.6 * discordancia;

    const chance = Math.min(
      0.97,
      Math.max(0.02, p.pSevero * vies + ruido(sorteio, 0.05 * (1 - cobertura))),
    );
    const pessoas = Math.round(
      p.expostosSevero * vies * (1 + ruido(sorteio, 0.1 * (1 - cobertura))),
    );

    return {
      bairro: p.slug,
      cobertura: Number(cobertura.toFixed(2)),
      chanceDeEventoSevero: {
        min: Number(Math.max(0.01, chance * (1 - erro)).toFixed(2)),
        esperado: Number(chance.toFixed(2)),
        max: Number(Math.min(0.99, chance * (1 + erro)).toFixed(2)),
      },
      pessoasEmRisco: {
        min: Math.round(pessoas * (1 - erro)),
        esperado: pessoas,
        max: Math.round(pessoas * (1 + erro)),
      },
      // Confiança é cobertura DESCONTADA a discordância: três fontes que se
      // contradizem não valem uma que enxerga direito.
      confianca: confiancaDe(Math.max(0, cobertura - discordancia)),
      sustentadaPor: cobrindo.map((c) => c.slug),
    };
  });
}

export interface Conflito {
  bairro: string;
  /** A fonte que vê MAIS gente ali, e quanto ela sozinha diria. */
  infla: { fonte: string; comoFalar: string; pessoas: number };
  /** A fonte que vê MENOS, e quanto ela sozinha diria. */
  encolhe: { fonte: string; comoFalar: string; pessoas: number };
}

/**
 * Onde as fontes carregadas BRIGAM.
 *
 * O momento em que o cadastro diz 790 e o satélite diz 2.740 sobre o mesmo
 * bairro é a aula inteira em uma linha — e, sem isto, ele passava em silêncio:
 * a faixa abria, a confiança caía de alta para média, e ninguém reparava.
 */
export function conflitos(conjuntos: readonly string[]): Conflito[] {
  const ativos = conjuntos.map((s) => CONJUNTO_POR_SLUG.get(s)).filter((c) => c !== undefined);

  return PARAMETROS.flatMap((p) => {
    const cobrindo = ativos.filter((c) => (c.cobertura[p.slug] ?? 0) > 0);
    const comVies = cobrindo.map((c) => ({ conjunto: c, vies: c.vies[p.slug] ?? 1 }));
    const infla = comVies.filter((x) => x.vies > 1.02).sort((a, b) => b.vies - a.vies)[0];
    const encolhe = comVies.filter((x) => x.vies < 0.98).sort((a, b) => a.vies - b.vies)[0];
    if (!infla || !encolhe) return [];

    const pessoasSegundo = (vies: number) => Math.round(p.expostosSevero * vies);
    return [
      {
        bairro: p.slug,
        infla: {
          fonte: infla.conjunto.slug,
          comoFalar: infla.conjunto.rotuloCurto,
          pessoas: pessoasSegundo(infla.vies),
        },
        encolhe: {
          fonte: encolhe.conjunto.slug,
          comoFalar: encolhe.conjunto.rotuloCurto,
          pessoas: pessoasSegundo(encolhe.vies),
        },
      },
    ];
  });
}

/**
 * Bairros cujas estimativas se cruzam: dentro da margem, não dá para dizer qual
 * tem mais gente.
 *
 * É o que transforma "±524" em consequência. Sozinha, a margem é decoração
 * numérica; dita como empate, ela vira a informação que muda a decisão — e o
 * aluno descobre que a ordem da tabela não é um ranking confiável.
 */
export function empates(estimativas: readonly EstimativaDoBairro[]): string[][] {
  return agruparEmpatados(
    estimativas
      .filter((e) => e.cobertura > 0)
      .map((e) => ({
        chave: e.bairro,
        esperado: e.pessoasEmRisco.esperado,
        min: e.pessoasEmRisco.min,
        max: e.pessoasEmRisco.max,
      })),
  ).map((g) => g.map((x) => x.chave));
}

/**
 * A REGRA do empate, isolada: quem se sobrepõe ao MAIOR do grupo entra no
 * grupo. O Resultado usa a mesma função — ter duas leituras de empate na mesma
 * Missão faria a tela final contradizer o cartão da investigação.
 *
 * Comparar com o último em vez do maior encadeia por transitividade: Ribeirinha
 * empatava com Jardim das Flores, faixas que nem se tocam, e a cidade inteira
 * virava um empate só.
 */
export interface Empatavel {
  chave: string;
  esperado: number;
  min: number;
  max: number;
}

export function agruparEmpatados<T extends Empatavel>(itens: readonly T[]): T[][] {
  const visiveis = [...itens].sort((a, b) => b.esperado - a.esperado);
  const grupos: T[][] = [];
  for (const e of visiveis) {
    const atual = grupos[grupos.length - 1];
    const maior = atual?.[0];
    if (maior && maior.min <= e.max) atual.push(e);
    else grupos.push([e]);
  }
  return grupos.filter((g) => g.length > 1);
}

/**
 * O que UMA fonte fez com a leitura: a diferença entre a estimativa com ela e
 * sem ela.
 *
 * Causalidade por subtração, não por narrativa da LLM (regra de ouro 3). É o
 * que responde "por que esse número mudou quando eu carreguei o satélite".
 */
export function efeitoDe(
  conjuntos: readonly string[],
  fonteNova: string,
  semente: number,
): { bairro: string; de: number; para: number }[] {
  if (!conjuntos.includes(fonteNova)) return [];
  const sem = estimar(
    conjuntos.filter((c) => c !== fonteNova),
    semente,
  );
  const com = estimar(conjuntos, semente);

  return com
    .map((depois) => {
      const antes = sem.find((x) => x.bairro === depois.bairro)!;
      return {
        bairro: depois.bairro,
        de: antes.pessoasEmRisco.esperado,
        para: depois.pessoasEmRisco.esperado,
      };
    })
    .filter((d) => d.para !== d.de)
    .sort((a, b) => Math.abs(b.para - b.de) - Math.abs(a.para - a.de));
}

/** Bairros que nenhum conjunto ativo enxerga. Alimenta o aviso de ponto cego. */
export function pontosCegos(estimativas: readonly EstimativaDoBairro[]): string[] {
  return estimativas.filter((e) => e.cobertura === 0).map((e) => e.bairro);
}

/** Fração da cidade sob algum dado. Vai no cabeçalho da rodada. */
export function coberturaDaCidade(estimativas: readonly EstimativaDoBairro[]): number {
  const soma = estimativas.reduce((a, e) => a + e.cobertura, 0);
  return Number((soma / estimativas.length).toFixed(2));
}
