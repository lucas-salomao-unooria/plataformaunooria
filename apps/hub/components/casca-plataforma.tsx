import "@unooria/design-system/unooria.css";
/**
 * As fontes, agora AUTO-HOSPEDADAS pelo pacote (0.1.17). A folha só tem
 * `@font-face` com `url()` relativa, então o bundler resolve e o Next não tem o
 * que remover — o `<link>` para o fonts.googleapis.com que morava aqui deixou
 * de existir, e com ele a única requisição externa da plataforma.
 *
 * Esta linha é OBRIGATÓRIA, não decorativa: os ícones da plataforma são fonte
 * de LIGADURA (Material Symbols Rounded), então `.unooria-icon` recebe o nome
 * do ícone como texto e a fonte o transforma em glifo. Sem a família carregada,
 * a tela escreve "search" no lugar da lupa.
 */
import "@unooria/design-system/fonts/unooria.css";
import "@edu/ui/styles/plataforma.css";
import { ClarityIdentidade } from "@/components/clarity-identidade";
import { auth } from "@/lib/auth";

/**
 * Casca visual da plataforma: o CSS institucional do DS, as fontes e as
 * compensações de `plataforma.css`.
 *
 * Existe como componente — e não solto no layout do grupo `(plataforma)` —
 * porque há DOIS grupos de rota que precisam dela: `(plataforma)/**` e
 * `/exp/**`. A rota da experiência ficou fora do grupo de propósito (o padding
 * e o `max-width` do layout do professor não servem a um aparelho em tela
 * cheia), mas o header padrão do hub vive lá também e sem estas folhas o
 * `Logo`/`Avatar` do DS sairia sem estilo e os ícones viriam como texto.
 */
export async function CascaPlataforma({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  /*
   * A identificação do Clarity entra aqui pela MESMA razão que a casca existe:
   * é o único componente por onde `(plataforma)/**` e `/exp/**` passam os dois.
   * No layout raiz não daria — lá não há sessão (e o login também passa por
   * ele); num layout por papel daria quatro cópias (ADR-59).
   *
   * O script em si é do layout raiz; sem ele, tudo abaixo é no-op.
   */
  const session = await auth();
  const usuario = session?.usuario;

  return (
    <div className={`unooria-theme-light unooria-surface ${className ?? ""}`} style={style}>
      {usuario ? (
        <ClarityIdentidade
          id={usuario.id}
          papel={usuario.papel}
          escolaId={usuario.escolaId}
          turmaId={usuario.turmaId}
          serie={usuario.serie}
        />
      ) : null}
      {children}
    </div>
  );
}
