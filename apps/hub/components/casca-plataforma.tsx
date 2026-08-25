import "@unooria/design-system/unooria.css";
import "@edu/ui/styles/plataforma.css";
import { FontesDaPlataforma } from "@edu/ui/fontes";

/**
 * Casca visual da plataforma: o CSS institucional do DS, as compensações de
 * `plataforma.css` e as fontes (Open Sans + Material Symbols via <link>
 * explícito, porque o Next remove `@import` externo de CSS importado por JS).
 *
 * Existe como componente — e não solto no layout do grupo `(plataforma)` —
 * porque há DOIS grupos de rota que precisam dela: `(plataforma)/**` e
 * `/exp/**`. A rota da experiência ficou fora do grupo de propósito (o padding
 * e o `max-width` do layout do professor não servem a um aparelho em tela
 * cheia), mas o header padrão do hub vive lá também e sem estas folhas o
 * `Logo`/`Avatar` do DS sairia sem estilo e os ícones viriam como texto.
 */
export function CascaPlataforma({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`unooria-theme-light unooria-surface ${className ?? ""}`} style={style}>
      <FontesDaPlataforma />
      {children}
    </div>
  );
}
