import { RECURSO_SEM_ROTA, SEM_ESCOLA, type ModalidadeDeIa } from "../ai/consumo-de-ia";

/**
 * O PAINEL DE CUSTOS DE IA (ADR-161) — a parte PURA: vocabulário, nomes e a
 * montagem das linhas que a consulta devolve. A consulta (SQL) fica no
 * controller e a cotação (Banco Central) em `cotacao-do-dolar.ts`; aqui não há
 * banco nem rede, e o teste cobra a conta sem nenhum dos dois.
 */

/** Espelha o CHECK `ck_ia_precos_componente` da migration. */
export const COMPONENTES_DE_PRECO = ["entrada", "saida", "minuto"] as const;
export type ComponenteDePreco = (typeof COMPONENTES_DE_PRECO)[number];

export const MODALIDADES: readonly ModalidadeDeIa[] = ["texto", "imagem", "audio", "video"];

/** O mesmo formato do CHECK `ck_ia_precos_modelo`. */
export const MODELO_DE_PRECO_RE = /^[a-z0-9][a-z0-9._-]{1,79}$/;

/** O "modelo" do avatar em vídeo: a LiveAvatar cobra por minuto, não por token. */
export const MODELO_DO_AVATAR = "liveavatar-full";

/** O período mais longo que o painel aceita: um ano e um dia (o ano bissexto inteiro). */
export const PERIODO_MAXIMO_EM_DIAS = 366;

/**
 * O NOME de cada recurso na tela. A chave é o primeiro segmento da rota
 * (`recursoDaRota`); duas rotas do mesmo produto apontam para a mesma
 * `chave`, e o painel soma as duas numa linha (o motor da exp08ef1b responde
 * em `/posts` e em `/runs`).
 *
 * Recurso NOVO que chama IA aparece no painel sem entrar aqui — com o rótulo
 * "Outro" e o prefixo da rota, para ninguém concluir que o custo sumiu. Entrar
 * aqui é só dar o nome certo.
 */
export const RECURSOS_DE_IA: Record<string, { chave: string; nome: string }> = {
  "a-selecao": { chave: "a-selecao", nome: "A Seleção" },
  "agente-professor": { chave: "agente-professor", nome: "Agente de IA do professor" },
  ajuda: { chave: "ajuda", nome: "Ajuda (mascote e avatar)" },
  bemestar: { chave: "bemestar", nome: "Acompanhamento de bem-estar" },
  "foto-conta": { chave: "foto-conta", nome: "O Que a Foto Conta" },
  "jornal-escola": { chave: "jornal-escola", nome: "Jornal da Escola" },
  "juri-estadual": { chave: "juri-estadual", nome: "O Júri Estadual de Projetos" },
  /* As imagens do banco padrão do Júri, geradas pelo `admin` fora de turma: custo da plataforma (atribuição explícita). */
  "juri-estadual-banco-padrao": { chave: "juri-estadual-banco-padrao", nome: "O Júri Estadual — imagens do banco padrão" },
  "manifesto-ia": { chave: "manifesto-ia", nome: "O Manifesto da IA" },
  posts: { chave: "unoovista", nome: "Unoovista — O Conteúdo que não chegou" },
  runs: { chave: "unoovista", nome: "Unoovista — O Conteúdo que não chegou" },
  planejamento: { chave: "planejamento", nome: "Planejamento de ensino" },
  planos: { chave: "planos", nome: "Plano de aula" },
  podcast: { chave: "podcast", nome: "Podcast da missão" },
  "quem-mandou-isso": { chave: "quem-mandou-isso", nome: "Quem Mandou Isso?" },
  unoogpt: { chave: "unoogpt", nome: "Missão Tempestade" },
  [RECURSO_SEM_ROTA]: { chave: RECURSO_SEM_ROTA, nome: "Tarefas fora de uma requisição" },
};

export function nomeDoRecurso(recurso: string): { chave: string; nome: string } {
  return RECURSOS_DE_IA[recurso] ?? { chave: recurso, nome: `Outro (${recurso})` };
}

/** O que a consulta devolve por grupo — números já em `float8`. */
export interface LinhaAgregada {
  usd: number;
  /** `null` quando NENHUMA linha do grupo tinha cotação. */
  brl: number | null;
  tokensEntrada: number;
  tokensSaida: number;
  chamadas: number;
  falhas: number;
  imagens: number;
  segundos: number;
  minutos: number;
  estimado: boolean;
  semPreco: boolean;
  semCotacao: boolean;
}

