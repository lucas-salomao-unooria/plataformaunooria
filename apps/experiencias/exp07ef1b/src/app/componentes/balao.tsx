import { Icon, MessageBubble } from "@edu/ui/ds-whatsapp";
import type { Materia, MensagemDoFeed } from "../../lib/tipos";
import { PrintDoGrupo } from "./reportagem";
import { BalaoDeVoz } from "./voz";

/**
 * Uma mensagem do grupo.
 *
 * O balão é do design system; o que a missão acrescenta por dentro são as três
 * composições que a seção ainda não publica — o selo de encaminhada (feito com
 * o ícone `forward` e os tokens do pacote), o player de voz e o print
 * clicável. Nenhuma delas inventa cor: tudo sai de `--wa-*`.
 *
 * **O selo não diz que a mensagem é falsa.** Ele diz o que o app real diz:
 * "Encaminhada com frequência". A plataforma não rotula veracidade — quem
 * audita a causa é o estudante, e é essa auditoria que a missão mede.
 */
export function BalaoDoFeed({
  mensagem,
  materia,
  midia,
  aoAbrirMateria,
  aoOuvirAudio,
}: {
  mensagem: MensagemDoFeed;
  materia: Materia;
  midia: Record<string, string | null>;
  aoAbrirMateria: () => void;
  aoOuvirAudio: (audioId: string) => void;
}) {
  const url = mensagem.midia ? (midia[mensagem.midia] ?? null) : null;

  return (
    <div className="feed__linha">
      <MessageBubble direction="in" time={mensagem.hora} tail>
        <div className="feed__autor">{mensagem.autor}</div>

        {mensagem.encaminhada && (
          <span className="selo-encaminhada">
            <Icon name="forward" tone="forward" size="xs" />
            Encaminhada com frequência
          </span>
        )}

        {mensagem.tipo === "audio" && mensagem.transcricao && (
          <BalaoDeVoz
            url={url}
            transcricao={mensagem.transcricao}
            duracaoSeg={mensagem.duracaoSeg ?? 0}
            rotulo={`áudio de ${mensagem.autor}`}
            aoConcluir={() => aoOuvirAudio(mensagem.midia ?? "")}
          />
        )}

        {mensagem.tipo === "print" && mensagem.abreMateria && (
          <PrintDoGrupo materia={materia} url={url} aoTocar={aoAbrirMateria} />
        )}

        {mensagem.tipo === "print" && !mensagem.abreMateria && (
          <PrintDoGrupo materia={materia} url={url} aoTocar={aoAbrirMateria} />
        )}

        {mensagem.tipo === "foto" &&
          (url ? (
            <MessageBubble.Media src={url} alt={mensagem.texto} ratio="4 / 3" />
          ) : (
            <div className="sem-foto">foto · imagem indisponível</div>
          ))}

        {mensagem.tipo !== "audio" && <span>{mensagem.texto}</span>}
      </MessageBubble>
    </div>
  );
}

/** A mensagem que o próprio estudante postou — o balão verde, à direita. */
export function BalaoDoEstudante({ texto, hora }: { texto: string; hora: string }) {
  return (
    <div className="feed__linha feed__linha--out">
      <MessageBubble direction="out" time={hora} delivery="read" tail>
        {texto}
      </MessageBubble>
    </div>
  );
}

/** Uma reação do bairro, que chega depois do envio. */
export function BalaoDeReacao({ autor, texto, hora }: { autor: string; texto: string; hora: string }) {
  return (
    <div className="feed__linha">
      <MessageBubble direction="in" time={hora} tail>
        <div className="feed__autor">{autor}</div>
        {texto}
      </MessageBubble>
    </div>
  );
}

/** Os "digitando…" da cascata. A espera É o pico da missão. */
export function Digitando({ autores }: { autores: string[] }) {
  if (autores.length === 0) return null;
  return (
    <div className="feed__linha">
      <MessageBubble direction="in" tail={false}>
        <span style={{ fontSize: 12, color: "var(--wa-color-text-meta)" }}>
          {autores.join(", ")} {autores.length > 1 ? "estão" : "está"} digitando
        </span>{" "}
        <span className="digitando" aria-hidden="true">
          <span className="digitando__ponto" />
          <span className="digitando__ponto" />
          <span className="digitando__ponto" />
        </span>
      </MessageBubble>
    </div>
  );
}
