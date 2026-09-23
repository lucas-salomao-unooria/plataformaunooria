import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { api, codigoDoErro, definirExperiencia } from "./lib/api";
import { ligarTelemetria } from "./lib/telemetria";
import { ERROS } from "./lib/textos";
import { EXP_ID, EXP_VERSION, type RespostaSessao } from "./lib/tipos";
import { ManifestoApp } from "./app/manifesto-app";

/**
 * Handshake com o hub e primeira leitura do estado.
 *
 * Duas etapas, na ordem: `createExperiencia` (que troca `exp:ready`/`hub:init`
 * por postMessage e recebe o token) e `GET /manifesto-ia/sessao`, que devolve o
 * estado, o pacote da turma e a conversa já reconstituída.
 *
 * **A tela de espera e a de erro falam a língua do terminal.** Nada aqui diz
 * "experiência" ou "missão": quem fala nesta moldura é o sistema da escola, e é
 * o tom dele que a missão está ensinando a criança a auditar.
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
        const sessao = await api.get<RespostaSessao>("/manifesto-ia/sessao");
        if (vivo) setInicial(sessao);
      } catch (erro) {
        // O boot que falha DEPOIS do handshake tem token, e por isso pode
        // reportar: era esta a falha que o estudante via como "não deu para
        // abrir" e que não deixava rastro nenhum no servidor (ADR-84). Antes do
        // handshake `exp` é null — ali não há token, e o sinal é a ausência de
        // `exp:ready`, que o hub observa.
        exp?.reportarErro(erro);
        if (!vivo) return;
        setFalhou(
          codigoDoErro(erro) === "rede"
            ? ERROS.rede
            : "Este canal não está disponível agora.",
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
    /* Esqueleto do próprio cliente: o cromo do assistente, sem conteúdo. O
       estudante vê a moldura que ele espera, não um "carregando" genérico. */
    return (
      <div className="app">
        <div className="esqueleto__topo" />
        <div style={{ flex: 1 }} />
      </div>
    );
  }

  return <ManifestoApp inicial={inicial} />;
}
