import { Icon } from "@edu/ui/ds-unooriaai";
import { TEXTOS } from "../lib/textos";

/**
 * E2-SIS-01 — a faixa de conexão instável do UnooriaAI (`e2.erro.conexao_chat`),
 * acima da barra do app. COMPENSAÇÃO MARCADA: a seção `unooriaai` não publica
 * faixa de aviso (no Unoovista é o `InlineHint`); daqui só sai o leiaute
 * (`.uai-faixa` em `globals.css`), o glifo é o `Icon` do DS.
 */
export function FaixaDeConexao() {
  return (
    <p className="uai-faixa" role="alert">
      <Icon name="shieldWarning" size={16} />
      <span>{TEXTOS.chat.conexao}</span>
    </p>
  );
}
