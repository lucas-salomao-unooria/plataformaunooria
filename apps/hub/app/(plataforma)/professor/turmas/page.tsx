import Link from "next/link";
import { Card, EmptyState } from "@edu/ui/ds";
import { minhasTurmas, rotuloDoTurno } from "@/lib/turmas";
import { rotuloDaSerie, type Serie } from "@/lib/series";

export const metadata = { title: "Minhas turmas — Plataforma Unooria" };

/**
 * As turmas do professor.
 *
 * "Minhas" aqui quer dizer matrícula, não escola: antes do enturmamento existir,
 * qualquer professor via todas as turmas da escola — e abria os resultados de
 * qualquer uma delas.
 */
export default async function MinhasTurmasPage() {
  const turmas = await minhasTurmas();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">Minhas turmas</h1>
        <p className="text-[14px] text-unooria-neutral-500">
          As turmas em que você está matriculado neste ano letivo. Abrir uma turma mostra os alunos
          dela.
        </p>
      </div>

      {turmas.length === 0 ? (
        <EmptyState
          title="Você ainda não está em nenhuma turma"
          description="Quem faz o enturmamento é a coordenação da escola, em Usuários → Turmas. Peça para te matricular nas suas turmas e elas aparecem aqui."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {turmas.map((turma) => {
            const turno = rotuloDoTurno(turma.turno);
            return (
              <li key={turma.id} className="h-full">
                <Link href={`/professor/turmas/${turma.id}`} className="block h-full">
                  <Card variant="outlined" className="h-full">
                    <div className="flex flex-col gap-1 p-1">
                      <span className="text-[18px] font-bold text-unooria-neutral-950">
                        {turma.nome}
                      </span>
                      <span className="text-[14px] text-unooria-neutral-700">
                        {rotuloDaSerie(turma.serie as Serie)}
                        {turno ? ` · ${turno}` : ""}
                      </span>
                      <span className="text-[13px] text-unooria-neutral-500">
                        {turma.alunos} aluno{turma.alunos === 1 ? "" : "s"}
                        {turma.periodo ? ` · ${turma.periodo}` : ""}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
