import { notFound } from "next/navigation";

import {
  MISSAO_A_SELECAO,
  MISSAO_ASSISTENTE_INVISIVEL,
  MISSAO_EFEITO_AMPLIFICADOR,
  MISSAO_ENIGMA_CAPA,
  MISSAO_MANIFESTO_IA,
  MISSAO_NINA_NOTICIA,
  MISSAO_FOTO_CONTA,
  MISSAO_JORNAL_DA_ESCOLA,
  MISSAO_JURI_ESTADUAL,
  MISSAO_QUEM_MANDOU_ISSO,
  MISSAO_RASTRO_BOATO,
  MISSAO_UNOOGPT,
  buscarMissao,
} from "@/lib/entre-redes/catalogo";

import { ResultadosASelecao } from "./resultados-a-selecao";
import { ResultadosAssistenteInvisivel } from "./resultados-assistente-invisivel";
import { ResultadosEfeitoAmplificador } from "./resultados-efeito-amplificador";
import { ResultadosEnigmaCapa } from "./resultados-enigma-capa";
import { ResultadosManifestoIa } from "./resultados-manifesto-ia";
import { ResultadosNinaNoticia } from "./resultados-nina-noticia";
import { ResultadosFotoConta } from "./resultados-foto-conta";
import { ResultadosJornalEscola } from "./resultados-jornal-escola";
import { ResultadosJuriEstadual } from "./resultados-juri-estadual";
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
 * compartilhável, e nunca "sem turma = todas". Nas missões com atividade
 * (ADR-130) esta é a PÁGINA DA ATIVIDADE: a exp07ef1b lê `?cobertura=`, e a
 * exp04ef1b, a exp05ef1b e a exp06ef1b, `?pacote=` — o card da lista de atividades da ficha
 * leva até aqui com a atividade na URL; sem o parâmetro, é a em andamento.
 */
export default async function ResultadosPage({
  params,
  searchParams,
}: {
  params: Promise<{ ano: string; unidade: string }>;
  searchParams: Promise<{ turmaId?: string; cobertura?: string; pacote?: string; separar?: string }>;
}) {
  const { ano: anoSlug, unidade: unidadeSlug } = await params;
  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  if (!encontrado) notFound();
  const { missao } = encontrado;

  const { turmaId, cobertura, pacote, separar: separarBruto } = await searchParams;
  const turma = turmaId?.trim() ?? "";
  /* `?separar=N` vem da criação da atividade com "Eu separo" (ADR-130): as N
     equipes vazias já abrem na página. Número inválido é ignorado. */
  const nSeparar = Number(separarBruto);
  const separar = Number.isInteger(nSeparar) && nSeparar > 0 && nSeparar <= 200 ? nSeparar : null;

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
    return <ResultadosASelecao missao={missao} turma={turma} cobertura={cobertura?.trim() ?? ""} separar={separar} />;
  }
  if (missao.expId === MISSAO_QUEM_MANDOU_ISSO.expId) {
    return <ResultadosQuemMandouIsso missao={missao} turma={turma} pacote={pacote?.trim() ?? ""} separar={separar} />;
  }
  if (missao.expId === MISSAO_JORNAL_DA_ESCOLA.expId) {
    return <ResultadosJornalEscola missao={missao} turma={turma} pacote={pacote?.trim() ?? ""} separar={separar} />;
  }
  if (missao.expId === MISSAO_JURI_ESTADUAL.expId) {
    return <ResultadosJuriEstadual missao={missao} turma={turma} pacote={pacote?.trim() ?? ""} separar={separar} />;
  }
  if (missao.expId === MISSAO_EFEITO_AMPLIFICADOR.expId) {
    return <ResultadosEfeitoAmplificador missao={missao} turma={turma} pacote={pacote?.trim() ?? ""} separar={separar} />;
  }
  if (missao.expId === MISSAO_ENIGMA_CAPA.expId) {
    return <ResultadosEnigmaCapa missao={missao} turma={turma} pacote={pacote?.trim() ?? ""} separar={separar} />;
  }
  if (missao.expId === MISSAO_ASSISTENTE_INVISIVEL.expId) {
    return <ResultadosAssistenteInvisivel missao={missao} turma={turma} pacote={pacote?.trim() ?? ""} separar={separar} />;
  }
  if (missao.expId === MISSAO_NINA_NOTICIA.expId) {
    return <ResultadosNinaNoticia missao={missao} turma={turma} pacote={pacote?.trim() ?? ""} separar={separar} />;
  }
  // Missão sem tela de resultados própria: a trilha não linka para cá.
  notFound();
}