export interface Totais {
  usd: number;
  brl: number | null;
  tokensEntrada: number;
  tokensSaida: number;
  chamadas: number;
  falhas: number;
  imagens: number;
  segundosDeAudio: number;
  minutosDeVideo: number;
}

export const LINHA_VAZIA: LinhaAgregada = {
  usd: 0,
  brl: null,
  tokensEntrada: 0,
  tokensSaida: 0,
  chamadas: 0,
  falhas: 0,
  imagens: 0,
  segundos: 0,
  minutos: 0,
  estimado: false,
  semPreco: false,
  semCotacao: false,
};

/** Soma dois grupos — usado para juntar as rotas do mesmo recurso (`posts` + `runs`). */
export function somarLinhas(a: LinhaAgregada, b: LinhaAgregada): LinhaAgregada {
  return {
    usd: a.usd + b.usd,
    brl: a.brl === null && b.brl === null ? null : (a.brl ?? 0) + (b.brl ?? 0),
    tokensEntrada: a.tokensEntrada + b.tokensEntrada,
    tokensSaida: a.tokensSaida + b.tokensSaida,
    chamadas: a.chamadas + b.chamadas,
    falhas: a.falhas + b.falhas,
    imagens: a.imagens + b.imagens,
    segundos: a.segundos + b.segundos,
    minutos: a.minutos + b.minutos,
    estimado: a.estimado || b.estimado,
    semPreco: a.semPreco || b.semPreco,
    semCotacao: a.semCotacao || b.semCotacao,
  };
}

export function totaisDe(linha: LinhaAgregada | undefined): Totais {
  const l = linha ?? LINHA_VAZIA;
  return {
    usd: l.usd,
    brl: l.brl,
    tokensEntrada: l.tokensEntrada,
    tokensSaida: l.tokensSaida,
    chamadas: l.chamadas,
    falhas: l.falhas,
    imagens: l.imagens,
    segundosDeAudio: l.segundos,
    minutosDeVideo: l.minutos,
  };
}

/**
 * Agrupa as linhas por recurso com o NOME da tela e soma as rotas que são o
 * mesmo produto. Ordem: o mais caro primeiro — é a pergunta do FinOps.
 */
export function porRecurso<T extends LinhaAgregada & { recurso: string }>(
  linhas: T[],
): Array<LinhaAgregada & { recurso: string; nome: string }> {
  const juntas = new Map<string, LinhaAgregada & { recurso: string; nome: string }>();
  for (const l of linhas) {
    const { chave, nome } = nomeDoRecurso(l.recurso);
    const atual = juntas.get(chave) ?? LINHA_VAZIA;
    juntas.set(chave, { ...somarLinhas(atual, l), recurso: chave, nome });
  }
  return [...juntas.values()].sort((a, b) => b.usd - a.usd);
}

/** "Sem escola" na tela: as contas de contrato e as tarefas de fundo não têm escola no token. */
export function nomeDaEscola(escolaId: string, nomes: Map<string, string>): string {
  if (escolaId === SEM_ESCOLA) return "Sem escola (contas do contrato)";
  return nomes.get(escolaId) ?? "Escola removida";
}

/** `YYYY-MM-DD` válido de calendário (o `Date` aceita 2026-02-31 e vira março). */
export function ehDiaValido(dia: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const d = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dia;
}

/** Diferença em dias entre dois `YYYY-MM-DD` (fim − início). */
export function diasEntre(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000);
}

/** Soma `n` dias a um `YYYY-MM-DD` — aritmética de calendário em UTC, sem fuso no meio. */
export function somarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * O custo de UMA linha de consumo — a MESMA fórmula que o SQL do controller
 * aplica, escrita aqui para o teste poder cobrá-la: tokens por milhão vezes o
 * preço de cada direção, mais minutos vezes o preço do minuto. Preço ausente
 * vale zero, e a linha sai marcada `semPreco` — a tela avisa, em vez de
 * mostrar um custo que parece completo.
 */
export function custoEmUsd(
  consumo: { tokensEntrada: number; tokensSaida: number; minutos: number },
  preco: Partial<Record<ComponenteDePreco, number>>,
): { usd: number; semPreco: boolean } {
  const usd =
    ((preco.entrada ?? 0) * consumo.tokensEntrada + (preco.saida ?? 0) * consumo.tokensSaida) / 1_000_000 +
    (preco.minuto ?? 0) * consumo.minutos;
  const semPreco =
    (preco.entrada === undefined && consumo.tokensEntrada > 0) ||
    (preco.saida === undefined && consumo.tokensSaida > 0) ||
    (preco.minuto === undefined && consumo.minutos > 0);
  return { usd, semPreco };
}
