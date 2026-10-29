/**
 * A versão desta experiência, em UM lugar do código.
 *
 * Ela precisa ser igual à do `public/experiencia.json` e à do `package.json`:
 * o CI lê o manifesto para montar o caminho IMUTÁVEL no bucket, e este valor é
 * o que vai no `versao` do erro de cliente e no `service.version` do trace.
 * Divergir não quebra nada visível — só faz o Error Reporting agrupar o erro
 * numa versão que nunca existiu, e o `scripts/mapear-stack.mjs` procurar o
 * sourcemap num caminho vazio. Ficou em "1.0.0" por várias versões, e foi
 * assim que se descobriu (2026-09-08). `versao.test.ts` é a rede.
 */
export const EXP_VERSION = "1.2.12";
