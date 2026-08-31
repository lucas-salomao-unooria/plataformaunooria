import { useEffect, useState } from "react";
import { createExperiencia } from "@edu/sdk";

import { api, definirExperiencia } from "./lib/api";
import type { Disponivel, PlanoResumo } from "./lib/tipos";
import { PlanoApp } from "./app/plano-app";

/**
 * Entrada da experiência, em duas etapas (padrão da exp-01):
 *  1. handshake com o hub (SDK): token, usuário logado e apiUrl chegam por
 *     `hub:init` — NÃO há tela de login: quem autentica é o hub (NextAuth
 *     hoje, WSO2 depois), e a api impõe `@Roles("professor")`;
 *  2. `GET /planos` + `GET /planos/referencias/disponiveis`: a lista do
 *     professor e o que dá para gerar.
 */
interface Boot {
  professorNome: string;
  planos: PlanoResumo[];
  disponiveis: Disponivel[];
}

export function Bootstrap() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const exp = await createExperiencia({ expId: "exp-90-plano-de-aula", expVersion: "1.0.0" });
        definirExperiencia(exp);
        const [{ planos }, disponiveis] = await Promise.all([
          api.get<{ planos: PlanoResumo[] }>("/planos"),
          api.get<Disponivel[]>("/planos/referencias/disponiveis"),
        ]);
        // `estudante` / `estudante` carrega o usuário logado no protocolo v1.
        if (ativo) setBoot({ professorNome: exp.estudante.nome, planos, disponiveis });
      } catch (falha) {
        console.error("[plano-de-aula] boot falhou", falha);
        if (ativo) setErro("Não foi possível abrir o gerador agora. Recarregue a página ou tente mais tarde.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <main className="app-shell app-main" style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <p>{erro}</p>
      </main>
    );
  }
  if (!boot) {
    return (
      <main className="app-shell app-main" style={{ alignItems: "center", justifyContent: "center" }}>
        <p aria-live="polite">Abrindo o gerador…</p>
      </main>
    );
  }
  return <PlanoApp professorNome={boot.professorNome} planosIniciais={boot.planos} disponiveis={boot.disponiveis} />;
}
