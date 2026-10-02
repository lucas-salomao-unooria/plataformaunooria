import { useCallback, useEffect, useRef } from "react";
import { FloatingButton, InlineHint, TabBar, TopBar, type UnvTabItem } from "@edu/ui/ds-unoovista";
import { FRACAO_VISIVEL } from "../../lib/regras";
import { criarRastreadorDePermanencia, type RastreadorDePermanencia } from "../../lib/permanencia";
import { E2, GLOBAL } from "../../lib/textos";
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
 * - **Curtir e ficar** são os dois sinais: a curtida (coração ou toque duplo) e
 *   a permanência de mais de 5 s (`lib/permanencia.ts`), uma vez por post.
 * - **Quando o décimo chega** (`completo`), acende a barra fixa da cédula e a
 *   linha da comissão no topo. A rolagem continua livre: a criança pode reler
 *   antes de votar.
 */
export function Feed({
  posts,
  categorias,
  curtidos,
  completo,
  carregando,
  comDica,
  permanenciasContadas,
  aoCurtir,
  aoPermanecer,
  aoChegarNoFim,
  aoDeslizar,
  aoExpandir,
  aoAbrirCedula,
  aoTocarCedulaCedo,
}: {
  posts: readonly PostPublico[];
  categorias: readonly Categoria[];
  curtidos: ReadonlySet<string>;
  completo: boolean;
  carregando: boolean;
  comDica: boolean;
  permanenciasContadas: readonly string[];
  aoCurtir: (postId: string, curtiu: boolean, gesto: "coracao" | "toque-duplo") => void;
  aoPermanecer: (postId: string) => void;
  aoChegarNoFim: () => void;
  aoDeslizar: (postId: string, lamina: number) => void;
  aoExpandir: (postId: string) => void;
  aoAbrirCedula: () => void;
  aoTocarCedulaCedo: () => void;
}) {
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
      <h1 className="so-leitor">{E2.tituloDaTela}</h1>
      <TopBar title={E2.topo} withStatusBarInset={false} />
      {completo ? (
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
            paleta={paleta}
            comDica={comDica && i === 0}
            refDoCartao={refDoPost(post.id)}
            aoCurtir={(curtiu, gesto) => aoCurtir(post.id, curtiu, gesto)}
            aoDeslizar={(lamina) => aoDeslizar(post.id, lamina)}
            aoExpandir={() => aoExpandir(post.id)}
          />
        ))}
        {carregando && !completo && (
          <p className="feed__carregando" role="status">
            {GLOBAL.carregando}
          </p>
        )}
        <div className="feed__respiro" aria-hidden="true" />
      </div>
      <FloatingButton
        icon="lock"
        placement="bottom"
        offset="calc(var(--unv-tabbar-height) + var(--unv-spacing-xs))"
        hidden={!completo}
        onClick={aoAbrirCedula}
      >
        {E2.barraDaCedula}
      </FloatingButton>
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
    </div>
  );
}
