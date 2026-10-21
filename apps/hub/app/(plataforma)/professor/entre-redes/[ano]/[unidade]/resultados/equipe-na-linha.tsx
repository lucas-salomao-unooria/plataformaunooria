import { Tag } from "@edu/ui/ds";
import { nomesDosMembros, type EquipeNoPainel } from "@/lib/equipe-no-painel";

/**
 * A primeira célula de uma linha que é UM COMPUTADOR com equipe (E13): o nome
 * da equipe, quem senta diante dele e quem entrou na missão.
 *
 * Sem hook e sem função nas props de propósito: a tabela do UnooTube é client
 * component e a folha da Missão Tempestade é server component, e as duas usam
 * esta mesma célula.
 *
 * "entrou" só aparece quando alguém de fato entrou: sem isso, a linha traz o
 * primeiro membro como representante, e dizer que ele entrou seria falso.
 *
 * Sem membros (a api da exp07ef1b devolve só o nome da equipe, e a tela os
 * cruza com as equipes da missão), a linha de nomes some em vez de sair vazia.
 */
export function EquipeNaLinha({
  equipe,
  representante,
  entrou,
}: {
  equipe: EquipeNoPainel;
  representante: string;
  entrou: boolean;
}) {
  return (
    <span className="flex flex-col items-start gap-1" data-equipe={equipe.nome}>
      <Tag variant="info" size="sm">
        {equipe.nome}
      </Tag>
      {equipe.membros.length > 0 ? (
        <span className="text-[11px] leading-snug text-unooria-neutral-600">{nomesDosMembros(equipe)}</span>
      ) : null}
      {entrou ? (
        <span className="text-[11px] leading-snug text-unooria-neutral-500">entrou: {representante}</span>
      ) : null}
    </span>
  );
}
