"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, EmptyState, Selection, Tag } from "@edu/ui/ds";
import { copyDaMissao } from "@/lib/missoes-do-estudante";
import {
  distribuicaoDa,
  rotuloDaSerieDoPainel,
  rotuloDaUnidade,
  seriesDaRede,
  type RedeConsolidada,
} from "@/lib/painel-de-habilidades";
import { BarraDaHabilidade } from "./barra-da-habilidade";

const TODAS = "todas";

/**
 * O PAINEL DA REDE (H14.7.3): por série, cada missão num cartão e, dentro
 * dele, cada escola com a soma das turmas — em contagem e porcentagem.
 *
 * Escolas por NOME, sem ranking: o objetivo é acompanhar e direcionar apoio,
 * não comparar. O nome da escola abre o painel daquela escola; de lá, a turma
 * e o estudante. Nome de criança nunca aparece nesta tela.
 */
export function PainelDaRede({
  painel,
  linkDaEscola,
}: {
  painel: RedeConsolidada;
  /** O endereço do painel da escola é `${prefixo}${id}`. */
  linkDaEscola: { prefixo: string };
}) {
  const series = seriesDaRede(painel);
  const [serie, setSerie] = useState<string>(TODAS);
  const visiveis = serie === TODAS ? series : series.filter((s) => s.serie === serie);
  const algumaAplicada = painel.escolas.some((e) => e.series.some((s) => s.missoes.some((m) => m.turmasAplicadas > 0)));

  if (painel.escolas.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        size="lg"
        bordered
        fullWidth
        title="Nenhuma escola nesta regional."
        description="As escolas aparecem aqui quando estiverem cadastradas na regional."
      />
    );
  }
  if (!algumaAplicada) {
    return (
      <EmptyState
        variant="no-data"
        size="lg"
        bordered
        fullWidth
        title="Nenhuma escola concluiu ainda uma missão com habilidades da BNCC."
        description="O painel se preenche à medida que os professores aplicam as missões que registram a BNCC."
      />
    );
  }

  return (
    <div className="plataforma-largura-cheia flex flex-col gap-6">
      {/* `plataforma-largura-cheia`: o `Card` do DS tem teto de 398px, e aqui ele
          carrega uma grade de barras (compensação de `packages/ui/styles/plataforma.css`). */}
      <div className="max-w-xs">
        <Selection
          id="serie-da-rede"
          label="Ano/série"
          value={serie}
          options={[
            { value: TODAS, label: "Todos os anos/séries" },
            ...series.map((s) => ({ value: s.serie, label: rotuloDaSerieDoPainel(s.serie) })),
          ]}
          onChange={(v) => setSerie(String(v))}
        />
      </div>

      {visiveis.map((grupo) => (
        <section key={grupo.serie} className="flex flex-col gap-3">
          <h2 className="text-[18px] font-bold text-unooria-neutral-950">{rotuloDaSerieDoPainel(grupo.serie)}</h2>
          {grupo.missoes.map((missao) => (
            <Card
              key={missao.expId}
              variant="outlined"
              title={`${rotuloDaUnidade(missao.unidade)} · ${copyDaMissao(missao.expId)?.titulo ?? missao.nome}`}
            >
              <ul className="flex flex-col gap-4">
                {painel.escolas.map((escola) => {
                  const daSerie = escola.series.find((s) => s.serie === grupo.serie);
                  const daMissao = daSerie?.missoes.find((m) => m.expId === missao.expId);
                  if (!daSerie || !daMissao) return null;
                  return (
                    <li key={escola.id} className="linha-de-lista flex flex-col gap-2 pb-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`${linkDaEscola.prefixo}${encodeURIComponent(escola.id)}`}
                          className="text-[15px] font-semibold text-unooria-neutral-950 hover:text-unooria-navy-800"
                        >
                          {escola.nome}
                        </Link>
                        <span className="text-[13px] text-unooria-neutral-500">
                          {daMissao.turmasAplicadas} de {daSerie.turmas} {daSerie.turmas === 1 ? "turma" : "turmas"}{" "}
                          aplicaram · {daSerie.estudantes} estudantes
                        </span>
                      </div>
                      {daMissao.turmasAplicadas === 0 ? (
                        <Tag size="sm">Ainda não aplicada</Tag>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {missao.habilidades.map((h) => {
                            const d = distribuicaoDa(daSerie.missoes, missao.expId, h.codigo);
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
                })}
              </ul>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
