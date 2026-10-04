"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, EmptyState, Tabs, Tag } from "@edu/ui/ds";
import { copyDaMissao } from "@/lib/missoes-do-estudante";
import {
  colunasPorUnidade,
  ordenarHabilidades,
  rotuloDaUnidade,
  type OrdemDasHabilidades,
  type TurmaConsolidada,
} from "@/lib/painel-de-habilidades";
import { BarraDaHabilidade } from "./barra-da-habilidade";

/**
 * O PAINEL DA TURMA (H14.7.1): as habilidades da BNCC de Computação de cada
 * missão, em quatro colunas — as unidades do ano —, cada uma com quantas
 * crianças atingiram, estão em processo, não atingiram e não foram avaliadas.
 *
 * É a mesma tela para o professor e para a coordenação no drill-down; o que
 * muda é para onde o nome do estudante leva (`linkDoEstudante`, montado pela
 * página — função não atravessa a fronteira do servidor).
 *
 * A ordenação "mais atingidas primeiro" é das HABILIDADES, dentro de cada
 * coluna. A lista de estudantes é alfabética e nunca um ranking.
 */
export function PainelDaTurma({
  painel,
  linkDoEstudante,
  semMissao,
}: {
  painel: TurmaConsolidada;
  /** O endereço do perfil é `${prefixo}${id}${sufixo}`. */
  linkDoEstudante: { prefixo: string; sufixo?: string };
  /** O que oferecer quando a turma ainda não fez nenhuma missão (só o professor aplica). */
  semMissao?: { rotulo: string; href: string };
}) {
  const [ordem, setOrdem] = useState<OrdemDasHabilidades>("ficha");
  const aplicadas = painel.missoes.filter((m) => m.aplicada);

  if (aplicadas.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Esta turma ainda não concluiu nenhuma missão com habilidades da BNCC."
          description="O painel se preenche à medida que a turma faz as atividades das missões que registram a BNCC."
        />
        {semMissao ? (
          <Link
            href={semMissao.href}
            className="self-start text-[14px] font-semibold text-unooria-navy-900 hover:text-unooria-navy-800"
          >
            {semMissao.rotulo}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="plataforma-largura-cheia flex flex-col gap-6">
      {/* `plataforma-largura-cheia`: o `Card` do DS tem teto de 398px, e aqui ele
          carrega uma grade de barras (compensação de `packages/ui/styles/plataforma.css`). */}
      <p className="text-[14px] text-unooria-neutral-700">
        Turma {painel.turma.nome} · {painel.estudantes.length} estudantes. O número ao lado de cada habilidade é o
        total da turma; a legenda diz quantos em cada nível.
      </p>
      <Tabs
        value={ordem}
        onChange={(valor) => setOrdem(valor === "atingimento" ? "atingimento" : "ficha")}
        items={[
          { value: "ficha", label: "Ordem da missão" },
          { value: "atingimento", label: "Mais atingidas primeiro" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {colunasPorUnidade(painel.missoes).map((coluna) => (
          <section key={coluna.unidade ?? "transversais"} className="flex min-w-0 flex-col gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
              {rotuloDaUnidade(coluna.unidade)}
            </h2>
            {coluna.missoes.length === 0 ? (
              <p className="text-[13px] text-unooria-neutral-500">Nenhuma missão com habilidades nesta unidade ainda.</p>
            ) : (
              coluna.missoes.map((missao) => (
                <Card
                  key={missao.expId}
                  variant="outlined"
                  title={copyDaMissao(missao.expId)?.titulo ?? missao.nome}
                >
                  {!missao.aplicada ? (
                    <Tag size="sm">Ainda não aplicada nesta turma</Tag>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {ordenarHabilidades(missao.habilidades, ordem).map((h) => (
                        <BarraDaHabilidade
                          key={h.codigo}
                          titulo={h.codigo}
                          subtitulo={h.descricao || "Habilidade da BNCC de Computação"}
                          distribuicao={h.distribuicao}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              ))
            )}
          </section>
        ))}
      </div>

      <Card variant="outlined" title="Estudantes">
        <p className="mb-2 text-[13px] text-unooria-neutral-500">
          Em ordem alfabética. Abra um nome para ver o resultado dele em cada missão e habilidade.
        </p>
        <ul className="flex flex-col">
          {painel.estudantes.map((e) => (
            <li key={e.id} className="linha-de-lista py-2">
              <Link
                href={`${linkDoEstudante.prefixo}${e.id}${linkDoEstudante.sufixo ?? ""}`}
                className="block truncate text-[15px] font-semibold text-unooria-neutral-950 hover:text-unooria-navy-800"
              >
                {e.nome}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
