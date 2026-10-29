import { Button, Card } from "@edu/ui/ds";
import type { ReactNode } from "react";
import { CARIMBOS, type Carimbo } from "../../lib/tipos";
import { ROTULO_DO_CARIMBO } from "../../lib/textos";
import { Icone } from "../comum/icone";

const ICONE_DO_CARIMBO = { v: "carimbo-v", x: "carimbo-x", duvida: "carimbo-duvida" } as const;

/**
 * O cartão-afirmação com os TRÊS carimbos visíveis (E4-ALU-02 e E6-ALU-01, o
 * mesmo componente — spec §7.5): ✔ "É verdade" (círculo), ✖ "Não é verdade"
 * (quadrado), ? "Não dá para saber" (triângulo). Ícone + texto, e a forma
 * diz qual é sem depender de cor.
 *
 * **Sem cor de certo ou errado**: o escolhido fica `primary` (a cor de ação
 * da seção, igual para os três); os outros, `outline`. Trocar à vontade até
 * o "Avançar" — nenhuma correção volta: o certo é do servidor (regra 3).
 * Só `@edu/ui/ds` (`Card`, `Button`).
 */
export function CartaoDeCarimbo({
  titulo,
  figura,
  pergunta,
  marcado,
  destaque = false,
  desabilitado = false,
  aoCarimbar,
}: {
  titulo: string;
  figura: ReactNode;
  pergunta: string;
  marcado: Carimbo | undefined;
  destaque?: boolean;
  desabilitado?: boolean;
  aoCarimbar: (c: Carimbo) => void;
}) {
  return (
    <Card variant="outlined" className={`cartao-carimbo${destaque ? " cartao-carimbo--destaque" : ""}`}>
      <p className="cartao-carimbo__titulo">{titulo}</p>
      <div className="cartao-carimbo__figura">{figura}</div>
      <p className="cartao-carimbo__pergunta">{pergunta}</p>
      <div className="cartao-carimbo__opcoes" role="group" aria-label={pergunta}>
        {CARIMBOS.map((c) => (
          <Button
            key={c}
            variant={marcado === c ? "primary" : "outline"}
            size="lg"
            fullWidth
            aria-pressed={marcado === c}
            disabled={desabilitado}
            leftIcon={<Icone nome={ICONE_DO_CARIMBO[c]} tamanho={24} />}
            onClick={() => aoCarimbar(c)}
            className="alvo-64 cartao-carimbo__opcao"
          >
            {ROTULO_DO_CARIMBO[c]}
          </Button>
        ))}
      </div>
    </Card>
  );
}
