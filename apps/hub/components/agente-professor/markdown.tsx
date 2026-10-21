"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { RichContent, RichContentTable } from "@edu/ui/ds";
import { ELEMENTOS_PERMITIDOS, urlSegura } from "@/lib/agente-professor/markdown-seguro";

/**
 * A RESPOSTA DO AGENTE, de markdown para elementos — no NAVEGADOR, porque o
 * texto chega em pedaços (a exceção ao precedente de `planos`, que converte na
 * api, está em `docs/regras/agente-professor.md`).
 *
 * O texto é do modelo, e o modelo leu o acervo: trate-o como entrada de
 * terceiro. As travas, todas aqui e testadas em `lib/agente-professor/`:
 *
 *   - **HTML cru não é interpretado** (`skipHtml={false}` de PROPÓSITO, sem
 *     `rehype-raw`): o react-markdown troca cada nó de HTML por TEXTO. Com
 *     `skipHtml` o nó SUMIRIA — e numa pergunta de Computação ("como explico
 *     a tag <p>?") a resposta perderia justamente o assunto. Nos dois casos
 *     nada vira elemento; aqui, nada se perde.
 *   - **Só `http`, `https` e `mailto` viram link** (`urlSegura`); o resto
 *     (`javascript:`, `data:`, relativo) fica sem `href` e o link vira texto.
 *   - **Só os elementos de `ELEMENTOS_PERMITIDOS`**; o que sai da lista é
 *     desembrulhado (o texto fica, a marcação não). Imagem nunca é imagem:
 *     vira o texto alternativo.
 *   - Nunca `dangerouslySetInnerHTML`.
 *
 * Markdown PARCIAL (cerca de código aberta, tabela pela metade, `**` sem par)
 * é o estado normal enquanto a resposta chega: o parser não lança com nenhum
 * deles, e a tela se corrige no pedaço seguinte.
 */

const COMPONENTES: Components = {
  /* O `node` que o react-markdown repassa não pode chegar ao DOM: cada
     componente o retira antes de espalhar o resto. */
  a: ({ node, href, children, ...resto }) => {
    void node;
    if (!href) return <>{children}</>;
    return (
      <a {...resto} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  img: ({ node, alt }) => {
    void node;
    return alt ? <span>{alt}</span> : null;
  },
  table: RichContentTable,
};

const OPCOES_DO_REHYPE = {
  footnoteLabel: "Notas de rodapé",
  footnoteBackLabel: "Voltar ao texto",
};

function MarkdownDoAgenteBase({ texto }: { texto: string }) {
  return (
    <RichContent>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        /* As notas de rodapé do GFM trazem rótulos em inglês ("Footnotes",
           "Back to content") para o leitor de tela: em pt-BR (ADR-91). */
        remarkRehypeOptions={OPCOES_DO_REHYPE}
        skipHtml={false}
        allowedElements={ELEMENTOS_PERMITIDOS}
        unwrapDisallowed
        urlTransform={urlSegura}
        components={COMPONENTES}
      >
        {texto}
      </ReactMarkdown>
    </RichContent>
  );
}

/** Re-renderiza só quando o texto acumulado muda — a cada `delta`, e não a cada render do painel. */
export const MarkdownDoAgente = memo(MarkdownDoAgenteBase);
