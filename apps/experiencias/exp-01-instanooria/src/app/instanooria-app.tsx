import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, experiencia } from "../lib/api";
import { aoMudarVisibilidade } from "../lib/visibilidade";
import { criarRastreadorDeDwell, type RastreadorDeDwell } from "../lib/dwell";
import { instalarRolagemPorTeclado } from "../lib/gestos";
import {
  criarBufferDeEventos,
  type BufferDeEventos,
  type TipoEventoCliente,
} from "../lib/eventos";
import type { FeedPostCliente, ItemFeed, ModuloCliente, PerfilCliente } from "../lib/tipos";

import {
  AbaBusca,
  AbaNotificacoes,
  AbaPerfil,
  ModalPerfil,
  type ItemNotificacao,
} from "./componentes/abas";
import { Encerramento } from "./componentes/encerramento";
import { MenuPerfil } from "./componentes/menu-perfil";

/**
 * As telas do fechamento entram por `lazy` pelo mesmo motivo do origem
 * (lá era next/dynamic): a copy delas ("posts que nunca chegaram até você",
 * "O algoritmo escondeu…") entrega o mecanismo, e em import estático viajaria
 * no chunk do feed — onde o estudante pode ler antes da hora abrindo o DevTools.
 */
const Explicabilidade = lazy(() =>
  import("./componentes/explicabilidade").then((modulo) => ({ default: modulo.Explicabilidade })),
);

const Perdidos = lazy(() =>
  import("./componentes/perdidos").then((modulo) => ({ default: modulo.Perdidos })),
);

const Reflexao = lazy(() =>
  import("./componentes/reflexao").then((modulo) => ({ default: modulo.Reflexao })),
);

import { AvatarPerfil } from "./componentes/avatar-perfil";
import { Glifo } from "@edu/ui/ds-insta";
import { BottomNav, type Aba } from "./componentes/bottom-nav";
import { ComentariosSheet } from "./componentes/comentarios-sheet";
import { Compositor } from "./componentes/compositor";
import { Conclusao } from "./componentes/conclusao";
import { Debate } from "./componentes/debate";
import { Onboarding } from "./componentes/onboarding";
import { PostCard, type AcoesDoPost } from "./componentes/post-card";
import { CompartilharSheet, OpcoesSheet, Toast } from "./componentes/sheets-extras";
import { SkeletonFeed } from "./componentes/skeleton-feed";
import { TopBar } from "./componentes/topbar";
import { Stories } from "./componentes/stories";
import { ModuloSugestoes } from "./componentes/sugestoes";

export type FaseCliente =
  | "onboarding"
  | "feed"
  | "encerramento"
  /** A conclusão da missão, entre o encerramento e a revelação. */
  | "conclusao"
  /** Fluxo v2: a turma anda junto nos momentos coletivos (relógio do professor). */
  | "debate"
  | "explicabilidade"
  | "perdidos"
  | "reflexao"
  | "fim"
  /** Fases antigas, mantidas para runs já congeladas. */
  | "revelacao"
  | "dossie";

/** Enunciado da missão e rótulos dos lados, para o seletor da conclusão. */
export interface MissaoCliente {
  perguntaChave: string;
  ladoALabel: string;
  ladoBLabel: string;
}

export interface EstudanteCliente {
  displayName: string;
  handle: string;
  avatar: string;
}


/**
 * Shell do Instanooria (SPA): onboarding → feed → encerramento. O cliente só
 * mede e envia eventos; toda a curadoria vem do servidor.
 *
 * Diferenças do porte (origem = app/app/componentes/instanooria-app.tsx):
 *  - fetch same-origin → `api.*` da SDK (bearer, apiUrl do hub:init);
 *  - mensagens da casca (`instanooria:visivel/oculto`) → `hub:pause/resume`
 *    repassados pelo bootstrap via lib/visibilidade;
 *  - `instanooria:perdidos` para a moldura → `exp:estado` do protocolo v1;
 *  - telemetria xAPI da SDK: attempted (entrou), progressed (mudou de fase),
 *    completed (chegou ao fim) — canal ANALÍTICO, separado dos eventos do motor.
 */
