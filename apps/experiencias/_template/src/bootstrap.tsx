import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { App } from "./App";
import { definirExperiencia } from "./lib/api";
import { ligarTelemetria, telemetria } from "./lib/telemetria";
import { TEXTOS } from "./lib/textos";
import { EXP_ID, EXP_VERSION, type Progresso } from "./lib/tipos";

/**
 * Handshake com o hub e primeira leitura do estado — a fiação que TODA
 * experiência precisa, na ordem em que ela acontece:
 *
 * 1. `createExperiencia` troca `exp:ready`/`hub:init` por postMessage e recebe
 *    o token, o estudante e o `config` (fuso, Clarity, amostragem de traces).
 *    Fora do hub ele nunca resolve: abra pela rota `/exp/<id>` ou pela bancada
 *    `/dev-embed?src=http://localhost:<porta>`.
 * 2. O handle vai para o singleton de `lib/api.ts` e liga a telemetria.
 * 3. A primeira leitura de estado. Aqui é o `progresso` genérico da plataforma;
 *    uma missão com módulo próprio na api troca esta linha por
 *    `api.get("/<slug>/sessao")` (molde: exp-08).
 *
 * O `catch` reporta pelo SDK: o boot que falha DEPOIS do handshake tem token e
 * deixa rastro no servidor (ADR-84). Antes do handshake não há token, e o sinal
 * é a ausência do `exp:ready`, que o hub observa.
 */
export function Bootstrap() {
  const [exp, setExp] = useState<ExperienciaHandle | null>(null);
  const [inicial, setInicial] = useState<Progresso | null>(null);
  const [falhou, setFalhou] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      let handle: ExperienciaHandle | null = null;
      try {
        handle = await createExperiencia({ expId: EXP_ID, expVersion: EXP_VERSION });
        definirExperiencia(handle);
        ligarTelemetria(handle);
        const salvo = await handle.progresso.carregar<Progresso>();
        if (!vivo) return;
        setInicial(salvo ?? { passos: 0 });
        setExp(handle);
        telemetria.entrou();
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
    /* Esqueleto do próprio cliente, não um "carregando" genérico: a criança vê
       a moldura que ela espera. Numa missão de clone, é o cromo do app. */
    return (
      <div className="app">
        <div className="esqueleto__topo" />
      </div>
    );
  }

  return <App exp={exp} inicial={inicial} />;
}
