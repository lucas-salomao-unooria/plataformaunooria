"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, EmptyState, Selection, Tag } from "@edu/ui/ds";
import { copyDaMissao } from "@/lib/missoes-do-estudante";
import {
  distribuicaoDa,
  rotuloDaSerieDoPainel,
  rotuloDaUnidade,
  seriesDaEscola,
  type EscolaConsolidada,
} from "@/lib/painel-de-habilidades";
import { BarraDaHabilidade } from "./barra-da-habilidade";
import { LinhaSomada } from "./linha-somada";

const TODAS = "todas";

/**
 * O PAINEL DA ESCOLA (H14.7.2): as turmas do ano letivo agrupadas por série,
 * cada missão num cartão e, dentro dele, cada turma com a barra de cada
 * habilidade. A barra mostra contagem e porcentagem — é a porcentagem que
 * deixa ler lado a lado turmas de tamanhos diferentes.
 *
 * O cartão abre pelo TOPO: "Escola inteira", a soma das turmas da série que a
 * api mandou em `total` — é a altura em que a coordenação começa, e embaixo
 * vêm as turmas que somam aquele número.
 *
 * Sem ranking entre turmas: série na ordem da trilha, nome dentro dela, como a
 * api manda. A coordenação só LÊ; o nome da turma abre a visão do professor.
 */
export function PainelDaEscola({
  painel,
  linkDaTurma,
}: {
  painel: EscolaConsolidada;
  /** O endereço da turma é `${prefixo}${id}${sufixo}`. */
  linkDaTurma: { prefixo: string; sufixo?: string };
}) {
  const grupos = seriesDaEscola(painel);
  const [serie, setSerie] = useState<string>(TODAS);
  const visiveis = serie === TODAS ? grupos : grupos.filter((g) => g.serie === serie);
  const algumaAplicada = painel.turmas.some((t) => t.missoes.some((m) => m.aplicada));

  if (grupos.length === 0 || !algumaAplicada) {
    return (
      <EmptyState
        variant="no-data"
        size="lg"
        bordered
        fullWidth
        title="Nenhuma turma desta escola concluiu ainda uma missão com habilidades da BNCC."
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
          id="serie-do-painel"
          label="Ano/série"
          value={serie}
          options={[
            { value: TODAS, label: "Todos os anos/séries" },
            ...grupos.map((g) => ({ value: g.serie, label: rotuloDaSerieDoPainel(g.serie) })),
          ]}
          onChange={(v) => setSerie(String(v))}
        />
      </div>

      {visiveis.map((grupo) => (
        <section key={grupo.serie} className="flex flex-col gap-3">
          <h2 className="text-[18px] font-bold text-unooria-neutral-950">
            {rotuloDaSerieDoPainel(grupo.serie)}
            <span className="ml-2 text-[14px] font-normal text-unooria-neutral-500">
              {grupo.turmas.length === 1 ? "1 turma" : `${grupo.turmas.length} turmas`}
            </span>
          </h2>

          {grupo.missoes.map((missao) => (
            <Card
              key={missao.expId}
              variant="outlined"
              title={`${rotuloDaUnidade(missao.unidade)} · ${copyDaMissao(missao.expId)?.titulo ?? missao.nome}`}
            >
              <ul className="flex flex-col gap-4">
                <LinhaSomada
                  rotulo="Escola inteira"
                  destaque
                  serie={painel.total.find((s) => s.serie === grupo.serie)}
                  missao={missao}
                />
                {grupo.turmas.map((turma) => {
                  const daTurma = turma.missoes.find((m) => m.expId === missao.expId);
                  if (!daTurma) return null;
                  return (
                    <li key={turma.id} className="linha-de-lista flex flex-col gap-2 pb-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`${linkDaTurma.prefixo}${turma.id}${linkDaTurma.sufixo ?? ""}`}
                          className="text-[15px] font-semibold text-unooria-neutral-950 hover:text-unooria-navy-800"
                        >
                          Turma {turma.nome}
                        </Link>
                        <span className="text-[13px] text-unooria-neutral-500">{turma.estudantes} estudantes</span>
                      </div>
                      {!daTurma.aplicada ? (
                        <Tag size="sm">Ainda não aplicada</Tag>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {missao.habilidades.map((h) => {
                            const d = distribuicaoDa(turma.missoes, missao.expId, h.codigo);
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
