import { MediaViewer, MessageBubble, type WaMessageDelivery } from "@edu/ui/ds-whatsapp";
import { dividirLegenda } from "../../lib/regras";
import { TEXTOS } from "../../lib/textos";
import type { MensagemPublica } from "../../lib/tipos";
import { ComunicadoDesenhado } from "./midia-desenhada";

/**
 * O balão de UMA mensagem do pacote — no grupo (recebido, com o remetente) e
 * no Mural (enviado, com o selo "Encaminhada"). Os três formatos:
 *
 * - `texto`: o texto, e só;
 * - `imagem`: o comunicado DESENHADO a partir da `legenda`
 *   (`MessageBubble.Media` sem `src`) e o texto do balão embaixo;
 * - `link`: a prévia (`MessageBubble.LinkPreview`) montada da `legenda` no
 *   formato "Nome do site: manchete", e o texto embaixo.
 *
 * Imagem e prévia abrem em tela cheia (`MediaViewer`), com a transcrição: é
 * ali que a criança lê o comunicado inteiro.
 */
export function BalaoDaMensagem({
  mensagem,
  direcao,
  hora,
  comRemetente = false,
  encaminhada = false,
  entrega = "none",
  aoAbrirMidia,
}: {
  mensagem: MensagemPublica;
  direcao: "in" | "out";
  hora: string;
  comRemetente?: boolean;
  encaminhada?: boolean;
  entrega?: WaMessageDelivery;
  aoAbrirMidia?: (m: MensagemPublica) => void;
}) {
  const abrir = aoAbrirMidia ? () => aoAbrirMidia(mensagem) : undefined;
  return (
    <MessageBubble
      direction={direcao}
      time={hora}
      delivery={entrega}
      sender={comRemetente ? mensagem.remetente : undefined}
      forwardedLabel={encaminhada ? TEXTOS.mural.encaminhada : undefined}
      maxWidth={268}
    >
      {mensagem.tipo === "imagem" && mensagem.legenda ? (
        abrir ? (
          /*
           * (b) COMPENSAÇÃO — `MessageBubble.Media` não publica `onClick` (a
           * `LinkPreview` publica). O toque é um `<button>` SEM aparência
           * (`.toque-na-midia`, só o reset e o anel de foco): o que se vê é a
           * moldura do DS, e o nome acessível é o `alt` dela. Morre quando o
           * `Media` aceitar `onClick`. PEDIDO: `MessageBubble.Media` acionável.
           */
          <button
            type="button"
            className="toque-na-midia"
            onClick={abrir}
            aria-label={TEXTOS.grupo.abrirMidiaDe(mensagem.remetente)}
          >
            <MessageBubble.Media alt={TEXTOS.midia.altDoComunicado} ratio="4 / 3">
              <ComunicadoDesenhado legenda={mensagem.legenda} />
            </MessageBubble.Media>
          </button>
        ) : (
          <MessageBubble.Media alt={TEXTOS.midia.altDoComunicado} ratio="4 / 3">
            <ComunicadoDesenhado legenda={mensagem.legenda} />
          </MessageBubble.Media>
        )
      ) : null}
      {mensagem.tipo === "link" && mensagem.legenda ? <PreviaDoLink legenda={mensagem.legenda} aoAbrir={abrir} /> : null}
      <p className="balao__texto">{mensagem.texto}</p>
    </MessageBubble>
  );
}

function PreviaDoLink({ legenda, aoAbrir }: { legenda: string; aoAbrir?: () => void }) {
  const { rotulo, corpo } = dividirLegenda(legenda);
  return <MessageBubble.LinkPreview title={corpo} domain={rotulo ?? ""} onClick={aoAbrir} />;
}

/**
 * A mídia em tela cheia (E2-ALU-02). O comunicado vem com a transcrição
 * inteira embaixo (`e2.feedback.midia_reserva_texto`) — é acessibilidade, não
 * reserva de arquivo que falhou: não há arquivo.
 */
export function MidiaAberta({
  mensagem,
  hora,
  aoFechar,
}: {
  mensagem: MensagemPublica;
  hora: string;
  aoFechar: () => void;
}) {
  const legenda = mensagem.legenda ?? "";
  return (
    <MediaViewer
      title={mensagem.remetente}
      subtitle={hora}
      backLabel={TEXTOS.midia.fechar}
      onClose={aoFechar}
      caption={mensagem.tipo === "imagem" ? TEXTOS.midia.transcricao(legenda) : legenda}
    >
      {mensagem.tipo === "imagem" ? (
        <MessageBubble.Media alt={TEXTOS.midia.altDoComunicado} ratio="4 / 3">
          <ComunicadoDesenhado legenda={legenda} />
        </MessageBubble.Media>
      ) : (
        <PreviaDoLink legenda={legenda} />
      )}
    </MediaViewer>
  );
}
