import { FASES, type Fase } from "../conteudo";

/**
 * O PASSO do estudante — DERIVADO dos carimbos da sessão e da fase da turma,
 * nunca guardado numa coluna (o desenho da exp02ef1b e da exp02em1b).
 *
 *   boas-vindas → funcoes → aposta → simulacao → confronto → fichas →
 *   classificacao → algoritmo → criterios → reteste → publicacao → concluida
 *
 * Quatro passos esperam o PROFESSOR (`aguardandoProfessor`), e o passo não
 * muda enquanto isso — a tela põe a camada de espera por cima:
 *   - `boas-vindas` com a turma em `aguardando-inicio` (E1-PROF-01);
 *   - `aposta` já travada com a turma em `testes` (E3, "Iniciando Simulação de Chat…");
 *   - `classificacao` com a turma antes de `explicar` (E4-SIS-01, a Trava 1 —
 *     DEPOIS das fichas, decisão do Vinicius);
 *   - `publicacao` com a turma antes de `publicar` (E5-SIS-01, a Trava 2).
 * E as duas pausas opcionais (`debate-1`, `debate-2`) cobrem quem ainda está no
 * bloco delas: "Travar Telas da Turma" para todo mundo da E4, não só quem acabou.
 */
export const PASSOS = [
  "boas-vindas",
  "funcoes",
  "aposta",
  "simulacao",
  "confronto",
  "fichas",
  "classificacao",
  "algoritmo",
  "criterios",
  "reteste",
  "publicacao",
  "concluida",
] as const;
export type Passo = (typeof PASSOS)[number];

export const FASE_INICIAL: Fase = "aguardando-inicio";

/** Os marcos da sessão que decidem o passo (a sessão nasce no primeiro GET). */
export interface MarcosDaSessao {
  /** "Abrir Módulo de Teste" (E1). */
  iniciou: boolean;
  /** "Ir para Bateria de Testes" (E2), com pelo menos uma função aberta. */
  navegou: boolean;
  /** O LATCH 1 (E3). */
  apostou: boolean;
  /** As três sessões de chat terminaram (E4-ALU-01). */
  simulacaoConcluida: boolean;
  /** "Abrir Fichas de Auditoria de Acesso" (E4-ALU-02). */
  fichasAbertas: boolean;
  /** "Concluir Inspeção de Metadados" (E4-ALU-03). */
  inspecaoConcluida: boolean;
  /** Os 6 cartões enviados (completos ou não — o PO não bloqueia). */
  classificou: boolean;
  /** O painel opcional resolvido: marcou ou tocou em "Pular Etapa". */
  algoritmoResolvido: boolean;
  /** Ao menos um reteste rodou. */
  retestou: boolean;
  /** Tocou em "Revisar Critérios" no alerta de viés: volta ao banco até o próximo reteste. */
  revisando: boolean;
  /** "Avançar para Homologação e Transparência" ou "Avançar para Publicação". */
  avancouParaPublicacao: boolean;
  /** O LATCH 2 (E6). */
  publicou: boolean;
}

export function normalizarFase(bruta: string | null | undefined): Fase {
  return (FASES as readonly string[]).includes(bruta ?? "") ? (bruta as Fase) : FASE_INICIAL;
}

export function indiceDaFase(f: Fase): number {
  return FASES.indexOf(f);
}

/** "A turma já está em `alvo` ou além?" */
export function faseAlcancou(atual: Fase, alvo: Fase): boolean {
  return indiceDaFase(atual) >= indiceDaFase(alvo);
}

/**
 * As transições que o professor pode pedir, a partir de cada fase. Só para a
 * FRENTE, e as pausas são opcionais (pular direto vale). Pedir a fase em que a
 * turma já está é idempotente (o serviço responde o estado, sem histórico novo).
 */
export const PROXIMAS_FASES: Readonly<Record<Fase, readonly Fase[]>> = {
  "aguardando-inicio": ["testes"],
  testes: ["simulacao"],
  simulacao: ["debate-1", "explicar"],
  "debate-1": ["explicar"],
  explicar: ["debate-2", "publicar"],
  "debate-2": ["publicar"],
  publicar: [],
};

export function transicaoValida(atual: Fase, para: Fase): boolean {
  return PROXIMAS_FASES[atual].includes(para);
}

export function passoEfetivo(m: MarcosDaSessao | null): Passo {
  if (!m || !m.iniciou) return "boas-vindas";
  if (m.publicou) return "concluida";
  if (!m.navegou) return "funcoes";
  if (!m.apostou) return "aposta";
  if (!m.simulacaoConcluida) return "simulacao";
  if (!m.fichasAbertas) return "confronto";
  if (!m.inspecaoConcluida) return "fichas";
  if (!m.classificou) return "classificacao";
  if (!m.algoritmoResolvido) return "algoritmo";
  if (!m.retestou || m.revisando) return "criterios";
  if (!m.avancouParaPublicacao) return "reteste";
  return "publicacao";
}

/**
 * A camada de espera está por cima? O passo é o mesmo; o que muda é se a
 * turma já foi liberada para ele.
 */
export function aguardandoProfessor(passo: Passo, fase: Fase): boolean {
  switch (passo) {
    case "boas-vindas":
    case "funcoes":
    case "aposta":
      return !faseAlcancou(fase, "testes");
    case "simulacao":
      // A aposta travada espera "Liberar Início da Simulação" ("Iniciando Simulação de Chat…").
      return !faseAlcancou(fase, "simulacao") || fase === "debate-1";
    case "confronto":
    case "fichas":
      return fase === "debate-1";
    case "classificacao":
      // A Trava 1: quem concluiu a inspeção espera a bancada.
      return !faseAlcancou(fase, "explicar") || fase === "debate-1";
    case "algoritmo":
    case "criterios":
    case "reteste":
      return fase === "debate-2";
    case "publicacao":
      // A Trava 2.
      return !faseAlcancou(fase, "publicar");
    case "concluida":
      return false;
  }
}

/** A posição do passo na trilha — "a jogada é deste passo ou de um já feito?". */
export function indiceDoPasso(p: Passo): number {
  return PASSOS.indexOf(p);
}
