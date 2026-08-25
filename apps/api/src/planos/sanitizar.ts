import sanitizeHtml from "sanitize-html";

/**
 * Allowlist do HTML que o editor devolve. O `RichTextEditor` do DS é um
 * contentEditable com `execCommand`: emite <b>/<i>/<u>/<font>/<div>/<span
 * style>. Tudo que não é formatação de documento (script, iframe, handlers,
 * `javascript:`) cai aqui — o HTML volta para o navegador de OUTRO usuário
 * (o próprio professor, ou quem herdar o plano), então é XSS armazenado se
 * passar cru.
 */
const OPCOES: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "span", "br", "hr",
    "strong", "b", "em", "i", "u", "s", "strike", "del", "sub", "sup", "mark", "font",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    "a",
  ],
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "target", "rel"],
    font: ["color", "face", "size"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    col: ["span"],
    ol: ["start", "type"],
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z]+$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z]+$/i],
      "text-align": [/^(left|right|center|justify)$/],
      "font-family": [/^[\w\s,'"-]+$/],
      "font-size": [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
      "font-weight": [/^(bold|normal|[1-9]00)$/],
      "font-style": [/^(italic|normal)$/],
      "text-decoration": [/^(underline|line-through|none)( (underline|line-through))?$/],
      "text-decoration-line": [/^(underline|line-through|none)( (underline|line-through))?$/],
      "padding-left": [/^\d+(\.\d+)?(px|pt|em|rem)$/],
      "margin-left": [/^\d+(\.\d+)?(px|pt|em|rem)$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  // `target=_blank` sem noopener dá acesso ao `window.opener` da plataforma.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target === "_blank" ? { ...attribs, rel: "noopener noreferrer" } : attribs,
    }),
  },
  disallowedTagsMode: "discard",
};

export function sanitizarHtmlDoPlano(html: string): string {
  return sanitizeHtml(html, OPCOES);
}
