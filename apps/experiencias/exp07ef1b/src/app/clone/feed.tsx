import { useEffect, useRef, useState } from "react";
import { BadgeUnv, FloatingButton, GestureHint, InlineHint, PostCard, TopBar } from "@edu/ui/ds-unoovista";
import { dicaDoFeed, nomeDaConta, SALVOS_PARA_A_PILULA, SEGUNDOS_ATE_A_DEMONSTRACAO, SEGUNDOS_ATE_A_DICA } from "../../lib/regras";
import { telemetria } from "../../lib/telemetria";
import { CONTAS, E2 } from "../../lib/textos";
import type { PostPublico } from "../../lib/tipos";
import { MidiaDoPost, usePaleta } from "../componentes/midia";
import { BarraDeAbas } from "./barra-de-abas";

/** As iniciais do avatar do veículo. Mesma cor para todos: o avatar do DS é neutro. */
function iniciais(perfil: string): string {
  return nomeDaConta(perfil).replace(/[^\p{L}]/gu, "").slice(0, 2).toUpperCase();
}

/**
 * E2-ALU-01 — o feed da cobertura. A tela ALTA do garimpo.
 *
 * - **Os 12 posts na ordem que a api mandou** (`ORDEM_DO_FEED`, intercalada e
 *   fixa: dois colegas lado a lado precisam poder dizer "o terceiro post").
 * - **Só o salvar, nas ações do post** (ADR-146). Curtir, comentar e
 *   compartilhar saíram a pedido do PO: nenhum muda nada na missão, e cada
 *   um era um convite a se distrair do único gesto que conta. A contagem de
 *   curtidas fica — é prova social que a criança LÊ, não um botão.
 * - **Os comentários têm autor**, como numa rede de verdade, e a linha "Ver
 *   todos os N comentários" saiu: não havia o que abrir.
 * - **Salvar é o gesto da missão.** Os ids ficam na memória e no
 *   `sessionStorage` (conveniência de F5, só ids — `lib/memoria.ts`); quem
 *   decide o que vale é a publicação, na aba Salvos.
 * - **A pílula "Ir para aba Salvos"** aparece com 3 salvos. Antes disso ela
 *   não existe — e a aba Salvos da barra inferior continua lá, porque o app
 *   real tem: quem entra nela com menos de 3 lê o aviso da poda.
 *
 * O andaime (`[D0-2]` e os caminhos degenerados da spec) é sobre o GESTO,
 * nunca sobre o conteúdo: 10 s parado na entrada → a demonstração de rolar
 * (uma vez, e nunca com `prefers-reduced-motion`); 3 min sem salvar → a dica do
 * marcador. A dica some no primeiro salvamento.
 */
export function Feed({
  posts,
  salvos,
  ocupado,
  aoSalvar,
  aoIrParaSalvos,
}: {
  posts: PostPublico[];
  salvos: readonly string[];
  ocupado: boolean;
  aoSalvar: (postId: string) => void;
  aoIrParaSalvos: () => void;
}) {
  const paleta = usePaleta();
  const [passouDoTeto, setPassouDoTeto] = useState(false);
  const [demonstrando, setDemonstrando] = useState(false);
  const rolou = useRef(false);
  const avisados = useRef(new Set<string>());

  // A demonstração do gesto de rolar: 10 s sem rolar na entrada, UMA vez.
  useEffect(() => {
    const semMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (semMovimento) return;
    const relogio = window.setTimeout(() => {
      if (!rolou.current) setDemonstrando(true);
    }, SEGUNDOS_ATE_A_DEMONSTRACAO * 1000);
    return () => window.clearTimeout(relogio);
  }, []);

  // O teto de 3 min sem salvar. O relógio é desta visita ao feed.
  useEffect(() => {
    const relogio = window.setTimeout(() => setPassouDoTeto(true), SEGUNDOS_ATE_A_DICA * 1000);
    return () => window.clearTimeout(relogio);
  }, []);

  const dica = dicaDoFeed(salvos.length, passouDoTeto ? SEGUNDOS_ATE_A_DICA : 0);

  useEffect(() => {
    const motivo = demonstrando ? "demonstracao" : dica;
    if (motivo && !avisados.current.has(motivo)) {
      avisados.current.add(motivo);
      telemetria.viuAndaime(motivo);
    }
  }, [demonstrando, dica]);

  function aoRolar() {
    if (rolou.current) return;
    rolou.current = true;
    setDemonstrando(false);
  }

  const salvosSet = new Set(salvos);

  return (
    <div className="tela tela--clara">
      <h1 className="so-leitor">{E2.tituloDaTela}</h1>
      <TopBar
        title={CONTAS.estudante}
        withStatusBarInset={false}
        trailing={
          <BadgeUnv variant="neutral" aria-live="polite">
            {E2.contadorSalvos(salvos.length)}
          </BadgeUnv>
        }
      />
      {dica && (
        <InlineHint announce>{E2.dicaInatividade}</InlineHint>
      )}
      <div className="rolagem rolagem--sem-barra" onScroll={aoRolar} onWheel={aoRolar} onTouchMove={aoRolar}>
        {posts.map((post) => {
          const conta = nomeDaConta(post.perfil);
          return (
            <PostCard key={post.id} className="post">
              <PostCard.Header username={conta} initials={iniciais(post.perfil)} />
              <MidiaDoPost post={post} paleta={paleta} aoRecarregar={() => telemetria.recarregouMidia(post.id)} />
              <PostCard.Actions actions={[]} saved={salvosSet.has(post.id)} onSave={() => aoSalvar(post.id)} />
              <PostCard.Likes>{E2.curtidas(post.curtidas)}</PostCard.Likes>
              <PostCard.Caption username={conta}>{post.legenda}</PostCard.Caption>
              {post.comentariosDestaque.map((comentario, i) => (
                <PostCard.Caption key={i} className="post__comentario" username={comentario.autor}>
                  {comentario.mensagem}
                </PostCard.Caption>
              ))}
            </PostCard>
          );
        })}
      </div>
      {demonstrando && <GestureHint gesture="swipe-up" />}
      <FloatingButton
        icon="bookmarkFilled"
        placement="bottom"
        offset="calc(var(--unv-tabbar-height) + var(--unv-spacing-xs))"
        hidden={salvos.length < SALVOS_PARA_A_PILULA}
        disabled={ocupado}
        onClick={aoIrParaSalvos}
      >
        {E2.irSalvos}
      </FloatingButton>
      <BarraDeAbas ativa="feed" aoTrocar={(aba) => aba === "salvos" && aoIrParaSalvos()} />
    </div>
  );
}