export function InstanooriaApp({
  runIdInicial,
  faseInicial,
  missao,
  estudante,
}: {
  runIdInicial: string | null;
  faseInicial: FaseCliente;
  missao: MissaoCliente;
  estudante?: EstudanteCliente;
}) {
  const dadosEstudante = (estudante)!;
  const [runId, setRunId] = useState(runIdInicial);
  const [fase, setFase] = useState<FaseCliente>(faseInicial);
  const [itens, setItens] = useState<ItemFeed[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aba, setAba] = useState<Aba>("feed");
  /**
   * Acervo da busca: os dois lados, sem curadoria. Carregado sob demanda ao
   * abrir a aba — não no boot, para não competir com o primeiro bloco do feed
   * no celular da escola.
   */
  const [acervo, setAcervo] = useState<FeedPostCliente[]>([]);
  /** Fim de sessão detectado, aguardando o post atual sair da tela. */
  const [encerramentoPendente, setEncerramentoPendente] = useState(false);
  const abaAtual = useRef<Aba>("feed");
  const [atualizando, setAtualizando] = useState(false);

  const [curtidos, setCurtidos] = useState<Set<string>>(new Set());
  const [salvos, setSalvos] = useState<Set<string>>(new Set());
  const [seguidosPorPost, setSeguidosPorPost] = useState<Set<string>>(new Set());
  const [seguidosPorPerfil, setSeguidosPorPerfil] = useState<Set<string>>(new Set());
  const [comentariosMeus, setComentariosMeus] = useState<Record<string, number>>({});
  const [notificacoes, setNotificacoes] = useState<ItemNotificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [meusPosts, setMeusPosts] = useState<
    { texto: string; template: string; criadoEm: number; apoio: { handle: string; texto: string }[] }[]
  >([]);

  const [postDeComentarios, setPostDeComentarios] = useState<FeedPostCliente | null>(null);
  const [postDeCompartilhar, setPostDeCompartilhar] = useState<FeedPostCliente | null>(null);
  const [postDeOpcoes, setPostDeOpcoes] = useState<FeedPostCliente | null>(null);
  const [perfilAberto, setPerfilAberto] = useState<PerfilCliente | null>(null);
  const [compositorAberto, setCompositorAberto] = useState(false);
  const [menuDaContaAberto, setMenuDaContaAberto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const buffer = useRef<BufferDeEventos | null>(null);
  const dwell = useRef<RastreadorDeDwell | null>(null);
  const sentinela = useRef<HTMLDivElement | null>(null);
  const pedindoBloco = useRef(false);
  const inicioDoPuxao = useRef<number | null>(null);
  const concluiu = useRef(false);

  const posts = useMemo(
    () =>
      itens
        .filter((item): item is { tipo: "post"; post: FeedPostCliente } => item.tipo === "post")
        .map((item) => item.post),
    [itens],
  );

  const avisar = useCallback((mensagem: string) => {
    setToast(mensagem);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  /**
   * Fase para o HUB, sempre que muda: `exp:estado` alimenta o "chrome"
   * opcional (a moldura dos posts perdidos vive na casca, que tem espaço para
   * dizer DE QUE feed se trata — 375px não dão conta sozinhos). E telemetria
   * analítica de progresso + conclusão única no fim.
   */
  useEffect(() => {
    const exp = experiencia();
    exp.enviarEstado({ fase });
    exp.track("progressed", `fase:${fase}`);
    if (fase === "fim" && !concluiu.current) {
      concluiu.current = true;
      exp.concluir({ dados: { fase: "fim" } });
    }
  }, [fase]);

  // ---- buffer de eventos + medição de dwell -------------------------------
  useEffect(() => {
    if (!runId) return;

    const novoBuffer = criarBufferDeEventos(runId);
    buffer.current = novoBuffer;

    const rastreador = criarRastreadorDeDwell((postId, dwellMs) => {
      novoBuffer.registrar("visto", postId, { dwellMs });
      // "Nunca cortar um post no meio da leitura": o encerramento só entra
      // quando o post que estava na tela sai dela.
      setEncerramentoPendente((pendente) => {
        if (pendente) setFase("encerramento");
        return pendente;
      });
    });
    dwell.current = rastreador;

    const aoSair = () => void novoBuffer.flush();
    window.addEventListener("pagehide", aoSair);
    // `pagehide` é frágil quando a casca remove o iframe: sem estes dois, o
    // último lote de dwell podia ser perdido junto com o frame.
    window.addEventListener("beforeunload", aoSair);
    document.addEventListener("visibilitychange", aoSair);

    /**
     * O hub avisa quando o aparelho sai de vista (`hub:pause`/`hub:resume`,
     * repassados pelo bootstrap) — esconder um iframe NÃO dispara
     * `visibilitychange` nele, e o cronômetro seguiria correndo com a tela
     * apagada. Cada perda de foco também é telemetria de CONTINUIDADE: o
     * momento em que o estudante olhou para o professor, o colega ou o teto.
     */
    const pararDeOuvir = aoMudarVisibilidade((visivel) => {
      if (!visivel) {
        novoBuffer.registrar("perdeu_foco");
        rastreador.pausar();
        void novoBuffer.flush();
      } else {
        novoBuffer.registrar("voltou_foco");
        rastreador.retomar();
      }
    });

    return () => {
      window.removeEventListener("pagehide", aoSair);
      window.removeEventListener("beforeunload", aoSair);
      document.removeEventListener("visibilitychange", aoSair);
      pararDeOuvir();
      rastreador.liberar();
      void novoBuffer.flush();
      novoBuffer.encerrar();
    };
  }, [runId]);

  const registrar = useCallback(
    (tipo: TipoEventoCliente, postId?: string | null, payload?: Record<string, unknown>) => {
      buffer.current?.registrar(tipo, postId, payload);
    },
    [],
  );

  /**
   * Busca no acervo. Sem termo, devolve o acervo inteiro; com termo, filtra no
   * servidor. Registra `buscou`/`abriu_busca` — é a telemetria que responde
   * "quem foi atrás do que o feed não dava".
   */
  const buscarNoAcervo = useCallback(
    async (termo: string): Promise<FeedPostCliente[]> => {
      if (!runId) return [];
      if (termo) registrar("buscou", null, { termo });

      try {
        const query = termo ? `?q=${encodeURIComponent(termo)}` : "";
        const corpo = await api.get<{ posts: FeedPostCliente[] }>(`/runs/${runId}/busca${query}`);
        return corpo.posts;
      } catch {
        return [];
      }
    },
    [registrar, runId],
  );

  // Carrega o acervo na primeira vez que a busca é aberta.
  useEffect(() => {
    if (aba !== "busca" || acervo.length > 0) return;
    void buscarNoAcervo("").then(setAcervo);
  }, [aba, acervo.length, buscarNoAcervo]);

  // ---- carregamento de blocos --------------------------------------------
  const carregarBloco = useCallback(async () => {
    if (!runId || pedindoBloco.current) return;
    pedindoBloco.current = true;
    setCarregando(true);

    try {
      await buffer.current?.flush();
      const dados = await api.get<{ posts: FeedPostCliente[]; modulos: ModuloCliente[] }>(
        `/runs/${runId}/feed`,
      );

      if (dados.modulos.some((modulo) => modulo.tipo === "fim_sessao")) {
        // Sem post na tela (aba trocada, feed vazio) não há o que esperar.
        const temCardVisivel = document.querySelector("article[data-post-id]") !== null;
        if (temCardVisivel && abaAtual.current === "feed") setEncerramentoPendente(true);
        else setFase("encerramento");
        return;
      }

      const novos: ItemFeed[] = dados.posts.map((post) => ({ tipo: "post", post }));

      for (const modulo of dados.modulos) {
        if (modulo.tipo === "sugestoes") {
          // Entra no meio do bloco, como o módulo real.
          novos.splice(Math.min(3, novos.length), 0, { tipo: "sugestoes", perfis: modulo.perfis });
        }
        if (modulo.tipo === "notificacao_seguidor") {
          setNotificacoes((atual) => [
            {
              id: `seguidor-${modulo.perfil.authorId}`,
              perfil: modulo.perfil,
              texto: "começou a seguir você.",
              quando: "agora",
            },
            ...atual,
          ]);
          setNaoLidas((atual) => atual + 1);
        }
      }

      setItens((atual) => [...atual, ...novos]);
    } catch {
      avisar("Algo deu errado. Tenta de novo.");
    } finally {
      setCarregando(false);
      pedindoBloco.current = false;
    }
  }, [avisar, runId]);

  useEffect(() => {
    abaAtual.current = aba;
  }, [aba]);

  // Setas, PageUp/PageDown e Espaço rolam o feed — o "flick" do dedo no mouse
  // e no teclado (rolagem contínua, sem paginação visível).
  useEffect(() => {
    if (fase !== "feed") return;
    return instalarRolagemPorTeclado();
  }, [fase]);

  useEffect(() => {
    if (fase !== "feed" || !runId || itens.length > 0) return;
    void carregarBloco();
  }, [carregarBloco, fase, itens.length, runId]);

  // Sentinela a 3 posts do fim.
  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo || fase !== "feed" || aba !== "feed") return;

    const observer = new IntersectionObserver(
      (entradas) => {
        if (encerramentoPendente) return;
        if (entradas.some((entrada) => entrada.isIntersecting)) void carregarBloco();
      },
      { rootMargin: "200px" },
    );
    observer.observe(alvo);
    return () => observer.disconnect();
  }, [aba, carregarBloco, encerramentoPendente, fase, itens.length]);

  const registrarElemento = useCallback((elemento: HTMLElement | null, postId: string) => {
    if (!dwell.current) return;
    if (elemento) dwell.current.observar(elemento, postId);
  }, []);

  // ---- ações do card -----------------------------------------------------
  const acoes: AcoesDoPost = useMemo(
    () => ({
      // Telemetria de imersão: gesto não pontua no motor, só mede.
      aoGesto: (tipo, post) => registrar(tipo, post.id),
      aoCurtir: (post, curtido) => {
        setCurtidos((atual) => {
          const proximo = new Set(atual);
          if (curtido) proximo.add(post.id);
          else proximo.delete(post.id);
          return proximo;
        });
        registrar(curtido ? "curtiu" : "descurtiu", post.id);
      },
      aoSalvar: (post, salvo) => {
        setSalvos((atual) => {
          const proximo = new Set(atual);
          if (salvo) proximo.add(post.id);
          else proximo.delete(post.id);
          return proximo;
        });
        registrar(salvo ? "salvou" : "dessalvou", post.id);
      },
      aoSeguir: (post, seguindo) => {
        setSeguidosPorPost((atual) => {
          const proximo = new Set(atual);
          if (seguindo) proximo.add(post.id);
          else proximo.delete(post.id);
          return proximo;
        });
        registrar(seguindo ? "seguiu" : "deixou_seguir", post.id);
      },
      aoAbrirComentarios: (post) => {
        setPostDeComentarios(post);
        registrar("abriu_comentarios", post.id);
      },
      aoCompartilhar: (post) => setPostDeCompartilhar(post),
      aoAbrirOpcoes: (post) => setPostDeOpcoes(post),
      aoAbrirPerfil: (post) => {
        // O cliente não conhece authorId (o sanitizador não manda): guardamos o
        // post de origem, e o servidor resolve o autor pelo postId.
        setPerfilAberto({
          postIdDeOrigem: post.id,
          handle: post.author.handle,
          displayName: post.author.displayName,
          verificado: post.author.verificado,
          avatarSeed: post.author.avatarSeed,
        });
        registrar("abriu_perfil", post.id);
      },
      registrarElemento,
    }),
    [registrar, registrarElemento],
  );

  const seguirPerfil = useCallback(
    (perfil: PerfilCliente, seguindo: boolean) => {
      const authorId = perfil.authorId;
      if (!authorId) return;

      setSeguidosPorPerfil((atual) => {
        const proximo = new Set(atual);
        if (seguindo) proximo.add(authorId);
        else proximo.delete(authorId);
        return proximo;
      });
      setNotificacoes((atual) =>
        atual.map((item) => (item.perfil.authorId === authorId ? { ...item, seguindo } : item)),
      );
      registrar(seguindo ? "seguiu" : "deixou_seguir", null, { authorId });
    },
    [registrar],
  );

  /**
   * O relógio da turma. Os momentos coletivos do fluxo v2 — encerrar a
   * investigação, iniciar e encerrar o debate, mostrar o que se perdeu, abrir a
   * reflexão — são disparados no SERVIDOR por quem conduz a aula. Sem este
   * polling, "agora todas as telas mudam" só aconteceria se cada um recarregasse.
   *
   * Roda desde o onboarding: a investigação pode ser encerrada a qualquer
   * momento, inclusive com estudante que acabou de entrar.
   */
  useEffect(() => {
    if (!runId) return;

    const intervalo = window.setInterval(async () => {
      try {
        const { fase: noServidor } = await api.get<{ fase: FaseCliente }>(`/runs/${runId}/fase`);

        /**
         * O servidor já reconcilia turma × estudante e devolve a tela certa. O
         * cliente só obedece — com uma exceção: nunca puxa ninguém de volta para
         * a revelação/explicabilidade que ele já passou.
         */
        if (noServidor !== fase && noServidor !== "onboarding") {
          setFase(noServidor);
        }
      } catch {
        // Rede instável na escola é regra, não exceção: o próximo tick tenta.
      }
    }, 5_000);

    return () => window.clearInterval(intervalo);
  }, [fase, runId]);

  if (fase === "onboarding") {
    return (
      <Onboarding
        primeiroNome={dadosEstudante.displayName.split(" ")[0] ?? dadosEstudante.displayName}
        perguntaChave={missao.perguntaChave}
        aoEntrar={async (avatar, nome) => {
          const dados = await api.post<{ runId: string }>("/runs", { avatar });

          /**
           * Avisa o SERVIDOR que ele entrou. Antes isto era só `setFase("feed")`
           * no cliente, e o servidor seguia achando que a turma inteira estava no
           * onboarding — o que impedia o professor de mover a aula.
           */
          await api.post(`/runs/${dados.runId}/entrar`, { avatar, nome });
          experiencia().track("attempted", "onboarding", { resultado: { avatar } });

          await new Promise((resolve) => setTimeout(resolve, 1500)); // splash de 1,5s
          setRunId(dados.runId);
          setFase("feed");
        }}
      />
    );
  }

  /**
   * FASE 4: a conclusão da missão, ANTES da revelação. Cobre a tela inteira e o
   * feed não é renderizado atrás — o estudante não deve consultar o feed para
   * escrever.
   */
  if (fase === "conclusao" && runId) {
    return (
      <Conclusao
        perguntaChave={missao.perguntaChave}
        ladoALabel={missao.ladoALabel}
        ladoBLabel={missao.ladoBLabel}
        aoEnviar={async (inclinacao) => {
          try {
            await api.post(`/runs/${runId}/conclusao`, { inclinacao });
            // NÃO avança a fase: quem move a turma é quem conduz a aula.
            return true;
          } catch {
            return false;
          }
        }}
      />
    );
  }

  /**
   * EXPLICABILIDADE (fluxo v2) = revelação e, em seguida, o relatório. As duas
   * num componente só: o passo entre elas é estado local, porque marcá-lo como
   * fase fazia o polling da turma empurrar o estudante de volta para a revelação.
   *
   * `revelacao` e `dossie` são fases de runs congeladas antes do fluxo v2 e
   * caem aqui também — melhor a tela nova que uma tela órfã.
   */
  if ((fase === "explicabilidade" || fase === "revelacao" || fase === "dossie") && runId) {
    return (
      <Suspense fallback={null}>
        <Explicabilidade runId={runId} />
      </Suspense>
    );
  }

  /**
   * DEBATE (fluxo v2): a tela trava nos posts que o estudante salvou. É o único
   * momento em que ele não pode navegar — a conversa é entre pares, e o feed
   * aberto faria metade da sala rolar post novo em vez de defender o que coletou.
   */
  if (fase === "debate" && runId) {
    return <Debate runId={runId} />;
  }

  /**
   * O que ele não recebeu. O hub é avisado via exp:estado para emoldurar a tela
   * — o cinza dentro do aparelho e o aviso em volta dizem a mesma coisa por
   * dois caminhos.
   */
  if (fase === "perdidos" && runId) {
    return (
      <Suspense fallback={null}>
        <Perdidos runId={runId} />
      </Suspense>
    );
  }

  if ((fase === "reflexao" || fase === "fim") && runId) {
    return (
      <Suspense fallback={null}>
        <Reflexao runId={runId} />
      </Suspense>
    );
  }

  /**
   * Rede de segurança. Se o servidor mover o estudante para uma fase que ainda não
   * tem tela, ele NÃO pode ver o aparelho em branco. Melhor uma tela de espera
   * honesta, na língua do app.
   */
  if (fase === "fim") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="instanooria-wordmark text-[34px] leading-none">Instanooria</p>
        <p className="text-[15px] leading-relaxed text-ink/70">Já vem — deixa essa tela aberta.</p>
      </main>
    );
  }

  if (fase !== "feed" && fase !== "encerramento") return null;

  const encerrando = fase === "encerramento";
  // Sessão retomada já no encerramento (aparelho que ficou aberto): não há feed
  // atrás para desfocar — melhor a tela limpa que um borrão vazio.
  const desfocar = encerrando && itens.length > 0;

  const salvosCompletos = posts.filter((post) => salvos.has(post.id));

  return (
    <>
      <div
        className={`flex min-h-dvh flex-col bg-surface ${
          encerrando ? "pointer-events-none select-none" : ""
        } ${desfocar ? "blur-sm" : ""}`}
        aria-hidden={encerrando}
        onPointerDown={(evento) => {
          if (window.scrollY <= 0) inicioDoPuxao.current = evento.clientY;
        }}
        onPointerUp={(evento) => {
          if (
            inicioDoPuxao.current !== null &&
            evento.clientY - inicioDoPuxao.current > 90 &&
            !atualizando
          ) {
            setAtualizando(true);
            window.setTimeout(() => {
              // "Puxar para atualizar" é cosmético: só reordena.
              setItens((atual) => {
                const copia = [...atual];
                for (let i = copia.length - 1; i > 0; i -= 1) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [copia[i], copia[j]] = [copia[j]!, copia[i]!];
                }
                return copia;
              });
              setAtualizando(false);
            }, 700);
          }
          inicioDoPuxao.current = null;
        }}
      >
        <TopBar
          aoAbrirCompositor={() => setCompositorAberto(true)}
          aoTocarIgtv={() => avisar("disponível em breve")}
          naoLidas={naoLidas}
        />

        <div className="flex-1">
          {atualizando ? (
            <p className="py-3 text-center text-[12px] text-muted">atualizando…</p>
          ) : null}

          {aba === "feed" ? (
            <>
              <Stories
                posts={posts}
                avatarDoEstudante={dadosEstudante.avatar}
                aoGestoDeStory={(tipo, postId) => registrar(tipo, postId)}
                aoDwellDeStory={(postId, dwellMs) =>
                  registrar("visto", postId, { dwellMs, contexto: "story" })
                }
              />

              {meusPosts.map((post) => (
                <article key={post.criadoEm} className="border-b border-hairline">
                  <MeuPost post={post} avatar={dadosEstudante.avatar} handle={dadosEstudante.handle} />
                </article>
              ))}

              {itens.map((item, indice) => {
                // A sentinela vive 3 posts antes do fim — no fim da lista, o
                // bloco só era pedido quando o estudante já via o vazio.
                const faltamTresPosts = indice === Math.max(0, itens.length - 3);

                return (
                  <div key={item.tipo === "post" ? item.post.id : `modulo-${indice}`}>
                    {faltamTresPosts ? <div ref={sentinela} className="h-px" /> : null}
                    {item.tipo === "post" ? (
                      <PostCard
                        post={item.post}
                        acoes={acoes}
                        curtido={curtidos.has(item.post.id)}
                        salvo={salvos.has(item.post.id)}
                        seguindo={seguidosPorPost.has(item.post.id)}
                        comentariosDoEstudante={comentariosMeus[item.post.id] ?? 0}
                      />
                    ) : item.tipo === "sugestoes" ? (
                      <ModuloSugestoes
                        perfis={item.perfis}
                        seguidos={seguidosPorPerfil}
                        aoSeguir={seguirPerfil}
                      />
                    ) : null}
                  </div>
                );
              })}

              {carregando ? <SkeletonFeed cards={1} /> : null}
            </>
          ) : null}

          {aba === "busca" ? (
            <AbaBusca
              postsIniciais={acervo}
              aoBuscar={buscarNoAcervo}
              registrarElemento={registrarElemento}
              aoAbrir={(post) => {
                // Post alcançado FORA do feed curado: é o dado que mostra quem
                // furou a própria bolha por conta própria.
                registrar("abriu_da_busca", post.id);
                // Volta ao feed e leva o estudante até o post (como a busca do app real).
                setAba("feed");
                window.setTimeout(() => {
                  document
                    .querySelector(`article[data-post-id="${post.id}"]`)
                    ?.scrollIntoView({ block: "center" });
                }, 80);
              }}
            />
          ) : null}

          {aba === "notificacoes" ? (
            <AbaNotificacoes itens={notificacoes} aoSeguirDeVolta={seguirPerfil} />
          ) : null}

          {aba === "perfil" ? (
            <AbaPerfil
              handle={dadosEstudante.handle}
              displayName={dadosEstudante.displayName}
              avatarDoEstudante={dadosEstudante.avatar}
              salvos={salvosCompletos}
              meusPosts={meusPosts}
              aoAbrirMenu={() => setMenuDaContaAberto(true)}
            />
          ) : null}
        </div>

        <BottomNav
          ativa={aba}
          aoTrocar={(proxima) => {
            // A aba central do Figma é "criar": abre o compositor e a navegação
            // permanece onde estava, como no app real.
            if (proxima === "criar") {
              setCompositorAberto(true);
              return;
            }
            setAba(proxima);
            // Telemetria de exploração e de descoberta da busca.
            registrar("trocou_aba", null, { aba: proxima });
            if (proxima === "busca") registrar("abriu_busca");
            if (proxima === "notificacoes") setNaoLidas(0);
          }}
          avatarDoEstudante={dadosEstudante.avatar}
          naoLidas={naoLidas}
        />

        <ComentariosSheet
          post={postDeComentarios}
          avatarDoEstudante={dadosEstudante.avatar}
          handleDoEstudante={dadosEstudante.handle}
          aoFechar={() => setPostDeComentarios(null)}
          aoComentar={(post, texto) => {
            setComentariosMeus((atual) => ({
              ...atual,
              [post.id]: (atual[post.id] ?? 0) + 1,
            }));
            registrar("comentou", post.id, { texto });
            /**
             * Descarrega o buffer na hora. O comentário é persistido junto com o
             * evento; esperar os 4s do flush normal significaria que reabrir o
             * sheet nesse intervalo mostraria o post SEM o que ele acabou de
             * escrever.
             */
            void buffer.current?.flush();
          }}
          // Curtir um comentário não é "abrir comentários": não inventa sinal.
          aoCurtirComentario={() => undefined}
        />

        <CompartilharSheet
          post={postDeCompartilhar}
          aoFechar={() => setPostDeCompartilhar(null)}
          aoEnviar={(post) => {
            registrar("compartilhou", post.id);
            avisar("Enviado");
          }}
        />

        <OpcoesSheet
          post={postDeOpcoes}
          aoFechar={() => setPostDeOpcoes(null)}
          aoNaoInteressa={(post) => {
            registrar("nao_interessa", post.id);
            setItens((atual) =>
              atual.filter((item) => item.tipo !== "post" || item.post.id !== post.id),
            );
            avisar("Ok, vamos mostrar menos disso");
          }}
          aoDenunciar={(post) => {
            registrar("denunciou", post.id);
            avisar("Obrigado por avisar");
          }}
        />

        <ModalPerfil
          perfil={perfilAberto}
          seguindo={
            perfilAberto?.postIdDeOrigem ? seguidosPorPost.has(perfilAberto.postIdDeOrigem) : false
          }
          aoFechar={() => setPerfilAberto(null)}
          aoSeguir={(perfil, seguindo) => {
            const postId = perfil.postIdDeOrigem;
            if (postId) {
              setSeguidosPorPost((atual) => {
                const proximo = new Set(atual);
                if (seguindo) proximo.add(postId);
                else proximo.delete(postId);
                return proximo;
              });
              registrar(seguindo ? "seguiu" : "deixou_seguir", postId);
              return;
            }
            seguirPerfil(perfil, seguindo);
          }}
          posts={posts.filter((post) => post.author.handle === perfilAberto?.handle)}
        />

        {compositorAberto ? (
          <Compositor
            avatarDoEstudante={dadosEstudante.avatar}
            aoFechar={() => setCompositorAberto(false)}
            aoPublicar={async (texto, template) => {
              setCompositorAberto(false);
              const criadoEm = Date.now();
              setMeusPosts((atual) => [{ texto, template, criadoEm, apoio: [] }, ...atual]);
              avisar("Publicado");

              if (!runId) return;
              try {
                const dados = await api.post<{
                  comentariosDeApoio?: { handle: string; texto: string }[];
                }>(`/runs/${runId}/student-post`, { texto, template });
                setMeusPosts((atual) =>
                  atual.map((post) =>
                    post.criadoEm === criadoEm
                      ? { ...post, apoio: dados.comentariosDeApoio ?? [] }
                      : post,
                  ),
                );
              } catch {
                // sem rede: o post fica no feed do estudante de todo jeito
              }
            }}
          />
        ) : null}

        <MenuPerfil aberto={menuDaContaAberto} aoFechar={() => setMenuDaContaAberto(false)} />

        <Toast mensagem={toast} />
      </div>

      {/*
        A tela de encerramento fica FORA do container que recebe `aria-hidden`:
        dentro dele, ela desaparecia da árvore de acessibilidade — invisível
        para leitor de tela e para navegação por teclado.
      */}
      {encerrando && runId ? (
        <Encerramento
          postosVistos={posts.length}
          aoVer={async () => {
            await buffer.current?.flush();
            /**
             * `finish` congela a run e computa o dossiê, mas leva para
             * `conclusao`, não para `revelacao`: o estudante responde a pergunta
             * ANTES de saber que o feed era enviesado.
             */
            await api.post(`/runs/${runId}/finish`).catch(() => undefined);
            setFase("conclusao");
          }}
        />
      ) : null}
    </>
  );
}

