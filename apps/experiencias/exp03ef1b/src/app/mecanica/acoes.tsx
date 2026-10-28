import { Button, Icon } from "@edu/ui/ds";
import type { ReactNode } from "react";

/**
 * Os botões da MECÂNICA (Travar Escolha, Confrontar e Aguardar Turma,
 * Avançar dos carimbos, Concluir, Testar Rotina, Continuar da ponte…). O
 * `Button` da seção `unooria` para em `lg` = 52px; `.alvo-64` leva a 64px
 * (compensação em `globals.css`, a mesma da exp04ef1b).
 */
export function AcaoDaMissao({
  children,
  variante = "primary",
  desabilitado = false,
  ocupado = false,
  icone,
  depois,
  aoTocar,
  larga = false,
}: {
  children: ReactNode;
  variante?: "primary" | "outline" | "secondary";
  desabilitado?: boolean;
  ocupado?: boolean;
  /** Ligadura do Material Symbols antes do rótulo (`lock`, `play_arrow`). */
  icone?: string;
  /** Ligadura depois do rótulo (a seta ▶ do protótipo: `play_arrow`). */
  depois?: string;
  aoTocar: () => void;
  larga?: boolean;
}) {
  return (
    <Button
      variant={variante}
      size="lg"
      disabled={desabilitado || ocupado}
      isLoading={ocupado}
      leftIcon={icone ? <Icon name={icone} size="s" /> : undefined}
      rightIcon={depois ? <Icon name={depois} size="s" /> : undefined}
      fullWidth={larga}
      onClick={aoTocar}
      className="alvo-64"
    >
      {children}
    </Button>
  );
}
