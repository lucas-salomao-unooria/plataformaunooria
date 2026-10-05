import { Logo, ScrollBar } from "@edu/ui/ds";
import { TEXTOS } from "../lib/textos";

/**
 * A tela da CASCA Unooria — quem fala é a escola, e só ela (`@edu/ui/ds`, a
 * seção `unooria`, tema claro; nada de `--unc-*`, nada do clone).
 *
 * Sobrou uma só: **"Missão Concluída"**, depois das perguntas da Nina. A regra
 * Se/Então, que era a outra travessia para a casca, saiu da missão (ADR-145):
 * as perguntas de múltipla escolha são a reflexão.
 *
 * A rolagem é o `ScrollBar` do DS: aqui a seção É a `unooria`, e a regra das
 * duas famílias (que tira o `ScrollBar` do clone) vale ao contrário.
 */

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <ScrollBar className="escola" height="100%" autoHide theme="light">
      <div className="escola__pilha">
        <Logo size="sm" className="escola__marca" />
        {children}
      </div>
    </ScrollBar>
  );
}

// ─────────────────────────────────────── E6-ALU-02: a missão concluída

export function TelaConcluida() {
  const c = TEXTOS.conclusao;
  return (
    <Casca>
      <h1 className="escola__titulo">{c.titulo}</h1>
      <p className="escola__rodape">{c.rodape}</p>
    </Casca>
  );
}
