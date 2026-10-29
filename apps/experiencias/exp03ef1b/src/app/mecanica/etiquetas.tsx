import { Card, PuzzleBlock } from "@edu/ui/ds";
import type { ReactNode } from "react";
import type { Campo } from "../../lib/tipos";
import { E4 } from "../../lib/textos";
import { Icone } from "../comum/icone";

export interface EtiquetaNaBandeja {
  id: string;
  rotulo: string;
  icone: Campo;
  posicionada: boolean;
}

/**
 * A bandeja de etiquetas do reparo (E4-ALU-03): 📍 Pátio, 👤 estudantes,
 * 📅 sexta. TOQUE SEQUENCIAL: tocar a etiqueta a ESCOLHE (`selected` do
 * `PuzzleBlock`), tocar um campo da ficha a solta lá. A posicionada fica na
 * bandeja apagada ("Pátio (posicionada)") e ainda pode ser escolhida de novo
 * para trocar de campo. Só `@edu/ui/ds`.
 */
export function BandejaDeEtiquetas({
  etiquetas,
  escolhida,
  aoEscolher,
  status,
  acoes,
}: {
  etiquetas: readonly EtiquetaNaBandeja[];
  escolhida: string | null;
  aoEscolher: (id: string) => void;
  status: string;
  acoes: ReactNode;
}) {
  return (
    <Card variant="outlined" className="etiquetas">
      <h2 className="rotulo-de-secao">{E4.etiquetas}</h2>
      <ul className="etiquetas__lista">
        {etiquetas.map((e) => (
          <li key={e.id} className={e.posicionada ? "etiquetas__item--posicionada" : undefined}>
            <PuzzleBlock
              label={
                <span className="rotulo-com-icone">
                  <Icone nome={e.icone} tamanho={18} />
                  {e.posicionada ? E4.posicionada(e.rotulo) : e.rotulo}
                </span>
              }
              state="idle"
              selected={escolhida === e.id}
              onClick={() => aoEscolher(e.id)}
            />
          </li>
        ))}
      </ul>
      <p className="ajuda" aria-live="polite">
        {status}
      </p>
      <div className="etiquetas__acoes">{acoes}</div>
    </Card>
  );
}
