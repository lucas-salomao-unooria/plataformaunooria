/**
 * Quem pode criar quem — a matriz do cadastro unitário, escrita UMA vez.
 *
 * O `RolesGuard` já separa as duas rotas (`POST /usuarios` aceita gestor e
 * `gestor_contrato`; `POST /usuarios/admin-contrato` só o segundo). Esta função
 * é a segunda tranca, e existe por um motivo específico: o guard protege a
 * ROTA, não o campo `papel` do corpo. No dia em que `PAPEIS_IMPORTAVEIS` ganhar
 * um item, ou em que alguém afrouxar o `@Roles` da classe, é aqui que a regra
 * "gestor não cria admin-contrato" continua de pé — e ela é testável sem banco.
 */
import type { Perfil } from "../auth/claims";
import { PAPEIS_IMPORTAVEIS } from "../rostering/catalogo";

/**
 * O gestor cria as pessoas da ESCOLA dele, que são exatamente as importáveis.
 * `gestor_contrato` fica de fora por construção: não pertence a escola nenhuma
 * (`users.escola_id` nulo) e enxerga a rede inteira — conceder esse alcance é
 * decisão do contrato, não de uma unidade.
 */
export const PAPEIS_QUE_O_GESTOR_CRIA: readonly Perfil[] = PAPEIS_IMPORTAVEIS;

/** `gestor_contrato` cria qualquer um, inclusive outro `gestor_contrato`. */
export const PAPEIS_QUE_O_ADMIN_CRIA: readonly Perfil[] = [
  ...PAPEIS_IMPORTAVEIS,
  "gestor_contrato",
];

export function podeCriarPapel(autor: Perfil, papelPedido: Perfil): boolean {
  if (autor === "gestor_contrato") return PAPEIS_QUE_O_ADMIN_CRIA.includes(papelPedido);
  if (autor === "gestor_escola") return PAPEIS_QUE_O_GESTOR_CRIA.includes(papelPedido);
  // Estudante e professor não criam ninguém, e a ausência é estrutural: não há
  // rota de criação com esses papéis no `@Roles`.
  return false;
}
