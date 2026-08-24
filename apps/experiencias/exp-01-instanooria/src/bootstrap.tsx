import { useEffect, useState } from "react";
import { createExperiencia } from "@edu/sdk";

import { api, definirExperiencia } from "./lib/api";
import { marcarVisibilidade } from "./lib/visibilidade";
import {
  InstanooriaApp,
  type AlunoCliente,
  type FaseCliente,
  type MissaoCliente,
} from "./app/instanooria-app";

/**
 * A entrada da experiência — o que o Server Component `tela/page.tsx` fazia no
 * origem, agora em duas etapas client-side:
 *
 *  1. handshake com o hub (SDK): token, aluno, apiUrl chegam por `hub:init`;
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
  aluno: AlunoCliente;
}

export function Bootstrap() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const exp = await createExperiencia({ expId: "exp-01-instanooria", expVersion: "1.0.0" });
        definirExperiencia(exp);
        // hub:pause/resume → cronômetro de dwell e flush do buffer.
        exp.on("pause", () => marcarVisibilidade(false));
        exp.on("resume", () => marcarVisibilidade(true));

        const dados = await api.get<Boot>("/runs/boot");
        if (ativo) setBoot(dados);
      } catch (falha) {
        console.error("[instanooria] boot falhou", falha);
        if (ativo) setErro("Não deu para abrir agora. Fecha e tenta de novo.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-8 text-center">
        <p className="instanooria-wordmark text-[34px] leading-none">Instanooria</p>
        <p className="text-[15px] leading-relaxed text-ink/70">{erro}</p>
      </main>
    );
  }

  if (!boot) {
    // Splash neutro enquanto o handshake e o boot correm (rede de escola).
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="instanooria-wordmark animar-skeleton text-[40px] leading-none">Instanooria</p>
      </main>
    );
  }

  return (
    <InstanooriaApp
      runIdInicial={boot.runId}
      faseInicial={boot.runId ? boot.fase : "onboarding"}
      missao={boot.missao}
      aluno={boot.aluno}
    />
  );
}
