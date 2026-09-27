import { MessageBubble } from "@edu/ui/ds-whatsapp";
import { E6 } from "../../lib/textos";

/**
 * A mensagem ENCAMINHADA — o `MessageBubble` da seção `whatsappmobile`, com o
 * selo `forwardedLabel` (ADR-117). Serve a duas telas: a matéria original de
 * uma notícia que chegou por mensagem (na gaveta da mesa) e o boato do desafio
 * final (E6). Este arquivo importa SÓ a ponte `@edu/ui/ds-whatsapp`.
 *
 * **O contêiner escuro é daqui, e não o fundo da redação.** A seção publica só
 * o tema escuro (`WaTheme = 'dark'`, tokens no `:root`) e o balão desenha a
 * própria cor, mas a cor dele foi calibrada para o fundo escuro do app — sobre
 * o branco da redação o balão "boia" e o texto dele perde o contexto. A moldura
 * `.peca-whatsapp` pinta o `--wa-color-surface-base` num retângulo do tamanho
 * da peça: não é o `ChatWallpaper` (que é o FUNDO do app, e a ADR-117 diz que a
 * peça não traz o fundo), é o mínimo para o balão estar no escuro que o pacote
 * publica. Nenhuma cor à mão: só token da seção.
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
    <div className="peca-whatsapp" data-wa-theme="dark" role="group" aria-label={rotulo}>
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
