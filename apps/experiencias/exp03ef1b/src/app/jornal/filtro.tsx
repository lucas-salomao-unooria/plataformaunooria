import { FilterPill } from "@edu/ui/ds-unoojornal";
import { Icone, type NomeDoIcone } from "../comum/icone";

/**
 * As pastilhas do filtro (E3-ALU-01): Quem, Onde, Quando — e, abaixo, os
 * valores da pastilha escolhida. `FilterPill` da seção (a barra pronta, o
 * `FilterBar`, tem a semântica de "todas"/seção e devolve `allId` ao tocar a
 * selecionada, o que apagaria a escolha da criança). Só `ds-unoojornal`.
 *
 * `pulsando`: a pastilha Onde pulsa depois de uma busca com 0 notícias (spec
 * decisão 8).
 */
export function Pastilhas<T extends string>({
  rotulo,
  itens,
  selecionada,
  pulsando,
  grande = false,
  aoEscolher,
}: {
  rotulo: string;
  itens: readonly { id: T; rotulo: string; icone?: NomeDoIcone }[];
  selecionada: T | null;
  pulsando?: T | null;
  grande?: boolean;
  aoEscolher: (id: T) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} className={`pastilhas${grande ? " pastilhas--grandes" : ""}`}>
      {itens.map((item) => (
        <FilterPill
          key={item.id}
          selected={selecionada === item.id}
          onClick={() => aoEscolher(item.id)}
          className={`pastilha alvo-64${pulsando === item.id ? " pulsa" : ""}`}
        >
          {item.icone ? <Icone nome={item.icone} tamanho={18} /> : null}
          {item.rotulo}
        </FilterPill>
      ))}
    </div>
  );
}
