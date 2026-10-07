import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SnackbarUnv } from "@edu/ui/ds-unoovista";
import { api, concluir, enviarEstado, idDoEstudante, postSemResposta, reportarErro, tipoDaFalha } from "../lib/api";
import { gravarMemoria, lerMemoria, type ChaveDaSessao } from "../lib/memoria";
import {
  INTERVALO_DO_GATE_MS,
  SEGUNDOS_DE_INATIVIDADE,
  SEGUNDOS_DO_LACRE,
  TELA_DO_PASSO,
  curtidosNaTela,
  estandesDoFeed,
  gateMudou,
  ordemValida,
  protocoloDoVoto,
  vozDaTela,
} from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { E2, E3 } from "../lib/textos";
import {
  ROTA,
  TOTAL_DE_BLOCOS,
  type AcaoDaGaleria,
  type Conviccao,
  type Estado,
  type Feed as DadosDoFeed,
  type Galeria as DadosDaGaleria,
  type Gate,
  type IdDaEnquete,
  type Sessao,
  type Tentativa,
} from "../lib/tipos";
import { Avisos } from "./avisos";
import { Cedula, Lacre } from "./clone/cedula";
import { Credencial } from "./clone/credencial";
import { Enquetes } from "./clone/enquetes";
import { Espera } from "./clone/espera";
import { Feed } from "./clone/feed";
import { Fim } from "./clone/fim";
import { Galeria } from "./clone/galeria";
import { Mariana } from "./clone/mariana";
import type { Conexao } from "./conexao";
import { Cadeia, Indisponivel } from "./escola/telas-da-escola";
import { useInatividade } from "./inatividade";

/** Junta curtidas e permanências por este tempo antes de ir à api (um toque duplo não vira duas idas). */
const JANELA_DOS_EVENTOS_MS = 400;

interface FilaDoFeed {
  curtidas: Map<string, boolean>;
  permanencias: Set<string>;
  /** O tamanho do feed para o qual o próximo já foi pedido — o mesmo fim não pede dois. */
  proximoPara: number | null;
}

/**
 * A casca da missão: uma máquina de telas sobre o que o SERVIDOR diz. Molde:
 * `exp07ef1b/src/app/selecao-app.tsx`.
 *
 * Quatro regras valem para tudo aqui:
 *
 * 1. **`sessao.passo`, nunca `passoDoEstudante`.** O primeiro já vem
 *    reconciliado com a etapa da turma (`regras/passos.ts#passoEfetivo`); usar
 *    o cru faria a tela discordar do servidor no instante em que a professora
 *    libera a galeria.
 * 2. **A tela só anda quando a api responde.** Nenhum latch é otimista: o voto
 *    lacrado e a revisão só existem quando o `POST` volta. A ÚNICA coisa
 *    otimista é o coração da curtida — que é estado, e o servidor devolve a
 *    lista inteira a cada ida.
 * 3. **Toda chamada passa por `conexao.executar`**, que repete a de rede e a de
 *    sessão com o aviso diegético aceso. As exceções são o polling do gate (que
 *    já se repete a cada 3 s) e as enquetes (que pulam para o fim).
 * 4. **409 e 400 relêem a sessão.** O voto já estava lacrado, a revisão já
 *    estava na ata, a rodada mudou: quem resolve é ler de novo o que o servidor
 *    diz. 403 é a porta fechada — exceto o da galeria antes da hora, que é o
 *    relógio da turma e também relê.
 */
