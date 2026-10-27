import { useState } from "react";
import { AvatarUnv, BadgeUnv, ButtonUnv, IconUnv } from "@edu/ui/ds-unoovista";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { fraseDaMissao } from "../lib/geometria";
import { preencher, ROTULOS, textoDe } from "../lib/textos";

/**
 * E1 — DESAFIAR: a chamada para a ação (`E1-ALU-02` do protótipo, ADR-186).
 *
 * O mural oficial da @radio_escola com UM card: o rascunho pendente, o que
 * aconteceu ("A capa sobre a biblioteca causou confusão…") e a MISSÃO, em
 * letra grande — "ENCONTRE OS 2 OBJETOS IGUAIS NAS DUAS FOTOS DA BIBLIOTECA" — e o botão
 * ABRIR BANCADA, que abre a sessão (`POST /enigma-capa/iniciar`). Cinco
 * elementos, um só gesto possível.
 *
 * A missão começa direto na ação: quem joga, o professor vê pelo nome no
 * painel (ADR-186).
 */
export function Mural({ ctx }: { ctx: Contexto }) {
  const { sessao, executar } = ctx;
  const cena = sessao.cena!;
  const [enviando, setEnviando] = useState(false);

  async function abrir() {
    if (enviando) return;
    setEnviando(true);
    const r = await executar(() => api.iniciar(), "iniciar");
    if (r === null && !ctx.naFila("iniciar")) setEnviando(false);
  }

  return (
    <section className="mural">
      <header className="mural__perfil">
        <AvatarUnv initials="RE" size="lg" ring="story" aria-hidden="true" />
        <div>
          <p className="mural__usuario">@{ROTULOS.perfil}</p>
          <p className="mural__nome">{ROTULOS.perfilNome}</p>
        </div>
      </header>

      <article className="missao" aria-labelledby="missao-titulo">
        <BadgeUnv variant="neutral" className="missao__tag">
          {textoDe(sessao.textos, "e1", "tag")} <span aria-hidden="true">🔴</span>
        </BadgeUnv>
        <h1 id="missao-titulo" className="missao__titulo">
          {textoDe(sessao.textos, "e1", "titulo")}
        </h1>
        <p className="missao__contexto">{preencher(textoDe(sessao.textos, "e1", "contexto"), { espacoCurto: cena.espacoCurto })}</p>
        <p className="missao__cta">
          <span className="missao__icone" aria-hidden="true">
            <IconUnv name="search" size="lg" />
          </span>
          {fraseDaMissao(cena.espacoCurto)}
        </p>
        <ButtonUnv size="lg" block disabled={enviando} onClick={() => void abrir()}>
          {textoDe(sessao.textos, "e1", "abrir")}
        </ButtonUnv>
      </article>
    </section>
  );
}
