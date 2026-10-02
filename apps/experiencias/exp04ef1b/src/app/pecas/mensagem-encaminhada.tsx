import { MessageBubble } from "@edu/ui/ds-unoochat";
import { E6 } from "../../lib/textos";

/**
 * A mensagem ENCAMINHADA — o `MessageBubble` da seção `unoochat`, com o selo
 * `forwardedLabel` (ADR-117; ADR-136: o mensageiro é o Unoochat, não o clone do
 * WhatsApp). Serve a duas telas: a matéria original de uma notícia que chegou
 * por mensagem (na gaveta da mesa) e o boato do desafio final (E6). Este
 * arquivo importa SÓ a ponte `@edu/ui/ds-unoochat`.
 *
 * **O contêiner é daqui, e não o fundo da redação.** O balão recebido é BRANCO
 * (`--unc-color-surface-bubble-in`) e foi calibrado para a lavanda do fundo do
 * app — sobre o branco da redação ele some. A moldura `.peca-unoochat` pinta o
 * `--unc-color-surface-base` num retângulo do tamanho da peça: não é o
 * `ChatWallpaper` (que é o FUNDO do app, e a ADR-117 diz que a peça não traz o
 * fundo), é o mínimo para o balão ter o contraste que o pacote publica. O tema
 * é o CLARO, fixado no contêiner (`data-unc-theme`), como na exp05ef1b.
 * Nenhuma cor à mão: só token da seção.
 *
 * Sem `time` e sem `delivery`: a hora e os tiques seriam a DATA revelada antes
 * de a criança abrir a pista.
 */
export function MensagemEncaminhada({
  remetente,
  texto,
  imagem,
  rotulo,
}: {
  /** Quem mandou a mensagem, quando a notícia diz; `null` = mensagem sem nome. */
  remetente: string | null;
  texto: string;
  imagem?: { url: string; alt: string } | null;
  /** O nome acessível da peça ("Mensagem encaminhada"). */
  rotulo: string;
}) {
  return (
    <div className="peca-unoochat" data-unc-theme="light" role="group" aria-label={rotulo}>
      {imagem && (
        <MessageBubble direction="in" maxWidth={280} sender={remetente ?? undefined} forwardedLabel={E6.encaminhada} tail={false}>
          <MessageBubble.Media src={imagem.url} alt={imagem.alt} />
        </MessageBubble>
      )}
      <MessageBubble
        direction="in"
        maxWidth={280}
        sender={imagem ? undefined : (remetente ?? undefined)}
        forwardedLabel={imagem ? undefined : E6.encaminhada}
      >
        {texto}
      </MessageBubble>
    </div>
  );
}
