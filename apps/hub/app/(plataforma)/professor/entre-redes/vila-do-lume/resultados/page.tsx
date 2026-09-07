import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, EmptyState, FeedbackAlert, MetricCard } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { apiDoServidor } from "@/lib/api-servidor";
import { buscarMissaoTransversal, rotaDaTransversal } from "@/lib/entre-redes/catalogo";
import type { LinhaDaTurma, ResumoDaTurma, TurmaResumida } from "@/lib/vila-tipos";

import { SeletorDeTurma } from "./seletor-de-turma";
import { TabelaTurma } from "./tabela-turma";
import { ZerarTurma } from "./zerar-turma";

export const metadata = { title: "Vila do Lume · resultados — Plataforma Unooria" };

/**
 * Resultados da Vila do Lume por turma. A turma vem da URL (`?turmaId=`), como
 * em `/analise` e no UnooTube: link compartilhável, e "sem turma" nunca vira
 * "todas". Busca server-side via `apiDoServidor` — o token nunca chega ao client.
 *
 * O que esta tela responde, em ordem: **as três bolhas estão na sala?** (sem
 * elas o debate não tem o que comparar), quantos jogaram, e quem abrir.
 */
export default async function ResultadosDaVilaPage({
  searchParams,
}: {
  searchParams: Promise<{ turmaId?: string }>;
}) {
  const missao = buscarMissaoTransversal("vila-do-lume");
  if (!missao) notFound();
  const rota = rotaDaTransversal(missao);
  const rotaBase = `${rota}/resultados`;

  const { turmaId } = await searchParams;
  const turma = turmaId?.trim() ?? "";

  const lista = await apiDoServidor<{ turmas: TurmaResumida[] }>("/vila/agregado/turmas");
  const turmas = lista?.turmas ?? [];

  const [agregado, listagem] = turma
    ? await Promise.all([
        apiDoServidor<{ resumo: ResumoDaTurma | null }>(
          `/vila/agregado/turmas/${encodeURIComponent(turma)}`,
        ),
        apiDoServidor<{ estudantes?: LinhaDaTurma[]}>(
          `/vila/professor/turmas/${encodeURIComponent(turma)}`,
        ),
      ])
    : [null, null];

  const resumo = agregado?.resumo ?? null;
  const estudantes = listagem?.estudantes ?? null;

  /* A pergunta que decide se o debate funciona. Uma bolha ausente não é detalhe:
     o roteiro conta com a A dizendo que era óbvio, a C não conseguindo explicar
     por que caiu, e a B dizendo "mas parecia ser o Lume". */
  const bolhasAusentes = resumo
    ? (["A", "B", "C"] as const).filter((b) => resumo.porBolha[b] === 0)
    : [];
  const jaJogouAlguem = (resumo?.jogaram ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          {missao.titulo}
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          Resultados da turma
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          Quem jogou, qual bolha cada estudante recebeu e o que aconteceu com as mensagens.
          Recalculado a cada visita — atualize a página durante a aula.
        </p>
        {/* O guia à mão: esta é a tela em que o professor está DURANTE a aula, e
            a revelação da Vila é projetada de lá — com a turma já selecionada. */}
        <p className="text-[13px] font-semibold">
          <Link
            href={turma ? `${rota}/guia?turmaId=${encodeURIComponent(turma)}` : `${rota}/guia`}
            className="text-unooria-navy-900 hover:text-unooria-neutral-950"
          >
            Abrir o guia da aula
          </Link>
        </p>
      </header>

      <SeletorDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. A lista mostra todos os estudantes, inclusive quem ainda não
            entrou na vila.
          </p>
        </Card>
      ) : resumo === null || estudantes === null ? (
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
          {/*
            MetricCard sem `tagText`: na 0.1.11 o componente NÃO inventa
            tendência (a doc do prop diz "sem ela a etiqueta não é renderizada").
            Aqui não há série temporal nenhuma por trás, então nada de etiqueta —
            um "+12%" ao lado de "Jogaram" é o tipo de número que um professor
            repete numa reunião achando que é dado.
          */}
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard title="Estudantes na turma" value={resumo.estudantes ?? 0} />
            <MetricCard title="Jogaram" value={`${resumo.jogaram}/${resumo.estudantes ?? 0}`} />
            <MetricCard title="Terminaram a vila" value={resumo.concluiram} />
            <MetricCard
              title="Partidas que sustentam leitura"
              value={resumo.comAmostra}
              description="as outras foram curtas demais"
            />
          </div>

          <Card variant="elevated" title="As três bolhas nesta turma">
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {(["A", "B", "C"] as const).map((bolha) => (
                  <div
                    key={bolha}
                    className="flex items-center gap-3 rounded-md border border-unooria-neutral-200 px-3 py-2"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-unooria-navy-800 text-[12px] font-bold text-white">
                      {bolha}
                    </span>
                    <span className="text-[20px] font-bold text-unooria-neutral-950">
                      {resumo.porBolha[bolha]}
                    </span>
                    <span className="text-[12px] text-unooria-neutral-500">
                      {resumo.porBolha[bolha] === 1 ? "estudante" : "estudantes"}
                    </span>
                  </div>
                ))}
              </div>
              {bolhasAusentes.length > 0 && jaJogouAlguem ? (
                <FeedbackAlert
                  type="warning"
                  title={`Falta a bolha ${bolhasAusentes.join(" e ")} nesta turma`}
                  description="A revelação final compara as três versões da mensagem. Com uma bolha faltando, a turma não tem com o que comparar — vale esperar mais estudantes jogarem antes do debate."
                />
              ) : null}
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                A divisão é feita pela plataforma, equilibrada dentro da turma, e não muda se
                o estudante jogar de novo. Nos anos iniciais a bolha B não é servida.
              </p>
            </div>
          </Card>

          {resumo.mensagens.comLeitura > 0 ? (
            <Card variant="elevated" title="O que aconteceu com as mensagens">
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-4">
                  <MetricCard title="Entregaram ao golpe" value={resumo.mensagens.golpeAceito} />
                  <MetricCard title="Recusaram o golpe" value={resumo.mensagens.golpeRecusado} />
                  <MetricCard
                    title="Recusaram ajuda real"
                    value={resumo.mensagens.legitimaRecusada}
                  />
                  <MetricCard
                    title="Não responderam nada"
                    value={resumo.mensagens.naoResponderam}
                  />
                </div>
                <p className="text-[12px] leading-relaxed text-unooria-neutral-600">
                  <strong>Não leia isto como acerto e erro.</strong> Quem entregou recebeu um
                  golpe de um nível específico — no nível C, quase toda a turma entrega, e não
                  há nada de ingênuo nisso. E os dois erros custam: recusar uma mensagem
                  verdadeira deixa a criança sem a ajuda que existia.
                  {resumo.mensagens.naoResponderam > 0 ? (
                    <>
                      {" "}
                      Os <strong>{resumo.mensagens.naoResponderam}</strong> que não responderam
                      nada são o achado mais importante da tela: no debate eles não discordam
                      de ninguém — ficam calados, ou perguntam "que mensagem?".
                    </>
                  ) : null}
                </p>
              </div>
            </Card>
          ) : null}

          {/* Destrutivo, e atrás de confirmação — mas ACIMA da lista, não
              depois dela: a tabela rola dentro do próprio quadro e a ação ficava
              escondida atrás da turma inteira. Longe do seletor de turma, que
              continua no topo: um clique errado lá troca de turma, e o seguinte
              apagaria a turma errada. */}
          <div className="flex justify-end">
            <ZerarTurma
              turmaId={turma}
              nomeDaTurma={turmas.find((t) => t.id === turma)?.nome ?? "esta turma"}
              partidas={resumo.jogaram}
            />
          </div>

          <Card variant="elevated" title="Estudante por estudante">
            <TabelaTurma estudantes={estudantes} rotaBase={rota} />
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <LinkButton href={`${rotaBase}?turmaId=${encodeURIComponent(turma)}`} variant="secondary">
              Atualizar
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
