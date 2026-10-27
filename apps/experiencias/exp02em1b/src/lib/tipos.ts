/**
 * O contrato desta experiência como o cliente o vê — espelho do que a TELA
 * precisa de `apps/api/src/efeito-amplificador/contrato-de-rotas.ts`
 * (`EstadoSchema`, `SessaoSchema`, `GateDoEstudanteSchema`). O gabarito não
 * está aqui porque não desce: o comentário vem sem a categoria de saúde, o
 * indicador sem o `comprova`, o parágrafo sem o nó (regra 3).
 */

export const EXP_ID = "exp02em1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json` (`versao.test.ts`). A 2.0.0 é a primeira do Efeito
 * Amplificador: a Missão Tempestade (1.x) mora em `exp02em1b-v0` (ADR-181), e o
 * caminho do bucket da 2.x nunca encosta no dela.
 */
export const EXP_VERSION = "2.0.2";

export type Passo = "abertura" | "conversa" | "feed" | "explicar" | "concluida";
export type Fase = "aberta" | "debate" | "explicar";
export type Manchete = "neutra" | "construtiva" | "sensacionalista";
export type Moderacao = "restringir" | "aviso" | "arquivar";

export interface Estado {
  passo: Passo;
  fase: Fase | null;
  pausada: boolean;
  preparada: boolean;
  atividade: { pacoteId: string; rodada: number } | null;
  conversa: { mensagens: { papel: "estudante" | "assistente"; texto: string; origem?: "ia" | "regras" }[]; restantes: number };
  previa: { gerada: boolean; paragrafos: { id: string; texto: string; corrigido: boolean; removido: boolean }[] } | null;
  manchetes: { id: Manchete; texto: string }[] | null;
  publicacao: { manchete: { id: Manchete; texto: string }; texto: string; trechoPincado: string; publicadaEm: string } | null;
  feed: {
    comentarios: { id: string; autor: string; handle: string; horario: string; texto: string }[];
    inspecionados: string[];
    metricas: boolean;
    moderacoes: Moderacao[];
    privacidade: boolean;
    denuncias: string[];
    ajuda: boolean;
    entrega: { faixa: string; percentual: number }[];
  } | null;
  explicar: { indicadores: { id: string; rotulo: string; confirmado: boolean }[]; ultimoNaoComprova: boolean; completo: boolean } | null;
  concluido: boolean;
}

export interface Sessao extends Estado {
  tema: string | null;
  textos: {
    abertura: string | null;
    pilulas: string[];
    explicar: {
      titulo: string;
      instrucao: string;
      naoComprova: string;
      citacao: string;
      conceitos: { id: string; texto: string }[];
      esperaAtiva: string;
    };
  };
}

export interface Gate {
  fase: Fase | null;
  passo: Passo;
  pausada: boolean;
  preparada: boolean;
  atividade: { pacoteId: string; rodada: number } | null;
  agora: string;
}

export type AcaoNoFeed =
  | { acao: "inspecionar"; comentarioId: string }
  | { acao: "metricas" }
  | { acao: "moderar"; moderacao: Moderacao }
  | { acao: "privacidade" }
  | { acao: "denunciar"; comentarioId: string }
  | { acao: "ajuda" };
