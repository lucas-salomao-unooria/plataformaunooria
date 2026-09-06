import { useEffect, useState } from "react";
import { createExperiencia } from "@edu/sdk";
import { api, codigoDoErro, definirExperiencia } from "./lib/api";
import { ligarTelemetria } from "./lib/telemetria";
import { EXP_ID, EXP_VERSION, type RespostaSessao } from "./lib/tipos";
import { RastroApp } from "./app/rastro-app";

/**
 * Handshake com o hub e primeira leitura do estado.
 *
 * Duas etapas, na ordem: `createExperiencia` (que troca `exp:ready`/`hub:init`
 * por postMessage e recebe o token) e `GET /rastro-boato/sessao`, que devolve o
 * estado, as quatro conversas e os metadados de cada mensagem.
 *
 * **A tela de espera e a de erro falam a língua de um app de verdade.** Nada
 * aqui pode dizer "experiência", "atividade" ou "missão": o estudante acha que
 * abriu um mensageiro, e é essa premissa que a missão mede. Um spinner genérico
 * também não serve — ele denuncia que algo está sendo montado para ele.
 */
export function Bootstrap() {
  const [inicial, setInicial] = useState<RespostaSessao | null>(null);
  const [falhou, setFalhou] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const exp = await createExperiencia({ expId: EXP_ID, expVersion: EXP_VERSION });
        definirExperiencia(exp);
        ligarTelemetria(exp);
        const sessao = await api.get<RespostaSessao>("/rastro-boato/sessao");
        if (vivo) setInicial(sessao);
      } catch (erro) {
        if (!vivo) return;
        setFalhou(
          codigoDoErro(erro) === "rede"
            ? "Conectando… Sem conexão com o servidor. Suas ações serão sincronizadas assim que o sinal voltar."
            : "Estas conversas não estão disponíveis agora.",
        );
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (falhou) {
    return (
      <div className="app app--centrado">
        <p className="aviso-de-rede">{falhou}</p>
      </div>
    );
  }

  if (!inicial) {
    /* Esqueleto do próprio cliente: o cromo do app, sem conteúdo. O estudante
       vê a moldura que ele espera, não um carregando genérico. */
    return (
      <div className="app">
        <div className="esqueleto__topo" />
        <div className="app__corpo" />
      </div>
    );
  }

  return <RastroApp inicial={inicial} />;
}
