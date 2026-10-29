import {
  CAMPOS,
  CARIMBOS,
  ETAPAS,
  PASSOS,
  VAGAS_DA_ESTEIRA,
  type Campo,
  type Carimbo,
  type Etapa,
  type FichaMontada,
  type Gate,
  type MarcaDaRotina,
  type Passo,
  type PassoDaSimulacao,
  type Sessao,
} from "./tipos";

/**
 * As poucas regras que são do CLIENTE — e por que são tão poucas.
 *
 * Tudo o que VALE (o filtro honesto, o latch da escolha, o certo dos
 * carimbos, a regra do reparo, a sequência da rotina, o relógio da turma)
 * mora em `apps/api/src/nina-noticia/`. Aqui fica só o que a tela decide
 * sozinha, sem ida à api: onde uma peça tocada vai parar (a caixa da escolha,
 * a ficha do reparo, a esteira da rotina), se o botão já pode acender, e o
 * compasso da simulação que o servidor já devolveu.
 *
 * `passoEfetivo` é cópia DECLARADA de `regras/passos.ts` da api: o servidor
 * já devolve o passo reconciliado, e a cópia existe para o `espelho.test.ts`
 * provar que a tela e a api chegam à mesma resposta num F5.
 */

// ──────────────────────────────────────────────────── o passo e o portão

const ORDEM: Record<Passo, number> = Object.fromEntries(PASSOS.map((p, i) => [p, i])) as Record<Passo, number>;

export const TETO_DA_ETAPA: Readonly<Record<Etapa, Passo>> = {
  aposta: "aposta",
  filtro: "omissao",
  inspecao: "fim",
};

export function passoEfetivo(passo: Passo, etapa: Etapa): Passo {
  const teto = TETO_DA_ETAPA[etapa];
  return ORDEM[passo] > ORDEM[teto] ? teto : passo;
}

export function passoAntes(a: Passo, b: Passo): boolean {
  return ORDEM[a] < ORDEM[b];
}

export function ehEtapa(valor: string): valor is Etapa {
  return (ETAPAS as readonly string[]).includes(valor);
}

/**
 * O que o polling do portão traz que pede uma RELEITURA da sessão: a turma
 * andou (etapa), a professora zerou (rodada) ou trocou a atividade (pacote),
 * ou o passo efetivo deste computador mudou. A PAUSA não relê: é só a flag.
 */
export function gateMudou(sessao: Pick<Sessao, "etapa" | "rodada" | "pacoteId" | "passo" | "aguardandoOProfessor">, gate: Gate): boolean {
  return (
    sessao.etapa !== gate.etapa ||
    sessao.rodada !== gate.rodada ||
    sessao.pacoteId !== gate.pacoteId ||
    sessao.passo !== gate.passo ||
    sessao.aguardandoOProfessor !== gate.aguardandoOProfessor
  );
}

/** As telas que esperam um toque da criança DEPOIS de o servidor já ter andado o passo. */
export type Segurada = "galeria" | "ficha" | "rotina";

/** A tela que aparece: a segurada (a criança ainda não tocou "Avançar"), senão a do passo. */
export function telaVisivel(passo: Passo, segurada: Segurada | null): Passo {
  if (segurada && !passoAntes(passo, segurada)) return segurada;
  return passo;
}

// ─────────────────────────────────────────────────── E2: a caixa da escolha

/** A caixa tem três nichos; cada um guarda o id de uma reportagem ou nada. */
export type Caixa = readonly (string | null)[];

export const CAIXA_VAZIA: Caixa = [null, null, null];

/** Tocar uma notícia da bandeja: ela vai ao primeiro nicho vazio. Caixa cheia: nada muda. */
export function porNaCaixa(caixa: Caixa, id: string): Caixa {
  if (caixa.includes(id)) return caixa;
  const vaga = caixa.indexOf(null);
  if (vaga < 0) return caixa;
  return caixa.map((v, i) => (i === vaga ? id : v));
}

/** Tocar uma notícia dentro da caixa: ela volta à bandeja. */
export function tirarDaCaixa(caixa: Caixa, id: string): Caixa {
  return caixa.map((v) => (v === id ? null : v));
}

export function itensDaCaixa(caixa: Caixa): string[] {
  return caixa.filter((v): v is string => v !== null);
}

/** Recompõe a caixa a partir dos itens que o servidor guardou (F5 com a escolha travada). */
export function caixaDosItens(itens: readonly string[]): Caixa {
  return CAIXA_VAZIA.map((_, i) => itens[i] ?? null);
}

// ─────────────────────────────────────────────── E4-03: a ficha do reparo

