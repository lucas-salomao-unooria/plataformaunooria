import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeUnv,
  BottomSheetUnv,
  ButtonUnv,
  FloatingButton,
  IconUnv,
  InlineHint,
  ListItem,
  NotificationItem,
  ProfileHeader,
  TabBar,
} from "@edu/ui/ds-unoovista";
import { FRACAO_VISIVEL, estandesPorPasta, iniciais } from "../../lib/regras";
import { criarRastreadorDePermanencia, type RastreadorDePermanencia } from "../../lib/permanencia";
import { CONTAS, E1, E2, GLOBAL, PASTAS } from "../../lib/textos";
import type { Area, Categoria, PostPublico } from "../../lib/tipos";
import { usePaleta } from "../componentes/midia";
import { ABAS, type IdDaAba } from "./abas";
import { Cabecalho } from "./cabecalho";
import { PostDoFeed } from "./post-do-feed";

/**
 * E2/E3-ALU-01 — o feed da mostra, servido UM POST POR VEZ pelo servidor.
 *
 * - **A ordem é a do servidor.** A abertura traz quatro (um de cada área); cada
 *   vez que o último post servido chega à tela (≥ 60% visível), a tela pede o
 *   próximo (`proximo: true`). O primeiro pedido é a 1ª ROLAGEM: liga o relógio
 *   de 8 minutos do servidor. Quem escolhe o post seguinte é o motor da api.
 * - **Curtir e ficar** são os sinais que pesam (a curtida pelo coração ou pelo
 *   toque duplo; a permanência de mais de 5 s, `lib/permanencia.ts`). **Salvar**
 *   grava o evento e não pesa (PRD v2).
 * - **As PASTAS** (ADR-176, a separação da EF06CO01): o "Salvar" do post abre
 *   a folha "Salvar em" com as quatro pastas da mostra (as áreas do pacote),
 *   como as coleções do app. Tocar numa pasta guarda — ou MOVE — o estande;
 *   "Remover dos salvos" tira. A comissão pede no topo do feed; a aba Jurado
 *   mostra as pastas com quantos estandes cada uma guarda. Não há certo nem
 *   errado na tela: quem corrige é o servidor, no voto.
 * - **A barra fixa da cédula** acende quando o SERVIDOR libera
 *   (`cedulaLiberada`: os dez chegaram, ou os 8 minutos acabaram). A rolagem
 *   continua livre: a criança pode reler antes de votar.
 *
 * **As quatro abas** (`abas.ts`): o feed fica montado e só se esconde nas
 * outras, para a rolagem, as curtidas pendentes e a medida não se perderem.
 */
