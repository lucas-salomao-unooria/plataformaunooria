import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { api, codigoDoErro, definirExperiencia } from "./lib/api";
import { ligarTelemetria } from "./lib/telemetria";
import { EXP_ID, EXP_VERSION, type RespostaSessao } from "./lib/tipos";
import { OEcoApp } from "./app/o-eco-app";

/**
 * Handshake com o hub e primeira leitura do estado.
 *
 * Duas etapas, na ordem: `createExperiencia` (que troca `exp:ready`/`hub:init`
 * por postMessage e recebe o token) e `GET /o-eco-no-grupo/sessao`, que devolve
 * o estado, o conteúdo do grupo e o mapa de mídia.
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
      let exp: ExperienciaHandle | null = null;
      try {
        exp = await createExperiencia({ expId: EXP_ID, expVersion: EXP_VERSION });
        definirExperiencia(exp);
        ligarTelemetria(exp);
        const sessao = await api.get<RespostaSessao>("/o-eco-no-grupo/sessao");
        if (vivo) setInicial(sessao);
      } catch (erro) {
        // O boot que falha DEPOIS do handshake tem token, e por isso pode
        // reportar: era esta a falha que o estudante via como "não deu para
        // abrir agora" e que não deixava rastro nenhum no servidor (ADR-84).
        // Antes do handshake `exp` é null — ali não há token, e o sinal é a
        // ausência de `exp:ready`, que o hub observa.
        exp?.reportarErro(erro);
        if (!vivo) return;
        setFalhou(
          codigoDoErro(erro) === "rede"
            ? "Conectando… Sem conexão com a internet. Suas ações serão sincronizadas assim que o sinal voltar."
            : "Esta conversa não está disponível agora.",
        );
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (falhou) {
    return (
      <div
        className="app"
        style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}
      >
        <p style={{ fontSize: 13, color: "var(--wa-color-text-meta)" }}>{falhou}</p>
      </div>
    );
  }

  if (!inicial) {
    // Esqueleto do próprio cliente: a barra de status e o cromo do chat, sem
    // conteúdo. O estudante vê a moldura do app que ele espera.
    return (
      <div className="app">
        <div style={{ height: 28, background: "var(--wa-color-surface-appbar)" }} />
        <div style={{ height: 56, background: "var(--wa-color-surface-appbar)", opacity: 0.7 }} />
        <div className="app__corpo" />
      </div>
    );
  }

  return <OEcoApp inicial={inicial} />;
}
