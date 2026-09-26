import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { StatusBar, TopBar } from "@edu/ui/ds-whatsapp";
import { api, classificar, definirExperiencia } from "./lib/api";
import { HORA_DO_APARELHO, INTERVALO_DO_GATE_MS } from "./lib/regras";
import { ligarTelemetria } from "./lib/telemetria";
import { TEXTOS } from "./lib/textos";
import { EXP_ID, EXP_VERSION, type Sessao } from "./lib/tipos";
import { QuemMandouApp } from "./app/quem-mandou-app";

/**
 * Handshake com o hub e primeira leitura do estado.
 *
 * Duas etapas, nesta ordem: `createExperiencia` (troca `exp:ready`/`hub:init`
 * por postMessage e recebe o token) e `GET /quem-mandou-isso/sessao` — o
 * estado, o pacote SEM gabarito (ou `null`: a missão está esperando o
 * professor), as falas que dependem do servidor, as opções e os limites.
 *
 * **A espera e a falha falam a língua de um app de verdade.** Nada aqui diz
 * "experiência", "missão" ou "erro 500": o estudante acha que abriu um
 * mensageiro, e é essa premissa que a missão mede. Sem rede, o app faz o que o
 * app real faz — mostra "Conectando..." no topo e tenta de novo sozinho.
 */
export function Bootstrap() {
  const [inicial, setInicial] = useState<Sessao | null>(null);
  const [falha, setFalha] = useState<"rede" | "nao-liberada" | "indisponivel" | null>(null);

  useEffect(() => {
    let vivo = true;
    let espera: number | undefined;
    let exp: ExperienciaHandle | null = null;

    async function lerSessao() {
      try {
        const sessao = await api.get<Sessao>("/quem-mandou-isso/sessao");
        if (vivo) setInicial(sessao);
      } catch (erro) {
        if (!vivo) return;
        const classe = classificar(erro);
        if (classe === "rede") {
          setFalha("rede");
          espera = window.setTimeout(() => void lerSessao(), INTERVALO_DO_GATE_MS);
          return;
        }
        // Depois do handshake há token: a falha deixa rastro no servidor
        // em vez de morrer no console de um Chromebook (ADR-84).
        if (classe !== "nao-liberada") exp?.reportarErro(erro);
        setFalha(classe === "nao-liberada" ? "nao-liberada" : "indisponivel");
      }
    }

    void (async () => {
      try {
        exp = await createExperiencia({ expId: EXP_ID, expVersion: EXP_VERSION });
        definirExperiencia(exp);
        ligarTelemetria(exp);
      } catch {
        // Antes do handshake não há token nem para onde reportar: o sinal é a
        // ausência de `exp:ready`, que o hub observa.
        if (vivo) setFalha("indisponivel");
        return;
      }
      await lerSessao();
    })();

    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, []);

  if (inicial) return <QuemMandouApp inicial={inicial} />;

  /* Esqueleto do próprio cliente: o cromo do app, sem conteúdo — a moldura que
     o estudante espera, não um "carregando" genérico. */
  return (
    <div className="raiz">
      <div className="app">
        <StatusBar time={HORA_DO_APARELHO} batteryLabel="85%" batteryLevel={0.85} showAlert={false} />
        <TopBar
          title={falha === "rede" ? TEXTOS.erros.conectando : TEXTOS.lista.titulo}
          showSearch={false}
          showMenu={false}
        />
        <div className="app__corpo app--centrado">
          {falha === "nao-liberada" && <p className="aviso-de-rede">{TEXTOS.erros.naoLiberada}</p>}
          {falha === "indisponivel" && <p className="aviso-de-rede">{TEXTOS.erros.indisponivel}</p>}
        </div>
      </div>
    </div>
  );
}
