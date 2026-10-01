/**
 * As travas do markdown do agente de IA do professor, separadas do componente
 * (`components/agente-professor/markdown.tsx`) para o teste do hub — que só
 * varre `lib/` — alcançá-las.
 */

/**
 * O que a resposta pode ter. Tudo o que o GFM produz para texto (títulos,
 * listas, citação, código, tabela, riscado) e nada que execute, carregue ou
 * envie: sem `img` como imagem (vira o texto alternativo), sem `input` (as
 * caixinhas de lista de tarefas somem, o texto fica), sem `iframe`, `form`,
 * `script` ou `style` — que o markdown nem produz sem HTML cru, e HTML cru
 * aqui é texto.
 */
export const ELEMENTOS_PERMITIDOS = [
  "p",
  "br",
  "strong",
  "em",
  "del",
  "a",
  "img",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "sup",
  "section",
];

const PROTOCOLOS_PERMITIDOS = new Set(["http:", "https:", "mailto:"]);

/**
 * O `urlTransform` do react-markdown: devolve a URL só se ela for absoluta e
 * `http`/`https`/`mailto`. O resto vira `null` — o atributo some, e o link sem
 * `href` é desenhado como texto.
 *
 * Pelo `URL` do navegador, e não por expressão regular: é ele que decide o que
 * `java\tscript:` ou `JAVASCRIPT:` significam (tira tabulação e quebra de
 * linha, normaliza a caixa) — e uma regex que discorde do navegador é um
 * filtro contornável. Relativo (`/professor`, `#nota`) também cai: num painel
 * flutuante sobre qualquer tela, um link relativo do modelo levaria o
 * professor a uma rota que ninguém escolheu.
 */
export function urlSegura(url: string): string | null {
  let lida: URL;
  try {
    lida = new URL(url);
  } catch {
    return null;
  }
  return PROTOCOLOS_PERMITIDOS.has(lida.protocol) ? url : null;
}
