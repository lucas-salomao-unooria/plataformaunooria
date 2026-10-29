import { ChatBanner, Icon } from "@edu/ui/ds-unoochat";
import { TEXTOS } from "../lib/textos";

/**
 * E3-SIS-01 — a rede caiu (o SDK não alcançou a api). A faixa fixa do
 * mensageiro, na voz da ficção, por cima do topo; some na próxima leitura que
 * der certo. As escolhas do compositor continuam na tela (estado local).
 */
export function FaixaDeConexao() {
  return (
    <div className="faixa-de-conexao" role="status">
      <ChatBanner>
        <Icon name="sbAlert" size="sm" tone="inherit" /> {TEXTOS.semConexao}
      </ChatBanner>
    </div>
  );
}
