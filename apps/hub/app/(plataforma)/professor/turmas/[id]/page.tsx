import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Tag } from "@edu/ui/ds";
import { rotuloDaSerie, type Serie } from "@/lib/series";
import { rotuloDoTurno, turmaComPessoas } from "@/lib/turmas";

export const metadata = { title: "Turma — Plataforma Unooria" };

/**
 * A lista NOMINAL da turma — o lugar onde "trackear por estudante" vira uma coisa
 * que se vê na tela. Cada nome leva ao que a plataforma já sabe sobre aquela
 * criança na Vila do Lume.
 *
 * Quem não leciona na turma recebe 403 da api e cai em 404 aqui: uma tela que
 * dissesse "sem permissão" já contaria que a turma existe.
 */
export default async function TurmaDoProfessorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dados = await turmaComPessoas(id);
  if (!dados) notFound();

  const { turma, professores } = dados;
  const estudantes = dados.estudantes ?? [];
  const turno = rotuloDoTurno(turma.turno);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/professor/turmas"
          className="text-[13px] font-semibold text-unooria-neutral-700 hover:text-unooria-navy-900"
        >
          ← Minhas turmas
        </Link>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">Turma {turma.nome}</h1>
        <p className="text-[14px] text-unooria-neutral-500">
          {rotuloDaSerie(turma.serie as Serie)}
          {turno ? ` · ${turno}` : ""} · {turma.periodo} · {estudantes.length} estudante
          {estudantes.length === 1 ? "" : "s"}
        </p>
      </div>

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
