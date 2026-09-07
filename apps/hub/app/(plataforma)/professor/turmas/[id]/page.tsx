import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { RotuloDaTrilha } from "@/components/trilha";
import { rotaDeConducao, rotasDaMissao } from "@/lib/rotas-da-missao";
import { copyDaMissao } from "@/lib/missoes-do-estudante";
import { salaDaTurma, type MissaoDaSalaDoProfessor } from "@/lib/salas";
import { rotuloDaSerie, normalizarSerie } from "@/lib/series";
import { rotuloDoTurno, turmaComPessoas } from "@/lib/turmas";

import { AbasDaSala, type AbaDaSala } from "./abas-da-sala";
import { BotaoLiberar } from "./botao-liberar";

export const metadata = { title: "Turma — Plataforma Unooria" };

/** Só duas abas existem; qualquer outra coisa na URL cai em Missões. */
function abaDaUrl(bruta: string | undefined): AbaDaSala {
  return bruta === "estudantes" ? "estudantes" : "missoes";
}

function DataCurta({ iso }: { iso: string }) {
  return <>{new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</>;
}

/**
 * A SALA DE AULA do professor (ADR-69).
 *
 * Esta página era só a lista nominal da turma. Virou o lugar onde a aula
 * acontece: as missões daquela sala, com liberar/encerrar, e os estudantes.
 *
 * O caminho para conduzir a missão sai DAQUI, com a turma já escolhida. Antes
 * ele era: voltar ao hub, entrar no Entre Redes, achar o ano, abrir resultados e
 * escolher a turma de novo num `select` — e a página do ano era a MESMA para as
 * duas turmas da série, que é como 2EM-A e 2EM-B viravam uma coisa só.
 *
 * Quem não leciona na turma recebe 404 da api e cai em 404 aqui: uma tela que
 * dissesse "sem permissão" já contaria que a turma existe.
 */
export default async function SalaDoProfessorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const { id } = await params;
  const aba = abaDaUrl((await searchParams).aba);

  /* As duas leituras em paralelo: a sala (grade + turma) e as pessoas. A lista
     nominal continua vindo de `GET /turmas/:id`, que é quem sabe de matrícula —
     `/salas` fala de missão, não de gente. */
  const [sala, pessoas] = await Promise.all([salaDaTurma(id), turmaComPessoas(id)]);
  if (!sala) notFound();

  const { turma } = sala;
  const serie = normalizarSerie(turma.serie);
  const turno = rotuloDoTurno(turma.turno);
  const estudantes = pessoas?.estudantes ?? [];
  const professores = pessoas?.professores ?? [];
  const liberadas = sala.missoes.filter((m) => m.estado === "liberada").length;

  return (
    <div className="flex flex-col gap-6">
      {/* O nome da turma na trilha do layout. O "← Minhas turmas" que ficava
          aqui saiu: a trilha já devolve o mesmo caminho, e dois caminhos de
          volta na mesma tela é o que fazia cada área inventar o seu. */}
      <RotuloDaTrilha valor={`Turma ${turma.nome}`} />

      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">Turma {turma.nome}</h1>
        <p className="text-[14px] text-unooria-neutral-500">
          {serie ? rotuloDaSerie(serie) : turma.serie}
          {turno ? ` · ${turno}` : ""} · {turma.periodo} · {turma.estudantes} estudante
          {turma.estudantes === 1 ? "" : "s"}
        </p>
      </div>

      <AbasDaSala aba={aba} estudantes={estudantes.length} missoes={sala.missoes.length} />

      {aba === "missoes" ? (
        <MissoesDaSala turmaId={turma.id} missoes={sala.missoes} liberadas={liberadas} />
      ) : (
        <EstudantesDaSala estudantes={estudantes} professores={professores} />
      )}
    </div>
  );
}

/**
 * A grade da turma: o que existe para esta série, e em que estado está.
 *
 * A missão SEM copy de estudante aparece assim mesmo para o professor — ele
 * precisa saber que ela existe e poder liberá-la; quem some da tela da criança é
 * o cartão, lá no hub dela.
 */
