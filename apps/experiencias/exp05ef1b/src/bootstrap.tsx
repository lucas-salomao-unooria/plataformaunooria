import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { api, codigoDoErro, definirExperiencia } from "./lib/api";
import { ligarTelemetria } from "./lib/telemetria";
import { TEXTOS } from "./lib/textos";
import { EXP_ID, EXP_VERSION, type RespostaSessao } from "./lib/tipos";
import { QuemMandouApp } from "./app/quem-mandou-app";

/**
 * Handshake com o hub e primeira leitura do estado.
 *
 * Duas etapas, nesta ordem: `createExperiencia` (que troca `exp:ready`/
 * `hub:init` por postMessage e recebe o token) e `GET /quem-mandou-isso/sessao`,
 * que devolve o estado do estudante, o lote homologado da turma (ou `null`, e
 * aí a missão está esperando a professora) e as constantes da missão.
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
        const sessao = await api.get<RespostaSessao>("/quem-mandou-isso/sessao");
        if (vivo) setInicial(sessao);
      } catch (erro) {
        // O boot que falha DEPOIS do handshake tem token, e por isso pode
        // reportar: era esta a falha que o estudante via como "não deu para
        // abrir agora" e que não deixava rastro nenhum no servidor (ADR-84).
        // Antes do handshake `exp` é null — ali não há token, e o sinal é a
        // ausência de `exp:ready`, que o hub observa.
        exp?.reportarErro(erro);
        if (!vivo) return;
        const codigo = codigoDoErro(erro);
        setFalhou(
          codigo === "rede"
            ? TEXTOS.erros.rede
            : codigo === "missao-nao-liberada"
              ? TEXTOS.erros.naoLiberada
              : TEXTOS.erros.generico,
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
       vê a moldura que ele espera, não um "carregando" genérico. */
    return (
      <div className="app">
        <div className="esqueleto__topo" />
        <div className="app__corpo" />
      </div>
    );
  }

  return <QuemMandouApp inicial={inicial} />;
}
