import Link from "next/link";

import { Badge } from "@edu/ui/ds";
import type { LinhaDaTurma } from "@/lib/vila-tipos";

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Uma linha por estudante da turma, inclusive quem não jogou.
 *
 * O QUE ESTA TABELA NÃO TEM: nenhum número de valor de Schwartz. Ela é uma
 * listagem, e listagem é ordenável — publicar "Poder" numa coluna aqui
 * produziria um ranking de crianças por uma palavra dessas. Os valores vivem na
 * tela individual, uma criança por vez, com o grau de sustentação de cada um ao
 * lado.
 *
 * A BOLHA aparece porque é o que o professor precisa antes do debate, e porque a
 * coluna não diz nada sobre a criança: ela diz qual mensagem a plataforma
 * mandou.
 */
export function TabelaTurma({
  estudantes,
  alunos,
  rotaBase,
}: {
  estudantes?: LinhaDaTurma[];
  alunos?: LinhaDaTurma[];
  rotaBase: string;
}) {
  const lista = estudantes ?? alunos ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-unooria-neutral-200 text-left text-[12px] uppercase tracking-wider text-unooria-neutral-500">
            <th className="py-2 pr-3 font-semibold">Estudante</th>
            <th className="py-2 pr-3 font-semibold">Bolha</th>
            <th className="py-2 pr-3 font-semibold">Partidas</th>
            <th className="py-2 pr-3 font-semibold">Última</th>
            <th className="py-2 pr-3 font-semibold">Fogueiras</th>
            <th className="py-2 pr-3 font-semibold">Leitura</th>
            <th className="py-2 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {lista.map((estudante) => (
            <tr key={estudante.estudanteId ?? estudante.alunoId} className="border-b border-unooria-neutral-100 align-middle">
              <td className="py-2.5 pr-3 font-medium text-unooria-neutral-950">{estudante.nome}</td>
              <td className="py-2.5 pr-3">
                {estudante.bolha ? (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-unooria-navy-800 text-[11px] font-bold text-white">
                    {estudante.bolha}
                  </span>
                ) : (
                  <span className="text-unooria-neutral-400">—</span>
                )}
              </td>
              <td className="py-2.5 pr-3 text-unooria-neutral-700">{estudante.partidas}</td>
              <td className="py-2.5 pr-3 text-unooria-neutral-700">{quando(estudante.ultimaEm)}</td>
              <td className="py-2.5 pr-3 text-unooria-neutral-700">
                {estudante.fogueirasAcesas === null ? "—" : `${estudante.fogueirasAcesas}/8`}
              </td>
              <td className="py-2.5 pr-3">
                {/*
                  Três estados, e nenhum deles é um julgamento da criança:
                  não jogou · jogou e a partida não sustenta leitura · sustenta.
                  "Partida curta" é sobre a PARTIDA. Um "insuficiente" solto aqui
                  seria lido como insuficiência dela.
                */}
                {estudante.amostraSuficiente === null ? (
                  <Badge variant="disable">Não jogou</Badge>
                ) : estudante.amostraSuficiente ? (
                  <Badge variant="success">Sustenta leitura</Badge>
                ) : (
                  <Badge variant="warning">Partida curta</Badge>
                )}
              </td>
              <td className="py-2.5 text-right">
                {estudante.ultimaEm ? (
                  <Link
                    href={`${rotaBase}/estudantes/${encodeURIComponent(estudante.estudanteId ?? estudante.alunoId ?? "")}`}
                    className="text-[13px] font-semibold text-unooria-navy-900 underline"
                  >
                    Abrir
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
