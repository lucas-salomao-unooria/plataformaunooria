import { useState } from "react";
import {
  BadgeInsta,
  ButtonInsta,
  ConfirmDialog,
  IconInsta,
  InlineHint,
  MediaGrid,
  StoryComposer,
  TopBar,
  type InstaMediaItem,
} from "@edu/ui/ds-insta";
import { legendaCurta, legendaValida, situacaoDaSelecao, temaNaFrase } from "../../lib/regras";
import { telemetria } from "../../lib/telemetria";
import { E3 } from "../../lib/textos";
import type { Limites, PostPublico } from "../../lib/tipos";
import { altDoPost, srcDoPost, usePaleta } from "../componentes/midia";
import { BarraDeAbas } from "./barra-de-abas";

/** O resultado da publicação, como a tela precisa dele. */
export type ResultadoDaPublicacao = "publicada" | "recusada" | "outra";

/**
 * E3-ALU-01 e E3-ALU-02 — a aba Salvos, a poda e o alerta irreversível.
 *
 * **A poda é a decisão que a missão mede**, e a tela a faz ser da criança:
 * todo post salvo entra selecionado, e ela desmarca na grade até sobrarem
 * exatamente três. Menos que três trava com o aviso operacional; mais trava
 * com o aviso de atrito ("Remova N posts"). Nada aqui sugere QUAIS três.
 *
 * **A legenda conta em code points, como a api** (`regras.ts`). O contador
 * VISÍVEL é o do `StoryComposer`, que conta `.length` (UTF-16): com emoji os
 * dois divergem, e quem decide se o botão acende é a régua da api, não o
 * número do DS — a diferença está registrada como pedido no `AGENTS.md`.
 *
 * **O latch só existe quando a api confirma.** O toque em "Confirmar
 * publicação" não muda a tela: quem muda é a resposta de `POST decisao`, que
 * devolve o passo `publicado`. Se ela cair na rede, a chamada se repete
 * (`conexao.ts`) com o alerta ocupado; se já tinha chegado ao servidor, a
 * repetição volta com 409 e a casca relê a sessão.
 */
export function Salvos({
  posts,
  salvos,
  selecao,
  tema,
  limites,
  legenda,
  publicando,
  aoMudarLegenda,
  aoAlternar,
  aoVoltarAoFeed,
  aoPublicar,
}: {
  posts: PostPublico[];
  salvos: readonly string[];
  selecao: readonly string[];
  tema: string;
  limites: Limites;
  legenda: string;
  publicando: boolean;
  aoMudarLegenda: (texto: string) => void;
  aoAlternar: (postId: string) => void;
  aoVoltarAoFeed: () => void;
  aoPublicar: () => Promise<ResultadoDaPublicacao>;
}) {
  const paleta = usePaleta();
  const [confirmando, setConfirmando] = useState(false);
  const [recusada, setRecusada] = useState(false);

  const porId = new Map(posts.map((p) => [p.id, p]));
  const itens: InstaMediaItem[] = salvos
    .map((id) => porId.get(id))
    .filter((p): p is PostPublico => Boolean(p))
    .map((p) => ({ id: p.id, src: srcDoPost(p, paleta, "quadrado"), alt: altDoPost(p) }));

  const situacao = situacaoDaSelecao(selecao.length, limites.selecao);
  const legendaOk = legendaValida(legenda, limites.legendaMin, limites.legendaMax);
  const podePublicar = situacao.tipo === "pronta" && legendaOk && !publicando;

  /* Um aviso por vez, na ordem em que a criança os resolve: primeiro a poda
     (é a decisão), depois a legenda. A recusa do sanitizador passa na frente
     porque é a resposta ao toque que ela acabou de dar. */
  const aviso = recusada
    ? E3.legendaRecusada
    : situacao.tipo === "excesso"
      ? E3.avisoExcesso(selecao.length, situacao.excesso)
      : situacao.tipo === "insuficiente"
        ? E3.avisoInsuficiente
        : legendaCurta(legenda, limites.legendaMin)
          ? E3.avisoLegendaCurta
          : null;

  async function confirmar() {
    const resultado = await aoPublicar();
    setConfirmando(false);
    if (resultado === "recusada") setRecusada(true);
  }

  return (
    <div className="tela tela--clara">
      <h1 className="so-leitor">{E3.titulo}</h1>
      <TopBar
        withStatusBarInset={false}
        leading={
          <ButtonInsta
            variant="link"
            aria-label={E3.voltarAoFeed}
            leadingIcon={<IconInsta name="back" size={18} />}
            onClick={aoVoltarAoFeed}
          />
        }
        title={E3.titulo}
        trailing={<BadgeInsta variant="neutral">{E3.statusSelecao(selecao.length)}</BadgeInsta>}
      />
      {aviso && (
        <InlineHint tone={situacao.tipo === "excesso" || recusada ? "friction" : "neutral"} announce>
          {aviso}
        </InlineHint>
      )}
      <div className="rolagem">
        {itens.length > 0 ? (
          <MediaGrid
            items={itens}
            selectable
            selectedIds={[...selecao]}
            ariaLabel={E3.grade}
            onToggle={(item) => aoAlternar(item.id)}
          />
        ) : (
          <p className="salvos__vazio">{E3.vazio}</p>
        )}
      </div>
      <div className="salvos__compositor">
        <StoryComposer
          theme="light"
          value={legenda}
          onChange={(e) => {
            setRecusada(false);
            aoMudarLegenda(e.target.value);
          }}
          maxLength={limites.legendaMax}
          minLength={limites.legendaMin}
          label={E3.rotuloDaLegenda}
          placeholder={E3.placeholderLegenda(temaNaFrase(tema))}
          submitLabel={E3.publicar}
          submitDisabled={!podePublicar}
          onSubmit={() => {
            if (!podePublicar) return;
            telemetria.pediuParaPublicar();
            setConfirmando(true);
          }}
        />
      </div>
      <BarraDeAbas ativa="salvos" aoTrocar={(aba) => aba === "feed" && aoVoltarAoFeed()} />
      <ConfirmDialog
        open={confirmando}
        tone="destructive"
        title={E3.modalTitulo}
        message={E3.modalCorpo}
        confirmLabel={E3.confirmar}
        cancelLabel={E3.cancelar}
        busy={publicando}
        onConfirm={() => void confirmar()}
        onCancel={() => {
          telemetria.desistiuDePublicar();
          setConfirmando(false);
        }}
      />
    </div>
  );
}
