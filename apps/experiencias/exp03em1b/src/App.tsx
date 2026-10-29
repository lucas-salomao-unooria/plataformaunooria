import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { api, concluirNaPlataforma, enviarEstado, reportarErro, statusDoErro } from "./lib/api";
import { estadoParaOHub, etapaDoPasso, vistaPadrao, type Vista } from "./lib/regras";
import { telemetria } from "./lib/telemetria";
import { TEXTOS } from "./lib/textos";
import type { Parecer, Publicar, Sessao, SessaoPreparada } from "./lib/tipos";
import { Assistente } from "./telas/Assistente";
import { Compositor } from "./telas/Compositor";
import { Conclusao } from "./telas/Conclusao";
import { Conversas } from "./telas/Conversas";
import { FaixaDeConexao } from "./telas/FaixaDeConexao";
import { Grupo } from "./telas/Grupo";
import { Laudo } from "./telas/Laudo";
import { Pausa } from "./telas/Pausa";
import { Pericia } from "./telas/Pericia";

/** O polling do gate: HTTP curto, nunca WebSocket (ADR-93). É o mesmo `GET sessao`. */
const INTERVALO_DO_GATE_MS = 3000;

type Chamada = () => Promise<Sessao>;

/**
 * O despachante da missão. O PASSO vem do servidor (derivado dos carimbos e
 * do gate da turma); a tela escolhe quem o desenha — e, nas etapas do
 * mensageiro, qual CONVERSA está aberta (`vista`), porque a navegação é a do
 * app: lista, chat do Assistente, grupo da cidade.
 *
 * Toda jogada passa por `executar`: rede caída fica registrada (EVT-U05) e o
 * botão volta; um 409 (a turma andou, a tela ficou velha) relê o estado.
 */
