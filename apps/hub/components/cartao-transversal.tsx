import Link from "next/link";

import { Badge, Card, Tag } from "@edu/ui/ds";
import { rotaDaTransversal, type MissaoTransversal } from "@/lib/entre-redes/catalogo";

/**
 * Card de uma missão TRANSVERSAL na trilha do Entre Redes.
 *
 * Componente próprio, e não o `CartaoMissao` com props opcionais: aquele
 * carrega "Unidade N" e a contagem de atividades no rodapé, e as duas coisas
 * são justamente o que uma missão sem ano não tem. Forçá-lo a esconder metade
 * do que desenha é como um card acaba dizendo "Unidade undefined".
 *
 * O card mostra POR QUE ela não tem ano. Sem essa linha, o professor de 5º ano
 * lê um card fora da grade e conclui que é de outro ano — e a transversalidade
 * é o ponto: ele pode rodar com a turma dele.
 */
export function CartaoTransversal({ missao }: { missao: MissaoTransversal }) {
  const emBreve = missao.status === "em-breve";

  const corpo = (
    <Card
      variant={emBreve ? "outlined" : "interactive"}
      interactive={!emBreve}
      className={`h-full ${emBreve ? "cartao-missao--em-breve" : ""}`}
    >
      <div className="flex h-full flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Tag variant="brand" size="sm" pill>
            Transversal
          </Tag>
          <Badge variant={emBreve ? "disable" : "success"}>
            {emBreve ? "Em breve" : "Disponível"}
          </Badge>
        </div>

        <h3 className="text-[16px] font-semibold leading-snug text-unooria-neutral-950">
          {missao.titulo}
        </h3>
        <p className="text-[13px] leading-relaxed text-unooria-neutral-700">{missao.resumo}</p>

        <p className="mt-auto pt-1 text-[12px] leading-snug text-unooria-neutral-500">
          {missao.porQueTransversal}
        </p>
      </div>
    </Card>
  );

  if (emBreve) {
    return <div aria-label={`${missao.titulo}: em breve`}>{corpo}</div>;
  }
  return (
    <Link href={rotaDaTransversal(missao)} className="block h-full">
      {corpo}
    </Link>
  );
}
