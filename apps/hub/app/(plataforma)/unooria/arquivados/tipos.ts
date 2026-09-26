/**
 * O contrato de `GET /recursos/arquivadas` (ADR-116), do lado do hub.
 *
 * Cópia deliberada do Zod da api (`recursos/contrato-de-rotas.ts`), como todo
 * tipo de resposta neste hub: o cliente não importa código da api. O que segura
 * a divergência é o `ContratoInterceptor`, que confere a resposta contra o
 * schema fora de produção.
 */

export interface ExperienciaArquivada {
  /** `backup-` + o código que ela tinha. */
  expId: string;
  codigoDeOrigem: string;
  nome: string;
  /** A versão que estava no ar quando foi arquivada. */
  versao: string;
  series: string[];
  unidade: number | null;
  produto: string | null;
  motivo: string;
  /** A fotografia do arquivamento, tirada pela migração — não é recontada. */
  turmasGuardadas: number;
  estudantesGuardados: number;
  /** ISO 8601. Quem formata é a tela, no fuso da plataforma (ADR-98/99). */
  arquivadaEm: string;
}

export interface Arquivadas {
  arquivadas: ExperienciaArquivada[];
}
