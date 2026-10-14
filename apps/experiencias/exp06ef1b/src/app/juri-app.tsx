import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SnackbarUnv } from "@edu/ui/ds-unoovista";
import { api, concluir, enviarEstado, idDoEstudante, postSemResposta, reportarErro, statusDoErro, tipoDaFalha } from "../lib/api";
import { gravarMemoria, lerMemoria, type ChaveDaSessao } from "../lib/memoria";
import {
  INTERVALO_DO_GATE_MS,
  SEGUNDOS_DE_INATIVIDADE,
  SEGUNDOS_DO_BATIMENTO,
  TELA_DO_PASSO,
  curtidosNaTela,
  esperaAteEncerrar,
  estandesDoFeed,
  gateMudou,
  ordemValida,
  protocoloDoVoto,
  vozDaTela,
} from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { E2 } from "../lib/textos";
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
import { Cedula } from "./clone/cedula";
import { Credencial } from "./clone/credencial";
import { Enquetes } from "./clone/enquetes";
import { Espera } from "./clone/espera";
import { Feed } from "./clone/feed";
import { Fim } from "./clone/fim";
import { Galeria, type CorpoDaRevisao } from "./clone/galeria";
import type { Conexao } from "./conexao";
import { Cadeia, Indisponivel, Mariana } from "./escola/telas-da-escola";
import { useOciosidade } from "./inatividade";

/** Junta curtidas, salvos e permanências por este tempo antes de ir à api (um toque duplo não vira duas idas). */
const JANELA_DOS_EVENTOS_MS = 400;

interface FilaDoFeed {
  curtidas: Map<string, boolean>;
  salvamentos: Map<string, boolean>;
  permanencias: Set<string>;
  /** O tamanho do feed para o qual o próximo já foi pedido — o mesmo fim não pede dois. */
  proximoPara: number | null;
  /** Uma ida vazia pedida pelo relógio dos 8 minutos: o servidor diz se o tempo acabou. */
  releitura: boolean;
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
/** O conjunto com `id` marcado ou desmarcado — curtida e salvo são estado. */
function alternar(atual: ReadonlySet<string>, id: string, marcado: boolean): Set<string> {
  const novo = new Set(atual);
  if (marcado) novo.add(id);
  else novo.delete(id);
  return novo;
}

export function JuriApp({ inicial, conexao }: { inicial: Sessao; conexao: Conexao }) {
  const [sessao, setSessao] = useState<Sessao>(inicial);
  const [galeria, setGaleria] = useState<DadosDaGaleria | null>(null);
  const [bloqueada, setBloqueada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [cedulaAberta, setCedulaAberta] = useState(false);
  const [carregandoPost, setCarregandoPost] = useState(false);
  /** O aviso curto da comissão: comentar, compartilhar e a busca fechados. */
  const [aviso, setAviso] = useState<string | null>(null);
  /* Curtidas e salvos que a tela mostra: o que o servidor devolveu, com o que ainda está na fila. */
  const [curtidos, setCurtidos] = useState<ReadonlySet<string>>(() => new Set(inicial.feed.curtidos));
  const [salvos, setSalvos] = useState<ReadonlySet<string>>(() => new Set(inicial.feed.salvos));
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
    setCedulaAberta(false);
    setCurtidos(new Set(sessao.feed.curtidos));
    setSalvos(new Set(sessao.feed.salvos));
  }
  const lembrar = useCallback(
    (parte: Parameters<typeof gravarMemoria>[1]) => {
      gravarMemoria(chave, parte);
      setMemoria((m) => ({ ...m, ...parte }));
    },
    [chave],
  );

  // ─────────────────────────────────────────── ler e aplicar o servidor

  const marcarDaSessao = useCallback((nova: Sessao) => {
    setCurtidos(new Set(nova.feed.curtidos));
    setSalvos(new Set(nova.feed.salvos));
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const nova = await executar(() => api.get<Sessao>(`${ROTA}/sessao`));
      setSessao(nova);
      marcarDaSessao(nova);
    } catch (erro) {
      if (tipoDaFalha(erro) === "bloqueada") setBloqueada(true);
      else reportarErro(erro);
    }
  }, [executar, marcarDaSessao]);

  /** O estado que uma rota de passo devolveu (voto, revisão, passo, cartões, concluir). */
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

