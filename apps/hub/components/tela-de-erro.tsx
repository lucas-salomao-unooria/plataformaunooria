"use client";
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "@edu/ui/styles/plataforma.css";
import { AlertBox } from "@edu/ui/ds";

/**
 * A tela que o `error.tsx` e o `global-error.tsx` mostram. É um componente à
 * parte porque os dois a usam, e porque ela precisa trazer o CSS do DS
 * sozinha: o `error.tsx` da raiz renderiza FORA da `CascaPlataforma` (a
 * landing e o login não passam por ela), e sem estas folhas o `AlertBox`
 * sairia sem estilo e o ícone viraria a palavra "error".
 *
 * O `digest` é o código do incidente: o Next o dá ao erro e o `onRequestError`
 * (`instrumentation.ts`) o grava na linha ERROR do servidor — é a ponte entre
 * o que a pessoa lê e o que quem opera procura no Logs Explorer, sem inventar
 * um id. Erro de render no CLIENTE não passa pelo servidor e não tem digest;
 * o registro dele entra com a captura de erros de cliente (fase 2).
 *
 * Nada da mensagem do erro vai para a tela: em produção o Next já a troca por
 * um texto genérico, e um erro do Prisma carrega o que se tentou gravar.
 */
export function TelaDeErro({ digest, aoTentarDeNovo }: { digest?: string; aoTentarDeNovo: () => void }) {
  return (
    <main
      className="unooria-theme-light unooria-surface"
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <AlertBox
        theme="light"
        variant="error"
        device="auto"
        title="Algo deu errado"
        description={
          <>
            A tela não conseguiu carregar. Tente de novo; se continuar, avise quem cuida da
            plataforma{digest ? <> e informe o código <code>{digest}</code></> : null}.
          </>
        }
        primaryAction={{ label: "Tentar de novo", onClick: aoTentarDeNovo }}
        // Âncora, não `router.push`: o `global-error` renderiza fora da árvore
        // do App Router, onde não há contexto de navegação.
        secondaryAction={{ label: "Voltar ao início", variant: "ghost", buttonProps: { as: "a", href: "/" } }}
      />
    </main>
  );
}
