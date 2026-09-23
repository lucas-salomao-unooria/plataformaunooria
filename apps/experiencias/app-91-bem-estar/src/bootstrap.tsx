import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";

import { EXP_VERSION } from "./lib/versao";

import { api, definirExperiencia } from "./lib/api";
import type { Hoje } from "./lib/tipos";
import { BemEstarApp } from "./app/bem-estar-app";

/**
 * Entrada da experiência (padrão da app-90):
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
      let exp: ExperienciaHandle | null = null;
      try {
        exp = await createExperiencia({ expId: "app-91-bem-estar", expVersion: EXP_VERSION });
        definirExperiencia(exp);
        const hoje = await api.get<Hoje>("/bemestar/hoje");
        // `estudante` / `estudante` carrega o usuário logado no protocolo v1.
        if (ativo) setBoot({ professorNome: exp.estudante.nome, hoje });
      } catch (falha) {
        console.error("[bem-estar] boot falhou", falha);
        // O boot que falha DEPOIS do handshake tem token, e por isso pode
        // reportar: era esta a falha que o estudante via como "não deu para
        // abrir agora" e que não deixava rastro nenhum no servidor (ADR-84).
        // Antes do handshake `exp` é null — ali não há token, e o sinal é a
        // ausência de `exp:ready`, que o hub observa.
        exp?.reportarErro(falha);
        if (ativo) setErro("Não foi possível abrir o acompanhamento agora. Recarregue a página ou tente mais tarde.");
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
        <p aria-live="polite">Abrindo…</p>
      </main>
    );
  }
  return <BemEstarApp professorNome={boot.professorNome} hojeInicial={boot.hoje} />;
}
