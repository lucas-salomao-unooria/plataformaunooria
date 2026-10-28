import { Avatar, Card } from "@edu/ui/ds";
import type { ReactNode } from "react";
import nina from "../../assets/nina.svg";
import { NINA } from "../../lib/textos";

/**
 * O quadro central das telas de passagem da MECÂNICA — a ponte da E5, o
 * sucesso e o erro de parada da rotina. `Card` da seção `unooria`, com o
 * retrato da Nina (`Avatar`) ou um pictograma, o título, o texto de apoio e a
 * ação. Só `@edu/ui/ds`.
 */
export function PainelCentral({
  titulo,
  texto,
  acao,
  simbolo,
  comNina = false,
}: {
  titulo: string;
  texto?: string;
  acao: ReactNode;
  simbolo?: ReactNode;
  comNina?: boolean;
}) {
  return (
    <div className="painel-central">
      <Card variant="outlined" className="painel-central__cartao">
        <div className="painel-central__miolo" role="status">
          {comNina ? <Avatar src={nina} alt={NINA.nome} size="xl" /> : simbolo ? <span className="painel-central__simbolo">{simbolo}</span> : null}
          <h2 className="painel-central__titulo">{titulo}</h2>
          {texto ? <p className="painel-central__texto">{texto}</p> : null}
          <div className="painel-central__acao">{acao}</div>
        </div>
      </Card>
    </div>
  );
}
