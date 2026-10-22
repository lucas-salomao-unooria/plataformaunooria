import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { Composer } from "@edu/ui/ds-unooriaai";
import { api, codigoDoErro, definirExperiencia } from "./lib/api";
import { ligarTelemetria } from "./lib/telemetria";
import { EXP_ID, EXP_VERSION, type RespostaSessao } from "./lib/tipos";
import { MissaoApp } from "./app/unoogpt-app";

/**
 * Handshake com o hub e primeira leitura do estado.
 *
 * Duas etapas, na ordem: `createExperiencia` (que troca `exp:ready`/`hub:init`
 * por postMessage e recebe o token) e `GET /unoogpt/sessao`, que cria a partida
 * na primeira visita.
 *
 * A tela de espera e a de erro falam a língua de um app de verdade. Nada aqui
 * pode dizer "experiência", "atividade" ou "exercício": o estudante acha que abriu
 * um assistente, e é essa premissa que a missão mede.
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
        const sessao = await api.get<RespostaSessao>("/unoogpt/sessao");
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
            ? "Não foi possível conectar agora. Tente recarregar a página."
            : "Esta sala de operações não está disponível.",
        );
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (falhou) {
    return (
      <div className="flex h-full items-center justify-center bg-uai-tela p-8">
        <p className="max-w-sm text-center text-sm text-uai-tinta-2">{falhou}</p>
      </div>
    );
  }

  if (!inicial) {
    // Esqueleto do cliente, não spinner genérico: o estudante vê a moldura do app
    // que ele espera, com o campo desabilitado, e não uma tela de carregamento
    // que denuncia que algo está sendo montado para ele.
    return (
      <div className="flex h-full flex-col bg-uai-tela">
        <div className="flex flex-1 items-end justify-center p-6">
          <div className="w-full max-w-2xl opacity-40">
            <Composer hideLeadingActions placeholder="" disabled />
          </div>
        </div>
      </div>
    );
  }

  return <MissaoApp inicial={inicial} />;
}
