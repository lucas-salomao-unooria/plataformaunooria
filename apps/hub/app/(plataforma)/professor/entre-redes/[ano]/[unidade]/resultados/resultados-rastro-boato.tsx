import { Card, EmptyState, MetricCard, ScrollBar } from "@edu/ui/ds";
import { RotuloDaTrilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  ROTULO_DA_OPCAO,
  ROTULO_DO_PASSO,
  type PainelDaTurma,
  type TurmaDoRastro,
} from "@/lib/rastro-tipos";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import { normalizarSerie } from "@/lib/series";

import { PainelDaAulaRastro } from "./painel-da-aula-rastro";
import { SeletorDeTurma } from "./seletor-de-turma";
import { ZerarTurmaRastro } from "./zerar-turma-rastro";

/**
 * A aula de O RASTRO DO BOATO: o botão que abre a Aula 2 e o retrato da turma.
 *
 * A REGRA QUE ESTA TELA APLICA: nenhuma coluna de pontos e nenhum nível.
 * Listagem é ordenável, e ordenar crianças por acerto viraria ranking (PED-07).
 * O que a folha mostra é CONDUTA — quantas fontes cada um auditou, o que
 * respondeu, se entregou o percurso —, e a distribuição A/B/C aparece como
 * contagem da turma, que é o material do debate.
 *
 * O TEXTO do percurso aparece aqui, e só aqui: é caixa livre de menor de idade,
 * e quem lê é o professor da turma dela.
 */
export async function ResultadosRastroBoato({
  missao,
  turma,
}: {
  missao: Missao;
  turma: string;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;

  const lista = await apiDoServidor<{ turmas: TurmaDoRastro[] }>("/rastro-boato/turmas");
  const todas = lista?.turmas ?? [];
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. Sem
     turma da série, o certo é dizer isso: o fallback "mostrando todas" fazia o
     professor escolher uma turma que nunca vai jogar isto. */
  const turmas = todas.filter((t) => normalizarSerie(t.serie) === "6EF");
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 6º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const painel = turma
    ? await apiDoServidor<PainelDaTurma>(
        `/rastro-boato/turmas/${encodeURIComponent(turma)}/painel`,
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Esta missão chama a tela de "A aula e os resultados" (ela abre a Aula 2,
          não só relata): o rótulo do registro de rotas é o genérico e quem o
          corrige é a página. */}
      <RotuloDaTrilha valor="A aula e os resultados" />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          {missao.titulo}
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          A aula e os resultados
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          A missão é de duas aulas, e é daqui que você abre a segunda. Abaixo, o retrato da turma:
          não quem acertou, mas quem <strong>abriu os dados das mensagens antes de responder</strong>.
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
          <PainelDaAulaRastro turmaId={turma} etapa={painel.turma.etapa} />

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              title="Auditaram 3 fontes"
              value={`${painel.resumo.auditaramTudo}/${painel.resumo.total}`}
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
            Respostas no grupo: {painel.resumo.distribuicao.B ?? 0} denunciaram e fixaram o laudo ·{" "}
            {painel.resumo.distribuicao.A ?? 0} encaminharam ·{" "}
            {painel.resumo.distribuicao.C ?? 0} apagaram para si ·{" "}
            {painel.resumo.modelosCoerentes} montaram o ciclo na ordem
            {painel.resumo.estouraramOAlerta > 0 && (
              <>
                {" "}
                · <strong>{painel.resumo.estouraramOAlerta} travaram mais de 90s na decisão</strong>
              </>
            )}
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
                <strong>Quem apagou para si</strong> é o gancho mais forte da aula. No mapa, essa
                escolha ainda acende 850 conexões — pergunte à turma por que calar não parou nada.
                É a descoberta que a missão inteira constrói.
              </li>
              <li>
                <strong>A distribuição A/B/C</strong> se projeta como contagem, nunca com nomes. A
                pergunta boa é &quot;por que a mensagem com medo convence?&quot;, não &quot;quem
                escolheu errado?&quot;.
              </li>
              <li>
                <strong>Quem travou os 90 segundos</strong> não hesitou por preguiça: a tela do
                pico não dá dica nenhuma de propósito. Vale perguntar o que passou pela cabeça
                deles ali — é a tensão ética que a missão existe para produzir.
              </li>
            </ul>
          </Card>

          <ZerarTurmaRastro turmaId={turma} nomeDaTurma={painel.turma.nome} />

          <Card variant="elevated" title={`${painel.turma.nome} · ${painel.turma.serie}`}>
            <ScrollBar orientation="both" autoHide className="tabela-rolavel">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-unooria-neutral-200 text-left text-unooria-neutral-500">
                    <th className="py-2 pr-3 font-semibold">Estudante</th>
                    <th className="py-2 pr-3 font-semibold">Onde está</th>
                    <th className="py-2 pr-3 font-semibold">Fontes auditadas</th>
                    <th className="py-2 pr-3 font-semibold">Respondeu</th>
                    <th className="py-2 pr-3 font-semibold">Ciclo</th>
                    <th className="py-2 font-semibold">Percurso</th>
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
                        {l.iniciou ? `${l.auditadas} de 3` : "—"}
                      </td>
                      {/* O que a resposta FAZ no grupo, não "certo/errado": é
                          sobre isso que o debate conversa. */}
                      <td className="py-2 pr-3">{l.opcao ? ROTULO_DA_OPCAO[l.opcao] : "—"}</td>
                      <td className="py-2 pr-3">
                        {l.modeloCoerente === null ? "—" : l.modeloCoerente ? "na ordem" : "montado"}
                      </td>
                      <td className="py-2">
                        {l.entregouPercurso ? (
                          <span className="block max-w-[280px] text-unooria-neutral-700">
                            {l.reflexaoTexto}
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
