import { notFound } from "next/navigation";

import {
  MISSAO_A_SELECAO,
  MISSAO_MANIFESTO_IA,
  MISSAO_FOTO_CONTA,
  MISSAO_QUEM_MANDOU_ISSO,
  MISSAO_RASTRO_BOATO,
  MISSAO_UNOOGPT,
  buscarMissao,
} from "@/lib/entre-redes/catalogo";

import { ResultadosASelecao } from "./resultados-a-selecao";
import { ResultadosManifestoIa } from "./resultados-manifesto-ia";
import { ResultadosFotoConta } from "./resultados-foto-conta";
import { ResultadosQuemMandouIsso } from "./resultados-quem-mandou-isso";
import { ResultadosRastroBoato } from "./resultados-rastro-boato";
import { ResultadosUnooGPT } from "./resultados-unoogpt";

/**
 * Resultados de uma missão por turma — DESPACHANTE por `missao.expId`.
 *
 * Era exclusivo do UnooTube (com `notFound()` para qualquer outro expId). Virou
 * despachante quando a Missão Tempestade ganhou a própria tela: é a MESMA rota
 * da trilha (`.../<ano>/<unidade>/resultados`), e um caminho paralelo
 * duplicaria o seletor de turma e o breadcrumb.
 *
 * A turma vem da URL (`?turmaId=`), como a escola em `/analise`: link
 * compartilhável, e nunca "sem turma = todas". A exp07ef1b lê também
 * `?cobertura=` — a atividade que o painel de habilidades mostra (a cobertura
 * homologada; sem o parâmetro, a em andamento).
 */
export default async function ResultadosPage({
  params,
  searchParams,
}: {
  params: Promise<{ ano: string; unidade: string }>;
  searchParams: Promise<{ turmaId?: string; cobertura?: string }>;
}) {
  const { ano: anoSlug, unidade: unidadeSlug } = await params;
  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  if (!encontrado) notFound();
  const { missao } = encontrado;

  const { turmaId, cobertura } = await searchParams;
  const turma = turmaId?.trim() ?? "";

  if (missao.expId === MISSAO_FOTO_CONTA.expId) {
    return <ResultadosFotoConta missao={missao} turma={turma} />;
  }
  if (missao.expId === MISSAO_UNOOGPT.expId) {
    return <ResultadosUnooGPT missao={missao} turma={turma} />;
  }
  if (missao.expId === MISSAO_RASTRO_BOATO.expId) {
    return <ResultadosRastroBoato missao={missao} turma={turma} />;
  }
  if (missao.expId === MISSAO_MANIFESTO_IA.expId) {
    return <ResultadosManifestoIa missao={missao} turma={turma} />;
  }
  if (missao.expId === MISSAO_A_SELECAO.expId) {
    return <ResultadosASelecao missao={missao} turma={turma} cobertura={cobertura?.trim() ?? ""} />;
  }
  if (missao.expId === MISSAO_QUEM_MANDOU_ISSO.expId) {
    return <ResultadosQuemMandouIsso missao={missao} turma={turma} />;
  }
  // Missão sem tela de resultados própria: a trilha não linka para cá.
  notFound();
}
