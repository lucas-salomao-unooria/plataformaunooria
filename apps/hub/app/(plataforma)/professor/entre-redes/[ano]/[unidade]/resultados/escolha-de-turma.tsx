"use client";

import { useRouter } from "next/navigation";

import { Card, Selection } from "@edu/ui/ds";

export interface TurmaParaEscolher {
  id: string;
  nome: string;
  estudantes: number;
}

/**
 * A escolha da turma da exp05ef1b — a MESMA função do `SeletorDeTurma` ao
 * lado (a turma vive na URL, `?turmaId=`, para o link ser compartilhável e
 * "sem turma" nunca virar "todas"), só que com o `Selection` do DS.
 *
 * Por que outro componente, e não o `SeletorDeTurma`: aquele ainda é um
 * `<select>` cru — o que a regra do DS proíbe ("seleção é `Selection`") — e
 * cinco suítes e2e o dirigem por `select#turma` (estudante/04, 06, 07, 08, 09).
 * Trocá-lo por dentro derrubaria as cinco sem nenhuma mudança de produto; é
 * frente própria (migrar as cinco missões e as suítes juntas). Esta missão
 * nasce do lado certo, e o `SeletorDeTurma` fica marcado como a dívida.
 *
 * O rótulo é o da copy (`e0.professor.seletor_turma_label`).
 */
export function EscolhaDeTurma({
  turmas,
  turmaId,
  rotaBase,
  aviso,
}: {
  turmas: TurmaParaEscolher[];
  turmaId: string;
  rotaBase: string;
  aviso?: string;
}) {
  const router = useRouter();

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-2 sm:max-w-md">
        <Selection
          label="Selecione a turma"
          placeholder="Escolha a turma…"
          value={turmaId || undefined}
          disabled={turmas.length === 0}
          showOptionCheckbox={false}
          options={turmas.map((turma) => ({
            value: turma.id,
            label: `${turma.nome} · ${turma.estudantes} ${turma.estudantes === 1 ? "estudante" : "estudantes"}`,
          }))}
          onChange={(valor) => {
            const alvo = Array.isArray(valor) ? valor[0] : valor;
            router.push(alvo ? `${rotaBase}?turmaId=${encodeURIComponent(alvo)}` : rotaBase);
          }}
        />
        {aviso ? <p className="text-[12px] text-unooria-neutral-500">{aviso}</p> : null}
      </div>
    </Card>
  );
}
