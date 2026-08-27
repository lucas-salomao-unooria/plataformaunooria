import { notFound } from "next/navigation";

import { MISSAO_UNOOGPT, MISSAO_UNOOTUBE, buscarMissao } from "@/lib/entre-redes/catalogo";

import { ResultadosUnooGPT } from "./resultados-unoogpt";
import { ResultadosUnooTube } from "./resultados-unootube";

/**
 * Resultados de uma missão por turma — DESPACHANTE por `missao.expId`.
 *
 * Era exclusivo do UnooTube (com `notFound()` para qualquer outro expId). Virou
 * despachante quando a Missão Tempestade ganhou a própria tela: é a MESMA rota
 * da trilha (`.../<ano>/<unidade>/resultados`), e um caminho paralelo
 * duplicaria o seletor de turma e o breadcrumb.
 *
 * A turma vem da URL (`?turmaId=`), como a escola em `/analise`: link
 * compartilhável, e nunca "sem turma = todas".
 */
export default async function ResultadosPage({
  params,
  searchParams,
}: {
  params: Promise<{ ano: string; unidade: string }>;
  searchParams: Promise<{ turmaId?: string }>;
}) {
  const { ano: anoSlug, unidade: unidadeSlug } = await params;
  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  if (!encontrado) notFound();
  const { ano, missao } = encontrado;

  const { turmaId } = await searchParams;
  const turma = turmaId?.trim() ?? "";

  if (missao.expId === MISSAO_UNOOTUBE.expId) {
    return <ResultadosUnooTube ano={ano} missao={missao} turma={turma} />;
  }
  if (missao.expId === MISSAO_UNOOGPT.expId) {
    return <ResultadosUnooGPT ano={ano} missao={missao} turma={turma} />;
  }
  // Missão sem tela de resultados própria: a trilha não linka para cá.
  notFound();
}
