"use client";

import { useRouter } from "next/navigation";

import type { TurmaResumida } from "@/lib/vila-tipos";

/**
 * Escolha da turma no guia — e aqui ela não é conveniência, é correção.
 *
 * Nos anos iniciais a api não serve a bolha B. Sem saber de que turma se trata,
 * o guia projetaria os três golpes e mandaria o professor esperar a reação de um
 * grupo que a sala dele não tem.
 */
export function SeletorDeTurmaGuia({
  turmas,
  turmaId,
  rotaBase,
}: {
  turmas: TurmaResumida[];
  turmaId: string;
  rotaBase: string;
}) {
  const router = useRouter();

  return (
    <label className="flex flex-wrap items-end gap-3 text-[13px] font-semibold text-unooria-neutral-800">
      Turma
      <select
        id="turma"
        value={turmaId}
        onChange={(evento) => {
          const alvo = evento.target.value;
          router.push(alvo ? `${rotaBase}?turmaId=${encodeURIComponent(alvo)}` : rotaBase);
        }}
        className="min-w-[260px] rounded-md border border-unooria-neutral-300 bg-white px-3 py-2 text-[14px] font-normal text-unooria-neutral-950"
      >
        <option value="">Todas as versões…</option>
        {turmas.map((turma) => (
          <option key={turma.id} value={turma.id}>
            {turma.nome} · {turma.serie}
          </option>
        ))}
      </select>
      <span className="text-[12px] font-normal text-unooria-neutral-500">
        Escolha a turma para ver só as mensagens que ela recebeu.
      </span>
    </label>
  );
}