export function JuriApp({ inicial, conexao }: { inicial: Sessao; conexao: Conexao }) {
  const [sessao, setSessao] = useState<Sessao>(inicial);
  const [galeria, setGaleria] = useState<DadosDaGaleria | null>(null);
  const [bloqueada, setBloqueada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [cedulaAberta, setCedulaAberta] = useState(false);
  const [lacre, setLacre] = useState<{ protocolo: string; titulo: string | null } | null>(null);
  const [carregandoPost, setCarregandoPost] = useState(false);
  const [avisoCedo, setAvisoCedo] = useState(false);
  const [curtidos, setCurtidos] = useState<ReadonlySet<string>>(() => new Set(inicial.feed.curtidos));
  const { executar, sinalizar } = conexao;

  const sessaoRef = useRef(sessao);
  useLayoutEffect(() => {
    sessaoRef.current = sessao;
  }, [sessao]);

  // ───────────────────────────────────────── a memória de F5 desta sessão

  const chave: ChaveDaSessao = useMemo(
    () => ({ estudanteId: idDoEstudante(), pacoteId: sessao.pacoteId, rodada: sessao.rodada }),
    [sessao.pacoteId, sessao.rodada],
  );
  const [memoria, setMemoria] = useState(() => lerMemoria(chave));
  const [chaveDaMemoria, setChaveDaMemoria] = useState(chave);
  /* Sessão nova ("Zerar a turma", atividade nova): a memória é outra, e a
     galeria e as curtidas da rodada anterior não valem. Reset DURANTE o render,
     o padrão do React para estado derivado. */
  if (chaveDaMemoria.pacoteId !== chave.pacoteId || chaveDaMemoria.rodada !== chave.rodada) {
    setChaveDaMemoria(chave);
    setMemoria(lerMemoria(chave));
    setGaleria(null);
    setLacre(null);
    setCedulaAberta(false);
    setCurtidos(new Set(sessao.feed.curtidos));
  }
  const lembrar = useCallback(
    (parte: Parameters<typeof gravarMemoria>[1]) => {
      gravarMemoria(chave, parte);
      setMemoria((m) => ({ ...m, ...parte }));
    },
    [chave],
  );

  // ─────────────────────────────────────────── ler e aplicar o servidor

  const recarregar = useCallback(async () => {
    try {
      const nova = await executar(() => api.get<Sessao>(`${ROTA}/sessao`));
      setSessao(nova);
      setCurtidos(new Set(nova.feed.curtidos));
    } catch (erro) {
      if (tipoDaFalha(erro) === "bloqueada") setBloqueada(true);
      else reportarErro(erro);
    }
  }, [executar]);

  /** O estado que uma rota de passo devolveu (voto, revisão, cartões, concluir). */
  const aplicarEstado = useCallback((estado: Estado) => {
    setSessao((atual) => ({
      ...atual,
      passo: estado.passo,
      etapa: estado.etapa,
      aguardandoOProfessor: estado.passo === "lacrada",
    }));
  }, []);

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

  const tela = lacre ? "lacre" : TELA_DO_PASSO[sessao.passo];

  // ────────────────────────────────────────────── efeitos da casca

  // O chrome opcional do hub acompanha o passo (`exp:estado`).
  useEffect(() => {
    enviarEstado({ passo: sessao.passo });
    if (sessao.passo === "lacrada") telemetria.esperou();
  }, [sessao.passo]);

  // O lacre fica alguns segundos e dá lugar à plenária.
  useEffect(() => {
    if (!lacre) return;
    const relogio = window.setTimeout(() => setLacre(null), SEGUNDOS_DO_LACRE * 1000);
    return () => window.clearTimeout(relogio);
  }, [lacre]);

  /**
   * O polling do gate da turma (HTTP de 3 s, nunca WebSocket) — SÓ enquanto a
   * criança espera a professora (a plenária). Antes do voto a etapa não a toca;
   * da revisão em diante, o passo é dela. A falha é silenciosa na primeira vez
   * (o SDK já reenviou o GET); a partir da segunda seguida, o aviso acende.
   */
  useEffect(() => {
    if (!sessao.aguardandoOProfessor) return;
    let falhas = 0;
    const relogio = window.setInterval(() => {
      void (async () => {
        try {
          const gate = await api.get<Gate>(`${ROTA}/gate`);
          if (falhas >= 2) sinalizar(null);
          falhas = 0;
          if (!gateMudou(sessaoRef.current, gate)) return;
          const nova = await api.get<Sessao>(`${ROTA}/sessao`);
          setSessao(nova);
          setCurtidos(new Set(nova.feed.curtidos));
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

  // A galeria, lida ao entrar no passo dela (e depois de um F5).
  useEffect(() => {
    if (tela !== "galeria" || galeria) return;
    let vivo = true;
    void (async () => {
      try {
        const g = await executar(() => api.get<DadosDaGaleria>(`${ROTA}/galeria`));
        if (!vivo) return;
        telemetria.abriuAGaleria(g.invisibilidade.ocultos, g.invisibilidade.percentual);
        setGaleria(g);
      } catch (erro) {
        if (!vivo) return;
        // 403 `galeria-nao-liberada`: o relógio da turma, não a porta fechada.
        if (tipoDaFalha(erro) === "bloqueada") void recarregar();
        else tratarFalha(erro);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [tela, galeria, executar, recarregar, tratarFalha]);

  // ─────────────────────────────────────────── o feed: eventos e próximo post

  const fila = useRef<FilaDoFeed>({ curtidas: new Map(), permanencias: new Set(), proximoPara: null });
  const emVoo = useRef(false);
  const deNovo = useRef(false);
  const janela = useRef<number | null>(null);
  const completouAntes = useRef(inicial.feed.completo);

  const aplicarFeed = useCallback((feed: DadosDoFeed) => {
    setSessao((s) => ({ ...s, feed }));
    setCurtidos(curtidosNaTela(feed.curtidos, fila.current.curtidas));
    if (feed.completo && !completouAntes.current) {
      completouAntes.current = true;
      telemetria.completouOFeed();
    }
  }, []);

  const sincronizar = useCallback(async () => {
    if (emVoo.current) {
      deNovo.current = true;
      return;
    }
    const f = fila.current;
    const servidos = sessaoRef.current.feed.posts.length;
    const proximo = f.proximoPara === servidos && !sessaoRef.current.feed.completo;
    if (f.curtidas.size === 0 && f.permanencias.size === 0 && !proximo) return;
    const curtidas = [...f.curtidas].map(([postId, curtiu]) => ({ postId, curtiu }));
    const permanencias = [...f.permanencias];
    f.curtidas.clear();
    f.permanencias.clear();
    emVoo.current = true;
    if (proximo) setCarregandoPost(true);
    try {
      const feed = await executar(() => api.post<DadosDoFeed>(`${ROTA}/feed/eventos`, { curtidas, permanencias, proximo }));
      aplicarFeed(feed);
      if (permanencias.length) {
        const todas = [...new Set([...lerMemoria(chave).permanencias, ...permanencias])];
        lembrar({ permanencias: todas });
      }
      if (proximo && feed.posts.length > servidos) telemetria.recebeuPost(feed.posts.length);
    } catch (erro) {
      tratarFalha(erro);
    } finally {
      emVoo.current = false;
      setCarregandoPost(false);
      if (deNovo.current) {
        deNovo.current = false;
        void sincronizar();
      }
    }
  }, [executar, aplicarFeed, tratarFalha, chave, lembrar]);

  const sincronizarEmBreve = useCallback(() => {
    if (janela.current !== null) window.clearTimeout(janela.current);
    janela.current = window.setTimeout(() => {
      janela.current = null;
      void sincronizar();
    }, JANELA_DOS_EVENTOS_MS);
  }, [sincronizar]);

  useEffect(
    () => () => {
      if (janela.current !== null) window.clearTimeout(janela.current);
    },
    [],
  );

  function curtir(postId: string, curtiu: boolean, gesto: "coracao" | "toque-duplo") {
    fila.current.curtidas.set(postId, curtiu);
    setCurtidos((atual) => {
      const novo = new Set(atual);
      if (curtiu) novo.add(postId);
      else novo.delete(postId);
      return novo;
    });
    telemetria.curtiu(postId, curtiu, gesto);
    sincronizarEmBreve();
  }

  function permanecer(postId: string) {
    fila.current.permanencias.add(postId);
    sincronizarEmBreve();
  }

  function pedirProximo() {
    const servidos = sessaoRef.current.feed.posts.length;
    if (sessaoRef.current.feed.completo || fila.current.proximoPara === servidos) return;
    fila.current.proximoPara = servidos;
    void sincronizar();
  }

  // ─────────────────────────────────────────────── as ações

  async function acessarOFeed() {
    setOcupado(true);
    telemetria.acessouOFeed();
    try {
      const feed = await executar(() => api.post<DadosDoFeed>(`${ROTA}/passo`, { para: "feed" }));
      if (sessaoRef.current.passo === "credencial" || sessaoRef.current.passo === "feed") {
        setSessao((s) => ({ ...s, passo: "feed", passoDoEstudante: "feed", feed }));
        setCurtidos(new Set(feed.curtidos));
      } else {
        void recarregar();
      }
    } catch (erro) {
      tratarFalha(erro);
    } finally {
      setOcupado(false);
    }
  }

  async function votar(projetoId: string, conviccao: Conviccao) {
    setOcupado(true);
    try {
      // As curtidas e as permanências que ainda estão na janela vão antes do voto.
      if (janela.current !== null) {
        window.clearTimeout(janela.current);
        janela.current = null;
        await sincronizar();
      }
      const estado = await executar(() => api.post<Estado>(`${ROTA}/voto`, { projetoId, conviccao }));
      const titulo = sessaoRef.current.feed.posts.find((p) => p.projetoId === projetoId)?.titulo ?? null;
      telemetria.votou(conviccao, estandesDoFeed(sessaoRef.current.feed.posts).length);
      setCedulaAberta(false);
      setSessao((s) => ({ ...s, voto: { projetoId, conviccao } }));
      setLacre({ protocolo: protocoloDoVoto(sessaoRef.current.pacoteId, sessaoRef.current.rodada, projetoId), titulo });
      aplicarEstado(estado);
    } catch (erro) {
      setCedulaAberta(false);
      tratarFalha(erro);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * As ações da galeria vão numa FILA, em ordem e sem bloquear a tela — e a
   * revisão espera a fila esvaziar: a evidência da EF06CO01 é marcada no latch
   * da revisão, sobre o que a api já gravou da galeria.
   */
  const filaDaGaleria = useRef<Promise<void>>(Promise.resolve());
  function registrarNaGaleria(acao: AcaoDaGaleria) {
    if (acao.tipo === "abrir") {
      const p = galeria?.projetos.find((x) => x.id === acao.projetoId);
      telemetria.inspecionou(acao.projetoId, p ? !p.exibidoNoSeuFeed : true);
    } else {
      telemetria.buscou(acao.busca, acao.area);
    }
    filaDaGaleria.current = filaDaGaleria.current
      .then(() => executar(() => postSemResposta(`${ROTA}/galeria/acoes`, acao)))
      .catch((erro: unknown) => {
        // Uma ação perdida não trava a galeria; o 403 (a sessão mudou) aparece na revisão.
        if (tipoDaFalha(erro) !== "bloqueada") reportarErro(erro);
      });
  }

  async function revisar(corpo: { acao: "manter" } | { acao: "trocar"; projetoId: string }) {
    setOcupado(true);
    try {
      await filaDaGaleria.current;
      const estado = await executar(() => api.post<Estado>(`${ROTA}/revisao`, corpo));
      telemetria.revisou(corpo.acao);
      aplicarEstado(estado);
      // A cadeia só desce do passo dela em diante: relê a sessão.
      await recarregar();
    } catch (erro) {
      tratarFalha(erro);
    } finally {
      setOcupado(false);
    }
  }

  async function conferirACadeia(ordem: string[]): Promise<boolean | null> {
    setOcupado(true);
    try {
      const t = await executar(() => api.post<Tentativa>(`${ROTA}/cadeia`, { ordem }));
      telemetria.montouACadeia(t.correta, t.tentativas);
      return t.correta;
    } catch (erro) {
      tratarFalha(erro);
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function registrarCartoes(mecanismo: string, atitude: string) {
    setOcupado(true);
    try {
      const estado = await executar(() => api.post<Estado>(`${ROTA}/cartoes`, { mecanismo, atitude }));
      telemetria.escolheuOsCartoes();
      aplicarEstado(estado);
    } catch (erro) {
      tratarFalha(erro);
    } finally {
      setOcupado(false);
    }
  }

  async function concluirMissao(respondidas: number) {
    setOcupado(true);
    try {
      const estado = await executar(() => api.post<Estado>(`${ROTA}/concluir`));
      aplicarEstado(estado);
      telemetria.concluiu(respondidas);
      /* Sem `score`: a missão não pontua criança. O nível das habilidades é do
         servidor (a ficha da E14), e nenhum desses números aparece em tela. */
      concluir({ votou: true, revisou: true, enquetes: respondidas });
    } catch (erro) {
      tratarFalha(erro);
    } finally {
      setOcupado(false);
    }
  }

  // ─────────────────────────────────── o aviso de inatividade da cédula

  const cedulaPronta = tela === "feed" && sessao.feed.completo;
  const parado = useInatividade(cedulaPronta, SEGUNDOS_DE_INATIVIDADE);
  useEffect(() => {
    if (parado) telemetria.ficouParado();
  }, [parado]);

  // ─────────────────────────────────────────────── a tela

  if (bloqueada) return <Indisponivel />;

  const desenhar = () => {
    switch (tela) {
      case "credencial":
        return (
          <Credencial
            tema={sessao.tema}
            categorias={sessao.categorias}
            ocupado={ocupado}
            aoAcessar={() => void acessarOFeed()}
          />
        );

      case "feed":
        return (
          <>
            <Feed
              key={`${sessao.pacoteId}:${sessao.rodada}`}
              posts={sessao.feed.posts}
              categorias={sessao.categorias}
              curtidos={curtidos}
              completo={sessao.feed.completo}
              carregando={carregandoPost}
              comDica={!memoria.gestoUsado}
              permanenciasContadas={memoria.permanencias}
              aoCurtir={curtir}
              aoPermanecer={permanecer}
              aoChegarNoFim={pedirProximo}
              aoDeslizar={(postId, lamina) => {
                telemetria.deslizou(postId, lamina);
                if (!memoria.gestoUsado) lembrar({ gestoUsado: true });
              }}
              aoExpandir={(postId) => telemetria.expandiu(postId)}
              aoAbrirCedula={() => {
                telemetria.abriuACedula();
                setCedulaAberta(true);
              }}
              aoTocarCedulaCedo={() => setAvisoCedo(true)}
            />
            <Cedula
              aberta={cedulaAberta}
              estandes={estandesDoFeed(sessao.feed.posts)}
              enviando={ocupado}
              aoFechar={() => setCedulaAberta(false)}
              aoVotar={(projeto, conviccao) => void votar(projeto, conviccao)}
            />
            <SnackbarUnv open={parado && !cedulaAberta} message={E3.inatividade} offset="calc(var(--unv-tabbar-height) + 64px)" />
            <SnackbarUnv
              open={avisoCedo}
              message={E2.feedIncompleto}
              duration={4000}
              onClose={() => setAvisoCedo(false)}
              offset="calc(var(--unv-tabbar-height) + 8px)"
            />
          </>
        );

      case "lacre":
        return <Lacre protocolo={lacre?.protocolo ?? ""} titulo={lacre?.titulo ?? null} />;

      case "espera":
        return <Espera />;

      case "galeria":
        return galeria ? (
          <Galeria
            key={`${sessao.pacoteId}:${sessao.rodada}`}
            galeria={galeria}
            categorias={sessao.categorias}
            voto={sessao.voto}
            enviando={ocupado}
            aoAcao={registrarNaGaleria}
            aoManter={() => void revisar({ acao: "manter" })}
            aoTrocar={(projetoId) => void revisar({ acao: "trocar", projetoId })}
          />
        ) : (
          <div className="tela" aria-busy="true">
            <div className="esqueleto__topo" />
          </div>
        );

      case "cadeia":
        return sessao.cadeia ? (
          <Cadeia
            key={`${sessao.pacoteId}:${sessao.rodada}`}
            blocos={sessao.cadeia.blocos}
            ordemInicial={ordemValida(memoria.ordemDaCadeia, sessao.cadeia.blocos.map((b) => b.id), TOTAL_DE_BLOCOS)}
            enviando={ocupado}
            aoMudarOrdem={(ordem) => lembrar({ ordemDaCadeia: ordem })}
            aoConferir={conferirACadeia}
            aoContinuar={() => void recarregar()}
          />
        ) : (
          <div className="escola" aria-busy="true" />
        );

      case "mariana":
        return sessao.mariana ? (
          <Mariana
            key={`${sessao.pacoteId}:${sessao.rodada}`}
            caso={sessao.mariana.caso}
            mecanismos={sessao.mariana.mecanismos}
            atitudes={sessao.mariana.atitudes}
            inicial={{
              mecanismo: sessao.mariana.escolha?.mecanismo ?? memoria.mecanismo,
              atitude: sessao.mariana.escolha?.atitude ?? memoria.atitude,
            }}
            enviando={ocupado}
            aoMudar={(escolha) => lembrar(escolha)}
            aoRegistrar={(m, a) => void registrarCartoes(m, a)}
          />
        ) : (
          <div className="tela" aria-busy="true" />
        );

      case "enquetes":
        return (
          <Enquetes
            key={`${sessao.pacoteId}:${sessao.rodada}`}
            votosGuardados={memoria.votos}
            concluindo={ocupado}
            aoVotar={(id: IdDaEnquete, alternativa) => lembrar({ votos: { ...lerMemoria(chave).votos, [id]: alternativa } })}
            aoConcluir={(n) => void concluirMissao(n)}
          />
        );

      case "fim":
        return <Fim tema={sessao.tema} categorias={sessao.categorias} />;
    }
  };

  return (
    <div className="app">
      {desenhar()}
      <Avisos aviso={conexao.aviso} voz={tela === "lacre" ? "clone" : vozDaTela(tela)} aoRevalidar={conexao.revalidar} />
    </div>
  );
}
