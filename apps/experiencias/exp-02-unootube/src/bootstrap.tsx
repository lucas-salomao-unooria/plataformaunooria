import { useEffect, useState } from "react";
import { createExperiencia } from "@edu/sdk";
import { Logo } from "@edu/ui/ds-unootube";

import { api, definirExperiencia } from "./lib/api";
import { marcarVisibilidade } from "./lib/visibilidade";
import { EXP_ID, EXP_VERSION, type RespostaSessao } from "./lib/tipos";
import { UnooTubeApp } from "./app/unootube-app";

/**
 * Entrada da experiência, em duas etapas client-side (mesmo desenho da exp-01):
 *
 *  1. handshake com o hub (SDK): token, aluno e apiUrl chegam por `hub:init`;
 *  2. `GET /unootube/sessao`: o SERVIDOR entrega catálogo (sem gabarito) e o
 *     estado da missão — recarregar a página nunca perde os salvos.
 *
 * Nenhum texto aqui pode denunciar o exercício: linguagem de app real.
 */
export function Bootstrap() {
  const [sessao, setSessao] = useState<RespostaSessao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const exp = await createExperiencia({ expId: EXP_ID, expVersion: EXP_VERSION });
        definirExperiencia(exp);
        // hub:pause/resume → pausa/retoma o vídeo ativo (iframe escondido não recebe visibilitychange).
        exp.on("pause", () => marcarVisibilidade(false));
        exp.on("resume", () => marcarVisibilidade(true));

        const dados = await api.get<RespostaSessao>("/unootube/sessao");
        if (ativo) setSessao(dados);
      } catch (falha) {
        console.error("[unootube] boot falhou", falha);
        if (ativo) setErro("Não deu para abrir agora. Fecha e tenta de novo.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <main className="splash">
        <Logo height={28} title="UnooTube" />
        <p>{erro}</p>
      </main>
    );
  }

  if (!sessao) {
    return (
      <main className="splash" aria-busy="true">
        <Logo className="splash-pulsando" height={28} title="UnooTube" />
      </main>
    );
  }

  return <UnooTubeApp sessaoInicial={sessao} />;
}
