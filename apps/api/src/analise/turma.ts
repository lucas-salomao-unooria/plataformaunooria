import type { Prisma } from '@prisma/client';

import { antagonismoSchema } from '../comum/insta/tipos';

import { metricasDaAtividade, type MetricasDaRun } from './metricas';

/**
 * Agregados de uma turma — o nível PEDAGÓGICO (doc 11 §4).
 *
 * A peça central é a tabela `conclusão × lado semeado`. Se o lado em que o feed
 * nasceu prevê a conclusão que o estudante escreveu, o resultado experimental da
 * turma está nessa grade — e é ela que o professor projeta no momento-espelho
 * (doc 09). Tudo o mais nesta tela existe para explicar essa grade.
 */
export interface Celula {
  A: number;
  duvida: number;
  B: number;
}

export interface AnaliseDaTurma {
  atividade: { id: string; titulo: string; perguntaChave: string; ladoALabel: string; ladoBLabel: string };

  /** A tabela que vale a aula: linhas = lado semeado, colunas = conclusão. */
  conclusaoPorLadoSemeado: { semeadoEmA: Celula; semeadoEmB: Celula };

  /**
   * Quantos concluíram no mesmo lado em que o feed nasceu, sobre quem concluiu
   * com lado (a dúvida não conta nem a favor nem contra).
   */
  poderDoViesSemeado: {
    seguiram: number;
    viraram: number;
    emDuvida: number;
    taxa: number | null;
    /** Quantos mexeram na resposta depois de escolher a primeira vez. */
    trocaramDeIdeia: number;
    /** E quantos, desses, acabaram num lado diferente do que escolheram de cara. */
    terminaramNoutroLado: number;
  };

  turma: {
    total: number;
    naMissao: number;
    concluiram: number;
    semConcluir: { username: string; displayName: string; fase: string }[];
    inverteram: { username: string; displayName: string; de: string; para: string; bloco: number | null }[];
  };

  /** Distribuição do lado semeado e de onde ele veio — auditoria da largada. */
  largada: { porLado: { A: number; B: number }; porOrigem: Record<string, number> };

  busca: { usaram: number; naoUsaram: number; termos: string[] };

  imersao: {
    media: number | null;
    porComponente: { chave: string; rotulo: string; media: number }[];
  };

  estudantes: MetricasDaRun[];
}

const vazia = (): Celula => ({ A: 0, duvida: 0, B: 0 });

