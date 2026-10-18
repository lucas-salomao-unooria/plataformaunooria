import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api, concluir, enviarEstado, reportarErro, tipoDaFalha } from "../lib/api";
import { gravarMemoria, lerMemoria } from "../lib/memoria";
import {
  INTERVALO_DO_GATE_MS,
  alternar,
  codePoints,
  etapaAntes,
  gateMudou,
  normalizarLegenda,
  precisaDoMural,
  salvosValidos,
  segundosDesde,
  selecionados,
  telaDoPasso,
  TEMPO_DE_FEED_MAX_S,
} from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { E1 } from "../lib/textos";
import type {
  Estado,
  PassoPedido,
  PostPublico,
  RespostaGate,
  RespostaMural,
  RespostaSessao,
} from "../lib/tipos";
import { Avisos } from "./avisos";
import { AcaoDaDm, BalaoDaAmara, DmDaAmara } from "./clone/dm-da-amara";
import { Marcacao, type ResultadoDoPorque } from "./clone/marcacao";
import { Espera } from "./clone/espera";
import { Feed } from "./clone/feed";
import { Mural } from "./clone/mural";
import { Salvos, type ResultadoDaPublicacao } from "./clone/salvos";
import type { Conexao } from "./conexao";
import { Concluida, Indisponivel, Reflexao, ReflexaoEnviada } from "./escola/telas-da-escola";
import { preguicoso } from "./preguica";

/** A explicação e a copy dela (a lente de cada veículo) só descem na Etapa 5. */
const Explicar = preguicoso(() => import("./clone/explicar"));

/**
 * A casca da missão: uma máquina de telas sobre o que o SERVIDOR diz.
 *
 * Quatro regras valem para tudo aqui:
 *
 * 1. **`sessao.passo`, nunca `passoDoEstudante`.** O primeiro já vem
 *    reconciliado com a etapa da turma (`regras/passos.ts#passoEfetivo` da
 *    api); o segundo é o cru. Usar o cru faria a tela discordar do servidor no
 *    instante em que a professora abre o Mural.
 * 2. **A tela só anda quando a api responde.** Nenhum toque troca a tela
 *    otimisticamente: o passo novo é o que o `POST` devolve. É o que torna o
 *    latch à prova de rede ruim — ele só existe quando o servidor o confirmou.
 * 3. **Toda chamada passa por `conexao.executar`**, que repete a de rede e a de
 *    sessão com o aviso diegético aceso. As exceções são o polling do gate (que
 *    já se repete a cada 5 s).
 * 4. **409 e 400 relêem a sessão.** O relógio da turma andou, a rodada mudou,
 *    o latch já estava fechado: tentar de novo daria o mesmo erro. Quem resolve
 *    é ler de novo o que o servidor diz.
 */
