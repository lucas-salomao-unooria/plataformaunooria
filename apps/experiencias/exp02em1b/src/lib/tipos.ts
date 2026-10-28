/**
 * O contrato desta experiência como o cliente o vê — espelho do que a TELA
 * precisa de `apps/api/src/efeito-amplificador/contrato-de-rotas.ts`
 * (`EstadoSchema`, `SessaoSchema`, `GateDoEstudanteSchema` e as entradas). O
 * gabarito não está aqui porque não desce: o comentário vem sem a categoria de
 * saúde e o parágrafo sem o nó (regra 3).
 */

export const EXP_ID = "exp02em1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json` (`versao.test.ts`). A 2.0.0 foi a primeira do Efeito
 * Amplificador: a Missão Tempestade (1.x) mora em `exp02em1b-v0` (ADR-181), e o
 * caminho do bucket da 2.x nunca encosta no dela. A 2.1.0 é a revisão do PO
 * (ADR-191): a árvore de intenções no chat, a gaveta da prévia, o feed com a
 * Central de Apoio. A 2.2.0 (ADR-192) traz a IA sem mexer na régua: o
 * classificador do que a árvore não entende, o feed que reage ao post de cada
 * um e a devolutiva da conclusão.
 */
export const EXP_VERSION = "2.2.0";

export type Passo = "abertura" | "conversa" | "feed" | "explicar" | "concluida";
export type Fase = "exploracao" | "pausa" | "explicar";
export type Etapa =
  | "E1_DESAFIAR"
  | "E2_NAVEGAR_CHAT"
  | "E2_PREVIA_APROVADA"
  | "E4_RESULTADO_AHA"
  | "E4_MODERADO"
  | "ESPERA_PROFESSOR"
  | "E5_EXPLICAR"
  | "E7_CONCLUIDO";
export type Manchete = "neutra" | "construtiva" | "sensacionalista";
/** Os motivos do aviso de cuidado (TC-19), na ordem da folha. */
export type MotivoDoAviso = "saude_usuarios" | "fonte_duvidosa" | "ofensivo";
/** Para quem o relato da Central de Apoio vai (TC-18). */
export type DestinoDoRelato = "escola" | "unoovista";

/** O TC-10 com o tema do professor no `destaque` — desenhado pelo HUB, fora do aparelho. */
export interface InstrucaoDoModerador {
  antes: string;
  destaque: string;
  depois: string;
}

export interface Estado {
  passo: Passo;
  etapa: Etapa;
  fase: Fase | null;
  pausada: boolean;
  preparada: boolean;
  atividade: { pacoteId: string; rodada: number } | null;
  conversa: { mensagens: { papel: "estudante" | "assistente"; texto: string }[]; restantes: number };
  previa: {
    gerada: boolean;
    aprovada: boolean;
    paragrafos: { id: string; texto: string; corrigido: boolean }[];
    pendencias: { fonte: boolean; autoria: boolean; privacidade: boolean };
  } | null;
  manchetes: { id: Manchete; texto: string }[] | null;
  publicacao: { manchete: { id: Manchete; texto: string }; texto: string; trechoPincado: string; publicadaEm: string } | null;
  feed: {
    comentarios: { id: string; autor: string; horario: string; texto: string }[];
    perfilSuspeito: { comentarioId: string; autor: string; horario: string } | null;
    aviso: MotivoDoAviso | null;
    contaPrivada: boolean;
    restringirComentarios: boolean;
    denunciou: boolean;
    relatos: { comentarioId: string; destino: DestinoDoRelato }[];
    metrica: string;
    instrucao: InstrucaoDoModerador;
  } | null;
  explicar: {
    indicadores: { id: string; rotulo: string; texto: string; apontado: boolean }[];
    entrega: { faixa: string; impressoes: number; minutos: number }[];
  } | null;
  concluido: boolean;
}

/** As quatro habilidades da devolutiva, na ordem da tela (a da Matriz do professor). */
export type HabilidadeDaDevolutiva = "EM13CO24" | "EM13CO14" | "EM13CO26" | "EM13CO08";
export const HABILIDADES_DA_DEVOLUTIVA: readonly HabilidadeDaDevolutiva[] = ["EM13CO24", "EM13CO14", "EM13CO26", "EM13CO08"];

/** A devolutiva da conclusão (ADR-192): um parágrafo por habilidade, sem nível — a régua é do professor. */
export interface RespostaDaDevolutiva {
  devolutiva: { origem: "ia" | "modelo"; habilidades: Record<HabilidadeDaDevolutiva, string>; geradaEm: string };
  titulos: Record<HabilidadeDaDevolutiva, string>;
}

export interface Sessao extends Estado {
  tema: string | null;
  textos: {
    pauta: { titulo: string; descricao: string; orientacoes: string[] } | null;
    boasVindas: string;
    sugestoes: string[];
    explicar: {
      titulo: string;
      instrucao: string;
      citacao: string;
      conceitos: { id: string; titulo: string; texto: string }[];
      esperaAtiva: string;
    };
    podcast: {
      titulo: string;
      blocos: { titulo: string; falas: { quem: string; texto: string }[] }[];
    };
  };
}

export interface Gate {
  fase: Fase | null;
  passo: Passo;
  etapa: Etapa;
  pausada: boolean;
  preparada: boolean;
  atividade: { pacoteId: string; rodada: number } | null;
  agora: string;
}

/** As ações de proteção (`POST /seguranca`, API-006). */
export type AcaoDeSeguranca =
  | { acao: "conta_privada"; ligado: boolean }
  | { acao: "restringir_comentarios"; ligado: boolean }
  | { acao: "abrir_central" }
  | { acao: "denunciar_perfil" }
  | { acao: "encaminhar_apoio"; comentarioId: string; destino: DestinoDoRelato };
