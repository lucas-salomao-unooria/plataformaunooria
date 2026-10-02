/**
 * O contrato de `GET /recursos/painel`, do lado do hub.
 *
 * Cópia deliberada do Zod da api (`recursos/contrato-de-rotas.ts`), como todo
 * tipo de resposta neste hub: o cliente não importa código da api. O que segura
 * a divergência é o `ContratoInterceptor`, que confere a resposta contra o schema
 * fora de produção.
 */

/** Os três estados do interruptor. `herda` é a AUSÊNCIA de linha no escopo. */
export type EstadoAqui = "ligado" | "desligado" | "herda";

export interface EfetivoNoPainel {
  ligado: boolean;
  /** `padrao` = ninguém decidiu em escopo nenhum; vale o padrão do produto (`ligadoPorPadrao`). */
  origem: "padrao" | "contrato" | "herdado" | "aqui";
  decididoEm: string | null;
  motivo: string | null;
}

export interface ExperienciaNoPainel {
  expId: string;
  nome: string;
  estadoAqui: EstadoAqui;
  efetivo: EfetivoNoPainel;
  /** Desligada pelo TETO do produto, não por linha própria. */
  tetoDoProduto: boolean;
  versaoAtiva: string;
  versaoFixa: string | null;
}

export interface ProdutoNoPainel {
  slug: string;
  /** O que vale sem linha em escopo nenhum — `false` para o produto em teste interno. */
  ligadoPorPadrao: boolean;
  estadoAqui: EstadoAqui;
  efetivo: EfetivoNoPainel;
  experiencias: ExperienciaNoPainel[];
}

export interface Painel {
  escopo: { escolaId: string | null; nome: string; tipo: string | null };
  produtos: ProdutoNoPainel[];
}

/** O que o seletor de escopo precisa de `GET /escolas`. */
export interface EscolaDoEscopo {
  id: string;
  nome: string;
  tipo: string;
  pai: string | null;
}
