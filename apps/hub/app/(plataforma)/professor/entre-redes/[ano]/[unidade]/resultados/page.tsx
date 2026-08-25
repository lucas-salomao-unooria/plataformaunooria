import { notFound } from "next/navigation";

import { BarChart, Card, EmptyState, MetricCard, UNOORIA_DATAVIZ_PALETTE } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  MISSAO_UNOOTUBE,
  buscarMissao,
  rotaDaMissao,
  rotuloDaMissao,
} from "@/lib/entre-redes/catalogo";
import { normalizarSerie } from "@/lib/series";
import type { ResultadosDaTurma, TurmaResumo } from "@/lib/unootube-tipos";

import { SeletorDeTurma } from "./seletor-de-turma";
import { TabelaResultados } from "./tabela-resultados";

/**
 * Resultados do UnooTube por turma. A turma vem da URL (`?turmaId=`), como a
 * escola em `/analise`: link compartilhável e nunca "sem turma = todas". Busca
 * server-side via `apiDoServidor` — o token nunca chega ao client.
 */
export default async function ResultadosPage({
  params,
  searchParams,
}: {
  params: Promise<{ ano: string; unidade: string }>;
  searchParams: Promise<{ turmaId?: string }>;
}) {
  const { ano: anoSlug, unidade: unidadeSlug } = await params;
  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  if (!encontrado || encontrado.missao.expId !== MISSAO_UNOOTUBE.expId) notFound();
  const { ano, missao } = encontrado;

  const { turmaId } = await searchParams;
  const turma = turmaId?.trim() ?? "";
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;

  const listaTurmas = await apiDoServidor<{ turmas: TurmaResumo[] }>("/unootube/turmas");
  const todas = listaTurmas?.turmas ?? [];
  const doQuartoAno = todas.filter((t) => normalizarSerie(t.serie) === "4EF");
  const turmas = doQuartoAno.length > 0 ? doQuartoAno : todas;
  const aviso =
    doQuartoAno.length === 0 && todas.length > 0
      ? "Nenhuma turma de 4º ano nesta escola — mostrando todas."
      : undefined;

  const resultados = turma
    ? await apiDoServidor<ResultadosDaTurma>(`/unootube/turmas/${encodeURIComponent(turma)}/resultados`)
    : null;

  const paleta = UNOORIA_DATAVIZ_PALETTE;
  const resumo = resultados?.resumo;
  // O BarChart do DS tem eixo fixo 0–100: os valores vão em % dos concluídos
  // (contagens de 0 a 40 alunos sumiriam na escala). Rótulos curtos: o eixo x
  // trunca texto acima de ~8 caracteres.
  const distribuicao = resumo
    ? (["0", "1", "2", "3"] as const).map((chave, i) => ({
        label: chave,
        value: resumo.concluiram ? Math.round((resumo.distribuicaoFontes[chave] / resumo.concluiram) * 100) : 0,
        color: paleta[i] ?? paleta[0],
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <Trilha
        itens={[
          { label: "Início", href: "/professor" },
          { label: "Entre Redes", href: "/professor/entre-redes" },
          { label: rotuloDaMissao(ano, missao), href: rotaDaMissao(missao) },
          { label: "Resultados da turma" },
        ]}
      />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">{missao.titulo}</p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">Resultados da turma</h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          Quem já salvou os 3 vídeos, quantas fontes confiáveis escolheu e quem chegou à virada do
          ranking. Recalculado a cada visita — atualize a página durante a aula.
        </p>
      </header>

      <SeletorDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. Os resultados aparecem por aluno, inclusive quem ainda não entrou.
          </p>
        </Card>
      ) : resultados === null ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos abrir os resultados desta turma"
          description="Confira se a turma é desta escola e tente de novo."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard title="Alunos na turma" value={resultados.resumo.total} />
            <MetricCard title="Concluíram" value={`${resultados.resumo.concluiram}/${resultados.resumo.total}`} />
            <MetricCard
              title="Média de fontes confiáveis"
              value={resultados.resumo.mediaFontesConcluidos === null ? "—" : resultados.resumo.mediaFontesConcluidos.toLocaleString("pt-BR")}
            />
          </div>
          <p className="-mt-2 text-[12px] leading-snug text-unooria-neutral-600">
            {resultados.resumo.iniciaram} entraram · {resultados.resumo.desbloquearamRanking} chegaram ao ranking ·
            a média considera só quem concluiu (0 a 3 fontes)
          </p>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Card variant="elevated">
              <BarChart
                title="Fontes confiáveis (0 a 3) — % dos concluídos"
                subtitle={`${resultados.resumo.concluiram} ${resultados.resumo.concluiram === 1 ? "aluno concluiu" : "alunos concluíram"} · eixo x = quantas das 3 escolhas eram fontes confiáveis`}
                data={distribuicao}
                height={200}
              />
            </Card>
            <Card variant="elevated">
              <div className="flex flex-col gap-2">
                <h2 className="text-[16px] font-semibold text-unooria-neutral-950">Como ler</h2>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-unooria-neutral-700">
                  <li>
                    <strong>Inscritos</strong> é a métrica-isca: cada vídeo sensacionalista salvo dá 1.000,
                    cada fonte confiável dá 50. Quem tem mais inscritos escolheu pior.
                  </li>
                  <li>
                    <strong>Fontes confiáveis</strong> é o que vale: 3/3 significa que as três escolhas
                    citavam fonte verificável.
                  </li>
                  <li>
                    <strong>Concluiu</strong> = clicou em "Adicionar credibilidade" e viu a virada do
                    ranking. Antes disso o aluno ainda pode trocar os salvos.
                  </li>
                </ul>
              </div>
            </Card>
          </div>

          <Card variant="elevated" title={`${resultados.turma.nome} · ${resultados.turma.serie}`}>
            <TabelaResultados alunos={resultados.alunos} />
          </Card>

          <div>
            <LinkButton href={`${rotaBase}?turmaId=${encodeURIComponent(turma)}`} variant="secondary">
              Atualizar
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
