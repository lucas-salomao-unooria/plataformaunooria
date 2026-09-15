import { Card, EmptyState, MetricCard, ScrollBar } from "@edu/ui/ds";
import { RotuloDaTrilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  ROTULO_DA_CLAUSULA,
  ROTULO_DA_TAG,
  ROTULO_DO_PASSO,
  type ConteudoDaTurma,
  type PainelDaTurma,
  type TurmaDoManifesto,
} from "@/lib/manifesto-tipos";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import { normalizarSerie } from "@/lib/series";

import { PainelDoDebateManifesto } from "./painel-do-debate-manifesto";
import { PreparoManifesto } from "./preparo-manifesto";
import { SeletorDeTurma } from "./seletor-de-turma";
import { ZerarTurmaManifesto } from "./zerar-turma-manifesto";

/**
 * A aula de O MANIFESTO DA IA: a preparação, o congelamento do debate e o
 * retrato da turma.
 *
 * A REGRA QUE ESTA TELA APLICA, e ela é mais forte aqui que nas outras missões:
 * **não existe cláusula certa.** As quatro são salvaguardas válidas sob
 * governança de direitos, e calcular percentual de acerto entre elas está na
 * lista de métricas proibidas do handoff. Com quatro opções e uma "mais
 * votada", esse é o erro natural de quem chegar depois — por isso a
 * distribuição aparece como CONTAGEM, com a frase que diz o que ela é.
 *
 * Nenhuma coluna de pontos e nenhum nível (PED-07 / D6b): listagem é ordenável,
 * e ordenar crianças por acerto viraria ranking. O que a folha mostra é
 * CONDUTA — quantos questionamentos cada um disparou, que regra fixou, o que
 * escreveu.
 *
 * O TEXTO do percurso aparece aqui, e só aqui: é caixa livre de menor de idade,
 * e quem lê é o professor da turma dela (LGPD art. 14).
 */
