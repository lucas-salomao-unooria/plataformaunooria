import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { App } from "./App";
import { api, definirExperiencia } from "./lib/api";
import { ligarTelemetria, telemetria } from "./lib/telemetria";
import { TEXTOS } from "./lib/textos";
import { EXP_ID, EXP_VERSION, type Sessao } from "./lib/tipos";

/**
 * Handshake com o hub e a primeira leitura do estado (`GET /efeito-amplificador/sessao`).
 * O `catch` reporta pelo SDK: o boot que falha DEPOIS do handshake tem token e
 * deixa rastro no servidor (ADR-84).
 */
export function Bootstrap() {
  const [exp, setExp] = useState<ExperienciaHandle | null>(null);
  const [inicial, setInicial] = useState<Sessao | null>(null);
  const [falhou, setFalhou] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      let handle: ExperienciaHandle | null = null;
      try {
        handle = await createExperiencia({ expId: EXP_ID, expVersion: EXP_VERSION });
        definirExperiencia(handle);
        ligarTelemetria(handle);
        const sessao = await api.sessao();
        if (!vivo) return;
        setInicial(sessao);
        setExp(handle);
        telemetria.entrou(sessao.passo !== "abertura");
      } catch (erro) {
        handle?.reportarErro(erro);
        if (!vivo) return;
        setFalhou(TEXTOS.erroDeAbertura);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (falhou) {
    return (
      <div className="app app--centrado">
        <p className="aviso">{falhou}</p>
      </div>
    );
  }
  if (!exp || !inicial) {
    return (
      <div className="app">
        <div className="esqueleto__topo" />
      </div>
    );
  }
  return <App inicial={inicial} />;
}
