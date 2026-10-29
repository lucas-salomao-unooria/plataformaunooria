import { Card } from "@edu/ui/ds";

/**
 * Um quadro de explicação da mecânica (o "Veja como ficariam as 3 notícias
 * completas:" do erro do reparo). `Card` da seção, título e apoio.
 */
export function PainelDeAviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Card variant="outlined" className="painel-de-aviso">
      <strong className="painel-de-aviso__titulo">{titulo}</strong>
      <span className="painel-de-aviso__texto">{texto}</span>
    </Card>
  );
}
