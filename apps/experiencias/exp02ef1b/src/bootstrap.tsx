import { useEffect, useState } from "react";
import { createExperiencia } from "@edu/sdk";
import { InlineHint, LogoUnv } from "@edu/ui/ds-unoovista";
import { App } from "./App";
import { api, definirExperiencia } from "./lib/api";
import { ligarTelemetria, telemetria } from "./lib/telemetria";
import { ROTULOS } from "./lib/textos";
import { EXP_ID, EXP_VERSION, type Sessao } from "./lib/tipos";

/**
 * Handshake com o hub e a primeira leitura do estado (`GET /enigma-capa/sessao`)
 * — é ela que faz o F5 voltar exatamente à etapa (one-pager §8). O `catch`
 * reporta pelo SDK: o boot que falha DEPOIS do handshake tem token e deixa
 * rastro no servidor (ADR-84). Fora do hub o handshake nunca resolve: abra por
 * `/exp/exp02ef1b` ou pela bancada `/dev-embed?src=http://localhost:5187`.
 */
export function Bootstrap() {
  const [inicial, setInicial] = useState<Sessao | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      let handle: Awaited<ReturnType<typeof createExperiencia>> | null = null;
      try {
        handle = await createExperiencia({ expId: EXP_ID, expVersion: EXP_VERSION });
        definirExperiencia(handle);
        ligarTelemetria(handle);
        const sessao = await api.sessao();
        if (!vivo) return;
        setInicial(sessao);
        telemetria.entrou(sessao.passo !== "cracha");
      } catch (erro) {
        handle?.reportarErro(erro);
        if (!vivo) return;
        setFalhou(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (falhou) {
    return (
      <div className="app app--centrado" data-unv-theme="light">
        <LogoUnv height={30} title="Unoovista" />
        <InlineHint tone="friction" announce>
          {ROTULOS.erroDeAbertura}
        </InlineHint>
      </div>
    );
  }
  if (!inicial) {
    /* O esqueleto é o cromo do próprio app — a criança vê a moldura que espera. */
    return (
      <div className="app app--centrado" data-unv-theme="light" aria-busy="true">
        <LogoUnv height={36} title="Unoovista" className="esqueleto" />
      </div>
    );
  }
  return <App inicial={inicial} />;
}