  const tela = TELA_DO_PASSO[sessao.passo];

  // ────────────────────────────────────────────── efeitos da casca

  // O chrome opcional do hub acompanha o passo (`exp:estado`).
  useEffect(() => {
    enviarEstado({ passo: sessao.passo });
    if (sessao.passo === "lacrada") telemetria.esperou();
  }, [sessao.passo]);

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
          marcarDaSessao(nova);
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
  }, [sessao.aguardandoOProfessor, sinalizar, marcarDaSessao]);

  // A galeria, lida ao entrar no passo dela (e depois de um F5).
  useEffect(() => {
    if (tela !== "galeria" || galeria) return;
    let vivo = true;
    void (async () => {
      try {
        const g = await executar(() => api.get<DadosDaGaleria>(`${ROTA}/galeria`));
        if (!vivo) return;
        telemetria.abriuAGaleria(g.invisibilidade.ocultos, g.invisibilidade.total);
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

  const fila = useRef<FilaDoFeed>({
    curtidas: new Map(),
    salvamentos: new Map(),
    permanencias: new Set(),
    proximoPara: null,
    releitura: false,
  });
  const emVoo = useRef(false);
  const deNovo = useRef(false);
  const janela = useRef<number | null>(null);
  const liberadaAntes = useRef(inicial.feed.cedulaLiberada);

  const aplicarFeed = useCallback((feed: DadosDoFeed) => {
    setSessao((s) => ({ ...s, feed }));
    setCurtidos(curtidosNaTela(feed.curtidos, fila.current.curtidas));
    setSalvos(curtidosNaTela(feed.salvos, fila.current.salvamentos));
    if (feed.cedulaLiberada && !liberadaAntes.current) {
      liberadaAntes.current = true;
      telemetria.completouOFeed(!feed.completo);
    }
  }, []);

  /**
   * A fila manda ao servidor as curtidas, os salvos e as permanências juntos, e
   * o pedido do próximo post. UMA ida por vez; o que chega no meio vai na
   * seguinte.
   */
  const sincronizar = useCallback(async () => {
    if (emVoo.current) {
      deNovo.current = true;
      return;
    }
    const f = fila.current;
    const atual = sessaoRef.current.feed;
    const servidos = atual.posts.length;
    const proximo = f.proximoPara === servidos && !atual.completo && !atual.tempoEsgotado;
    const releitura = f.releitura;
    f.releitura = false;
    if (f.curtidas.size === 0 && f.salvamentos.size === 0 && f.permanencias.size === 0 && !proximo && !releitura) return;
    const curtidas = [...f.curtidas].map(([postId, curtiu]) => ({ postId, curtiu }));
    const salvamentos = [...f.salvamentos].map(([postId, salvou]) => ({ postId, salvou }));
    const permanencias = [...f.permanencias];
    f.curtidas.clear();
    f.salvamentos.clear();
    f.permanencias.clear();
    emVoo.current = true;
    if (proximo) setCarregandoPost(true);
    try {
      const corpo = { curtidas, salvamentos, permanencias, proximo };
      const feed = await executar(() => api.post<DadosDoFeed>(`${ROTA}/feed/eventos`, corpo));
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

  /**
   * O relógio dos 8 minutos é do SERVIDOR (`encerraEm`, desde a 1ª rolagem;
   * recarregar não zera). Quando ele vence, a tela faz uma ida vazia e o
   * servidor responde `tempoEsgotado` e `cedulaLiberada` — é ele quem decide.
   */
  const feedAtual = sessao.feed;
  useEffect(() => {
    if (tela !== "feed" || feedAtual.cedulaLiberada) return;
    const espera = esperaAteEncerrar(feedAtual.encerraEm, Date.now());
    if (espera === null) return;
    const relogio = window.setTimeout(() => {
      fila.current.releitura = true;
      void sincronizar();
    }, espera);
    return () => window.clearTimeout(relogio);
  }, [tela, feedAtual.cedulaLiberada, feedAtual.encerraEm, sincronizar]);

  function curtir(postId: string, curtiu: boolean, gesto: "coracao" | "toque-duplo") {
    fila.current.curtidas.set(postId, curtiu);
    setCurtidos((atual) => alternar(atual, postId, curtiu));
    telemetria.curtiu(postId, curtiu, gesto);
    sincronizarEmBreve();
  }

  function salvar(postId: string, salvou: boolean) {
    fila.current.salvamentos.set(postId, salvou);
    setSalvos((atual) => alternar(atual, postId, salvou));
    telemetria.salvou(postId, salvou);
    sincronizarEmBreve();
  }

  function fechado(acao: "comentar" | "compartilhar" | "buscar") {
    telemetria.tocouFechado(acao);
    setAviso(acao === "buscar" ? E2.buscaFechada : E2.comentariosFechados);
  }

  function permanecer(postId: string) {
    fila.current.permanencias.add(postId);
    sincronizarEmBreve();
  }

  function pedirProximo() {
    const atual = sessaoRef.current.feed;
    const servidos = atual.posts.length;
    if (atual.completo || atual.tempoEsgotado || fila.current.proximoPara === servidos) return;
    fila.current.proximoPara = servidos;
    void sincronizar();
  }

  /** Esvazia a janela de eventos e espera a ida em voo (antes de um latch). */
  async function esvaziarAFila() {
    if (janela.current !== null) {
      window.clearTimeout(janela.current);
      janela.current = null;
      await sincronizar();
    }
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

  async function votar(voto: { projetoId: string; conviccao: Conviccao }) {
    const { projetoId, conviccao } = voto;
    setOcupado(true);
    try {
      // As curtidas, os salvos e as permanências que ainda estão na janela vão antes do voto.
      await esvaziarAFila();
      const estado = await executar(() => api.post<Estado>(`${ROTA}/voto`, voto));
      telemetria.votou(conviccao, estandesDoFeed(sessaoRef.current.feed.posts).length);
      setCedulaAberta(false);
      setSessao((s) => ({ ...s, voto: { projetoId, conviccao } }));
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

  /**
   * A revisão (LATCH 2) e, logo depois, o "avançar" para a cadeia (`POST passo
   * {para:"cadeia"}`, PRD §6.3): a copy não tem tela entre os dois. A cadeia
   * só desce do passo dela em diante, então a sessão é relida no fim.
   */
  async function revisar(corpo: CorpoDaRevisao) {
    setOcupado(true);
    try {
      await filaDaGaleria.current;
      const estado = await executar(() => api.post<Estado>(`${ROTA}/revisao`, corpo));
      telemetria.revisou(corpo.acao);
      aplicarEstado(estado);
      await avancarParaACadeia();
    } catch (erro) {
      tratarFalha(erro);
    } finally {
      setOcupado(false);
    }
  }

  async function avancarParaACadeia() {
    const estado = await executar(() => api.post<Estado>(`${ROTA}/passo`, { para: "cadeia" }));
    aplicarEstado(estado);
    await recarregar();
  }

  /* `revisada` num F5 (a revisão foi, o avanço não): a tela pede o avanço sozinha. */
  const avancando = useRef(false);
  useEffect(() => {
    if (tela !== "avancando" || avancando.current) return;
    avancando.current = true;
    void avancarParaACadeia()
      .catch(tratarFalha)
      .finally(() => {
        avancando.current = false;
      });
    // `avancarParaACadeia` só usa callbacks estáveis da casca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela]);

  /** A cadeia: 200 é a certa; **422 `ordem-incorreta`** é a errada, e a tentativa conta. */
  async function conferirACadeia(ordem: string[]): Promise<boolean | null> {
    setOcupado(true);
    try {
      const t = await executar(() => api.post<Tentativa>(`${ROTA}/cadeia`, { ordem }));
      telemetria.montouACadeia(true, t.tentativas);
      return true;
    } catch (erro) {
      if (statusDoErro(erro) === 422) {
        telemetria.montouACadeia(false, (sessaoRef.current.cadeia?.tentativas ?? 0) + 1);
        return false;
      }
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

  // ───────────────────── a cédula aberta: o aviso de 60 s e o batimento de 15 s

  const { parado, segundosSemToque } = useOciosidade(cedulaAberta && tela === "feed", SEGUNDOS_DE_INATIVIDADE);
  useEffect(() => {
    if (parado) telemetria.ficouParado();
  }, [parado]);

  /*
   * Com a cédula aberta, a cada 15 s: há quantos segundos não há toque. O
   * servidor marca o ocioso para o painel do professor. Ao fechar, `aberta:
   * false` apaga a marca na hora. Rota 204: `postSemResposta`, e a falha é
   * silenciosa (o batimento seguinte corrige; a marca some sozinha em 40 s).
   */
  useEffect(() => {
    if (!cedulaAberta || tela !== "feed") return;
    const bater = (aberta: boolean) =>
      postSemResposta(`${ROTA}/cedula/batimento`, { aberta, segundosSemToque: aberta ? segundosSemToque() : 0 }).catch(
        (erro: unknown) => {
          if (tipoDaFalha(erro) === "invalida") reportarErro(erro);
        },
      );
    void bater(true);
    const relogio = window.setInterval(() => void bater(true), SEGUNDOS_DO_BATIMENTO * 1000);
    return () => {
      window.clearInterval(relogio);
      void bater(false);
    };
  }, [cedulaAberta, tela, segundosSemToque]);

  // ─────────────────────────────────────────────── a tela

  if (bloqueada) return <Indisponivel />;

  const desenhar = () => {
    switch (tela) {
      case "credencial":
        return <Credencial categorias={sessao.categorias} ocupado={ocupado} aoAcessar={() => void acessarOFeed()} />;

      case "feed":
        return (
          <>
            <Feed
              key={`${sessao.pacoteId}:${sessao.rodada}`}
              posts={sessao.feed.posts}
              curtidos={curtidos}
              salvos={salvos}
              podeCrescer={!sessao.feed.completo && !sessao.feed.tempoEsgotado}
              cedulaLiberada={sessao.feed.cedulaLiberada}
              carregando={carregandoPost}
              comDica={!memoria.gestoUsado}
              permanenciasContadas={memoria.permanencias}
              aoCurtir={curtir}
              aoSalvar={salvar}
              aoFechado={fechado}
              aoPermanecer={permanecer}
              aoChegarNoFim={pedirProximo}
              aoDeslizar={(postId, foto) => {
                telemetria.deslizou(postId, foto);
                if (!memoria.gestoUsado) lembrar({ gestoUsado: true });
              }}
              aoExpandir={(postId) => telemetria.expandiu(postId)}
              aoAbrirCedula={() => {
                telemetria.abriuACedula();
                setCedulaAberta(true);
              }}
              aoTrocarDeAba={(aba) => telemetria.trocouDeAba(aba)}
            />
            <Cedula
              aberta={cedulaAberta}
              estandes={estandesDoFeed(sessao.feed.posts)}
              parado={parado}
              enviando={ocupado}
              aoFechar={() => setCedulaAberta(false)}
              aoVotar={(voto) => void votar(voto)}
            />
          </>
        );

      case "espera":
        return (
          <Espera
            protocolo={sessao.voto ? protocoloDoVoto(sessao.pacoteId, sessao.rodada, sessao.voto.projetoId) : null}
          />
        );

      case "galeria":
        return galeria ? (
          <Galeria
            key={`${sessao.pacoteId}:${sessao.rodada}`}
            galeria={galeria}
            categorias={sessao.categorias}
            voto={sessao.voto}
            enviando={ocupado}
            aoAcao={registrarNaGaleria}
            aoRevisar={(corpo) => void revisar(corpo)}
          />
        ) : (
          <div className="tela" aria-busy="true">
            <div className="esqueleto__topo" />
          </div>
        );

      case "avancando":
        return (
          <div className="tela" aria-busy="true">
            <div className="esqueleto__topo" />
          </div>
        );

      case "cadeia":
        return sessao.cadeia ? (
          <Cadeia
            key={`${sessao.pacoteId}:${sessao.rodada}`}
            blocos={sessao.cadeia.blocos}
            parSimulado={sessao.cadeia.parSimulado}
            categorias={sessao.categorias}
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
          <div className="escola" aria-busy="true" />
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
        return <Fim />;
    }
  };

  return (
    <div className="app">
      {desenhar()}
      <SnackbarUnv
        open={aviso !== null}
        message={aviso ?? ""}
        duration={4000}
        onClose={() => setAviso(null)}
        offset={tela === "feed" ? "calc(var(--unv-tabbar-height) + 8px)" : "var(--unv-spacing-l)"}
      />
      <Avisos aviso={conexao.aviso} voz={vozDaTela(tela)} aoRevalidar={conexao.revalidar} />
    </div>
  );
}
