"use client";

import { useState } from "react";
import { Card, EmptyState, Selection } from "@edu/ui/ds";
import { copyDaMissao } from "@/lib/missoes-do-estudante";
import {
  rotuloDaSerieDoPainel,
  rotuloDaUnidade,
  seriesDaRede,
  type RedeConsolidada,
  type SerieSomada,
} from "@/lib/painel-de-habilidades";
import { LinhaSomada } from "./linha-somada";

const daSerie = (series: readonly SerieSomada[], serie: string) => series.find((s) => s.serie === serie);

const TODAS = "todas";

/**
 * O PAINEL DA REDE (H14.7.3): por série, cada missão num cartão e, dentro
 * dele, cada escola com a soma das turmas — em contagem e porcentagem.
 *
 * O cartão abre pelo TOPO ("Regional inteira" ou "Rede inteira", o `total` da
 * api). Para o contrato na rede inteira há um degrau a mais: em vez de cem
 * escolas, uma linha por REGIONAL, que abre o painel dela; só a escola sem
 * regional aparece sozinha — sem ela o topo não fecharia com as linhas.
 *
 * Escolas por NOME, sem ranking: o objetivo é acompanhar e direcionar apoio,
 * não comparar. O nome da escola abre o painel daquela escola; de lá, a turma
 * e o estudante. Nome de criança nunca aparece nesta tela.
 */
export function PainelDaRede({
  painel,
  linkDaEscola,
  linkDaRegional,
}: {
  painel: RedeConsolidada;
  /** O endereço do painel da escola é `${prefixo}${id}`. */
  linkDaEscola: { prefixo: string };
  /** O endereço do painel da regional é `${prefixo}${id}` — só o contrato chega a ele. */
  linkDaRegional: { prefixo: string };
}) {
  const porRegional = painel.regionais.length > 0;
  const escolasEmLinha = porRegional ? painel.escolas.filter((e) => e.regionalId === null) : painel.escolas;
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
                <LinhaSomada
                  rotulo={painel.regional ? "Regional inteira" : "Rede inteira"}
                  destaque
                  serie={daSerie(painel.total, grupo.serie)}
                  missao={missao}
                />
                {porRegional
                  ? painel.regionais.map((regional) => (
                      <LinhaSomada
                        key={regional.id}
                        rotulo={regional.nome}
                        href={`${linkDaRegional.prefixo}${encodeURIComponent(regional.id)}`}
                        serie={daSerie(regional.series, grupo.serie)}
                        missao={missao}
                      />
                    ))
                  : null}
                {escolasEmLinha.map((escola) => (
                  <LinhaSomada
                    key={escola.id}
                    rotulo={escola.nome}
                    href={`${linkDaEscola.prefixo}${encodeURIComponent(escola.id)}`}
                    serie={daSerie(escola.series, grupo.serie)}
                    missao={missao}
                  />
                ))}
              </ul>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