/** A ficha em montagem: a etiqueta (id opaco) em cada campo, ou nada. */
export type Montagem = Readonly<Record<Campo, string | null>>;

export const MONTAGEM_VAZIA: Montagem = { quem: null, onde: null, quando: null };

/**
 * Soltar uma etiqueta num campo (spec §7.6: QUALQUER etiqueta em QUALQUER
 * campo). Se ela já estava em outro campo, sai de lá; se o campo tinha outra,
 * a outra volta à bandeja. Nenhuma correção aqui: quem avalia é o servidor,
 * no Concluir.
 */
export function soltarEtiqueta(montagem: Montagem, etiquetaId: string, campo: Campo): Montagem {
  const nova: Record<Campo, string | null> = { ...montagem };
  for (const c of CAMPOS) if (nova[c] === etiquetaId) nova[c] = null;
  nova[campo] = etiquetaId;
  return nova;
}

/** Tocar a etiqueta encaixada: ela volta à bandeja. */
export function tirarEtiqueta(montagem: Montagem, campo: Campo): Montagem {
  return { ...montagem, [campo]: null };
}

export function campoDaEtiqueta(montagem: Montagem, etiquetaId: string): Campo | null {
  return CAMPOS.find((c) => montagem[c] === etiquetaId) ?? null;
}

/** A ficha montada, pronta para o `POST reparo` — ou `null` enquanto faltar etiqueta (o Concluir fica apagado). */
export function fichaMontada(montagem: Montagem): FichaMontada | null {
  const { quem, onde, quando } = montagem;
  if (!quem || !onde || !quando) return null;
  if (new Set([quem, onde, quando]).size !== 3) return null;
  return { quem, onde, quando };
}

// ─────────────────────────────────────────────── E5-01: a esteira da rotina

export type Esteira = readonly (string | null)[];

export const ESTEIRA_VAZIA: Esteira = Array.from({ length: VAGAS_DA_ESTEIRA }, () => null);

/**
 * O recuo de cada vaga da esteira (spec §1: ENQUANTO > Pegar, SE > ok, SENÃO
 * > revisar, FIM). É o DESENHO da esteira, igual para todos — não diz qual
 * bloco vai em qual vaga: a criança põe qualquer um em qualquer lugar.
 */
export const RECUO_DA_VAGA: readonly (0 | 1 | 2)[] = [0, 1, 1, 2, 1, 2, 0];

/** Soltar um bloco numa vaga: sai da vaga em que estava; o que ocupava a vaga volta à bandeja. */
export function soltarBloco(esteira: Esteira, blocoId: string, vaga: number): Esteira {
  if (vaga < 0 || vaga >= esteira.length) return esteira;
  return esteira.map((v, i) => (i === vaga ? blocoId : v === blocoId ? null : v));
}

export function tirarBloco(esteira: Esteira, vaga: number): Esteira {
  return esteira.map((v, i) => (i === vaga ? null : v));
}

/** A sequência para o `POST rotina`, ou `null` enquanto houver vaga vazia. */
export function sequenciaDaEsteira(esteira: Esteira): string[] | null {
  if (esteira.some((v) => v === null)) return null;
  return esteira as string[];
}

export function vagasVazias(esteira: Esteira): number {
  return esteira.filter((v) => v === null).length;
}

/**
 * Os quadros da simulação (contador 3 → 0): um por ficha da pilha que o
 * SERVIDOR devolveu, no mesmo intervalo, somando a duração total. Com
 * `prefers-reduced-motion`, a tela pula direto para o último.
 */
export function quadrosDaSimulacao(
  simulacao: readonly PassoDaSimulacao[],
  duracaoMs: number,
): { emMs: number; indice: number; passo: PassoDaSimulacao; marca: MarcaDaRotina }[] {
  const intervalo = simulacao.length > 0 ? duracaoMs / simulacao.length : 0;
  return simulacao.map((passo, indice) => ({ emMs: Math.round(indice * intervalo), indice, passo, marca: passo.marca }));
}

// ────────────────────────────────────────────────────── E4-02 / E6-01

/** Os três carimbos dados, prontos para o envio — ou `null` se falta algum. */
export function carimbosCompletos<K extends string>(
  cartoes: readonly K[],
  marcas: Partial<Record<K, Carimbo>>,
): Record<K, Carimbo> | null {
  const saida = {} as Record<K, Carimbo>;
  for (const k of cartoes) {
    const m = marcas[k];
    if (!m || !(CARIMBOS as readonly string[]).includes(m)) return null;
    saida[k] = m;
  }
  return saida;
}