function MissoesDaSala({
  turmaId,
  missoes,
  liberadas,
}: {
  turmaId: string;
  missoes: MissaoDaSalaDoProfessor[];
  liberadas: number;
}) {
  if (missoes.length === 0) {
    return (
      <Card variant="outlined">
        <p className="py-2 text-[14px] text-unooria-neutral-700">
          Nenhuma missão publicada para esta série ainda. Assim que uma entrar no catálogo, ela
          aparece aqui para você liberar.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {liberadas === 0 ? (
        <FeedbackAlert
          type="warning"
          title="Nenhuma missão está aberta para esta turma"
          description="Enquanto você não liberar, os estudantes veem a missão com cadeado e não conseguem entrar. Libere a que vai rodar hoje."
        />
      ) : null}

      <Card variant="outlined">
        <ul className="flex flex-col">
          {missoes.map((missao) => {
            const copy = copyDaMissao(missao.expId);
            const rotas = rotasDaMissao(missao.expId);
            const conducao = rotaDeConducao(missao.expId, turmaId);
            return (
              <li key={missao.expId} className="linha-de-lista py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-unooria-neutral-950">
                        {copy?.titulo ?? missao.nome}
                      </span>
                      {missao.transversal ? (
                        <Tag>para qualquer ano</Tag>
                      ) : missao.unidade ? (
                        <Tag>Unidade {missao.unidade}</Tag>
                      ) : null}
                      {missao.deOutraSerie ? <Tag>de outra série</Tag> : null}
                      {missao.estado === "liberada" ? (
                        <Tag variant="success">aberta</Tag>
                      ) : missao.estado === "encerrada" ? (
                        <Tag>encerrada</Tag>
                      ) : (
                        <Tag>fechada</Tag>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-unooria-neutral-500">
                      {/* Quem liberou é a pergunta que a sala faz quando a missão
                          aparece sem ninguém saber por quê — turma com dois
                          professores é comum. */}
                      {missao.liberadaPor && missao.liberadaEm ? (
                        <>
                          {missao.estado === "encerrada" && missao.encerradaEm ? (
                            <>
                              encerrada em <DataCurta iso={missao.encerradaEm} />
                            </>
                          ) : (
                            <>
                              aberta por {missao.liberadaPor} em{" "}
                              <DataCurta iso={missao.liberadaEm} />
                            </>
                          )}
                        </>
                      ) : (
                        "ninguém abriu esta missão aqui ainda"
                      )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
                      {rotas ? (
                        <Link
                          href={rotas.ficha}
                          className="text-unooria-neutral-700 hover:text-unooria-navy-900"
                        >
                          Como funciona
                        </Link>
                      ) : null}
                      {/* O guia da aula: o professor abre daqui, na véspera e
                          na hora. Ele existe por missão e não por turma, então
                          não leva `?turmaId=` — a exceção é a Vila do Lume, cujo
                          guia tem seletor de turma próprio na revelação. */}
                      {rotas?.guia ? (
                        <Link
                          href={rotas.guia}
                          className="text-unooria-neutral-700 hover:text-unooria-navy-900"
                        >
                          Guia da aula
                        </Link>
                      ) : null}
                      {conducao ? (
                        <Link
                          href={conducao}
                          className="text-unooria-navy-900 hover:text-unooria-navy-800"
                        >
                          Conduzir com esta turma
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <BotaoLiberar
                    turmaId={turmaId}
                    expId={missao.expId}
                    estado={missao.estado}
                    nome={copy?.titulo ?? missao.nome}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/** A lista NOMINAL — o lugar onde "trackear por estudante" vira coisa que se vê. */
function EstudantesDaSala({
  estudantes,
  professores,
}: {
  estudantes: NonNullable<Awaited<ReturnType<typeof turmaComPessoas>>>["estudantes"];
  professores: NonNullable<Awaited<ReturnType<typeof turmaComPessoas>>>["professores"];
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card variant="outlined">
        <ul className="flex flex-col">
          {estudantes.length === 0 ? (
            <li className="py-4 text-[14px] text-unooria-neutral-500">
              Nenhum estudante matriculado nesta turma ainda — quem enturma é a coordenação.
            </li>
          ) : (
            estudantes.map((estudante) => (
              <li key={estudante.id} className="linha-de-lista">
                <Link
                  href={`/professor/entre-redes/vila-do-lume/estudantes/${estudante.id}`}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-unooria-neutral-950">
                      {estudante.nome}
                    </span>
                    <span className="block truncate text-[13px] text-unooria-neutral-500">
                      {estudante.usuario}
                      {estudante.matricula ? ` · matrícula ${estudante.matricula}` : ""}
                    </span>
                  </span>
                  {!estudante.ativo ? (
                    <Tag>inativo</Tag>
                  ) : estudante.senhaProvisoria ? (
                    <Tag>sem primeiro acesso</Tag>
                  ) : null}
                </Link>
              </li>
            ))
          )}
        </ul>
      </Card>

      {professores.length > 1 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
            Também nesta turma
          </h2>
          <p className="text-[14px] text-unooria-neutral-700">
            {professores.map((p) => p.nome).join(", ")}
          </p>
        </section>
      ) : null}
    </div>
  );
}
