import Link from "next/link";
import { Card, EmptyState, MetricCard } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  rotaDaMissao,
  rotuloDaMissao,
  type Ano,
  type Missao,
} from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { normalizarSerie } from "@/lib/series";
import type { FolhaDaTurma, TurmaResumo } from "@/lib/unoogpt-tipos";

import { PainelDoRelogio } from "./painel-do-relogio";
import { SeletorDeTurma } from "./seletor-de-turma";
import { ZerarTurma } from "./zerar-turma";

/**
 * A aula da MISSÃO TEMPESTADE: o relógio da turma e o retrato de conduta.
 *
 * A REGRA QUE ESTA TELA APLICA: nenhuma coluna de resgatados. Listagem é
 * ordenável, e ordenar crianças por acerto viraria ranking — o número fica na
 * tela individual, uma por vez. É a mesma regra da exp-70, e ela é o motivo de
 * a folha falar de CONDUTA (leu antes de decidir? viu fontes discordando?
 * justificou por intuição?) em vez de desempenho.
 */
export async function ResultadosUnooGPT({
  ano,
  missao,
  turma,
}: {
  ano: Ano;
  missao: Missao;
  turma: string;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  const lista = await apiDoServidor<{ turmas: TurmaResumo[] }>("/unoogpt/professor/turmas");
  const todas = lista?.turmas ?? [];
  const daSegundaSerie = todas.filter((t) => normalizarSerie(t.serie) === "2EM");
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão.
     O que saiu foi o FALLBACK "mostrando todas": sem turma da série ele
     silenciosamente oferecia as outras, e o professor escolhia uma turma que
     nunca vai jogar isto. Sem turma da série, o certo é dizer isso. */
  const turmas = daSegundaSerie;
  const aviso =
    daSegundaSerie.length === 0
      ? "Você não tem turma de 2ª série do EM, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const folha = turma
    ? await apiDoServidor<FolhaDaTurma>(`/unoogpt/professor/turmas/${encodeURIComponent(turma)}`)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Trilha
        itens={[
          { label: "Início", href: "/professor" },
          { label: "Entre Redes", href: "/professor/entre-redes" },
          { label: rotuloDaMissao(ano, missao), href: rotaDaMissao(missao) },
          { label: "A aula e os resultados" },
        ]}
      />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          {missao.titulo}
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          A aula e os resultados
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          Daqui você dá a largada — e sem ela ninguém fala com o assistente. Abaixo, o retrato da
          turma: não quem acertou, mas quem <strong>leu antes de decidir</strong>, quem viu fontes
          discordando e quem decidiu no escuro.
        </p>
        {/* O guia da aula, à mão: esta é a tela em que o professor está DURANTE
            a aula, e é aqui que ele precisa reler o roteiro ou a pergunta do
            debate sem perder o painel de vista. */}
        {guia ? (
          <p className="text-[13px] font-semibold">
            <Link href={guia} className="text-unooria-navy-900 hover:text-unooria-neutral-950">
              Abrir o guia da aula
            </Link>
          </p>
        ) : null}
      </header>

      <SeletorDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. O relógio é por turma, e a largada vale só para a que você
            escolher.
          </p>
        </Card>
      ) : folha === null ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos abrir esta turma"
          description="Confira se a turma é desta escola e tente de novo."
        />
      ) : (
        <>
          <PainelDoRelogio turmaId={turma} inicial={folha.relogio} />

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              title="Começaram"
              value={`${folha.retrato.comecaram}/${folha.retrato.estudantes}`}
            />
            <MetricCard
              title="Enfrentaram a tempestade"
              value={`${folha.retrato.concluiram}/${folha.retrato.estudantes}`}
            />
            <MetricCard
              title="Viram fontes em conflito"
              value={`${folha.retrato.viramConflito}/${folha.retrato.estudantes}`}
            />
          </div>
          <p className="-mt-2 text-[12px] leading-snug text-unooria-neutral-600">
            {folha.retrato.decidiramNoEscuro} decidiram sem cruzar dado nenhum ·{" "}
            {folha.retrato.justificaramPorIntuicao} justificaram por intuição
          </p>

          <Card variant="outlined" title="Como usar isto no debate">
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px] leading-relaxed text-unooria-neutral-700">
              <li>
                <strong>Viu conflito</strong> é o gancho mais forte: pergunte a esse estudante o que ele
                fez quando duas fontes discordaram sobre o mesmo bairro.
              </li>
              <li>
                <strong>Decidiu no escuro</strong> não é erro a corrigir em público. É a experiência
                de decidir sem dado — e vale perguntar como ele se sentiu, não o que ele errou.
              </li>
              <li>
                <strong>Justificou por intuição</strong> está sempre disponível de propósito. Sem
                essa saída a pergunta viraria pegadinha e o estudante aprenderia a mentir para o
                formulário.
              </li>
            </ul>
          </Card>

          <Card variant="elevated" title={`${folha.turma.nome} · ${folha.turma.serie}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-unooria-neutral-200 text-left text-unooria-neutral-500">
                    <th className="py-2 pr-3 font-semibold">Estudante</th>
                    <th className="py-2 pr-3 font-semibold">Fontes</th>
                    <th className="py-2 pr-3 font-semibold">Leituras</th>
                    <th className="py-2 pr-3 font-semibold">Viu conflito</th>
                    <th className="py-2 pr-3 font-semibold">Decidiu no escuro</th>
                    <th className="py-2 pr-3 font-semibold">Intuição</th>
                    <th className="py-2 pr-3 font-semibold">Rodadas</th>
                    <th className="py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {folha.linhas.map((l) => (
                    <tr
                      key={l.estudanteId}
                      className="border-b border-unooria-neutral-100 text-unooria-neutral-800"
                      data-estudante={l.usuario}
                    >
                      <td className="py-2 pr-3">
                        <span className="font-medium text-unooria-neutral-950">{l.nome}</span>
                        {!l.comecou && (
                          <span className="ml-2 text-unooria-neutral-500">não começou</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{l.fontesDistintas}</td>
                      <td className="py-2 pr-3 tabular-nums">{l.leituras}</td>
                      <td className="py-2 pr-3">{l.viuConflito ? "sim" : "—"}</td>
                      <td className="py-2 pr-3">{l.decidiuNoEscuro ? "sim" : "—"}</td>
                      <td className="py-2 pr-3">{l.justificouPorIntuicao ? "sim" : "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">{l.tentativas}</td>
                      <td className="py-2">
                        <LinkButton
                          href={`${rotaDaMissao(missao)}/estudantes/${l.estudanteId}`}
                          variant="secondary"
                          size="sm"
                        >
                          Abrir
                        </LinkButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pt-3 text-[12px] leading-snug text-unooria-neutral-500">
              Não há coluna de resgatados aqui, de propósito: listagem é ordenável, e ordenar
              crianças por acerto viraria ranking. O número está na tela de cada estudante.
            </p>
          </Card>

          {/* O caminho de exclusão desta missão, no lugar de um prazo de
              retenção que nenhuma rotina cumpriria. Fica no FIM da página, longe
              da largada: ação destrutiva ao lado do botão que o professor mais
              aperta é um acidente esperando acontecer. */}
          <div className="flex flex-wrap items-center gap-3 border-t border-unooria-neutral-200 pt-4">
            <ZerarTurma turmaId={turma} nomeDaTurma={folha.turma.nome} />
            <p className="text-[12px] leading-snug text-unooria-neutral-500">
              Apaga as partidas desta turma e devolve o relógio ao início. Use para rodar a missão
              de novo com a mesma turma.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