export async function ResultadosManifestoIa({
  missao,
  turma,
}: {
  missao: Missao;
  turma: string;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;

  const lista = await apiDoServidor<{ turmas: TurmaDoManifesto[] }>("/manifesto-ia/turmas");
  const todas = lista?.turmas ?? [];
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. Sem
     turma da série, o certo é dizer isso: o fallback "mostrando todas" fazia o
     professor escolher uma turma que nunca vai jogar isto. */
  const turmas = todas.filter((t) => normalizarSerie(t.serie) === "8EF");
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 8º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const [painel, conteudo] = turma
    ? await Promise.all([
        apiDoServidor<PainelDaTurma>(
          `/manifesto-ia/turmas/${encodeURIComponent(turma)}/painel`,
        ),
        apiDoServidor<ConteudoDaTurma>(
          `/manifesto-ia/turmas/${encodeURIComponent(turma)}/conteudo`,
        ),
      ])
    : [null, null];

  return (
    <div className="flex flex-col gap-6">
      {/* Esta missão chama a tela de "A aula e os resultados" (ela prepara o
          conteúdo e congela o debate, não só relata): o rótulo do registro de
          rotas é o genérico e quem o corrige é a página. */}
      <RotuloDaTrilha valor="A aula e os resultados" />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          {missao.titulo}
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          A aula e os resultados
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          É daqui que você prepara o caso da sua escola e congela as telas para o debate. Abaixo, o
          retrato da turma: não quem acertou — as quatro cláusulas são válidas —, mas{" "}
          <strong>quem contraditou o sistema antes de fixar uma regra nele</strong>.
        </p>
      </header>

      <SeletorDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. A preparação e o debate são por turma, e valem só para a que
            você escolher.
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
          {conteudo && <PreparoManifesto turmaId={turma} inicial={conteudo} />}

          <PainelDoDebateManifesto turmaId={turma} etapa={painel.turma.etapa} />

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              title="Auditaram o sistema"
              value={`${painel.resumo.auditaram}/${painel.resumo.total}`}
            />
            <MetricCard
              title="Fixaram uma cláusula"
              value={`${painel.resumo.fixaramClausula}/${painel.resumo.total}`}
            />
            <MetricCard
              title="Assinaram no Percurso"
              value={`${painel.resumo.assinaram}/${painel.resumo.total}`}
            />
          </div>

          <Card variant="outlined" title="Distribuição das cláusulas">
            <p className="mb-3 text-[12px] leading-snug text-unooria-neutral-600">
              É o material das três perguntas do debate — <strong>não um placar</strong>. As quatro
              salvaguardas são válidas, e o que interessa é o argumento de cada escolha.
            </p>
            <ul className="flex flex-col gap-2 text-[13px]" data-distribuicao>
              {Object.entries(ROTULO_DA_CLAUSULA).map(([id, rotulo]) => {
                const votos = painel.resumo.distribuicao[id] ?? 0;
                const total = Math.max(1, painel.resumo.fixaramClausula);
                return (
                  <li key={id} className="flex items-center gap-3" data-clausula={id}>
                    <span className="w-[210px] shrink-0 text-unooria-neutral-800">{rotulo}</span>
                    {/* Barra desenhada com a largura proporcional. Não é
                        `BarChart` do DS porque são quatro linhas com rótulo
                        longo, e o gráfico as encavalaria — é MEDIDA, que é
                        compensação legítima. */}
                    <span
                      className="h-3 rounded-sm bg-unooria-neutral-800"
                      style={{ width: `${Math.round((votos / total) * 60)}%`, minWidth: votos ? 6 : 0 }}
                    />
                    <span className="tabular-nums text-unooria-neutral-600">{votos}</span>
                  </li>
                );
              })}
            </ul>
            {painel.resumo.assinaram > 0 && (
              <p className="mt-4 text-[12px] leading-snug text-unooria-neutral-600" data-tags>
                Palavras-chave mais escolhidas:{" "}
                {Object.entries(painel.resumo.tags)
                  .filter(([, n]) => n > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([id, n]) => `${ROTULO_DA_TAG[id] ?? id} (${n})`)
                  .join(" · ") || "—"}
              </p>
            )}
            {painel.resumo.ociosos > 0 && (
              <p className="mt-2 text-[12px] text-unooria-neutral-600">
                <strong>{painel.resumo.ociosos} parados há mais de 3 min</strong>
              </p>
            )}
          </Card>

          <Card variant="outlined" title="Como usar isto no debate">
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px] leading-relaxed text-unooria-neutral-700">
              <li>
                <strong>Se a turma inteira votou a mesma cláusula</strong>, o debate quase não
                acontece — assuma o contraditório e peça o custo dela. Veto humano em toda decisão
                significa esperar uma pessoa para tudo: quanto tempo isso leva numa rede de 10 mil
                estudantes?
              </li>
              <li>
                <strong>A distribuição se projeta como contagem, nunca com nomes.</strong> A
                pergunta boa é &quot;o que cada regra deixa de proteger?&quot;, não &quot;quem
                escolheu errado?&quot;.
              </li>
              <li>
                <strong>Quem disparou os três questionamentos</strong> ouviu a máquina dizer quem
                configurou os critérios de comportamento. É a fala mais útil da aula, e vale pedir
                que essa criança conte à turma o que leu.
              </li>
              <li>
                <strong>Quem defendeu a vigilância</strong> pode não aparecer nesta folha: o
                argumento sai no debate oral. Não é erro — é o que a aula precisa ouvir em voz alta.
              </li>
            </ul>
          </Card>

          <ZerarTurmaManifesto turmaId={turma} nomeDaTurma={painel.turma.nome} />

          <Card variant="elevated" title={`${painel.turma.nome} · ${painel.turma.serie}`}>
            <ScrollBar orientation="both" autoHide className="tabela-rolavel">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-unooria-neutral-200 text-left text-unooria-neutral-500">
                    <th className="py-2 pr-3 font-semibold">Estudante</th>
                    <th className="py-2 pr-3 font-semibold">Onde está</th>
                    <th className="py-2 pr-3 font-semibold">Questionamentos</th>
                    <th className="py-2 pr-3 font-semibold">Cláusula fixada</th>
                    <th className="py-2 pr-3 font-semibold">Palavras-chave</th>
                    <th className="py-2 font-semibold">O que escreveu</th>
                  </tr>
                </thead>
                <tbody>
                  {painel.estudantes.map((l) => (
                    <tr
                      key={l.estudanteId}
                      className="border-b border-unooria-neutral-100 align-top text-unooria-neutral-800"
                      data-estudante={l.usuario}
                    >
                      <td className="py-2 pr-3">
                        <span className="font-medium text-unooria-neutral-950">{l.nome}</span>
                        {!l.iniciou && (
                          <span className="ml-2 text-unooria-neutral-500">não começou</span>
                        )}
                        {l.ociosoMin !== null && l.ociosoMin >= 3 && (
                          <span className="ml-2 text-unooria-danger">
                            parado há {l.ociosoMin} min
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{l.iniciou ? ROTULO_DO_PASSO[l.passo] : "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {l.iniciou ? `${l.auditorias} de 2` : "—"}
                      </td>
                      {/* A regra que ele fixou, não "certo/errado": é sobre
                          isso que o debate conversa. */}
                      <td className="py-2 pr-3">
                        {l.clausulaId ? (ROTULO_DA_CLAUSULA[l.clausulaId] ?? l.clausulaId) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {l.tags.length
                          ? l.tags.map((t) => ROTULO_DA_TAG[t] ?? t).join(" · ")
                          : "—"}
                      </td>
                      <td className="py-2">
                        {l.registrouPercurso ? (
                          <span className="block max-w-[300px] text-unooria-neutral-700">
                            {l.justificativaTexto}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBar>
          </Card>
        </>
      )}
    </div>
  );
}
