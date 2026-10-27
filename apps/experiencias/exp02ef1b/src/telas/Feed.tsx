import { useEffect } from "react";
import { BadgeUnv, MessageBubble, PostCard } from "@edu/ui/ds-unoovista";
import { Aviso } from "../componentes/Aviso";
import { Janela } from "../componentes/Janela";
import type { Contexto } from "../contexto";
import { useDepoisDe } from "../hooks/tela";
import { proporcaoDaJanela } from "../lib/geometria";
import { ROTULOS, textoDe } from "../lib/textos";

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
 * Depois de 5 s, com a turma na fase `aberta`, o feed pausa no aviso com o
 * cadeado e AGUARDE O PROFESSOR — só a mensagem, sem retrato (ADR-186); o
 * polling de 3 s do despachante percebe a virada. Passados 3 min, "O
 * PROFESSOR JÁ VEM!" com o círculo de respiração. A criança não fura o
 * bloqueio: o aviso não tem botão e não fecha.
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
        <PostCard.Header username={ROTULOS.perfil} initials="RE" />
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
        <PostCard.Timestamp>{cena.hora}</PostCard.Timestamp>
      </PostCard>

      <div className="feed__resposta" aria-live="polite">
        <MessageBubble direction="incoming" senderLabel={ROTULOS.visitante}>
          {capa.visitante}
        </MessageBubble>
      </div>

      <Aviso
        aberto={esperando}
        icone="lock"
        titulo={demorou ? textoDe(sessao.textos, "e4", "professorJaVem") : textoDe(sessao.textos, "e4", "aguarde")}
        texto={demorou ? textoDe(sessao.textos, "e4", "respire") : undefined}
      >
        {demorou ? <span className="respiracao" aria-hidden="true" /> : null}
      </Aviso>
    </section>
  );
}

