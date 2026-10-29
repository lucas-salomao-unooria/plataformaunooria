import { notFound } from "next/navigation";

import { EmptyState } from "@edu/ui/ds";
import { EquipesDaFicha } from "@/components/equipes/equipes-da-ficha";
import { FaixaDaTurma } from "@/components/ficha/ficha-de-conducao";
import { LinkButton } from "@/components/link-button";
import { temAtividades } from "@/lib/entre-redes/atividades";
import {
  MISSAO_A_SELECAO,
  MISSAO_ASSISTENTE_INVISIVEL,
  MISSAO_EFEITO_AMPLIFICADOR,
  MISSAO_ENIGMA_CAPA,
  MISSAO_FOTO_CONTA,
  MISSAO_JORNAL_DA_ESCOLA,
  MISSAO_JURI_ESTADUAL,
  MISSAO_MANIFESTO_IA,
  MISSAO_NINA_NOTICIA,
  MISSAO_PORTA_VOZ,
  MISSAO_QUEM_MANDOU_ISSO,
  MISSAO_RASTRO_BOATO,
  MISSAO_UNOOGPT,
  buscarMissao,
  rotuloDaMissao,
} from "@/lib/entre-redes/catalogo";
import { turmaDaConducao } from "@/lib/turmas";

import { MissaoASelecao } from "./missao-a-selecao";
import { MissaoAssistenteInvisivel } from "./missao-assistente-invisivel";
import { MissaoEfeitoAmplificador } from "./missao-efeito-amplificador";
import { MissaoEnigmaCapa } from "./missao-enigma-capa";
import { MissaoFotoConta } from "./missao-foto-conta";
import { MissaoInstanooria } from "./missao-instanooria";
import { MissaoJornalEscola } from "./missao-jornal-escola";
import { MissaoJuriEstadual } from "./missao-juri-estadual";
import { MissaoManifestoIa } from "./missao-manifesto-ia";
import { MissaoNinaNoticia } from "./missao-nina-noticia";
import { MissaoPortaVoz } from "./missao-porta-voz";
import { MissaoQuemMandouIsso } from "./missao-quem-mandou-isso";
import { MissaoRastroBoato } from "./missao-rastro-boato";
import { MissaoUnooGPT } from "./missao-unoogpt";

/**
 * Página de uma missão do Entre Redes — DESPACHANTE por `missao.expId`.
 *
 * Cada missão publicada tem o próprio corpo: o Instanooria configura
 * atividades e tem guia; o unooGPT tem uma ação AO VIVO (a largada do relógio da turma) e sem ela a aula
 * não começa. Unidades "em breve" continuam com o aviso honesto abaixo.
 */
export default async function MissaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ ano: string; unidade: string }>;
  /**
   * `?turmaId=` chega de quem veio da SALA DE AULA (ADR-100) — de lá esta é a
   * única porta da missão, e ela abre JÁ na turma: os resultados, as atividades
   * e o guia lá dentro repontam para ela. Sem o parâmetro (trilha do Entre
   * Redes, link salvo) a ficha abre como sempre abriu.
   */
  searchParams: Promise<{ turmaId?: string }>;
}) {
  const { ano: anoSlug, unidade: unidadeSlug } = await params;
  const { turmaId } = await searchParams;

  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  if (!encontrado) notFound();
  const { ano, missao } = encontrado;

  // Unidade sem conteúdo acessada pela URL: a trilha não linka para cá, mas o
  // endereço é adivinhável. Melhor dizer o que é do que devolver um 404 seco.
  if (missao.status === "em-breve" || !missao.ficha) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title={`${rotuloDaMissao(ano, missao)} ainda está em produção`}
          description="Assim que esta missão for publicada ela aparece na trilha do Entre Redes, pronta para configurar."
        />
        <div>
          <LinkButton href="/professor/entre-redes" variant="secondary">
            Voltar para a trilha
          </LinkButton>
        </div>
      </div>
    );
  }

  const turma = await turmaDaConducao(turmaId);
  const comFicha = { ...missao, ficha: missao.ficha };

  /**
   * A faixa de contexto mora AQUI, e não nos corpos, pela mesma razão da trilha
   * e do `EscopoDaEscola`: são nove corpos, e nove cópias divergem. Ela existe
   * porque a ficha aberta pela sala e a aberta pela trilha são a MESMA tela com
   * comportamentos diferentes por dentro (a lista de atividades filtra, os
   * resultados já vêm com a turma) — sem dizer isso na cara, o professor não
   * tem como saber de qual turma é o que está vendo.
   *
   * As EQUIPES (E13) entram logo abaixo dela SÓ na missão sem atividade (o
   * unooGPT, até ser refeito): nas outras, a equipe é de cada ATIVIDADE
   * (ADR-130) e mora na página dela. A seção decide sozinha se aparece
   * (`permitida`).
   */
  const corpo = (elemento: React.ReactNode) => (
    <div className="flex flex-col gap-6">
      {turma ? (
        <FaixaDaTurma
          nome={turma.nome}
          descricao="As atividades e os resultados abaixo são desta turma. Para ver as outras, entre pela trilha do Entre Redes."
        />
      ) : null}
      {turma && missao.expId && !temAtividades(missao.expId) ? (
        <EquipesDaFicha turmaId={turma.id} expId={missao.expId} />
      ) : null}
      {elemento}
    </div>
  );

  if (missao.expId === MISSAO_FOTO_CONTA.expId) {
    return corpo(<MissaoFotoConta ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_UNOOGPT.expId) {
    return corpo(<MissaoUnooGPT ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_RASTRO_BOATO.expId) {
    return corpo(<MissaoRastroBoato ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_MANIFESTO_IA.expId) {
    return corpo(<MissaoManifestoIa ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_A_SELECAO.expId) {
    return corpo(<MissaoASelecao ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_QUEM_MANDOU_ISSO.expId) {
    return corpo(<MissaoQuemMandouIsso ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_JORNAL_DA_ESCOLA.expId) {
    return corpo(<MissaoJornalEscola ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_JURI_ESTADUAL.expId) {
    return corpo(<MissaoJuriEstadual ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_EFEITO_AMPLIFICADOR.expId) {
    return corpo(<MissaoEfeitoAmplificador ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_ENIGMA_CAPA.expId) {
    return corpo(<MissaoEnigmaCapa ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_ASSISTENTE_INVISIVEL.expId) {
    return corpo(<MissaoAssistenteInvisivel ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_NINA_NOTICIA.expId) {
    return corpo(<MissaoNinaNoticia ano={ano} missao={comFicha} turma={turma} />);
  }
  if (missao.expId === MISSAO_PORTA_VOZ.expId) {
    return corpo(<MissaoPortaVoz ano={ano} missao={comFicha} turma={turma} />);
  }
  /* FALLBACK = INSTANOORIA, e é por isso que ele é perigoso: uma missão
     publicada sem ramo aqui não quebra — ela mostra a tela de OUTRA missão,
     com "Nova atividade" e sem o caminho para os resultados. Foi o que
     aconteceu com a exp08ef4b até 2026-09-11, e só a suíte e2e pegou. */
  return corpo(<MissaoInstanooria ano={ano} missao={comFicha} turma={turma} />);
}
