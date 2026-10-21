/**
 * O que o hub lê da exp06ef2b — espelho de `apps/api/src/rastro-boato`.
 *
 * Note o que NÃO existe aqui: coluna de pontos, e nenhum campo `nivel`. A
 * leitura do professor é de PROGRESSO, nunca uma ordenação de crianças por
 * acerto (PED-07). A distribuição A/B/C entra como contagem da turma, porque é
 * o material do debate — e não como "quem errou".
 *
 * `reflexaoTexto` existe: é caixa livre de menor de idade, e quem a lê é o
 * professor DA TURMA dela. Nenhuma rota de gestor a alcança (LGPD art. 14).
 */

export type EtapaDaAula = "aula1" | "aula2";

export type PassoDoEstudante =
  | "contexto"
  | "chats"
  | "decisao"
  | "breakpoint"
  | "resultado"
  | "ciclo"
  | "percurso"
  | "fim";

/** O `SeletorDeTurma` é compartilhado com a exp02em1b e exige
 *  `estudantes`; a api o devolve sempre. */
export interface TurmaDoRastro {
  id: string;
  nome: string;
  serie: string;
  estudantes: number;
}

export interface LinhaDaTurma {
  estudanteId: string;
  nome: string;
  usuario: string;
  iniciou: boolean;
  passo: PassoDoEstudante;
  /** Quantas mensagens DISTINTAS teve os dados abertos. */
  auditadas: number;
  auditouTudo: boolean;
  opcao: "A" | "B" | "C" | null;
  /** O alerta de 90s chegou a aparecer. Pede intervenção oral, não anotação. */
  houveInacao90s: boolean;
  latenciaSeg: number | null;
  modeloCoerente: boolean | null;
  entregouPercurso: boolean;
  reflexaoTexto: string | null;
  /** Minutos desde a última ação; `null` para quem não começou ou já entregou. */
  ociosoMin: number | null;
}

export interface PainelDaTurma {
  turma: { id: string; nome: string; serie: string; etapa: EtapaDaAula };
  estudantes: LinhaDaTurma[];
  resumo: {
    total: number;
    iniciaram: number;
    auditaramTudo: number;
    responderam: number;
    entregaram: number;
    ociosos: number;
    modelosCoerentes: number;
    estouraramOAlerta: number;
    distribuicao: Record<string, number>;
  };
}

/** O que cada etapa quer dizer na tela da professora. */
export const ROTULO_DA_ETAPA: Record<EtapaDaAula, string> = {
  aula1: "Aula 1 — investigação e decisão",
  aula2: "Aula 2 — o mapa, o ciclo e o percurso",
};

/** O que o estudante está vendo agora, em uma linha. */
export const ROTULO_DO_PASSO: Record<PassoDoEstudante, string> = {
  contexto: "Lendo o convite",
  chats: "Auditando as conversas",
  decisao: "Decidindo no grupo",
  breakpoint: "Esperando a Aula 2",
  resultado: "Lendo o mapa da rede",
  ciclo: "Montando o ciclo",
  percurso: "Escrevendo o percurso",
  fim: "Concluída",
};

/** As três respostas, como a professora as lê no debate. */
export const ROTULO_DA_OPCAO: Record<"A" | "B" | "C", string> = {
  A: "Encaminhou",
  B: "Denunciou e fixou o laudo",
  C: "Apagou para si",
};