export async function analiseDaTurma(
  prisma: Prisma.TransactionClient,
  activityId: string,
): Promise<AnaliseDaTurma> {
  const [atividade, estudantes] = await Promise.all([
    prisma.activity.findUniqueOrThrow({
      where: { id: activityId },
      select: { id: true, titulo: true, perguntaChave: true, antagonismo: true },
    }),
    metricasDaAtividade(prisma, activityId),
  ]);

  const antagonismo = antagonismoSchema.safeParse(atividade.antagonismo);
  const ladoALabel = antagonismo.success ? antagonismo.data.ladoA.label : 'Lado A';
  const ladoBLabel = antagonismo.success ? antagonismo.data.ladoB.label : 'Lado B';
  const rotulo = (lado: string) => (lado === 'A' ? ladoALabel : lado === 'B' ? ladoBLabel : 'nenhum lado');

  const tabela = { semeadoEmA: vazia(), semeadoEmB: vazia() };
  let seguiram = 0;
  let viraram = 0;
  let emDuvida = 0;
  let trocaramDeIdeia = 0;
  let terminaramNoutroLado = 0;

  for (const estudante of estudantes) {
    if (!estudante.conclusao) continue;
    const linha = estudante.bolha.ladoInicial === 'A' ? tabela.semeadoEmA : tabela.semeadoEmB;
    linha[estudante.conclusao.inclinacao] += 1;

    if (estudante.conclusao.inclinacao === 'duvida') emDuvida += 1;
    else if (estudante.conclusao.inclinacao === estudante.bolha.ladoInicial) seguiram += 1;
    else viraram += 1;

    /**
     * Quem trocou de ideia enquanto esperava a turma. A tabela acima usa a
     * ÚLTIMA escolha — é a que o estudante assumiu, e é a que ele vai defender —,
     * mas a correlação lê diferente se metade da sala mudou de opinião DEPOIS
     * de sair do feed. Sem este número, ninguém tinha como perguntar isso.
     */
    if (estudante.conclusao.trocas > 0) trocaramDeIdeia += 1;
    if (
      estudante.conclusao.inclinacaoInicial &&
      estudante.conclusao.inclinacaoInicial !== estudante.conclusao.inclinacao
    ) {
      terminaramNoutroLado += 1;
    }
  }

  const comLado = seguiram + viraram;

  /**
   * As fases "ainda na missão" são as anteriores à revelação. Quem está em
   * `conclusao` conta como na missão de propósito: ele ainda tem trabalho a
   * entregar, e é quem o professor precisa esperar antes do momento-espelho.
   */
  const naMissao = estudantes.filter((estudante) =>
    ['onboarding', 'feed', 'encerramento', 'conclusao'].includes(estudante.fase),
  ).length;

  const termos = [...new Set(estudantes.flatMap((estudante) => estudante.investigacao.termosBuscados))];
  const usaram = estudantes.filter((estudante) => estudante.investigacao.usosDaBusca > 0).length;

  /**
   * Média de imersão só entre quem chegou ao fim do feed. Incluir quem acabou de
   * entrar puxaria a média para baixo e faria a turma parecer desengajada quando
   * o que houve foi atraso no login.
   */
  const paraImersao = estudantes.filter((estudante) => estudante.postsConsumidos >= 8);
  const mediaDe = (valores: number[]) =>
    valores.length > 0 ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10 : null;

  const chaves = paraImersao[0]?.imersao.componentes.map((c) => ({ chave: c.chave, rotulo: c.rotulo })) ?? [];

  return {
    atividade: {
      id: atividade.id,
      titulo: atividade.titulo,
      perguntaChave: atividade.perguntaChave,
      ladoALabel,
      ladoBLabel,
    },
    conclusaoPorLadoSemeado: tabela,
    poderDoViesSemeado: {
      seguiram,
      viraram,
      emDuvida,
      taxa: comLado > 0 ? Math.round((seguiram / comLado) * 100) / 100 : null,
      trocaramDeIdeia,
      terminaramNoutroLado,
    },
    turma: {
      total: estudantes.length,
      naMissao,
      concluiram: estudantes.filter((estudante) => estudante.conclusao !== null).length,
      semConcluir: estudantes
        .filter((estudante) => estudante.conclusao === null)
        .map((estudante) => ({ ...estudante.estudante, fase: estudante.fase })),
      inverteram: estudantes
        .filter((estudante) => estudante.bolha.inverteu)
        .map((estudante) => ({
          ...estudante.estudante,
          de: rotulo(estudante.bolha.ladoInicial),
          para: rotulo(estudante.ladoDominante),
          bloco: estudante.bolha.blocoDaInversao,
        })),
    },
    largada: {
      porLado: {
        A: estudantes.filter((estudante) => estudante.bolha.ladoInicial === 'A').length,
        B: estudantes.filter((estudante) => estudante.bolha.ladoInicial === 'B').length,
      },
      porOrigem: estudantes.reduce<Record<string, number>>((acumulado, estudante) => {
        acumulado[estudante.bolha.ladoOrigem] = (acumulado[estudante.bolha.ladoOrigem] ?? 0) + 1;
        return acumulado;
      }, {}),
    },
    busca: { usaram, naoUsaram: estudantes.length - usaram, termos },
    imersao: {
      media: mediaDe(paraImersao.map((estudante) => estudante.imersao.total)),
      porComponente: chaves.map(({ chave, rotulo: rotuloDoComponente }) => ({
        chave,
        rotulo: rotuloDoComponente,
        media:
          mediaDe(
            paraImersao.map(
              (estudante) => estudante.imersao.componentes.find((c) => c.chave === chave)?.pontos ?? 0,
            ),
          ) ?? 0,
      })),
    },
    estudantes,
  };
}

/**
 * CSV identificado da turma (doc 11 §4.2).
 *
 * Duas decisões de formato que existem por experiência de planilha:
 * **BOM UTF-8** no começo — sem ele o Excel e o LibreOffice abrem "não" como
 * "nÃ£o" — e **ponto e vírgula** como separador, porque a máquina do professor
 * está em pt-BR e vírgula é separador decimal.
 */
