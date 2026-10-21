import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";

import { EXP_VERSION } from "./lib/versao";

import { api, definirExperiencia } from "./lib/api";
import type { Disponivel, PlanoResumo } from "./lib/tipos";
import { PlanoApp } from "./app/plano-app";

/**
 * Entrada da experiência, em duas etapas (padrão da exp08ef1b):
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
      let exp: ExperienciaHandle | null = null;
      try {
        exp = await createExperiencia({ expId: "app-90-plano-de-aula", expVersion: EXP_VERSION });
        definirExperiencia(exp);
        const [{ planos }, disponiveis] = await Promise.all([
          api.get<{ planos: PlanoResumo[] }>("/planos"),
          api.get<Disponivel[]>("/planos/referencias/disponiveis"),
        ]);
        // `estudante` / `estudante` carrega o usuário logado no protocolo v1.
        if (ativo) setBoot({ professorNome: exp.estudante.nome, planos, disponiveis });
      } catch (falha) {
        console.error("[plano-de-aula] boot falhou", falha);
        // O boot que falha DEPOIS do handshake tem token, e por isso pode
        // reportar: era esta a falha que o estudante via como "não deu para
        // abrir agora" e que não deixava rastro nenhum no servidor (ADR-84).
        // Antes do handshake `exp` é null — ali não há token, e o sinal é a
        // ausência de `exp:ready`, que o hub observa.
        exp?.reportarErro(falha);
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
