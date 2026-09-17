/**
 * O contrato de `GET /recursos/quotas-de-ia` (ADR-105), do lado do hub.
 *
 * Cópia deliberada do Zod da api (`recursos/contrato-de-rotas.ts`), como todo
 * tipo de resposta neste hub: o cliente não importa código da api. O que segura
 * a divergência é o `ContratoInterceptor`, que confere a resposta contra o
 * schema fora de produção.
 */

export type PerfilDaQuota = "estudante" | "professor";

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
