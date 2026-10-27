import { useEffect, useState } from "react";
import { createExperiencia } from "@edu/sdk";
import { AlertBox, ProgressBar } from "@edu/ui/ds";
import { App } from "./App";
import { api, definirExperiencia } from "./lib/api";
import { ligarTelemetria, telemetria } from "./lib/telemetria";
import { TEXTOS } from "./lib/textos";
import { EXP_ID, EXP_VERSION, type Sessao } from "./lib/tipos";

/**
 * Handshake com o hub e a primeira leitura do estado
 * (`GET /assistente-invisivel/sessao`) — é ela que faz o F5 voltar exatamente
 * à etapa. O `catch` reporta pelo SDK: o boot que falha DEPOIS do handshake
 * tem token e deixa rastro no servidor (ADR-84). Fora do hub o handshake nunca
 * resolve: abra por `/exp/exp01em1b` ou pela bancada
 * `/dev-embed?src=http://localhost:5188`.
 *
 * O esqueleto e o erro de abertura são da ESCOLA (seção `unooria`): a missão
 * abre pelo módulo de homologação da comissão.
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
        telemetria.entrou(sessao.passo !== "boas-vindas");
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
      <div className="app app--centrado escola">
        <AlertBox variant="error" device="mobile" theme="light" description={TEXTOS.geral.erroDeAbertura} />
      </div>
    );
  }
  if (!inicial) {
    return (
      <div className="app app--centrado escola" aria-busy="true">
        <ProgressBar indeterminate label={TEXTOS.geral.carregando} valuePosition="none" theme="light" className="app__carregando" />
      </div>
    );
  }
  return <App inicial={inicial} />;
}
