import { notFound } from "next/navigation";

import {
  MISSAO_ECO_NO_GRUPO,
  MISSAO_FOTO_CONTA,
  MISSAO_RASTRO_BOATO,
  MISSAO_UNOOGPT,
  MISSAO_UNOOTUBE,
  buscarMissao,
} from "@/lib/entre-redes/catalogo";

import { ResultadosFotoConta } from "./resultados-foto-conta";
import { ResultadosOEcoNoGrupo } from "./resultados-o-eco-no-grupo";
import { ResultadosRastroBoato } from "./resultados-rastro-boato";
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
  const { missao } = encontrado;

  const { turmaId } = await searchParams;
  const turma = turmaId?.trim() ?? "";

  if (missao.expId === MISSAO_FOTO_CONTA.expId) {
    return <ResultadosFotoConta missao={missao} turma={turma} />;
  }
  if (missao.expId === MISSAO_UNOOTUBE.expId) {
    return <ResultadosUnooTube missao={missao} turma={turma} />;
  }
  if (missao.expId === MISSAO_UNOOGPT.expId) {
    return <ResultadosUnooGPT missao={missao} turma={turma} />;
  }
  if (missao.expId === MISSAO_ECO_NO_GRUPO.expId) {
    return <ResultadosOEcoNoGrupo missao={missao} turma={turma} />;
  }
  if (missao.expId === MISSAO_RASTRO_BOATO.expId) {
    return <ResultadosRastroBoato missao={missao} turma={turma} />;
  }
  // Missão sem tela de resultados própria: a trilha não linka para cá.
  notFound();
}
