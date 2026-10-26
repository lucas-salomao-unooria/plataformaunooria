import { useState } from "react";
import { AvatarUnv, NotificationItem } from "@edu/ui/ds-unoovista";
import { Personagem } from "../componentes/Personagem";
import type { Contexto } from "../contexto";
import { useDepoisDe } from "../hooks/tela";
import { api } from "../lib/api";
import { ROTULOS, textoDe } from "../lib/textos";
import type { CrachaId } from "../lib/tipos";

/**
 * E1 — DESAFIAR. O mural oficial da @radio_escola e o seletor ESCOLHA SEU
 * CRACHÁ, com os 4 avatares do banco curado. O toque só libera depois de 3 s
 * (one-pager §4: "evitar toque acidental"); antes disso o avatar não reage.
 *
 * Tocar no crachá ABRE a sessão (`POST /enigma-capa/cracha`): a notificação
 * vermelha do rascunho pendente acende e o Bento aparece aflito. Tocar na
 * notificação desliza para a bancada (o passo do servidor já é `lupa`; quem
 * segura esta tela até o toque é o `rascunhoAberto` do despachante).
 */
export function Mural({ ctx, aoAbrir }: { ctx: Contexto; aoAbrir: () => void }) {
  const { sessao, estado, executar } = ctx;
  const liberado = useDepoisDe(sessao.tempos.toqueLiberadoMs || 3000);
  const [enviando, setEnviando] = useState<CrachaId | null>(null);
  const escolhido = estado.cracha;

  async function escolher(id: CrachaId) {
    if (!liberado || escolhido || enviando) return;
    setEnviando(id);
    await executar(() => api.cracha(id), "cracha");
    setEnviando(null);
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

      {!escolhido ? (
        <>
          <h1 className="titulo-da-tela">{textoDe(sessao.textos, "e1", "titulo")}</h1>
          <ul className={`crachas${liberado ? "" : " crachas--travados"}`} aria-busy={!liberado}>
            {sessao.material.crachas.map((c) => (
              <li key={c.id} className="crachas__item">
                <AvatarUnv
                  initials={c.emoji}
                  size="xl"
                  aria-label={c.rotulo}
                  aria-disabled={!liberado || Boolean(enviando)}
                  className={enviando === c.id ? "crachas__avatar crachas__avatar--escolhido" : "crachas__avatar"}
                  onClick={() => void escolher(c.id)}
                />
                <span className="crachas__rotulo" aria-hidden="true">
                  {c.rotulo}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mural__rascunho">
          <Personagem quem="bento" fala={textoDe(sessao.textos, "e1", "bento")} animado anunciar />
          <NotificationItem
            className="mural__notificacao"
            initials={ctx.cracha?.emoji ?? "★"}
            username={ctx.cracha?.rotulo ?? ""}
            action={ROTULOS.rascunho}
            unread
            unreadLabel={ROTULOS.rascunho}
            footer={<strong>{textoDe(sessao.textos, "e1", "card")}</strong>}
            onClick={aoAbrir}
          />
        </div>
      )}
    </section>
  );
}
