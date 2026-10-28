import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { api, enviarEstado, reportarErro, statusDoErro } from "./lib/api";
import { estadoParaOHub, etapaDoPasso } from "./lib/regras";
import { telemetria } from "./lib/telemetria";
import type { Estado, Sessao } from "./lib/tipos";
import { Abertura } from "./telas/Abertura";
import { Conclusao } from "./telas/Conclusao";
import { Conversa } from "./telas/Conversa";
import { Explicar } from "./telas/Explicar";
import { Feed } from "./telas/Feed";
import { Pausa } from "./telas/Pausa";
import { Relogio } from "./telas/Relogio";

/** O polling da fase da turma: HTTP curto, nunca WebSocket (ADR-93). */
const INTERVALO_DO_GATE_MS = 3000;

export type Executar = (chamada: () => Promise<Estado>) => Promise<Estado | null>;

/**
 * O despachante da missão. O PASSO vem do servidor (derivado dos carimbos e da
 * fase da turma); a tela só escolhe quem o desenha. Toda jogada passa por
 * `executar`: rede caída acende o banner de conexão da tela (cada seção tem o
 * seu), e um 409 (a turma andou, a tela ficou velha) relê o estado inteiro.
 */
export function App({ inicial }: { inicial: Sessao }) {
  const [sessao, setSessao] = useState<Sessao>(inicial);
  const [estado, setEstado] = useState<Estado>(inicial);
  const [semRede, setSemRede] = useState(false);
  /* O relógio acelerado toca UMA vez, logo depois do Publicar nesta aba — um F5 no feed não o repete. */
  const [relogio, setRelogio] = useState(false);
  const passoAnterior = useRef(inicial.passo);
  const ultimoParaOHub = useRef<string | null>(null);
  const fimDoRelogio = useCallback(() => setRelogio(false), []);

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
    telemetria.etapa(etapaDoPasso(estado.passo));
  }, [estado.passo]);

  /* EVT-U05: uma vez por aparição do banner de conexão. */
  useEffect(() => {
    if (semRede) telemetria.erro("rede-oscilando", etapaDoPasso(estado.passo));
    // A etapa é contexto, não gatilho: o banner que continua aceso não reenvia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semRede]);

  /* O TC-10 do hub, FORA do aparelho: publicado só quando muda (o polling não o repete). */
  const paraOHub = JSON.stringify(estadoParaOHub(estado, relogio));
  useEffect(() => {
    if (ultimoParaOHub.current === paraOHub) return;
    ultimoParaOHub.current = paraOHub;
    enviarEstado(JSON.parse(paraOHub) as Record<string, unknown>);
  }, [paraOHub]);

  let tela: ReactElement;
  if (!estado.preparada || estado.passo === "abertura") {
    tela = (
      <Abertura
        preparada={estado.preparada}
        pauta={sessao.textos.pauta}
        semRede={semRede}
        onAbrir={() => void executar(api.entrar)}
      />
    );
  } else if (estado.passo === "conversa") {
    tela = <Conversa estado={estado} textos={sessao.textos} semRede={semRede} executar={executar} />;
  } else if (estado.passo === "feed") {
    tela = relogio ? <Relogio onFim={fimDoRelogio} /> :<Feed estado={estado} semRede={semRede} executar={executar} />;
  } else if (estado.passo === "explicar") {
    tela = <Explicar estado={estado} textos={sessao.textos.explicar} semRede={semRede} executar={executar} />;
  } else {
    tela = <Conclusao semRede={semRede} />;
  }

  return (
    <div className="app">
      {/* `inert`: a pausa do professor bloqueia também o teclado, não só o toque. */}
      <div className="app__tela" inert={estado.pausada}>
        {tela}
      </div>
      {estado.pausada && <Pausa />}
    </div>
  );
}
