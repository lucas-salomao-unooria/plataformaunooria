import { useState } from "react";
import { DmPoll, PostCard } from "@edu/ui/ds-unoovista";
import { Dupla } from "../componentes/Personagem";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { ROTULOS, textoDe } from "../lib/textos";
import type { Voto } from "../lib/tipos";

/**
 * E6 — REFLETIR, a transferência para um cenário inédito: o post da HORTA DA
 * ESCOLA com a foto fechada da lagarta na alface, e "A HORTA ACABOU?" com os
 * dois botões pictográficos grandes. LATCH 2: o voto trava as opções (a
 * enquete do DS marca a escolhida com o sinal, não só com a cor), aparece
 * "SELEÇÃO ENVIADA", e a api marca a EF02CO05 e conclui.
 *
 * Depois do voto — e num F5 com a missão concluída, que é o MODO LEITURA —
 * Bento e Iara aparecem com a bandeira da Rádio: "MISSÃO CUMPRIDA!". O
 * `concluir()` do SDK é chamado pelo despachante na transição para `concluida`.
 */
export function Transferencia({ ctx }: { ctx: Contexto }) {
  const { sessao, estado, executar, url } = ctx;
  const material = sessao.material.transferencia;
  const [local, setLocal] = useState<Voto | null>(null);
  const voto = estado.transferencia?.voto ?? local;
  const concluida = estado.passo === "concluida";

  async function votar(id: string) {
    if (voto) return;
    const opcao = id as Voto;
    setLocal(opcao);
    const r = await executar(() => api.transferencia(opcao), "transferencia");
    /* Falhou sem ir para a fila: a escolha volta a ficar aberta. */
    if (r === null && !ctx.naFila("transferencia")) setLocal(null);
  }

  return (
    <section className="transferencia">
      <PostCard>
        <PostCard.Header username={textoDe(sessao.textos, "e6", "cabecalho")} initials="HE" />
        <PostCard.Media src={url(material.imagem)} alt={ROTULOS.lagarta} aspectRatio={1} />
      </PostCard>

      <DmPoll
        className="opcoes-grandes"
        question={textoDe(sessao.textos, "e6", "pergunta")}
        options={material.opcoes.map((o) => ({
          id: o.id,
          label: (
            <span className="opcao">
              <span aria-hidden="true" className="opcao__apoio">
                {o.emoji}
              </span>
              {o.rotulo}
            </span>
          ),
        }))}
        value={voto}
        sentLabel={textoDe(sessao.textos, "e6", "enviada")}
        onVote={(id) => void votar(id)}
      />

      {concluida ? (
        <div className="celebracao" role="status" aria-live="polite">
          <p className="celebracao__titulo">
            <span aria-hidden="true">📻🚩 </span>
            {textoDe(sessao.textos, "e6", "fim")}
          </p>
          <Dupla />
        </div>
      ) : null}
    </section>
  );
}
