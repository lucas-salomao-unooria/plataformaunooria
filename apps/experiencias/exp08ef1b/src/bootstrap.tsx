import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { LogoUnv } from "@edu/ui/ds-unoovista";

import { EXP_VERSION } from "./lib/versao";

import { api, definirExperiencia } from "./lib/api";
import { marcarVisibilidade } from "./lib/visibilidade";
import {
  InstanooriaApp,
  type EstudanteCliente,
  type FaseCliente,
  type MissaoCliente,
} from "./app/instanooria-app";

/**
 * A entrada da experiência — o que o Server Component `tela/page.tsx` fazia no
 * origem, agora em duas etapas client-side:
 *
 *  1. handshake com o hub (SDK): token, estudante, apiUrl chegam por `hub:init`;
 *  2. `GET /runs/boot`: o SERVIDOR decide a fase e entrega a missão — o
 *     cliente assume dali (recarga direta nunca perde a fase, a lição do
 *     origem).
 *
 * Nenhum texto de erro aqui pode denunciar o exercício (regra de ouro 1):
 * linguagem de app real, sempre.
 */
interface Boot {
  runId: string | null;
  fase: FaseCliente;
  missao: MissaoCliente;
  estudante?: EstudanteCliente;
}

export function Bootstrap() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      let exp: ExperienciaHandle | null = null;
      try {
        exp = await createExperiencia({ expId: "exp08ef1b", expVersion: EXP_VERSION });
        definirExperiencia(exp);
        // hub:pause/resume → cronômetro de dwell e flush do buffer.
        exp.on("pause", () => marcarVisibilidade(false));
        exp.on("resume", () => marcarVisibilidade(true));

        const dados = await api.get<Boot>("/runs/boot");
        if (ativo) setBoot(dados);
      } catch (falha) {
        console.error("[unoovista] boot falhou", falha);
        // O boot que falha DEPOIS do handshake tem token, e por isso pode
        // reportar: era esta a falha que o estudante via como "não deu para
        // abrir agora" e que não deixava rastro nenhum no servidor (ADR-84).
        // Antes do handshake `exp` é null — ali não há token, e o sinal é a
        // ausência de `exp:ready`, que o hub observa.
        exp?.reportarErro(falha);
        if (ativo) setErro("Não deu para abrir agora. Fecha e tenta de novo.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-8 text-center">
        <LogoUnv height={30} title="Unoovista" />
        <p className="text-[15px] leading-relaxed text-ink/70">{erro}</p>
      </main>
    );
  }

  if (!boot) {
    // Splash neutro enquanto o handshake e o boot correm (rede de escola).
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas">
        <LogoUnv height={36} title="Unoovista" className="animar-skeleton" />
      </main>
    );
  }

  const dadosEstudante = boot.estudante;

  return (
    <InstanooriaApp
      runIdInicial={boot.runId}
      faseInicial={boot.runId ? boot.fase : "onboarding"}
      missao={boot.missao}
      estudante={dadosEstudante}
    />
  );
}
