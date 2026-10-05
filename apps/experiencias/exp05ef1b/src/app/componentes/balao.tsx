import { MediaViewer, MessageBubble, type UncMessageDelivery } from "@edu/ui/ds-unoochat";
import { dividirLegenda, type EstiloDeImagem } from "../../lib/regras";
import { TEXTOS } from "../../lib/textos";
import type { MensagemPublica } from "../../lib/tipos";
import { ImagemDesenhada, PROPORCAO_DO_DESENHO } from "./midia-desenhada";

/**
 * O balão de UMA mensagem do pacote — no grupo (recebido, com o remetente) e
 * no Mural (enviado, com o selo "Encaminhada"). Os três formatos:
 *
 * - `texto`: o texto, e só;
 * - `imagem`: a imagem DESENHADA a partir da `legenda` (`MessageBubble.Media`
 *   sem `src`), num dos quatro desenhos (`estilo`), e o texto do balão embaixo;
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
  estilo = "comunicado",
  aoAbrirMidia,
}: {
  mensagem: MensagemPublica;
  direcao: "in" | "out";
  hora: string;
  comRemetente?: boolean;
  encaminhada?: boolean;
  entrega?: UncMessageDelivery;
  /** O desenho da imagem (`regras.ts#estiloDaImagem`); só vale para `tipo: "imagem"`. */
  estilo?: EstiloDeImagem;
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
        /* Com `onClick` (DS 0.2.6) a moldura é um botão com o mesmo desenho, e
           o nome dele diz de quem é a imagem que abre. */
        <MessageBubble.Media
          alt={TEXTOS.midia.alt[estilo]}
          ratio={PROPORCAO_DO_DESENHO[estilo]}
          onClick={abrir}
          actionLabel={abrir ? TEXTOS.grupo.abrirMidiaDe(mensagem.remetente) : undefined}
        >
          <ImagemDesenhada legenda={mensagem.legenda} estilo={estilo} />
        </MessageBubble.Media>
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
  estilo = "comunicado",
  aoFechar,
}: {
  mensagem: MensagemPublica;
  hora: string;
  estilo?: EstiloDeImagem;
  aoFechar: () => void;
}) {
  const legenda = mensagem.legenda ?? "";
  return (
    <MediaViewer
      title={mensagem.remetente}
      subtitle={hora}
      backLabel={TEXTOS.midia.fechar}
      onClose={aoFechar}
      caption={
        mensagem.tipo !== "imagem"
          ? legenda
          : estilo === "comunicado"
            ? TEXTOS.midia.transcricao(legenda)
            : TEXTOS.midia.transcricaoDaImagem(legenda)
      }
    >
      {mensagem.tipo === "imagem" ? (
        <MessageBubble.Media alt={TEXTOS.midia.alt[estilo]} ratio={PROPORCAO_DO_DESENHO[estilo]}>
          <ImagemDesenhada legenda={legenda} estilo={estilo} />
        </MessageBubble.Media>
      ) : (
        <PreviaDoLink legenda={legenda} />
      )}
    </MediaViewer>
  );
}