export function App({ inicial }: { inicial: Sessao }) {
  const [estado, setEstado] = useState<Sessao>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [semRede, setSemRede] = useState(false);
  const [vista, setVista] = useState<Vista>(() => vistaPadrao(inicial.passo));
  /** O que ESTA aba acabou de publicar: o feed chega em sequência, e a errata aparece no grupo antes do laudo. */
  const [recente, setRecente] = useState<"inicial" | "errata" | null>(null);
  const [compositorAberto, setCompositorAberto] = useState(inicial.passo === "compositor");
  const [errataAberta, setErrataAberta] = useState(false);
  const retomada = useRef(inicial.passo !== "abertura");
  const passoAnterior = useRef(inicial.passo);
  const ultimoParaOHub = useRef<string | null>(null);

  const reler = useCallback(async () => {
    try {
      setEstado(await api.sessao());
      setSemRede(false);
    } catch (erro) {
      if (statusDoErro(erro) === null) setSemRede(true);
      else reportarErro(erro);
    }
  }, []);

  const executar = useCallback(
    async (chamada: Chamada): Promise<Sessao | null> => {
      setOcupado(true);
      try {
        const novo = await chamada();
        setEstado(novo);
        setSemRede(false);
        return novo;
      } catch (erro) {
        const status = statusDoErro(erro);
        if (status === null) setSemRede(true);
        else if (status === 409) await reler();
        else reportarErro(erro);
        return null;
      } finally {
        setOcupado(false);
      }
    },
    [reler],
  );

  /* O gate (a pausa, a retomada) e o pacote posto no ar: relê a cada 3 s. */
  useEffect(() => {
    const id = window.setInterval(() => {
      void api
        .sessao()
        .then((nova) => {
          setSemRede(false);
          setEstado((atual) =>
            nova.passo !== atual.passo ||
            nova.pausada !== atual.pausada ||
            nova.preparada !== atual.preparada ||
            nova.etapaDaTurma !== atual.etapaDaTurma ||
            nova.atividade?.rodada !== atual.atividade?.rodada
              ? nova
              : atual,
          );
        })
        .catch((erro: unknown) => {
          if (statusDoErro(erro) === null) setSemRede(true);
        });
    }, INTERVALO_DO_GATE_MS);
    return () => window.clearInterval(id);
  }, []);

  /* EVT-U02 a cada etapa nova; e a conclusão fecha a missão na plataforma (uma vez, no gesto). */
  useEffect(() => {
    if (passoAnterior.current === estado.passo) return;
    const antes = passoAnterior.current;
    passoAnterior.current = estado.passo;
    telemetria.etapa(etapaDoPasso(estado.passo));
    if (estado.passo === "compositor") setCompositorAberto(true);
    if (estado.passo === "concluida" && antes !== "concluida") {
      concluirNaPlataforma();
      telemetria.concluiu();
    }
  }, [estado.passo]);

  /* EVT-U05: uma vez por queda de rede. */
  useEffect(() => {
    if (semRede) telemetria.erro("sem-sinal", etapaDoPasso(estado.passo));
    // A etapa é contexto, não gatilho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semRede]);

  /* A instrução ao lado do aparelho, publicada só quando muda (o polling não a repete). */
  const paraOHub = JSON.stringify(estadoParaOHub(estado));
  useEffect(() => {
    if (ultimoParaOHub.current === paraOHub) return;
    ultimoParaOHub.current = paraOHub;
    enviarEstado(JSON.parse(paraOHub) as Record<string, unknown>);
  }, [paraOHub]);

  // ─────────────────────────────────────────────────────────── os gestos

  const abrirAssistente = () => {
    setVista("assistente");
    if (estado.passo === "abertura") void executar(() => api.marco("chat_aberto"));
  };
  const marcar = useCallback((marco: "anexo_aberto" | "nudge_e2") => void executar(() => api.marco(marco)), [executar]);
  const abrirCompositor = () => {
    if (estado.passo === "dados") void executar(() => api.marco("compositor_aberto"));
    setCompositorAberto(true);
  };
  const publicar = async (corpo: Publicar, modo: "inicial" | "errata"): Promise<boolean> => {
    const novo = await executar(() => (modo === "inicial" ? api.publicar(corpo) : api.publicarErrata(corpo)));
    if (!novo) return false;
    if (modo === "inicial") telemetria.publicou(corpo);
    else telemetria.errata(corpo);
    setCompositorAberto(false);
    setErrataAberta(false);
    setRecente(modo);
    setVista("grupo");
    return true;
  };
  const pularErrata = () => {
    setErrataAberta(false);
    telemetria.pulouErrata();
    void executar(api.pularErrata);
  };
  const irParaPericia = () => void executar(() => api.marco("pericia_aberta"));
  const emitir = (p: Parecer) => {
    telemetria.parecer(p);
    void executar(() => api.parecer(p));
  };
  const pularPericia = () => {
    telemetria.pulouPericia();
    void executar(api.pularPericia);
  };

  // ─────────────────────────────────────────────────────────── a tela

  const s = estado;
  let tela: ReactElement;
  let pausaNoGrupo = false;
  let doClone = true;
  const verErrataNoGrupo = s.passo === "laudo" && recente === "errata" && vista === "grupo";
  if (s.preparada && s.conteudo && s.passo === "concluida") {
    doClone = false;
    tela = <Conclusao sessao={s as SessaoPreparada} />;
  } else if (s.preparada && s.conteudo && s.passo === "pericia") {
    tela = <Pericia sessao={s as SessaoPreparada} ocupado={ocupado} aoEmitir={emitir} aoPular={pularPericia} />;
  } else if (s.preparada && s.conteudo && s.passo === "laudo" && !verErrataNoGrupo) {
    doClone = false;
    tela = <Laudo sessao={s as SessaoPreparada} ocupado={ocupado} aoAvancar={irParaPericia} />;
  } else if (!s.preparada || !s.conteudo || s.passo === "abertura" || vista === "lista") {
    tela = <Conversas sessao={s} aoAbrirAssistente={abrirAssistente} aoAbrirGrupo={() => s.publicacoes.inicial && setVista("grupo")} />;
  } else if (vista === "grupo" && s.publicacoes.inicial) {
    const sp = s as SessaoPreparada;
    pausaNoGrupo = true;
    const acao =
      s.passo === "errata"
        ? { rotulo: TEXTOS.grupo.abrirAssistente, aoTocar: () => setVista("assistente") }
        : verErrataNoGrupo
          ? { rotulo: TEXTOS.grupo.irAoLaudo, aoTocar: () => setRecente(null) }
          : null;
    tela = <Grupo sessao={sp} animar={recente === "inicial"} pausada={s.pausada} aoVoltar={() => setVista("lista")} acao={acao} />;
  } else {
    const sp = s as SessaoPreparada;
    tela = (
      <>
        <Assistente
          sessao={sp}
          retomada={retomada.current}
          ocupado={ocupado}
          aoVoltar={() => setVista("lista")}
          aoMarcar={marcar}
          aoAbrirCompositor={abrirCompositor}
          aoAbrirErrata={() => setErrataAberta(true)}
          aoPularErrata={pularErrata}
        />
        {s.passo === "compositor" && (
          <Compositor
            key="inicial"
            modo="inicial"
            sessao={sp}
            aberto={compositorAberto}
            ocupado={ocupado}
            aoFechar={() => setCompositorAberto(false)}
            aoPublicar={(c) => publicar(c, "inicial")}
            aoPularErrata={pularErrata}
          />
        )}
        {s.passo === "errata" && (
          <Compositor
            key="errata"
            modo="errata"
            sessao={sp}
            aberto={errataAberta}
            ocupado={ocupado}
            aoFechar={() => setErrataAberta(false)}
            aoPublicar={(c) => publicar(c, "errata")}
            aoPularErrata={pularErrata}
          />
        )}
      </>
    );
  }

  /* A pausa: no grupo é o rodapé (rolagem livre); em qualquer outra tela, camada com a tela `inert`. */
  const camada = s.pausada && !pausaNoGrupo;
  return (
    <div className="raiz" data-passo={s.passo} data-vista={vista}>
      <div className="raiz__tela" inert={camada}>
        {tela}
      </div>
      {semRede && doClone && <FaixaDeConexao />}
      {camada && <Pausa texto={s.textos.chat.pausa} />}
    </div>
  );
}
