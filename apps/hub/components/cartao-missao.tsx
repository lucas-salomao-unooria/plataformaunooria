import Link from "next/link";

import { Badge, Card } from "@edu/ui/ds";
import type { Ano, Missao } from "@/lib/entre-redes/catalogo";
import { rotaDaMissao } from "@/lib/entre-redes/catalogo";

function rodape(missao: Missao, atividades: number | undefined): string {
  // Missão sem atividades configuráveis (ex.: UnooTube): o professor só entra com a turma.
  if (atividades === undefined) return missao.expId ? "Sem configuração — é só entrar com a turma" : "";
  if (atividades === 0) return "Nenhuma atividade criada";
  if (atividades === 1) return "1 atividade";
  return `${atividades} atividades`;
}

/**
 * Uma unidade da trilha do Entre Redes.
 *
 * As unidades sem conteúdo continuam na grade, apagadas e sem link: a grade de
 * 4 unidades por ano é a informação — some com elas e o professor não entende
 * onde a missão dele mora, nem o que vem depois.
 */
export function CartaoMissao({
  ano,
  missao,
  atividades,
}: {
  ano: Ano;
  missao: Missao;
  /** Quantas atividades o professor já criou nesta missão. */
  atividades?: number;
}) {
  const emBreve = missao.status === "em-breve";

  const corpo = (
    <Card
      variant={emBreve ? "outlined" : "interactive"}
      interactive={!emBreve}
      className={`h-full ${emBreve ? "cartao-missao--em-breve" : ""}`}
    >
      <div className="flex h-full flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-unooria-neutral-500">
            Unidade {missao.unidade}
          </span>
          <Badge variant={emBreve ? "disable" : "success"}>
            {emBreve ? "Em breve" : "Disponível"}
          </Badge>
        </div>

        <h3 className="text-[16px] font-semibold leading-snug text-unooria-neutral-950">
          {missao.titulo}
        </h3>
        <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
          {missao.resumo}
        </p>

        {emBreve ? null : (
          <p className="mt-auto pt-1 text-[12px] text-unooria-neutral-500">
            {rodape(missao, atividades)}
          </p>
        )}
      </div>
    </Card>
  );

  if (emBreve) {
    return (
      <div aria-label={`${ano.rotulo}, unidade ${missao.unidade}: em breve`}>
        {corpo}
      </div>
    );
  }

  return (
    <Link href={rotaDaMissao(missao)} className="block h-full">
      {corpo}
    </Link>
  );
}
