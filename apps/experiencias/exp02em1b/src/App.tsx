import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { api, reportarErro, statusDoErro } from "./lib/api";
import { telemetria } from "./lib/telemetria";
import { TEXTOS } from "./lib/textos";
import type { Estado, Sessao } from "./lib/tipos";
import { Abertura } from "./telas/Abertura";
import { Conclusao } from "./telas/Conclusao";
import { Conversa } from "./telas/Conversa";
import { Explicar } from "./telas/Explicar";
import { Feed } from "./telas/Feed";
import { Relogio } from "./telas/Relogio";

/** O polling da fase da turma: HTTP curto, nunca WebSocket (ADR-93). */
const INTERVALO_DO_GATE_MS = 3000;

export type Executar = (chamada: () => Promise<Estado>) => Promise<Estado | null>;

/**
 * O despachante da missão. O PASSO vem do servidor (derivado dos carimbos e da
 * fase da turma); a tela só escolhe quem o desenha. Toda jogada passa por
 * `executar`: rede caída acende o banner da ficção, e um 409 (a turma andou, a
 * tela ficou velha) relê o estado inteiro.
 */
export function App({ inicial }: { inicial: Sessao }) {
  const [sessao, setSessao] = useState<Sessao>(inicial);
  const [estado, setEstado] = useState<Estado>(inicial);
  const [semRede, setSemRede] = useState(false);
  /* O relógio acelerado toca UMA vez, logo depois do Publicar nesta aba — um F5 no feed não o repete. */
  const [relogio, setRelogio] = useState(false);
  const passoAnterior = useRef(inicial.passo);

  const reler = useCallback(async () => {
    try {
      const nova = await api.sessao();
      setSessao(nova);
      setEstado(nova);
      setSemRede(false);
    } catch (erro) {
      if (statusDoErro(erro) === null) setSemRede(true);
      else reportarErro(erro);
    }
  }, []);

  const executar: Executar = useCallback(
    async (chamada) => {
      try {
        const novo = await chamada();
        setEstado(novo);
        setSemRede(false);
        return novo;
      } catch (erro) {
        const status = statusDoErro(erro);
        if (status === null) {
          setSemRede(true);
          telemetria.rede();
        } else if (status === 409) {
          await reler();
        } else {
          reportarErro(erro);
        }
        return null;
      }
    },
    [reler],
  );

  /* O gate: a fase da turma (a pausa, a Etapa 5) e o pacote posto no ar. */
  useEffect(() => {
    const id = window.setInterval(() => {
      void api
        .gate()
        .then((g) => {
          setSemRede(false);
          if (g.preparada !== estado.preparada || g.passo !== estado.passo || g.pausada !== estado.pausada) void reler();
        })
        .catch((erro: unknown) => {
          if (statusDoErro(erro) === null) setSemRede(true);
        });
    }, INTERVALO_DO_GATE_MS);
    return () => window.clearInterval(id);
  }, [estado.preparada, estado.passo, estado.pausada, reler]);

  /* A Etapa 5 liberada: entrar no Explicar FECHA o feed no servidor (as marcas do que não foi feito). */
  useEffect(() => {
    if (estado.passo === "explicar" && !estado.explicar && !estado.pausada) void executar(api.explicar);
  }, [estado.passo, estado.explicar, estado.pausada, executar]);

  useEffect(() => {
    if (passoAnterior.current === estado.passo) return;
    if (passoAnterior.current === "conversa" && estado.passo === "feed") setRelogio(true);
    passoAnterior.current = estado.passo;
    telemetria.etapa(estado.passo);
  }, [estado.passo]);

  let tela: ReactElement;
  if (!estado.preparada || estado.passo === "abertura") {
    tela = <Abertura preparada={estado.preparada} onIniciar={() => void executar(api.entrar)} />;
  } else if (estado.passo === "conversa") {
    tela = <Conversa estado={estado} sessao={sessao} executar={executar} />;
  } else if (estado.passo === "feed") {
    tela = relogio ? <Relogio onFim={() => setRelogio(false)} /> : <Feed estado={estado} executar={executar} />;
  } else if (estado.passo === "explicar") {
    tela = <Explicar estado={estado} textos={sessao.textos.explicar} executar={executar} />;
  } else {
    tela = <Conclusao />;
  }

  return (
    <div className="app">
      {semRede && (
        <p className="faixa-rede" role="status">
          {TEXTOS.rede}
        </p>
      )}
      {tela}
      {estado.pausada && (
        <div className="pausa" role="alertdialog" aria-live="assertive" aria-label={TEXTOS.pausa}>
          <p className="pausa__texto">{TEXTOS.pausa}</p>
        </div>
      )}
    </div>
  );
}
