import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { FloatingButton, InlineHint, TabBar, TopBar, type UnvTabItem } from "@edu/ui/ds-unoovista";
import { FRACAO_VISIVEL } from "../../lib/regras";
import { criarRastreadorDePermanencia, type RastreadorDePermanencia } from "../../lib/permanencia";
import { DESVIO, E2, GLOBAL } from "../../lib/textos";
import type { Categoria, PostPublico } from "../../lib/tipos";
import { usePaleta } from "../componentes/midia";
import { PostDoFeed } from "./post-do-feed";

/**
 * A barra inferior com DUAS abas — Feed e Cédula — e a ausência das outras é
 * decisão, não esquecimento: o desenho da missão fecha DM, comentários e busca
 * nesta etapa (a busca é a ferramenta da Galeria Oculta, depois do pico), e
 * desenhar os ícones mudos poria na tela alvos que não fazem nada. A Cédula
 * antes do décimo post responde com a frase da comissão (`feed-incompleto`).
 */
const ABAS: UnvTabItem[] = [
  { id: "feed", label: E2.abaFeed, icon: "home", activeIcon: "home" },
  { id: "cedula", label: E2.abaCedula, icon: "lock", activeIcon: "lock" },
];

/**
 * E2/E3-ALU-01 — o feed da mostra, servido UM POST POR VEZ pelo servidor.
 *
 * - **A ordem é a do servidor.** A abertura traz quatro (um de cada área); cada
 *   vez que o último post servido chega à tela (≥ 60% visível), a tela pede o
 *   próximo (`proximo: true`), junto com as curtidas e as permanências ainda
 *   não enviadas. Quem escolhe o post seguinte é o motor da api — a tela não
 *   sabe a regra, e não tem como saber.
 * - **Curtir, salvar e ficar** são os três sinais: a curtida (coração ou toque
 *   duplo), o salvo e a permanência de mais de 5 s (`lib/permanencia.ts`), uma
 *   vez por post.
 * - **Quando o décimo chega** (`completo`), acende a barra fixa da cédula e a
 *   linha da comissão no topo. A rolagem continua livre: a criança pode reler
 *   antes de votar.
 *
 * **O mesmo feed serve a RODADA DE DESVIO** (`modo: "desvio"`, 2026-10-07): a
 * mesma medida e o mesmo pedido do próximo, outra rota e outra moldura — a
 * instrução da comissão no topo, a comparação no fim (`rodape`) e, no lugar da
 * cédula, a barra que encerra a rodada. Sem a barra de abas: não há cédula.
 */
