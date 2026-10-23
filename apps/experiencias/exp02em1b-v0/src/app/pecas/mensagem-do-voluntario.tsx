import { MessageBubble } from "@edu/ui/ds-unoochat";

/**
 * O PEDIDO PELO WHATSAPP do fechamento (EM13CO08, ADR-172) — o `MessageBubble`
 * da seção `unoochat`, e SÓ ele: é CLONE DENTRO DE CLONE (ADR-173, que estende
 * a ADR-117). A tela em volta continua sendo o UnooriaAI; a mensagem fala na
 * voz do mensageiro de onde veio, porque um pedido que não parece mensagem não
 * ensina a reconhecer o pedido. Sem barra, abas nem fundo do app. Este arquivo
 * importa SÓ a ponte `@edu/ui/ds-unoochat` — molde:
 * `exp04ef1b/src/app/pecas/mensagem-encaminhada.tsx`.
 *
 * **O contêiner é daqui.** O balão recebido é branco e foi calibrado para o
 * fundo do app; a moldura `.peca-unoochat` (`estilos/globals.css`) pinta o
 * `--unc-color-surface-base` só no tamanho da peça, em tema CLARO fixado no
 * contêiner (`data-unc-theme`). Nenhum token `--unc-*` sai dela.
 *
 * Sem `time` e sem `delivery`: a hora e os tiques não dizem nada aqui, e uma
 * hora inventada competiria com o relógio da operação.
 */
export function MensagemDoVoluntario({ texto }: { texto: string }) {
  return (
    <div className="peca-unoochat" data-unc-theme="light" role="group" aria-label="Mensagem de número desconhecido">
      <MessageBubble direction="in" maxWidth={420} sender="Número desconhecido">
        {texto}
      </MessageBubble>
    </div>
  );
}
