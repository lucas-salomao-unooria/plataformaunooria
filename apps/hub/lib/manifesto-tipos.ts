/**
 * O que o hub lê da exp08ef4b — espelho de `apps/api/src/manifesto-ia`.
 *
 * Note o que NÃO existe aqui: nenhum campo de nota, nível ou taxa de acerto. A
 * leitura do professor é de PROGRESSO e de ESCOLHA (PED-07). A distribuição das
 * quatro cláusulas entra como CONTAGEM — é o material das três perguntas do
 * debate, e as quatro salvaguardas são válidas: não existe "quem errou".
 *
 * `justificativaTexto` existe: é caixa livre de menor de idade, e quem a lê é o
 * professor DA TURMA dela. Nenhuma rota de gestor a alcança (LGPD art. 14).
 */

export type EtapaDaTurma = "missao" | "debate";

export type PassoDoEstudante =
  | "briefing"
  | "chat"
  | "decisao"
  | "manifesto"
  | "percurso"
  | "podcast"
  | "fim";

/** O `SeletorDeTurma` é compartilhado com a exp02em1b e a exp06ef2b e
 *  exige `estudantes`; a api o devolve sempre. */
export interface TurmaDoManifesto {
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
  /** Quantos questionamentos DISTINTOS ela disparou contra a máquina. */
  auditorias: number;
  auditouOMinimo: boolean;
  clausulaId: string | null;
  tags: string[];
  registrouPercurso: boolean;
  justificativaTexto: string | null;
  /** Minutos desde a última ação; `null` para quem não começou ou já concluiu. */
  ociosoMin: number | null;
}

export interface PainelDaTurma {
  turma: { id: string; nome: string; serie: string; etapa: EtapaDaTurma };
  estudantes: LinhaDaTurma[];
  resumo: {
    total: number;
    iniciaram: number;
    auditaram: number;
    fixaramClausula: number;
    assinaram: number;
    concluiram: number;
    ociosos: number;
    /** Votos por cláusula. Material do debate, não placar. */
    distribuicao: Record<string, number>;
    /** A nuvem agregada de palavras-chave da sala. */
    tags: Record<string, number>;
  };
}

/** O pacote curado da turma, COM o material de mediação. Professor-only. */
export interface ConteudoDaTurma {
  contexto: { escola: string; casoUsoTitulo: string; premissaIaAutoritaria: string };
  prompts: Array<{
    id: string;
    rotuloBotao: string;
    textoPrompt: string;
    /** A defesa da máquina. O professor a lê ANTES da aula, de propósito. */
    replicaIa: string;
  }>;
  clausulas: Array<{
    id: string;
    tituloClausula: string;
    artigoTexto: string;
    /** Material de mediação — nunca chega ao estudante. */
    justificativaSugerida: string;
  }>;
  aprovadoPorProfessor: boolean;
  usouBancoDefault: boolean;
  atualizadoEm: string | null;
  /** Só na resposta de `gerar-conteudo`: a IA respondeu, ou veio o curado? */
  usouIa?: boolean;
}

/** O que cada etapa quer dizer na tela da professora. */
export const ROTULO_DA_ETAPA: Record<EtapaDaTurma, string> = {
  missao: "Missão correndo — cada um no seu ritmo",
  debate: "Congelada para o debate coletivo",
};

/** O que o estudante está vendo agora, em uma linha. */
export const ROTULO_DO_PASSO: Record<PassoDoEstudante, string> = {
  briefing: "Ouvindo o alerta de Amara",
  chat: "Auditando o sistema",
  decisao: "Escolhendo a cláusula",
  manifesto: "Lendo o manifesto",
  percurso: "Assinando no Percurso",
  podcast: "No fechamento",
  fim: "Concluída",
};

/**
 * Os rótulos das quatro cláusulas, na ordem do catálogo da api.
 *
 * É cópia declarada — o hub não busca o catálogo só para escrever quatro
 * títulos no gráfico, e o `SeletorDeTurma` já é client. O custo é que renomear
 * uma cláusula na api sem mudar aqui faz o gráfico mostrar o id cru; a ordem e
 * os ids estão presos pelo CHECK da migration, então o gráfico nunca fica
 * VAZIO — ele fica feio, e isso se vê.
 */
export const ROTULO_DA_CLAUSULA: Record<string, string> = {
  clausula_transparencia: "Transparência Total de Dados",
  clausula_auditoria_vies: "Auditoria Periódica de Viés",
  clausula_veto_humano: "Veto Humano Obrigatório",
  clausula_anonimizacao: "Anonimização Estrita de Perfis",
};

export const ROTULO_DA_TAG: Record<string, string> = {
  autonomia: "Autonomia",
  transparencia: "Transparência",
  justica: "Justiça",
  privacidade: "Privacidade",
};