export function Feed({
  modo = "juri",
  posts,
  categorias,
  curtidos,
  salvos,
  completo,
  carregando,
  comDica,
  permanenciasContadas,
  rodape,
  aoCurtir,
  aoSalvar,
  aoInteracaoFechada,
  aoPermanecer,
  aoChegarNoFim,
  aoDeslizar,
  aoExpandir,
  aoAbrirCedula,
  aoTocarCedulaCedo,
}: {
  modo?: "juri" | "desvio";
  posts: readonly PostPublico[];
  categorias: readonly Categoria[];
  curtidos: ReadonlySet<string>;
  salvos: ReadonlySet<string>;
  completo: boolean;
  carregando: boolean;
  comDica: boolean;
  permanenciasContadas: readonly string[];
  /** Depois do último post: a comparação do desvio. */
  rodape?: ReactNode;
  aoCurtir: (postId: string, curtiu: boolean, gesto: "coracao" | "toque-duplo") => void;
  aoSalvar: (postId: string, salvou: boolean) => void;
  aoInteracaoFechada: (acao: "comentar" | "compartilhar") => void;
  aoPermanecer: (postId: string) => void;
  aoChegarNoFim: () => void;
  aoDeslizar: (postId: string, lamina: number) => void;
  aoExpandir: (postId: string) => void;
  /** A barra fixa: a cédula no júri; encerrar a rodada no desvio. */
  aoAbrirCedula: () => void;
  aoTocarCedulaCedo: () => void;
}) {
  const desvio = modo === "desvio";
  const paleta = usePaleta();
  const porArea = new Map(categorias.map((c) => [c.area, c]));

  // ── a permanência (uma vez por post, > 5 s com ≥ 60% na tela)
  const aoPermanecerRef = useRef(aoPermanecer);
  aoPermanecerRef.current = aoPermanecer;
  const rastreador = useRef<RastreadorDePermanencia | null>(null);
  const contadas = useRef(permanenciasContadas);
  useEffect(() => {
    const r = criarRastreadorDePermanencia((id) => aoPermanecerRef.current(id), contadas.current);
    rastreador.current = r;
    return () => {
      r.liberar();
      rastreador.current = null;
    };
  }, []);

  // ── o último post servido chegou à tela: pede o próximo
  const aoChegarNoFimRef = useRef(aoChegarNoFim);
  aoChegarNoFimRef.current = aoChegarNoFim;
  const ultimoId = posts[posts.length - 1]?.id ?? null;
  const observadorDoFim = useRef<IntersectionObserver | null>(null);
  const elementos = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (completo || !ultimoId) return;
    const alvo = elementos.current.get(ultimoId);
    if (!alvo) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting && e.intersectionRatio >= FRACAO_VISIVEL)) aoChegarNoFimRef.current();
      },
      { threshold: [0, FRACAO_VISIVEL] },
    );
    obs.observe(alvo);
    observadorDoFim.current = obs;
    return () => obs.disconnect();
  }, [ultimoId, completo]);

  const refDoPost = useCallback(
    (postId: string) => (no: HTMLElement | null) => {
      const anterior = elementos.current.get(postId);
      if (anterior && anterior !== no) rastreador.current?.esquecer(anterior);
      if (no) {
        elementos.current.set(postId, no);
        rastreador.current?.observar(no, postId);
      } else {
        elementos.current.delete(postId);
      }
    },
    [],
  );

  return (
    <div className="tela">
      <h1 className="so-leitor">{desvio ? DESVIO.tituloDaTela : E2.tituloDaTela}</h1>
      <TopBar title={E2.topo} withStatusBarInset={false} />
      {desvio ? (
        <InlineHint announce>{DESVIO.instrucao}</InlineHint>
      ) : completo ? (
        <InlineHint announce>{E2.cedulaPronta}</InlineHint>
      ) : comDica ? (
        <InlineHint>{E2.dicaDoCarrossel}</InlineHint>
      ) : null}
      <div className="rolagem rolagem--sem-barra feed">
        {posts.map((post, i) => (
          <PostDoFeed
            key={post.id}
            post={post}
            categoria={porArea.get(post.area)}
            curtido={curtidos.has(post.id)}
            salvo={salvos.has(post.id)}
            paleta={paleta}
            comDica={comDica && i === 0}
            refDoCartao={refDoPost(post.id)}
            aoCurtir={(curtiu, gesto) => aoCurtir(post.id, curtiu, gesto)}
            aoSalvar={(salvou) => aoSalvar(post.id, salvou)}
            aoInteracaoFechada={aoInteracaoFechada}
            aoDeslizar={(lamina) => aoDeslizar(post.id, lamina)}
            aoExpandir={() => aoExpandir(post.id)}
          />
        ))}
        {carregando && !completo && (
          <p className="feed__carregando" role="status">
            {GLOBAL.carregando}
          </p>
        )}
        {rodape}
        <div className="feed__respiro" aria-hidden="true" />
      </div>
      <FloatingButton
        icon={desvio ? "check" : "lock"}
        placement="bottom"
        offset={desvio ? "var(--unv-spacing-s)" : "calc(var(--unv-tabbar-height) + var(--unv-spacing-xs))"}
        hidden={!completo}
        onClick={aoAbrirCedula}
      >
        {desvio ? DESVIO.encerrar : E2.barraDaCedula}
      </FloatingButton>
      {!desvio && (
        <TabBar
          items={ABAS}
          activeId="feed"
          ariaLabel={E2.navegacao}
          withHomeIndicatorInset={false}
          onChange={(id) => {
            if (id !== "cedula") return;
            if (completo) aoAbrirCedula();
            else aoTocarCedulaCedo();
          }}
        />
      )}
    </div>
  );
}
