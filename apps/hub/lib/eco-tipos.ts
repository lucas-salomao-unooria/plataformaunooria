/**
 * O que o hub lê da exp-07 — espelho de `apps/api/src/o-eco-no-grupo`.
 *
 * Note o que NÃO existe aqui: coluna de pontos. A leitura do professor é de
 * progresso e de estratégia, nunca uma ordenação de crianças por acerto
 * (PED-07). A distribuição A/B/C entra como percentual da turma, porque é o
 * material do debate — e não como "quem errou".
 */

export type EtapaDaAula = "investigacao" | "aula2" | "debate" | "reflexao";

export type PassoDoEstudante =
  | "chat_amara"
  | "grupo"
  | "breakpoint"
  | "podcast"
  | "intervencao"
  | "desfecho"
  | "sintese"
  | "reflexao"
  | "fim";

/** O `SeletorDeTurma` é compartilhado com a exp-03 e exige `estudantes`; a api
 *  o devolve sempre, e marcá-lo opcional aqui só criaria uma divergência de
 *  tipo entre duas telas que leem a mesma lista. */
export interface TurmaDoEco {
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
  inspecionouMateria: boolean;
  ouviuPodcast: boolean;
  opcao: "A" | "B" | "C" | null;
  desfazerUsado: number;
  entregouPercurso: boolean;
  /** Minutos desde a última ação; `null` para quem não começou ou já entregou. */
  ociosoMin: number | null;
}

export interface PainelDaTurma {
  turma: { id: string; nome: string; serie: string; etapa: EtapaDaAula };
  estudantes: LinhaDaTurma[];
  resumo: {
    total: number;
    iniciaram: number;
    inspecionaram: number;
    responderam: number;
    entregaram: number;
    ociosos: number;
    distribuicao: Record<string, number>;
    usaramRecuperacao: number;
    percursoComAsDuas: number;
  };
}

export interface PreparoDaMidia {
  urls: Record<string, string | null>;
  geradas: string[];
  falharam: string[];
}

/** O que cada etapa quer dizer na tela da professora. */
export const ROTULO_DA_ETAPA: Record<EtapaDaAula, string> = {
  investigacao: "Aula 1 — investigação",
  aula2: "Aula 2 — decisão liberada",
  debate: "Debate — telas congeladas",
  reflexao: "Reflexão liberada",
};

/** Onde cada estudante está, em português. */
export const ROTULO_DO_PASSO: Record<PassoDoEstudante, string> = {
  chat_amara: "abrindo a conversa",
  grupo: "investigando o grupo",
  breakpoint: "esperando a Aula 2",
  podcast: "no episódio",
  intervencao: "decidindo",
  desfecho: "vendo o grupo reagir",
  sintese: "na sistematização",
  reflexao: "no Meu percurso",
  fim: "entregou",
};
