"use client";

import { useRouter } from "next/navigation";

import { Card } from "@edu/ui/ds";
import type { TurmaResumo } from "@/lib/unootube-tipos";

/**
 * Escolha da turma — vive na URL (`?turmaId=`) para o link ser compartilhável
 * e para "sem turma" nunca virar "todas" (mesmo desenho de `/analise`).
 */
export function SeletorDeTurma({
  turmas,
  turmaId,
  rotaBase,
  aviso,
}: {
  turmas: TurmaResumo[];
  turmaId: string;
  rotaBase: string;
  aviso?: string;
}) {
  const router = useRouter();

  return (
    <Card variant="elevated">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-unooria-neutral-800">
          Turma
          <select
            id="turma"
            name="turmaId"
            value={turmaId}
            onChange={(evento) => {
              const alvo = evento.target.value;
              router.push(alvo ? `${rotaBase}?turmaId=${encodeURIComponent(alvo)}` : rotaBase);
            }}
            className="min-w-[260px] rounded-md border border-unooria-neutral-300 bg-white px-3 py-2 text-[14px] font-normal text-unooria-neutral-950"
          >
            <option value="">Escolha a turma…</option>
            {turmas.map((turma) => {
              const contagem = turma.estudantes ?? 0;
              return (
                <option key={turma.id} value={turma.id}>
                  {turma.nome} · {turma.serie} · {contagem} {contagem === 1 ? "estudante" : "estudantes"}
                </option>
              );
            })}
          </select>
        </label>
        {aviso ? <p className="text-[12px] text-unooria-neutral-500">{aviso}</p> : null}
      </div>
    </Card>
  );
}
