import { Card, EmptyState, MetricCard } from "@edu/ui/ds";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  ROTULO_DO_PASSO,
  type PainelDaTurma,
  type TurmaDoEco,
} from "@/lib/eco-tipos";
import {
  rotaDaMissao,
  rotuloDaMissao,
  type Ano,
  type Missao,
} from "@/lib/entre-redes/catalogo";
import { normalizarSerie } from "@/lib/series";

import { PainelDaAulaEco } from "./painel-da-aula-eco";
import { SeletorDeTurma } from "./seletor-de-turma";
import { ZerarTurmaEco } from "./zerar-turma-eco";

/**
 * A aula de O ECO NO GRUPO: os três momentos que a professora abre e o retrato
 * da turma.
 *
 * A REGRA QUE ESTA TELA APLICA: nenhuma coluna de pontos. Listagem é ordenável,
 * e ordenar crianças por acerto viraria ranking (PED-07). O que a folha mostra
 * é CONDUTA — quem abriu a matéria antes de responder, quem se corrigiu, quem
 * entregou o percurso —, e a distribuição A/B/C aparece como percentual da
 * turma, que é o material do debate.
 */
export async function ResultadosOEcoNoGrupo({
  ano,
  missao,
  turma,
}: {
  ano: Ano;
  missao: Missao;
  turma: string;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;

  const lista = await apiDoServidor<{ turmas: TurmaDoEco[] }>("/o-eco-no-grupo/turmas");
  const todas = lista?.turmas ?? [];
  const doSetimo = todas.filter((t) => normalizarSerie(t.serie) === "7EF");
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão.
     O que saiu foi o FALLBACK "mostrando todas": sem turma da série ele
     silenciosamente oferecia as outras, e o professor escolhia uma turma que
     nunca vai jogar isto. Sem turma da série, o certo é dizer isso. */
  const turmas = doSetimo;
  const aviso =
    doSetimo.length === 0
      ? "Você não tem turma de 7º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const painel = turma
    ? await apiDoServidor<PainelDaTurma>(
        `/o-eco-no-grupo/turmas/${encodeURIComponent(turma)}/painel`,
      )
    : null;

  const midia = await apiDoServidor<{ urls: Record<string, string | null> }>(
    "/o-eco-no-grupo/midia",
  );
  const urls = Object.values(midia?.urls ?? {});
  const midiaPronta = { prontas: urls.filter(Boolean).length, total: urls.length || 6 };

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
          A missão é de duas aulas, e é daqui que você abre a segunda, congela as telas para o
          debate e libera o registro final. Abaixo, o retrato da turma: não quem acertou, mas
          quem <strong>abriu a matéria antes de responder</strong>.
        </p>
      </header>

      <SeletorDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. A aula é conduzida por turma, e abrir a Aula 2 vale só para a
            que você escolher.
          </p>
        </Card>
      ) : painel === null ? (
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
          <PainelDaAulaEco
            turmaId={turma}
            etapa={painel.turma.etapa}
            midiaPronta={midiaPronta}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              title="Abriram a matéria completa"
              value={`${painel.resumo.inspecionaram}/${painel.resumo.total}`}
            />
            <MetricCard
              title="Responderam no grupo"
              value={`${painel.resumo.responderam}/${painel.resumo.total}`}
            />
            <MetricCard
              title="Entregaram o percurso"
              value={`${painel.resumo.entregaram}/${painel.resumo.total}`}
            />
          </div>

          <p className="-mt-2 text-[12px] leading-snug text-unooria-neutral-600" data-distribuicao>
            Respostas no grupo: {painel.resumo.distribuicao.B ?? 0} com a matéria completa ·{" "}
            {painel.resumo.distribuicao.A ?? 0} repassando o áudio ·{" "}
            {painel.resumo.distribuicao.C ?? 0} saindo do grupo ·{" "}
            {painel.resumo.usaramRecuperacao} apagaram e tentaram de novo
            {painel.resumo.ociosos > 0 && (
              <>
                {" "}
                · <strong>{painel.resumo.ociosos} parados há mais de 3 min</strong>
              </>
            )}
          </p>

          <Card variant="outlined" title="Como usar isto no debate">
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px] leading-relaxed text-unooria-neutral-700">
              <li>
                <strong>Quem apagou e tentou de novo</strong> é o gancho mais forte da aula:
                pergunte o que mudou entre a primeira resposta e a segunda. Não é erro a corrigir
                em público — é a experiência de ver o bairro reagir.
              </li>
              <li>
                <strong>A distribuição A/B/C</strong> se projeta como percentual, nunca com nomes.
                A pergunta boa é &quot;por que o áudio da Dona Lúcia convence?&quot;, não &quot;quem
                escolheu errado?&quot;.
              </li>
              <li>
                <strong>Quem não abriu a matéria</strong> não conseguiu responder — o sistema
                segura. Se alguém travou aí, é sinal de que o print não pareceu suspeito, e isso
                vale mais conversa que a resposta certa.
              </li>
            </ul>
          </Card>

          <Card variant="elevated" title={`${painel.turma.nome} · ${painel.turma.serie}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-unooria-neutral-200 text-left text-unooria-neutral-500">
                    <th className="py-2 pr-3 font-semibold">Estudante</th>
                    <th className="py-2 pr-3 font-semibold">Onde está</th>
                    <th className="py-2 pr-3 font-semibold">Abriu a matéria</th>
                    <th className="py-2 pr-3 font-semibold">Ouviu o episódio</th>
                    <th className="py-2 pr-3 font-semibold">Respondeu</th>
                    <th className="py-2 pr-3 font-semibold">Apagou</th>
                    <th className="py-2 font-semibold">Percurso</th>
                  </tr>
                </thead>
                <tbody>
                  {painel.estudantes.map((l) => (
                    <tr
                      key={l.estudanteId}
                      className="border-b border-unooria-neutral-100 text-unooria-neutral-800"
                      data-estudante={l.usuario}
                    >
                      <td className="py-2 pr-3">
                        <span className="font-medium text-unooria-neutral-950">{l.nome}</span>
                        {!l.iniciou && (
                          <span className="ml-2 text-unooria-neutral-500">não começou</span>
                        )}
                        {l.ociosoMin !== null && l.ociosoMin >= 3 && (
                          <span className="ml-2 text-unooria-danger">parado há {l.ociosoMin} min</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{l.iniciou ? ROTULO_DO_PASSO[l.passo] : "—"}</td>
                      <td className="py-2 pr-3">{l.inspecionouMateria ? "sim" : "—"}</td>
                      <td className="py-2 pr-3">{l.ouviuPodcast ? "sim" : "—"}</td>
                      {/* A LETRA, não "certo/errado": a conversa do debate é sobre
                          o que cada resposta faz no grupo. */}
                      <td className="py-2 pr-3">{l.opcao ?? "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">{l.desfazerUsado || "—"}</td>
                      <td className="py-2">{l.entregouPercurso ? "entregue" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <ZerarTurmaEco turmaId={turma} nomeDaTurma={painel.turma.nome} />
        </>
      )}
    </div>
  );
}
