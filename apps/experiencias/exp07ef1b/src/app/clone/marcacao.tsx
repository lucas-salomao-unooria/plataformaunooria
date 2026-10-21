import { useState } from "react";
import { ButtonUnv, InlineHint, MediaGrid, TextFieldUnv, TopBar, type UnvMediaItem } from "@edu/ui/ds-unoovista";
import { codePoints } from "../../lib/regras";
import { MARCACAO } from "../../lib/textos";
import type { MarcacaoDoEstudante, PostPublico, RespostaMural } from "../../lib/tipos";
import { altDoPost, srcDoPost, usePaleta } from "../componentes/midia";

/** O resultado de guardar o "por quê?", como a tela precisa dele. */
export type ResultadoDoPorque = "guardado" | "recusado" | "outra";

/** O teto do "por quê?" — o mesmo da legenda (140 code points), conferido de novo na api. */
const PORQUE_MAX = 140;

/**
 * E4-ALU-01B — A MARCAÇÃO (EF07CO08, ADR-170), entre o Mural e as fichas.
 *
 * A professora deixou a turma ver o par em silêncio e conduziu a conversa; ao
 * abrir a marcação, a pergunta chega a todos os aparelhos: "Tem algo na
 * publicação de {colega} que a sua deixou de fora e muda a história?". A
 * criança toca num dos três posts do colega (escolha única: a grade do DS com
 * `selectable` e um id só) ou em "Nada que mude a história".
 *
 * - **Grava ao tocar, e dá para trocar** até a professora revelar as fichas — a
 *   última marcação vale. Não há botão de confirmar.
 * - **Nenhuma resposta tem aviso.** A criança não sabe o que cada uma vale: o
 *   nível congela nas fichas e só o professor o vê.
 * - **"Sua publicação" fica embaixo, sem ação** — só para comparar.
 * - **O "por quê?" é opcional** e aparece depois da escolha: uma frase que só
 *   o professor lê, fora do nível.
 *
 * O Mural continua NU (o não-negociável 2): esta é outra tela, depois de outro
 * botão da professora.
 */
export function Marcacao({
  mural,
  marcacao,
  ocupado,
  aoMarcar,
  aoExplicar,
}: {
  mural: RespostaMural;
  marcacao: MarcacaoDoEstudante | null;
  ocupado: boolean;
  aoMarcar: (escolha: { postId: string } | { nenhum: true }) => void;
  aoExplicar: (texto: string) => Promise<ResultadoDoPorque>;
}) {
  const paleta = usePaleta();
  const [porque, setPorque] = useState(marcacao?.porque ?? "");
  const [guardado, setGuardado] = useState<"sim" | "recusado" | null>(marcacao?.porque ? "sim" : null);

  const item = (p: PostPublico): UnvMediaItem => ({ id: p.id, src: srcDoPost(p, paleta, "quadrado"), alt: altDoPost(p) });
  const nome = mural.par.rotulo;
  const escolhido = marcacao?.postId ? [marcacao.postId] : [];
  const marcou = marcacao !== null;
  const texto = porque.trim();
  const podeGuardar = marcou && texto.length > 0 && codePoints(texto) <= PORQUE_MAX && !ocupado;

  async function guardar() {
    if (!podeGuardar) return;
    const r = await aoExplicar(texto);
    setGuardado(r === "guardado" ? "sim" : r === "recusado" ? "recusado" : null);
  }

  return (
    <div className="tela tela--clara marcacao">
      <h1 className="so-leitor">{MARCACAO.pergunta(nome)}</h1>
      <TopBar withStatusBarInset={false} title={MARCACAO.doColega(nome)} />
      <div className="rolagem marcacao__corpo">
        <p className="marcacao__pergunta">{MARCACAO.pergunta(nome)}</p>
        <p className="marcacao__como">{MARCACAO.como}</p>

        <MediaGrid
          items={mural.par.posts.map(item)}
          selectable
          selectedIds={escolhido}
          ariaLabel={MARCACAO.doColega(nome)}
          onToggle={(i) => !ocupado && aoMarcar({ postId: i.id })}
        />

        <ButtonUnv
          variant={marcacao?.nenhum ? "primary" : "secondary"}
          block
          aria-pressed={marcacao?.nenhum === true}
          disabled={ocupado}
          onClick={() => aoMarcar({ nenhum: true })}
        >
          {MARCACAO.nenhum}
        </ButtonUnv>

        {marcou && (
          <InlineHint tone="neutral" announce>
            {MARCACAO.registrada}
          </InlineHint>
        )}

        {marcou && (
          <div className="marcacao__porque">
            <TextFieldUnv
              label={MARCACAO.porque}
              placeholder={MARCACAO.porquePlaceholder}
              value={porque}
              maxLength={PORQUE_MAX}
              block
              onChange={(e) => {
                setPorque(e.target.value);
                setGuardado(null);
              }}
              error={guardado === "recusado" ? MARCACAO.porqueRecusado : undefined}
              hint={guardado === "sim" ? MARCACAO.porqueGuardado : undefined}
            />
            <ButtonUnv variant="secondary" disabled={!podeGuardar} onClick={() => void guardar()}>
              {MARCACAO.guardar}
            </ButtonUnv>
          </div>
        )}

        <p className="marcacao__sua">{MARCACAO.suaPublicacao}</p>
        <MediaGrid items={mural.minha.posts.map(item)} ariaLabel={MARCACAO.suaPublicacao} />
      </div>
    </div>
  );
}
