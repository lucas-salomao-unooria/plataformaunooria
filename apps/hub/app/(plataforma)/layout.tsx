import "@unooria/design-system/unooria.css";
import "@edu/ui/styles/plataforma.css";
import { FontesDaPlataforma } from "@edu/ui/fontes";

/**
 * Grupo de rotas da PLATAFORMA (login, /professor/**, /admin/**): é aqui — e
 * só aqui — que entram o CSS institucional do DS, as compensações de
 * `plataforma.css` e as fontes (Open Sans + Material Symbols via <link>
 * explícito, porque o Next remove `@import` externo de CSS importado por JS).
 *
 * A rota /exp/** (aluno dentro da experiência) NÃO passa por este layout:
 * nada da marca institucional pode vazar para o aparelho do aluno.
 */
export default function PlataformaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="unooria-theme-light unooria-surface" style={{ minHeight: "100dvh" }}>
      <FontesDaPlataforma />
      {children}
    </div>
  );
}
