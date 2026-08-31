import { useEffect, useState } from "react";
import { createExperiencia } from "@edu/sdk";

import { api, definirExperiencia } from "./lib/api";
import type { Hoje } from "./lib/tipos";
import { BemEstarApp } from "./app/bem-estar-app";

/**
 * Entrada da experiência (padrão da exp-90):
 *  1. handshake com o hub (SDK): token, usuário logado e apiUrl por `hub:init`
 *     — sem tela de login; a api impõe `@Roles("professor")`;
 *  2. `GET /bemestar/hoje`: o check-in do dia (o pendente com os 3 itens e os
 *     textos do dia, ou o já respondido).
 */
interface Boot {
  professorNome: string;
  hoje: Hoje;
}

export function Bootstrap() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const exp = await createExperiencia({ expId: "exp-91-bem-estar", expVersion: "1.0.0" });
        definirExperiencia(exp);
        const hoje = await api.get<Hoje>("/bemestar/hoje");
        // `estudante` / `estudante` carrega o usuário logado no protocolo v1.
        if (ativo) setBoot({ professorNome: exp.estudante.nome, hoje });
      } catch (falha) {
        console.error("[bem-estar] boot falhou", falha);
        if (ativo) setErro("Não foi possível abrir o check-in agora. Recarregue a página ou tente mais tarde.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <main className="app-shell app-main app-centro">
        <p>{erro}</p>
      </main>
    );
  }
  if (!boot) {
    return (
      <main className="app-shell app-main app-centro">
        <p aria-live="polite">Abrindo o check-in…</p>
      </main>
    );
  }
  return <BemEstarApp professorNome={boot.professorNome} hojeInicial={boot.hoje} />;
}