export function SelecaoApp({ inicial, conexao }: { inicial: RespostaSessao; conexao: Conexao }) {
  const [sessao, setSessao] = useState<RespostaSessao>(inicial);
  const [mural, setMural] = useState<RespostaMural | null>(null);
  const [bloqueada, setBloqueada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  /** A legenda em edição. Só na memória: texto de menor não vai ao `sessionStorage`. */
  const [legenda, setLegenda] = useState("");
  /** A reflexão acabou de ir: mostra a confirmação antes da tela final (ADR-170). */
  const [recemEnviada, setRecemEnviada] = useState(false);
  const { executar, sinalizar } = conexao;

  /* A sessão mais recente para quem roda FORA do render (o polling, o `aplicar`
     chamado depois de um `await`). */
  const sessaoRef = useRef(sessao);
  useLayoutEffect(() => {
    sessaoRef.current = sessao;
  }, [sessao]);

  // ───────────────────────────────────────── os salvos (memória de F5)

  const idsDaCobertura = useMemo(() => new Set(sessao.cobertura.posts.map((p) => p.id)), [sessao.cobertura.posts]);
  const [salvos, setSalvos] = useState<string[]>(() => salvosValidos(lerMemoria(inicial.sessaoId).salvos, idsDaCobertura));
  const [desmarcados, setDesmarcados] = useState<ReadonlySet<string>>(
    () => new Set(lerMemoria(inicial.sessaoId).desmarcados),
  );
  const [sessaoDosSalvos, setSessaoDosSalvos] = useState(inicial.sessaoId);
  /* Sessão nova ("Zerar a turma", tema novo): os salvos da rodada anterior não
     valem, e a memória desta sessão é outra. Reset DURANTE o render, o padrão
     do React para estado derivado — num efeito, um quadro com os salvos velhos
     chegaria à tela. */
  if (sessaoDosSalvos !== sessao.sessaoId) {
    const memoria = lerMemoria(sessao.sessaoId);
    setSessaoDosSalvos(sessao.sessaoId);
    setSalvos(salvosValidos(memoria.salvos, idsDaCobertura));
    setDesmarcados(new Set(memoria.desmarcados));
    setLegenda("");
    setMural(null);
  }

  const selecao = useMemo(() => selecionados(salvos, desmarcados), [salvos, desmarcados]);

  const porId = useMemo(
    () => new Map<string, PostPublico>(sessao.cobertura.posts.map((p) => [p.id, p])),
    [sessao.cobertura.posts],
  );

  // ─────────────────────────────────────────── ler e aplicar o servidor

  const recarregar = useCallback(async () => {
    try {
      const nova = await executar(() => api.get<RespostaSessao>("/a-selecao/sessao"));
      setSessao(nova);
    } catch (erro) {
      if (tipoDaFalha(erro) === "bloqueada") setBloqueada(true);
      else reportarErro(erro);
    }
  }, [executar]);

  /** O estado que uma rota devolveu. Sessão OUTRA = a cobertura na tela é velha: relê tudo. */
  const aplicar = useCallback(
    (estado: Estado) => {
      if (estado.sessaoId !== sessaoRef.current.sessaoId) {
        void recarregar();
        return;
      }
      setSessao((atual) => ({ ...atual, ...estado }));
    },
    [recarregar],
  );

  const tratarFalha = useCallback(
    (erro: unknown) => {
      const tipo = tipoDaFalha(erro);
      if (tipo === "bloqueada") {
        setBloqueada(true);
        return;
      }
      if (tipo === "invalida") reportarErro(erro);
      if (tipo === "conflito" || tipo === "invalida") {
        void recarregar();
        return;
      }
      reportarErro(erro);
    },
    [recarregar],
  );

  // ────────────────────────────────────────────── efeitos da casca

  // O chrome opcional do hub acompanha o passo (`exp:estado`).
  useEffect(() => {
    enviarEstado({ passo: sessao.passo });
    if (sessao.passo === "publicado") telemetria.esperou();
  }, [sessao.passo]);

  /* O Mural: lido ao entrar e relido quando a etapa da sessão passa à frente da
     do Mural na tela (a revelação das fichas). "Passa à frente", e não "é
     diferente": se o Mural volta com uma etapa ADIANTE da sessão (a professora
     clicou entre as duas leituras), quem alcança é o polling — comparar por
     diferença releria o Mural em laço até lá. */
  const etapaDoMural = mural?.etapa ?? null;
  useEffect(() => {
    if (!precisaDoMural(sessao.passo)) return;
    if (etapaDoMural !== null && !etapaAntes(etapaDoMural, sessao.etapa)) return;
    let vivo = true;
    void (async () => {
      try {
        const m = await executar(() => api.get<RespostaMural>("/a-selecao/mural"));
        if (!vivo) return;
        if (etapaDoMural === null) telemetria.viuOMural(m.par.virtual);
        setMural(m);
      } catch (erro) {
        if (vivo) tratarFalha(erro);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [sessao.passo, sessao.etapa, etapaDoMural, executar, tratarFalha]);

  /**
   * O polling do gate da turma (ADR-93: HTTP de 5 s, nunca WebSocket) — SÓ
   * enquanto a criança espera a professora (a espera, o Mural, as fichas).
   * Antes de publicar, a etapa não a toca; da explicação em diante, o passo é
   * dela. Bater na api fora disso seria trabalho para ninguém, trinta vezes.
   *
   * A falha é silenciosa na primeira vez (o SDK já reenviou o GET uma vez); a
   * partir da segunda seguida, o aviso de conexão acende, e apaga no primeiro
   * sucesso.
   */
  useEffect(() => {
    if (!sessao.aguardandoOProfessor) return;
    let falhas = 0;
    const relogio = window.setInterval(() => {
      void (async () => {
        try {
          const gate = await api.get<RespostaGate>("/a-selecao/gate");
          if (falhas >= 2) sinalizar(null);
          falhas = 0;
          if (!gateMudou(sessaoRef.current, gate)) return;
          const nova = await api.get<RespostaSessao>("/a-selecao/sessao");
          setSessao(nova);
        } catch (erro) {
          const tipo = tipoDaFalha(erro);
          if (tipo === "bloqueada") {
            setBloqueada(true);
            return;
          }
          falhas += 1;
          if (falhas >= 2 && (tipo === "rede" || tipo === "sessao")) sinalizar(tipo);
        }
      })();
    }, INTERVALO_DO_GATE_MS);
    return () => window.clearInterval(relogio);
  }, [sessao.aguardandoOProfessor, sinalizar]);

  // ─────────────────────────────────────────── o tempo de feed

  const tela = telaDoPasso(sessao.passo);
  const entrouNoFeedEm = useRef<number | null>(null);
  useEffect(() => {
    if (tela === "feed") entrouNoFeedEm.current = Date.now();
  }, [tela]);

  /** Fecha a visita ao feed e devolve o total acumulado desta sessão (indicativo). */
  function fecharTempoDoFeed(): number {
    const anterior = lerMemoria(sessao.sessaoId).tempoFeedS;
    const desta = entrouNoFeedEm.current === null ? 0 : segundosDesde(entrouNoFeedEm.current, Date.now());
    entrouNoFeedEm.current = null;
    const total = Math.min(TEMPO_DE_FEED_MAX_S, anterior + desta);
    gravarMemoria(sessao.sessaoId, { tempoFeedS: total });
    return total;
  }

  // ─────────────────────────────────────────────── as ações

  const pedirPasso = useCallback(
    async (para: PassoPedido, tempoFeedS?: number) => {
      setOcupado(true);
      try {
        const corpo = tempoFeedS === undefined ? { para } : { para, tempoFeedS };
        aplicar(await executar(() => api.post<Estado>("/a-selecao/passo", corpo)));
      } catch (erro) {
        tratarFalha(erro);
      } finally {
        setOcupado(false);
      }
    },
    [aplicar, executar, tratarFalha],
  );

  function salvar(postId: string) {
    const jaSalvo = salvos.includes(postId);
    const novos = alternar(salvos, postId);
    const novosDesmarcados = new Set(desmarcados);
    novosDesmarcados.delete(postId);
    setSalvos(novos);
    setDesmarcados(novosDesmarcados);
    gravarMemoria(sessao.sessaoId, { salvos: novos, desmarcados: [...novosDesmarcados] });
    if (jaSalvo) telemetria.desfezSalvar(postId, novos.length);
    else telemetria.salvou(postId, novos.length);
  }

  function alternarSelecao(postId: string) {
    const novos = new Set(desmarcados);
    const estavaSelecionado = !novos.has(postId);
    if (estavaSelecionado) novos.add(postId);
    else novos.delete(postId);
    setDesmarcados(novos);
    gravarMemoria(sessao.sessaoId, { desmarcados: [...novos] });
    const total = selecionados(salvos, novos).length;
    if (estavaSelecionado) telemetria.podou(postId, total);
    else telemetria.remarcou(postId, total);
  }

  function irParaSalvos() {
    const tempo = fecharTempoDoFeed();
    telemetria.foiParaSalvos(salvos.length, tempo);
    void pedirPasso("salvos", tempo);
  }

  async function publicar(): Promise<ResultadoDaPublicacao> {
    const texto = normalizarLegenda(legenda);
    const tresPosts = [...selecao];
    setOcupado(true);
    try {
      const estado = await executar(() =>
        api.post<Estado>("/a-selecao/decisao", {
          selecao: tresPosts,
          legenda: texto,
          /* A PODA (ADR-170): quantos salvos saíram antes de publicar. Indicador
             para o professor, nunca nível. */
          podados: Math.min(9, Math.max(0, salvos.length - tresPosts.length)),
        }),
      );
      telemetria.publicou(codePoints(texto));
      aplicar(estado);
      setLegenda("");
      return "publicada";
    } catch (erro) {
      if (tipoDaFalha(erro) === "recusada") {
        telemetria.legendaRecusada();
        return "recusada";
      }
      tratarFalha(erro);
      return "outra";
    } finally {
      setOcupado(false);
    }
  }

  async function enviarReflexao(texto: string) {
    setOcupado(true);
    try {
      const estado = await executar(() => api.post<Estado>("/a-selecao/reflexao", { texto }));
      telemetria.enviouReflexao(codePoints(texto));
      setRecemEnviada(true);
      aplicar(estado);
      /* Desde a ADR-170 a reflexão ENCERRA a missão (o Canal B saiu): a api já
         devolve o `fim`, e o hub recebe a conclusão aqui. Sem `score`: o nível
         das habilidades é do servidor, e nenhum número aparece em tela. */
      telemetria.concluiu();
      concluir({ publicou: estado.publicada, reflexao: true });
    } catch (erro) {
      tratarFalha(erro);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * A sessão de ANTES da ADR-170, parada em `enquetes` (o passo do Canal B,
   * que saiu): a tela a leva ao fim sozinha, pelo `POST concluir` idempotente.
   */
  const concluindoAntiga = useRef(false);
  useEffect(() => {
    if (sessao.passo !== "enquetes" || concluindoAntiga.current) return;
    concluindoAntiga.current = true;
    void (async () => {
      try {
        aplicar(await executar(() => api.post<Estado>("/a-selecao/concluir")));
        telemetria.concluiu();
        concluir({ publicou: true, reflexao: true });
      } catch (erro) {
        tratarFalha(erro);
      }
    })();
  }, [sessao.passo, aplicar, executar, tratarFalha]);

  /** A marcação do post do colega (E4-ALU-01B): grava ao tocar, e a última vale. */
  async function marcar(escolha: { postId: string } | { nenhum: true }) {
    setOcupado(true);
    try {
      aplicar(await executar(() => api.post<Estado>("/a-selecao/marcacao", escolha)));
      telemetria.marcou("postId" in escolha ? "post" : "nenhum");
    } catch (erro) {
      tratarFalha(erro);
    } finally {
      setOcupado(false);
    }
  }

  /** O "por quê?" opcional — texto de menor, que só o professor lê. */
  async function explicarAMarcacao(texto: string): Promise<ResultadoDoPorque> {
    setOcupado(true);
    try {
      aplicar(await executar(() => api.post<Estado>("/a-selecao/marcacao/porque", { texto })));
      telemetria.explicouAMarcacao(codePoints(texto));
      return "guardado";
    } catch (erro) {
      if (tipoDaFalha(erro) === "recusada") return "recusado";
      tratarFalha(erro);
      return "outra";
    } finally {
      setOcupado(false);
    }
  }

  // ─────────────────────────────────────────────── a tela

  if (bloqueada) return <Indisponivel />;

  const vozDaEscola = tela === "reflexao" || tela === "fim";

  const desenhar = () => {
    switch (tela) {
      case "desafio":
        return (
          <DmDaAmara
            rodape={
              <AcaoDaDm
                ocupado={ocupado}
                aoTocar={() => {
                  telemetria.abriuOFeed();
                  void pedirPasso("feed");
                }}
              >
                {E1.abrirFeed}
              </AcaoDaDm>
            }
          >
            <BalaoDaAmara>{E1.dmAmara}</BalaoDaAmara>
          </DmDaAmara>
        );

      case "feed":
        return (
          <Feed
            key={sessao.sessaoId}
            posts={sessao.cobertura.posts}
            salvos={salvos}
            ocupado={ocupado}
            aoSalvar={salvar}
            aoIrParaSalvos={irParaSalvos}
          />
        );

      case "salvos":
        return (
          <Salvos
            posts={sessao.cobertura.posts}
            salvos={salvos}
            selecao={selecao}
            tema={sessao.cobertura.tema}
            limites={sessao.limites}
            legenda={legenda}
            publicando={ocupado}
            aoMudarLegenda={setLegenda}
            aoAlternar={alternarSelecao}
            aoVoltarAoFeed={() => {
              telemetria.voltouAoFeed();
              void pedirPasso("feed");
            }}
            aoPublicar={publicar}
          />
        );

      case "espera": {
        const publicados = (sessao.selecao ?? []).map((id) => porId.get(id)).filter((p): p is PostPublico => Boolean(p));
        return publicados.length > 0 ? (
          <Espera posts={publicados} legenda={sessao.legenda ?? ""} />
        ) : (
          <div className="tela tela--story" data-unv-theme="dark" aria-busy="true" />
        );
      }

      case "mural":
        return mural ? (
          <Mural key={sessao.sessaoId} mural={mural} />
        ) : (
          <div className="tela tela--story" data-unv-theme="dark" aria-busy="true" />
        );

      case "marcacao":
        return mural ? (
          <Marcacao
            key={sessao.sessaoId}
            mural={mural}
            marcacao={sessao.marcacao}
            ocupado={ocupado}
            aoMarcar={(escolha) => void marcar(escolha)}
            aoExplicar={explicarAMarcacao}
          />
        ) : (
          <div className="tela tela--clara" aria-busy="true" />
        );

      case "explicacao":
        return (
          <Suspense fallback={<div className="tela tela--clara" aria-busy="true" />}>
          <Explicar
            key={sessao.sessaoId}
            cardInicial={lerMemoria(sessao.sessaoId).card}
            indo={ocupado}
            aoChegarNoCard={(card) => gravarMemoria(sessao.sessaoId, { card })}
            aoIrParaReflexao={() => {
              telemetria.foiParaReflexao();
              void pedirPasso("reflexao");
            }}
          />
          </Suspense>
        );

      case "reflexao":
        return <Reflexao limites={sessao.limites} enviando={ocupado} aoEnviar={(t) => void enviarReflexao(t)} />;

      case "fim":
        return recemEnviada ? <ReflexaoEnviada aoContinuar={() => setRecemEnviada(false)} /> : <Concluida />;
    }
  };

  return (
    <div className="app">
      {desenhar()}
      <Avisos aviso={conexao.aviso} voz={vozDaEscola ? "escola" : "clone"} aoRevalidar={conexao.revalidar} />
    </div>
  );
}
