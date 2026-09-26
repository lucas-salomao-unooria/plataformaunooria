/**
 * A EXPERIÊNCIA ARQUIVADA (ADR-116).
 *
 * Arquivar é tirar do produto sem apagar. Quando uma missão nova toma o código
 * de outra (o código é derivado da série e da unidade, ADR-110), a antiga não
 * some: tudo o que era dela ganha o prefixo `backup-` — a pasta da experiência,
 * o módulo da api, as tabelas (`backup_<código>_`) e o id como VALOR nas tabelas
 * da plataforma.
 *
 * O arquivamento é DERIVADO do id, como o código é derivado do manifesto: não há
 * campo `arquivada` no manifesto para ficar dessincronizado do nome da pasta.
 *
 * **O id arquivado NÃO passa no `EXP_ID_RE`**, de propósito: rota, catálogo,
 * grade da sala e painel de recursos aceitam só experiência viva. Quem precisa
 * enxergar arquivada (a área `/unooria/arquivados`, a spec do código) usa este
 * arquivo.
 */
import { EXP_ID_RE } from "./codigo-da-experiencia";

/** O prefixo do id arquivado. No nome de tabela vira `backup_`. */
export const PREFIXO_DE_ARQUIVADA = "backup-";

/** `backup-` + um código válido: `backup-exp04ef1b`, `backup-app-70-vila-do-lume`. */
export const CODIGO_ARQUIVADO_RE = new RegExp(`^backup-(${EXP_ID_RE.source.slice(1, -1)})$`);

export function ehArquivada(expId: string): boolean {
  return CODIGO_ARQUIVADO_RE.test(expId);
}

/** O código que a experiência tinha antes de ser arquivada, ou `null` se o id não é de arquivada. */
export function codigoDeOrigem(expId: string): string | null {
  return ehArquivada(expId) ? expId.slice(PREFIXO_DE_ARQUIVADA.length) : null;
}
