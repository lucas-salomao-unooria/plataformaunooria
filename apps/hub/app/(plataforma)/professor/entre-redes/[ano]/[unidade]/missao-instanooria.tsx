import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import {
  rotuloDaMissao,
  type Ano,
  type Missao,
} from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo da missão do INSTANOORIA (8º ano · Unidade 1): ficha, guia e a lista
 * de atividades que o professor configurou — a lista que virou o molde das
 * outras missões (ADR-130), e que mora em `atividades-da-missao.tsx`. Recebe a
 * missão já resolvida pelo despachante em `page.tsx`. A disposição é do
 * template (`components/ficha/ficha-de-conducao.tsx`, ADR-182).
 */
export async function MissaoInstanooria({
  ano,
  missao,
  turma,
}: {
  ano: Ano;
  missao: Missao & { ficha: NonNullable<Missao["ficha"]> };
  /** A turma que a sala mandou conduzir (ADR-100); `null` pela trilha. */
  turma: TurmaDoProfessor | null;
}) {
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  return (
    <FichaDeConducao
      contexto={rotuloDaMissao(ano, missao)}
      titulo={missao.titulo}
      resumo={missao.resumo}
      ficha={missao.ficha}
      guia={guia}
      conducao={<AtividadesDaMissao missao={missao} expId="exp08ef1b" turma={turma} />}
    />
  );
}