/** Post do estudante no topo do feed, com curtidas fake subindo. */
function MeuPost({
  post,
  avatar,
  handle,
}: {
  post: { texto: string; template: string; criadoEm: number; apoio: { handle: string; texto: string }[] };
  avatar: string;
  handle: string;
}) {
  const [curtidas, setCurtidas] = useState(12);
  const [apoioVisivel, setApoioVisivel] = useState(0);

  useEffect(() => {
    const marcos = [47, 89, 134, 186];
    const timers = marcos.map((valor, indice) =>
      window.setTimeout(() => setCurtidas(valor), (indice + 1) * 4000),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // Comentários de apoio chegam um a um, como numa rede de verdade.
  useEffect(() => {
    if (post.apoio.length === 0) return;
    const timers = post.apoio.map((_, indice) =>
      window.setTimeout(() => setApoioVisivel(indice + 1), (indice + 1) * 5000),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [post.apoio]);

  const fundo =
    {
      coral: "linear-gradient(135deg,#FF5C6E,#FF9A6E)",
      violeta: "linear-gradient(135deg,#7B4DFF,#C86DD7)",
      oceano: "linear-gradient(135deg,#2E9BF5,#26D0CE)",
      limao: "linear-gradient(135deg,#A8E063,#56AB2F)",
      noite: "linear-gradient(135deg,#232526,#414345)",
      doce: "linear-gradient(135deg,#FBD3E9,#BB377D)",
      areia: "linear-gradient(135deg,#F6D365,#FDA085)",
      menta: "linear-gradient(135deg,#B2FEFA,#0ED2F7)",
    }[post.template] ?? "linear-gradient(135deg,#FF5C6E,#7B4DFF)";

  return (
    <>
      <header className="flex h-postheader items-center gap-2.5 px-3">
        <AvatarPerfil seed={avatar} tamanho={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{handle.replace(/^@/, "")}</p>
        </div>
        <Glifo name="more" size={18} />
      </header>
      <div
        className="flex aspect-post w-full items-center justify-center px-8 text-center text-[24px] font-semibold leading-tight text-white"
        style={{ background: fundo }}
      >
        {post.texto}
      </div>
      {/* Mesma barra de ações dos outros cards: sem ela, o post do estudante era o
          único card diferente do feed e saltava aos olhos. */}
      <div className="flex h-actionbar items-center justify-between px-3">
        <div className="flex items-center gap-4">
          <Glifo name="heartFilled" size={24} tone="like" />
          <Glifo name="comment" size={24} />
          <Glifo name="share" size={22} />
        </div>
        <Glifo name="bookmark" size={24} />
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-3">
        <p className="text-[14px] font-semibold text-ink">{curtidas} curtidas</p>
        {post.apoio.slice(0, apoioVisivel).map((comentario) => (
          <p key={comentario.handle + comentario.texto} className="text-[14px] leading-snug text-ink">
            <span className="font-semibold">{comentario.handle.replace(/^@/, "")}</span>{" "}
            {comentario.texto}
          </p>
        ))}
        <p className="text-[11px] text-muted">agora mesmo</p>
      </div>
    </>
  );
}
