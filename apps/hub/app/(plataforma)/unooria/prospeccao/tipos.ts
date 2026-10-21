/**
 * O contrato de `GET /prospeccao/cadastros` (ADR-107), do lado do hub.
 *
 * Cópia deliberada do Zod da api (`prospeccao/contrato-de-rotas.ts`), como todo
 * tipo de resposta neste hub: o cliente não importa código da api. O que segura
 * a divergência é o `ContratoInterceptor`, que confere a resposta contra o
 * schema fora de produção.
 */

export interface Cadastro {
  /** Só para eliminar a pedido do titular (H10.5.2); cadastro não se edita. */
  id: string;
  nome: string;
  email: string;
  telefone: string;
  organizacao: string;
  cargo: string;
  /** ISO 8601. Quem formata é a tela, no fuso da plataforma (ADR-98/99). */
  criadoEm: string;
}

export interface Cadastros {
  cadastros: Cadastro[];
  /** O total na tabela — pode ser maior que a lista, que vem limitada. */
  total: number;
}