export function turmaEmCsv(analise: AnaliseDaTurma): string {
  const sep = ';';
  const num = (valor: number) => String(valor).replace('.', ',');
  const texto = (valor: string) => `"${valor.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const rotulo = (lado: string) =>
    lado === 'A' ? analise.atividade.ladoALabel : lado === 'B' ? analise.atividade.ladoBLabel : 'nenhum lado';

  const colunas = [
    'estudante',
    'usuario',
    'fase',
    'perfil_do_jogo',
    'origem_do_perfil',
    'lado_semeado',
    'origem_do_lado',
    'lado_final',
    'inverteu',
    'bloco_da_inversao',
    'conclusao',
    // A PRIMEIRA escolha e quantas vezes ele mexeu. A tela convida a trocar de
    // ideia enquanto a turma termina, e sem estas duas colunas a planilha não
    // tem como distinguir a reação ao feed do que sobrou depois da espera.
    'conclusao_inicial',
    'trocas_de_resposta',
    // O texto livre saiu da conclusão e virou a REFLEXÃO do fim (fluxo v2): é ele
    // que o professor audita, e é sobre a atividade, não sobre a pergunta-chave.
    'caracteres_da_reflexao',
    'texto_da_reflexao',
    'posts_consumidos',
    'minutos_de_feed',
    'minutos_ativos',
    'segundos_no_lado_semeado',
    'segundos_no_outro_lado',
    'usos_da_busca',
    'termos_buscados',
    'considerou_o_oposto',
    'imersao_total',
    'continuidade',
    'atencao',
    'gestos',
    'voluntariedade',
    'exploracao',
    'curtidas',
    'comentarios',
    'salvos',
    'seguidos',
    'publicou',
  ];

  const linhas = (analise.estudantes).map((estudante) => {
    const outro = estudante.bolha.ladoInicial === 'A' ? 'B' : 'A';
    const ponto = (chave: string) =>
      num(estudante.imersao.componentes.find((c) => c.chave === chave)?.pontos ?? 0);

    return [
      texto(estudante.estudante?.displayName ?? estudante.estudante.displayName),
      estudante.estudante?.username ?? estudante.estudante.username,
      estudante.fase,
      estudante.perfilJogo?.dominante ?? 'ausente',
      estudante.perfilJogo?.origem ?? 'ausente',
      texto(rotulo(estudante.bolha.ladoInicial)),
      estudante.bolha.ladoOrigem,
      texto(rotulo(estudante.ladoDominante)),
      estudante.bolha.inverteu ? 'sim' : 'nao',
      estudante.bolha.blocoDaInversao ?? '',
      estudante.conclusao ? texto(rotulo(estudante.conclusao.inclinacao)) : 'nao concluiu',
      estudante.conclusao?.inclinacaoInicial
        ? texto(rotulo(estudante.conclusao.inclinacaoInicial))
        : 'nao registrada',
      String(estudante.conclusao?.trocas ?? 0),
      estudante.reflexao?.caracteres ?? 0,
      estudante.reflexao ? texto(estudante.reflexao.texto) : '',
      estudante.postsConsumidos,
      num(Math.round((estudante.tempo.feedMs / 60_000) * 10) / 10),
      num(Math.round((estudante.tempo.ativoMs / 60_000) * 10) / 10),
      num(Math.round(estudante.tempo.porLadoMs[estudante.bolha.ladoInicial] / 1000)),
      num(Math.round(estudante.tempo.porLadoMs[outro] / 1000)),
      estudante.investigacao.usosDaBusca,
      texto(estudante.investigacao.termosBuscados.join(' | ')),
      estudante.investigacao.consideracaoDoOposto,
      num(estudante.imersao.total),
      ponto('continuidade'),
      ponto('atencao'),
      ponto('gestos'),
      ponto('voluntariedade'),
      ponto('exploracao'),
      estudante.interacoes.curtidas,
      estudante.interacoes.comentarios,
      estudante.interacoes.salvos,
      estudante.interacoes.seguidos,
      estudante.interacoes.publicou ? 'sim' : 'nao',
    ].join(sep);
  });

  return `﻿${colunas.join(sep)}\n${linhas.join('\n')}\n`;
}
