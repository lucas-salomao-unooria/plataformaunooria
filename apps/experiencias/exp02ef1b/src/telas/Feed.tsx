import { useEffect } from "react";
import { BadgeUnv, IconUnv, MessageBubble, PostCard } from "@edu/ui/ds-unoovista";
import { Janela } from "../componentes/Janela";
import { Dupla } from "../componentes/Personagem";
import type { Contexto } from "../contexto";
import { useDepoisDe } from "../hooks/tela";
import { proporcaoDaJanela } from "../lib/geometria";
import { preencher, ROTULOS, textoDe } from "../lib/textos";

/** A fala da visitante fica sozinha na tela por este tempo antes do cadeado (a consequência sentida). */
const VISITANTE_MS = 5000;

/**
 * E4, Momentos 1 e 2 — a CONSEQUÊNCIA e a PAUSA.
 *
 * O feed da @radio_escola mostra a capa publicada (a janela exata que a
 * moldura mostrou, `capa.visivel`, com o selo) e a resposta curta da
 * VISITANTE, adaptada ao recorte pelo servidor ("Na foto, vi crianças lendo!"
 * ou só "Na foto, vi a biblioteca!" quando a ação ficou fora). Sem explicação
 * do Bento: quem lê e explora é o professor.
 *
 * Depois de 5 s, com a turma na fase `aberta`, o feed pausa no cadeado
 * AGUARDE O PROFESSOR, com Bento e Iara arrumando os fones; o polling de 3 s
 * do despachante percebe a virada. Passados 3 min, o balão "O PROFESSOR JÁ
 * VEM!". A criança não fura o bloqueio: a camada não tem botão.
 */
export function Feed({ ctx, aoVer }: { ctx: Contexto; aoVer: () => void }) {
  const { sessao, estado, url } = ctx;
  const cena = sessao.cena!;
  const capa = estado.capa;
  const viu = useDepoisDe(VISITANTE_MS);
  const esperando = viu && estado.aguardandoVirada;
  const demorou = useDepoisDe((sessao.tempos.esperaDoProfessorMs || 180_000) + VISITANTE_MS);

  useEffect(() => {
    if (viu) aoVer();
  }, [viu, aoVer]);

  if (!capa) return null;
  const selo = cena.selos.find((s) => s.id === capa.seloId);
  const proporcao = proporcaoDaJanela(capa.visivel, sessao.geometria.proporcaoDaPanoramica);

  return (
    <section className="feed">
      <PostCard>
        <PostCard.Header username={ROTULOS.perfil} location={ctx.cracha ? `${ctx.cracha.emoji} ${ctx.cracha.rotulo}` : undefined} initials="RE" />
        <PostCard.Media aspectRatio={proporcao} alt={cena.alt}>
          <Janela src={url(cena.imagem)} alt={cena.alt} janela={capa.visivel} className="feed__capa">
            {selo ? (
              <div className="moldura__selo">
                <BadgeUnv variant="neutral" wrap className="carimbo">
                  <span aria-hidden="true">{selo.emoji}</span> {selo.texto}
                </BadgeUnv>
              </div>
            ) : null}
          </Janela>
        </PostCard.Media>
        <PostCard.Caption username={ROTULOS.perfil}>
          {preencher(textoDe(sessao.textos, "e3", "assinatura"), { cracha: ctx.cracha?.rotulo ?? "" })}
        </PostCard.Caption>
        <PostCard.Timestamp>{cena.hora}</PostCard.Timestamp>
      </PostCard>

      <div className="feed__resposta" aria-live="polite">
        <MessageBubble direction="incoming" senderLabel={ROTULOS.visitante}>
          {capa.visitante}
        </MessageBubble>
      </div>

      {esperando ? (
        <div className="cadeado" role="status" aria-live="polite">
          <div className="cadeado__cartao">
            <IconUnv name="lock" size="lg" />
            <p className="cadeado__titulo">{textoDe(sessao.textos, "e4", "aguarde")}</p>
            <Dupla fala={demorou ? textoDe(sessao.textos, "e4", "professorJaVem") : undefined} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

