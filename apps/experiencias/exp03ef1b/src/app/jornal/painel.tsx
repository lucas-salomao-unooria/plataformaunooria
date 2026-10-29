import { Figure } from "@edu/ui/ds-unoojornal";
import type { ReactNode } from "react";

/**
 * O "Painel da Investigação" (E6-ALU-03): quatro colunas com o resumo da
 * PRÓPRIA sessão e o rodapé de somente-leitura. Fala o jornal (o painel é a
 * redação arquivando o caso), então só `ds-unoojornal`.
 *
 * (b) COMPENSAÇÃO — sem par no DS: a seção não tem "coluna de quadro" (o
 * `OpinionBox` é citação; o `ArticleCard` exige foto). A coluna é só fio,
 * recuo e tipografia com os tokens `--ujn-*` (`.painel-coluna`).
 */
export function ColunaDoPainel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="painel-coluna" aria-label={titulo}>
      <h3 className="painel-coluna__titulo">{titulo}</h3>
      <div className="painel-coluna__texto">{children}</div>
    </section>
  );
}

export function RodapeSomenteLeitura({ children }: { children: ReactNode }) {
  return <p className="painel-rodape">{children}</p>;
}

/** A foto de uma matéria fora do cartão (a foto grande do telão). */
export function FotoDaMateria({ src, alt, legenda, className }: { src: string; alt: string; legenda?: string; className?: string }) {
  return <Figure src={src} alt={alt} caption={legenda} className={className} />;
}
