/**
 * Quem pode criar quem — a matriz do cadastro unitário, escrita UMA vez.
 *
 * O `RolesGuard` já separa as rotas. Esta função é a segunda tranca, e existe
 * por um motivo específico: o guard protege a ROTA, não o campo `papel` do
 * corpo. No dia em que `PAPEIS_IMPORTAVEIS` ganhar um item, ou em que alguém
 * afrouxar o `@Roles` da classe, é aqui que a cadeia continua de pé — e ela é
 * testável sem banco.
 */
import type { Perfil } from "../auth/claims";
import { PAPEIS_IMPORTAVEIS } from "../rostering/catalogo";

/**
 * A CADEIA DE ATRIBUIÇÃO (ADR-80). Cada nível atribui o de baixo:
 *
 *   admin (Unooria)  →  gestor_contrato
 *   gestor_contrato  →  gestor_regional
 *   gestor_regional  →  gestor_escola
 *   gestor_escola    →  professor, estudante
 *
 * Ela é escrita como "o que EU atribuo diretamente", e o alcance real sai do
 * fechamento transitivo (`papeisQueCria`). As duas coisas separadas de
 * propósito: a cadeia é a regra de negócio, que se lê numa olhada; o fechamento
 * é a consequência dela. Escrever a lista já expandida em cada papel faria a
 * regra ter quatro cópias, e mudar a delegação passaria a exigir acertar todas
 * — a divergência que ninguém percebe é a que dá acesso a mais.
 *
 * Por que o fechamento e não a cadeia estrita: quem atribui um `gestor_regional`
 * atribui, por definição, alguém que atribui `gestor_escola`. Recusar ao
 * `gestor_contrato` o cadastro direto de uma coordenação de escola não protege
 * nada — ele criaria o regional e pediria a ele — e transformaria toda operação
 * de balcão numa corrente de três telefonemas.
 */
const ATRIBUI_DIRETAMENTE: Readonly<Record<Perfil, readonly Perfil[]>> = {
  admin: ["gestor_contrato"],
  gestor_contrato: ["gestor_regional"],
  gestor_regional: ["gestor_escola"],
  gestor_escola: PAPEIS_IMPORTAVEIS.filter((p) => p !== "gestor_escola"),
  professor: [],
  estudante: [],
};

/** O fechamento transitivo da cadeia: tudo que este papel alcança. */
export function papeisQueCria(autor: Perfil): readonly Perfil[] {
  const vistos = new Set<Perfil>();
  const fila = [...(ATRIBUI_DIRETAMENTE[autor] ?? [])];
  while (fila.length > 0) {
    const papel = fila.shift()!;
    if (vistos.has(papel)) continue;
    vistos.add(papel);
    fila.push(...(ATRIBUI_DIRETAMENTE[papel] ?? []));
  }
  return [...vistos];
}

export function podeCriarPapel(autor: Perfil, papelPedido: Perfil): boolean {
  return papeisQueCria(autor).includes(papelPedido);
}

/**
 * Os papéis que NÃO nascem por importação: não pertencem a escola nenhuma, e
 * por isso não cabem numa linha de planilha da escola (`PAPEIS_IMPORTAVEIS`
 * sempre os excluiu). Entram pela rota `POST /usuarios/sem-escola`.
 */
export const PAPEIS_SEM_ESCOLA = ["gestor_contrato", "gestor_regional"] as const;
export type PapelSemEscola = (typeof PAPEIS_SEM_ESCOLA)[number];
