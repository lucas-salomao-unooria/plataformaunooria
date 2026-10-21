"use client";

import Link from "next/link";
import { Tag } from "@edu/ui/ds";
import { distribuicaoDa, type MissaoDoPainel, type SerieSomada } from "@/lib/painel-de-habilidades";
import { BarraDaHabilidade } from "./barra-da-habilidade";

/**
 * UMA LINHA SOMADA dentro do cartão de uma missão: o TOTAL no topo (a escola
 * inteira, a regional, a rede), uma regional no painel do contrato, ou uma
 * escola no painel da rede. Contagem e porcentagem na mesma barra das turmas.
 *
 * O total não leva link (ele é a altura em que se está); as outras levam ao
 * degrau de baixo. Série sem a missão não desenha nada — quem decide se a
 * linha existe é a soma que a api mandou.
 */
export function LinhaSomada({
  rotulo,
  href,
  destaque = false,
  serie,
  missao,
}: {
  rotulo: string;
  href?: string;
  /** O TOTAL: a linha que abre o cartão, em negrito e sem link. */
  destaque?: boolean;
  serie: SerieSomada | undefined;
  missao: MissaoDoPainel;
}) {
  const daMissao = serie?.missoes.find((m) => m.expId === missao.expId);
  if (!serie || !daMissao) return null;
  return (
    <li className="linha-de-lista flex flex-col gap-2 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {href ? (
          <Link
            href={href}
            className="text-[15px] font-semibold text-unooria-neutral-950 hover:text-unooria-navy-800"
          >
            {rotulo}
          </Link>
        ) : (
          <span className={`text-[15px] text-unooria-neutral-950 ${destaque ? "font-bold" : "font-semibold"}`}>
            {rotulo}
          </span>
        )}
        <span className="text-[13px] text-unooria-neutral-500">
          {daMissao.turmasAplicadas} de {serie.turmas} {serie.turmas === 1 ? "turma" : "turmas"} aplicaram ·{" "}
          {serie.estudantes} estudantes
        </span>
      </div>
      {daMissao.turmasAplicadas === 0 ? (
        <Tag size="sm">Ainda não aplicada</Tag>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {missao.habilidades.map((h) => {
            const d = distribuicaoDa(serie.missoes, missao.expId, h.codigo);
            return d ? (
              <BarraDaHabilidade
                key={h.codigo}
                titulo={h.codigo}
                subtitulo={h.descricao || "Habilidade da BNCC de Computação"}
                distribuicao={d}
              />
            ) : null;
          })}
        </div>
      )}
    </li>
  );
}
