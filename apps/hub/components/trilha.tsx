'use client';

import Link from 'next/link';

import { Breadcrumb } from '@edu/ui/ds';

export type ItemDaTrilha = {
  label: string;
  /** Ausente no item atual (o último), que nunca é link. */
  href?: string;
};

/**
 * Breadcrumb do DS ligado ao roteador do Next.
 *
 * Existe porque o header do professor perdeu os atalhos fixos: com o hub de
 * produtos, a navegação é hierárquica (produto → missão → atividade) e é a
 * trilha que devolve o caminho de volta. O `as: Link` precisa ser costurado
 * aqui, num client component: referência de componente não atravessa a
 * fronteira RSC.
 */
export function Trilha({ itens }: { itens: ItemDaTrilha[] }) {
  const ultimo = itens.length - 1;

  return (
    <Breadcrumb
      size="s"
      ariaLabel="Onde você está"
      items={itens.map((item, indice) => {
        const atual = indice === ultimo;
        return {
          label: item.label,
          isCurrent: atual,
          // Item atual sai como texto: com `as` o DS renderiza um <Link> mesmo
          // marcado como current, e a página viraria link para si mesma.
          ...(atual || !item.href ? {} : { href: item.href, as: Link }),
        };
      })}
    />
  );
}