export function Feed({
  posts,
  curtidos,
  salvos,
  pastas,
  categorias,
  podeCrescer,
  cedulaLiberada,
  carregando,
  comDica,
  permanenciasContadas,
  aoCurtir,
  aoSalvar,
  aoFechado,
  aoPermanecer,
  aoChegarNoFim,
  aoDeslizar,
  aoExpandir,
  aoAbrirCedula,
  aoTrocarDeAba,
}: {
  posts: readonly PostPublico[];
  curtidos: ReadonlySet<string>;
  salvos: ReadonlySet<string>;
  /** A pasta (área) de cada post salvo, com a fila por cima. */
  pastas: Partial<Record<string, Area>>;
  /** As quatro áreas do pacote: os nomes das pastas. */
  categorias: readonly Categoria[];
  /** O servidor ainda serve posts (nem os dez, nem o tempo esgotado). */
  podeCrescer: boolean;
  cedulaLiberada: boolean;
  carregando: boolean;
  comDica: boolean;
  permanenciasContadas: readonly string[];
  aoCurtir: (postId: string, curtiu: boolean, gesto: "coracao" | "toque-duplo") => void;
  /** Guardou numa pasta (`pasta`) ou tirou dos salvos (`null`). */
  aoSalvar: (postId: string, pasta: Area | null) => void;
  /** Comentar, compartilhar ou a aba Busca: a comissão responde que estão fechados. */
  aoFechado: (acao: "comentar" | "compartilhar" | "buscar") => void;
  aoPermanecer: (postId: string) => void;
  aoChegarNoFim: () => void;
  aoDeslizar: (postId: string, foto: number) => void;
  aoExpandir: (postId: string) => void;
  aoAbrirCedula: () => void;
  aoTrocarDeAba: (aba: IdDaAba) => void;
}) {
  const paleta = usePaleta();
  const [aba, setAba] = useState<IdDaAba>("inicio");
  /** O post cuja folha de pastas está aberta. */
  const [salvando, setSalvando] = useState<string | null>(null);
  const pastaAtual = salvando ? (pastas[salvando] ?? null) : null;
  const porPasta = estandesPorPasta(posts, pastas);

  function guardar(postId: string, pasta: Area | null) {
    setSalvando(null);
    aoSalvar(postId, pasta);
  }

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
  const elementos = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!podeCrescer || !ultimoId || aba !== "inicio") return;
    const alvo = elementos.current.get(ultimoId);
    if (!alvo) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting && e.intersectionRatio >= FRACAO_VISIVEL)) aoChegarNoFimRef.current();
      },
      { threshold: [0, FRACAO_VISIVEL] },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [ultimoId, podeCrescer, aba]);

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

  function trocarDeAba(id: string) {
    if (id === "busca") {
      aoFechado("buscar");
      return;
    }
    const nova = id as IdDaAba;
    setAba(nova);
    aoTrocarDeAba(nova);
  }

  return (
    <div className="tela">
      <h1 className="so-leitor">{E2.tituloDaTela}</h1>
      <Cabecalho />
      <div className="rolagem rolagem--sem-barra feed" hidden={aba !== "inicio"}>
        <div className="feed__pedido">
          {/* O `InlineHint` desenha o próprio ícone: um segundo ícone aqui sairia dobrado. */}
          <InlineHint tone="neutral">{PASTAS.pedido}</InlineHint>
        </div>
        {posts.map((post, i) => (
          <PostDoFeed
            key={post.id}
            post={post}
            curtido={curtidos.has(post.id)}
            salvo={salvos.has(post.id)}
            paleta={paleta}
            comDica={comDica && i === 0}
            refDoCartao={refDoPost(post.id)}
            aoCurtir={(curtiu, gesto) => aoCurtir(post.id, curtiu, gesto)}
            aoSalvar={() => setSalvando(post.id)}
            aoFechado={aoFechado}
            aoDeslizar={(foto) => aoDeslizar(post.id, foto)}
            aoExpandir={() => aoExpandir(post.id)}
          />
        ))}
        {carregando && podeCrescer && (
          <p className="feed__carregando" role="status">
            {GLOBAL.carregando}
          </p>
        )}
        <div className="feed__respiro" aria-hidden="true" />
      </div>

      {aba === "notificacoes" && (
        <div className="rolagem rolagem--sem-barra">
          <h2 className="aba__titulo">{E2.notificacoesTitulo}</h2>
          <NotificationItem
            username={CONTAS.comissao}
            initials={iniciais(CONTAS.comissao)}
            action={E2.notificacaoDoCracha}
          />
        </div>
      )}

      {aba === "jurado" && (
        <div className="rolagem rolagem--sem-barra">
          <ProfileHeader
            name={CONTAS.jurado}
            initials="JO"
            avatarRing="none"
            verified
            bio={
              <>
                <BadgeUnv variant="neutral" wrap>
                  {E1.topo}
                </BadgeUnv>
                <span className="perfil__mandato">{E1.corpo}</span>
              </>
            }
          />
          <h2 className="aba__titulo">{PASTAS.titulo}</h2>
          <ul className="pastas">
            {categorias.map((c) => (
              <li key={c.area}>
                <ListItem
                  as="div"
                  size="sm"
                  leading={<IconUnv name="bookmark" size="md" tone="inherit" />}
                  title={c.nome}
                  subtitle={PASTAS.quantos(porPasta[c.area])}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <BottomSheetUnv
        open={salvando !== null}
        modal
        title={PASTAS.salvarEm}
        maxHeight="70%"
        onOpenChange={(abrir) => {
          if (!abrir) setSalvando(null);
        }}
      >
        <div className="pastas-do-salvar">
          <p className="pastas-do-salvar__instrucao">{PASTAS.instrucao}</p>
          <ul className="pastas">
            {categorias.map((c) => {
              const aqui = pastaAtual === c.area;
              return (
                <li key={c.area}>
                  <ListItem
                    size="md"
                    aria-label={PASTAS.pastaDe(c.nome)}
                    aria-pressed={aqui}
                    data-pasta={c.area}
                    leading={<IconUnv name={aqui ? "bookmarkFilled" : "bookmark"} size="md" tone="inherit" />}
                    title={c.nome}
                    trailing={aqui ? <IconUnv name="check" size="sm" tone="inherit" /> : undefined}
                    onClick={() => {
                      if (salvando) guardar(salvando, c.area);
                    }}
                  />
                </li>
              );
            })}
          </ul>
          {salvando && salvos.has(salvando) && (
            <ButtonUnv variant="secondary" size="md" block onClick={() => guardar(salvando, null)}>
              {PASTAS.remover}
            </ButtonUnv>
          )}
        </div>
      </BottomSheetUnv>

      <FloatingButton
        icon="lock"
        placement="bottom"
        offset="calc(var(--unv-tabbar-height) + var(--unv-spacing-xs))"
        hidden={!cedulaLiberada || aba !== "inicio"}
        onClick={aoAbrirCedula}
      >
        {E2.abrirCedula}
      </FloatingButton>
      <TabBar
        items={ABAS}
        activeId={aba}
        ariaLabel={E2.navegacao}
        withHomeIndicatorInset={false}
        onChange={(id) => trocarDeAba(id)}
      />
    </div>
  );
}
