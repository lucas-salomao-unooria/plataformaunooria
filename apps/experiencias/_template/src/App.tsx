import { useState } from "react";
import type { ExperienciaHandle } from "@edu/sdk";
import { Button } from "@edu/ui/ds";
import { concluir } from "./lib/api";
import { telemetria } from "./lib/telemetria";
import { TEXTOS } from "./lib/textos";
import type { Progresso } from "./lib/tipos";

/**
 * A tela de exemplo — troque tudo aqui, mantendo três coisas:
 *
 * - **interface só do design system**, pela ponte (`@edu/ui/ds` para a seção
 *   da plataforma, `@edu/ui/ds-<clone>` para a do app imitado). Este template
 *   não traz componente local de propósito: o que falta aqui, o pacote traz —
 *   e o que o pacote não traz nasce no `storybook-unooria`, com compensação
 *   local MARCADA no CSS enquanto não chega (`docs/regras/design-system.md`);
 * - **toda leitura e escrita pela SDK** (`lib/api.ts`), nunca `fetch` solto;
 * - **todo evento pela `telemetria`** (`lib/telemetria.ts`), nunca `exp.track`
 *   espalhado pelas telas — é lá que mora o vocabulário da missão.
 */
export function App({ exp, inicial }: { exp: ExperienciaHandle; inicial: Progresso }) {
  const [passos, setPassos] = useState(inicial.passos);

  function registrarPasso() {
    const n = passos + 1;
    setPassos(n);
    telemetria.registrouPasso(n);
    void exp.progresso.salvar({ passos: n } satisfies Progresso);
  }

  return (
    <main className="app app--centrado">
      <div className="cartao">
        <h1 className="cartao__titulo">{TEXTOS.saudacao(exp.estudante.nome)}</h1>
        <p className="cartao__texto">{TEXTOS.passos(passos)}</p>
        <div className="cartao__acoes">
          <Button onClick={registrarPasso}>{TEXTOS.registrarPasso}</Button>
          <Button
            variant="secondary"
            onClick={() => {
              telemetria.concluiu(passos);
              concluir({ passos });
            }}
          >
            {TEXTOS.concluir}
          </Button>
        </div>
      </div>
    </main>
  );
}
