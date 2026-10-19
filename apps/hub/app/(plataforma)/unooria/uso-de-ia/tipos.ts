/**
 * O contrato de `GET /recursos/quotas-de-ia` (ADR-105), do lado do hub.
 *
 * Cópia deliberada do Zod da api (`recursos/contrato-de-rotas.ts`), como todo
 * tipo de resposta neste hub: o cliente não importa código da api. O que segura
 * a divergência é o `ContratoInterceptor`, que confere a resposta contra o
 * schema fora de produção.
 */

/** `avaliacao` não é perfil de pessoa: é a leitura da plataforma para a evidência (ADR-169), com teto por escola. */
export type PerfilDaQuota = "estudante" | "professor" | "avaliacao";

export interface QuotaDeIa {
  perfil: PerfilDaQuota;
  tokensPorDia: number;
  motivo: string | null;
  /** `null` = veio da migration; ninguém decidiu ainda. */
  definidoPorNome: string | null;
  definidoEm: string;
}

export interface QuotasDeIa {
  quotas: QuotaDeIa[];
}

/** O contrato de `GET /recursos/limites-da-ajuda` (ADR-132) — mesma cópia deliberada. */
export type ChaveDeLimite = "minutos-por-dia" | "minutos-por-sessao";

export interface LimiteDaAjuda {
  chave: ChaveDeLimite;
  minutos: number;
  motivo: string | null;
  /** `null` = veio da migration; ninguém decidiu ainda. */
  definidoPorNome: string | null;
  definidoEm: string;
}

export interface LimitesDaAjuda {
  limites: LimiteDaAjuda[];
}

/** O contrato de `GET /recursos/configuracao-da-ajuda` (ADR-158) — mesma cópia deliberada. */
export type Atendente = "mascote" | "avatar";

export interface CamposDaConfiguracao {
  atendentePadrao: Atendente;
  permitirTroca: boolean;
  mascoteVoz: string;
  mascoteModelo: string;
  mascoteSensibilidade: number;
  mascoteSuavizacao: number;
  mascoteAntecipacaoMs: number;
  mascoteBocaRepouso: number;
  /** As instruções de "como responder" (ADR-165). `null` = o texto padrão. */
  instrucoesMascote: string | null;
  instrucoesAvatar: string | null;
}

export interface ConfiguracaoDaAjuda extends CamposDaConfiguracao {
  motivo: string | null;
  /** `null` = veio da migration; ninguém decidiu ainda. */
  definidoPorNome: string | null;
  definidoEm: string;
  /** O que está montado nesta stack: o padrão escolhido pode não estar. */
  disponiveis: Record<Atendente, boolean>;
  /** A lista fechada de vozes do mascote, com o jeito de cada uma. */
  vozes: Array<{ nome: string; jeito: string }>;
  /** O texto padrão das instruções de cada atendente (ADR-165). */
  instrucoesPadrao: Record<Atendente, string>;
}
