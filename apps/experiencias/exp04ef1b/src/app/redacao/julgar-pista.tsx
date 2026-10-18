import { Button, Tag } from "@edu/ui/ds";
import { E2, VEREDITO } from "../../lib/textos";
import type { Veredito } from "../../lib/tipos";

/** A ordem dos dois botões: a mesma em toda pista (a posição não diz nada da notícia). */
const VEREDITOS: readonly Veredito[] = ["confio", "nao_confio"];

/**
 * "✓ Confio" / "✗ Não confio" sob o texto de uma pista aberta — o julgamento do
 * Canal A (3.0.0, ADR-168). Serve à gaveta da mesa (opcional, vale o primeiro)
 * e à simulação (obrigatório para seguir): a peça só desenha; quem decide se o
 * julgamento é obrigatório, e o que fazer com ele, é a tela que a usa.
 *
 * Dois `Button` do DS lado a lado, ambos `outline`: nenhum dos dois é a
 * resposta "esperada", então nenhum ganha destaque. O símbolo vai sempre com o
 * texto. Marcado, o par vira um `Tag` NEUTRO com o veredito — sem verde nem
 * vermelho, que leriam como certo e errado — e não deixa mudar.
 */
export function JulgarPista({
  veredito,
  enviando,
  aoJulgar,
}: {
  /** O veredito que vale; `null` = ainda não marcado. */
  veredito: Veredito | null;
  enviando: boolean;
  aoJulgar: (veredito: Veredito) => void;
}) {
  if (veredito) {
    return (
      <p className="julgar__marcado" role="status">
        <Tag variant="neutral" size="md" pill>
          {E2.marcado(VEREDITO[veredito])}
        </Tag>
      </p>
    );
  }
  return (
    <div className="julgar" role="group" aria-label={E2.julgar}>
      {VEREDITOS.map((v) => (
        <Button
          key={v}
          variant="outline"
          size="lg"
          fullWidth
          className="acao-crianca"
          disabled={enviando}
          onClick={() => aoJulgar(v)}
        >
          {VEREDITO[v]}
        </Button>
      ))}
    </div>
  );
}
