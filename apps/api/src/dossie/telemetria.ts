import { PERFIS, type Perfil } from '../comum/insta/defaults';
import { MARGEM_DE_EMPATE } from '../perfis/afinidade';
import type { EngineConfig, EngineState } from '../motor/tipos';

import type {
  Bolha,
  ComponenteDeImersao,
  Imersao,
  Investigacao,
  PerfilObservado,
  Ritmo,
  TempoDaSessao,
} from './tipos';

/**
 * As definições operacionais do doc 11 §3, em funções puras.
 *
 * Puras de propósito: são elas que alimentam o relatório do aluno (M8), o painel
 * do professor e a análise de produto (M9). Se cada superfície calculasse "tempo
 * ativo" do seu jeito, os três números divergiriam e ninguém saberia qual está
 * certo. Aqui existe uma definição só, testável sem banco.
 */

/**
 * Piso de ociosidade (doc 11 §3.1). Abaixo de 20s o vão é compatível com ler uma
 * legenda longa ou os comentários; acima, o aluno provavelmente olhou para outro
 * lugar da sala.
 */
export const PISO_OCIOSIDADE_MS = 20_000;

/** Dwell normalizado a partir do qual o aluno não só viu: considerou (doc 11 §3.4). */
const CONSIDEROU = 2.2;

export interface EventoDeTelemetria {
  tipo: string;
  postId: string | null;
  payload: unknown;
  clientTs: number;
}

export interface MetaDePost {
  lado: string;
  perfil: string;
  intensidade: number;
}

interface Entrada {
  eventos: EventoDeTelemetria[];
  estado: EngineState;
  config: EngineConfig;
  porId: Map<string, MetaDePost>;
  run: { startedAt: Date; finishedAt: Date | null; ladoInicial: string; ladoOrigem: string };
}

const conta = (eventos: EventoDeTelemetria[], tipo: string) =>
  eventos.filter((evento) => evento.tipo === tipo).length;

const campo = (payload: unknown, chave: string): string | null => {
  if (payload === null || typeof payload !== 'object') return null;
  const valor = (payload as Record<string, unknown>)[chave];
  return typeof valor === 'string' ? valor : null;
};

/** doc 11 §3.1 — tempo. */
export function calcularTempo({ eventos, estado, porId, run }: Entrada): TempoDaSessao {
  const fim = run.finishedAt ?? new Date();
  const sessaoMs = Math.max(0, fim.getTime() - run.startedAt.getTime());

  const vistos = eventos.filter((evento) => evento.tipo === 'visto');
  const marcas = eventos.map((evento) => evento.clientTs).sort((a, b) => a - b);
  const inicioDoFeed = vistos.length > 0 ? Math.min(...vistos.map((e) => e.clientTs)) : marcas[0] ?? 0;
  const ultimo = marcas[marcas.length - 1] ?? inicioDoFeed;
  const feedMs = Math.max(0, ultimo - inicioDoFeed);

  /**
   * Vãos ociosos: só entre eventos DEPOIS do primeiro `visto`. O intervalo entre
   * o login e o primeiro post é onboarding, não ociosidade — contá-lo puniria
   * quem leu o cartão de missão com calma.
   */
  const depoisDoInicio = marcas.filter((marca) => marca >= inicioDoFeed);
  let ociosoMs = 0;
  let vaosOciosos = 0;
  for (let i = 1; i < depoisDoInicio.length; i += 1) {
    // `!`: i e i-1 estão sempre dentro do array (noUncheckedIndexedAccess).
    const vao = depoisDoInicio[i]! - depoisDoInicio[i - 1]!;
    if (vao > PISO_OCIOSIDADE_MS) {
      ociosoMs += vao;
      vaosOciosos += 1;
    }
  }

  /**
   * Tempo por lado e por perfil sai de `dwellPorPost` (o acumulado do motor), não
   * da soma crua dos `visto`: revisita do mesmo post soma dwell no mesmo balde,
   * e é assim que o motor conta.
   */
  const porLadoMs = { A: 0, B: 0, neutro: 0 };
  const porPerfilMs: Record<string, number> = Object.fromEntries(PERFIS.map((perfil) => [perfil, 0]));
  for (const [postId, dwellMs] of Object.entries(estado.dwellPorPost)) {
    const meta = porId.get(postId);
    if (!meta) continue;
    if (meta.lado === 'A' || meta.lado === 'B' || meta.lado === 'neutro') porLadoMs[meta.lado] += dwellMs;
    if (meta.perfil in porPerfilMs) porPerfilMs[meta.perfil] = (porPerfilMs[meta.perfil] ?? 0) + dwellMs;
  }

  return {
    sessaoMs,
    feedMs,
    ativoMs: Math.max(0, feedMs - ociosoMs),
    ociosoMs,
    vaosOciosos,
    porLadoMs,
    porPerfilMs,
  };
}

/** doc 11 §3.2 — ritmo. */
export function calcularRitmo(entrada: Entrada, tempo: TempoDaSessao): Ritmo {
  const { eventos, estado } = entrada;
  const minutosAtivos = tempo.ativoMs / 60_000;

  const marcas = eventos
    .filter((evento) => evento.tipo === 'visto')
    .map((evento) => evento.clientTs)
    .sort((a, b) => a - b);

  const intervalos: number[] = [];
  // `!`: i e i-1 estão sempre dentro do array (noUncheckedIndexedAccess).
  for (let i = 1; i < marcas.length; i += 1) intervalos.push(marcas[i]! - marcas[i - 1]!);

  let variacao = 0;
  if (intervalos.length >= 2) {
    const media = intervalos.reduce((soma, valor) => soma + valor, 0) / intervalos.length;
    if (media > 0) {
      const variancia =
        intervalos.reduce((soma, valor) => soma + (valor - media) ** 2, 0) / intervalos.length;
      variacao = Math.sqrt(variancia) / media;
    }
  }

  return {
    postsPorMinuto: minutosAtivos > 0 ? arredondar(estado.postsConsumidos.length / minutosAtivos, 2) : 0,
    variacaoDoRitmo: arredondar(variacao, 2),
  };
}

/**
 * doc 11 §3.3 — índice de imersão.
 *
 * Cinco componentes de 20 pontos, **sempre devolvidos separados**. O total existe
 * para ordenar uma lista de turma, não para ser exibido sozinho: dois alunos com
 * 60 podem ter chegado lá por caminhos opostos, e a conversa do professor com
 * cada um é diferente.
 */
export function calcularImersao(entrada: Entrada, tempo: TempoDaSessao): Imersao {
  const { eventos, estado, porId } = entrada;

  const pontos = (valor: number, teto: number) =>
    teto <= 0 ? 0 : arredondar(Math.min(1, Math.max(0, valor / teto)) * 20, 1);

  // 1. Continuidade — proporção de tempo ativo, com desconto por perda de foco.
  const perdasDeFoco = conta(eventos, 'perdeu_foco');
  const fracaoAtiva = tempo.feedMs > 0 ? tempo.ativoMs / tempo.feedMs : 0;
  const continuidade = Math.max(0, arredondar(pontos(fracaoAtiva, 0.9) - perdasDeFoco * 2, 1));

  // 2. Atenção — quantos posts prenderam pelo menos o dwell de referência dele.
  const baseline = estado.baselineDwellMs ?? 0;
  const dwells = Object.entries(estado.dwellPorPost).filter(([postId]) => porId.has(postId));
  const comAtencao =
    baseline > 0 ? dwells.filter(([, dwellMs]) => dwellMs / baseline >= 1).length : 0;
  const fracaoAtenta = dwells.length > 0 ? comAtencao / dwells.length : 0;

  // 3. Gestos — memória muscular de rede social, o sinal mais difícil de fingir.
  const gestos = conta(eventos, 'duplo_toque') + conta(eventos, 'avancou_story') + conta(eventos, 'rever');

  // 4. Voluntariedade — o que ele fez sem ninguém pedir (regra de ouro 3).
  const voluntarias =
    conta(eventos, 'curtiu') +
    conta(eventos, 'salvou') +
    conta(eventos, 'seguiu') +
    conta(eventos, 'comentou') +
    conta(eventos, 'compartilhou') +
    conta(eventos, 'publicou');

  // 5. Exploração — superfícies distintas visitadas.
  const superficies = new Set<string>();
  if (conta(eventos, 'abriu_busca') > 0) superficies.add('busca');
  if (conta(eventos, 'abriu_story') > 0) superficies.add('stories');
  if (conta(eventos, 'abriu_perfil') > 0) superficies.add('perfis');
  if (eventos.some((evento) => evento.tipo === 'trocou_aba' && campo(evento.payload, 'aba') === 'notificacoes'))
    superficies.add('notificacoes');
  if (conta(eventos, 'publicou') > 0 || conta(eventos, 'comentou') > 0) superficies.add('compositor');

  const componentes: ComponenteDeImersao[] = [
    {
      chave: 'continuidade',
      rotulo: 'Continuidade',
      pontos: continuidade,
      detalhe: `${Math.round(fracaoAtiva * 100)}% do tempo sem pausa longa · ${perdasDeFoco} saída(s) de tela`,
    },
    {
      chave: 'atencao',
      rotulo: 'Atenção',
      pontos: pontos(fracaoAtenta, 0.7),
      /**
       * Sem "você": o mesmo texto aparece no relatório do aluno E no popup do
       * professor. Escrito em 2ª pessoa, ele dizia "prenderam você" na tela de
       * quem estava lendo sobre outra pessoa.
       */
      detalhe: `${comAtencao} de ${dwells.length} posts acima do ritmo próprio`,
    },
    {
      chave: 'gestos',
      rotulo: 'Gestos',
      pontos: pontos(gestos, 8),
      detalhe: `${gestos} gesto(s) de rede social (duplo toque, story, rever)`,
    },
    {
      chave: 'voluntariedade',
      rotulo: 'Voluntariedade',
      pontos: pontos(voluntarias, 10),
      detalhe: `${voluntarias} ação(ões) que ninguém pediu`,
    },
    {
      chave: 'exploracao',
      rotulo: 'Exploração',
      pontos: pontos(superficies.size, 5),
      detalhe: `${superficies.size} de 5 cantos do app visitados`,
    },
  ];

  return {
    total: arredondar(
      componentes.reduce((soma, componente) => soma + componente.pontos, 0),
      1,
    ),
    componentes,
  };
}

/** doc 11 §3.4 — investigação. */
export function calcularInvestigacao(entrada: Entrada): Investigacao {
  const { eventos, estado, porId, run } = entrada;

  const segundosDe = (lado: 'A' | 'B') =>
    arredondar(
      Object.entries(estado.dwellPorPost)
        .filter(([postId]) => porId.get(postId)?.lado === lado)
        .reduce((soma, [, dwellMs]) => soma + dwellMs, 0) / 1000,
      1,
    );

  const postosDe = (lado: 'A' | 'B') =>
    estado.servedPostIds.filter((id) => porId.get(id)?.lado === lado).length;

  /**
   * Considerar ≠ ver. Um aluno pode receber 14 posts do outro lado e rolar reto
   * por todos; outro para 8 segundos em três deles. Só o segundo investigou — e é
   * esse número que sustenta a seção "a saída que existia" do relatório.
   */
  const oposto = run.ladoInicial === 'A' ? 'B' : 'A';
  const baseline = estado.baselineDwellMs ?? 0;
  const consideracaoDoOposto =
    baseline > 0
      ? Object.entries(estado.dwellPorPost).filter(
          ([postId, dwellMs]) => porId.get(postId)?.lado === oposto && dwellMs / baseline >= CONSIDEROU,
        ).length
      : 0;

  return {
    usosDaBusca: conta(eventos, 'abriu_busca'),
    termosBuscados: eventos
      .filter((evento) => evento.tipo === 'buscou')
      .map((evento) => campo(evento.payload, 'termo'))
      .filter((termo): termo is string => Boolean(termo)),
    postsPelaBusca: conta(eventos, 'abriu_da_busca'),
    comentariosLidos: conta(eventos, 'abriu_comentarios'),
    revisitas: conta(eventos, 'rever'),
    perdasDeFoco: conta(eventos, 'perdeu_foco'),
    coberturaDosLados: {
      A: { posts: postosDe('A'), segundos: segundosDe('A') },
      B: { posts: postosDe('B'), segundos: segundosDe('B') },
    },
    consideracaoDoOposto,
  };
}

/**
 * doc 11 §3.5 — bolha: o lado semeado, o final, e onde virou.
 *
 * `blocoDaInversao` é lido do **acumulado** de posts servidos por lado, não da
 * maioria de cada bloco isolado. Duas razões:
 *
 * 1. O domínio do motor é cumulativo (score sobre score), então o acumulado é o
 *    que de fato "trocou de lado" — não existe histórico de domínio gravado.
 * 2. Blocos têm tamanhos diferentes. O último costuma ter 2 posts, e um bloco-cauda
 *    do lado semeado zerava a inversão de uma sessão que virou no bloco 3. Foi
 *    exatamente isso que a validação de duas sessões opostas pegou.
 *
 * `blocos` traz CONTAGEM de posts por lado (não proporção): somar proporções de
 * blocos de tamanhos diferentes daria peso maior ao bloco menor.
 */
export function calcularBolha(
  entrada: Entrada,
  ladoDominanteFinal: 'A' | 'B' | 'indefinido',
  blocos: { bloco: number; A: number; B: number }[],
): Bolha {
  const ladoInicial = entrada.run.ladoInicial === 'B' ? 'B' : 'A';
  const inverteu = ladoDominanteFinal !== 'indefinido' && ladoDominanteFinal !== ladoInicial;

  let blocoDaInversao: number | null = null;
  if (inverteu) {
    let acumuladoA = 0;
    let acumuladoB = 0;
    const liderancas = blocos.map((bloco) => {
      acumuladoA += bloco.A;
      acumuladoB += bloco.B;
      return {
        bloco: bloco.bloco,
        lider: acumuladoA === acumuladoB ? null : acumuladoA > acumuladoB ? 'A' : 'B',
      };
    });

    // `!`: i está sempre dentro do array (noUncheckedIndexedAccess).
    for (let i = 0; i < liderancas.length; i += 1) {
      if (liderancas[i]!.lider !== ladoDominanteFinal) continue;
      // Só conta como virada se a liderança não voltar para o lado semeado depois.
      if (liderancas.slice(i).every((passo) => passo.lider !== ladoInicial)) {
        blocoDaInversao = liderancas[i]!.bloco;
        break;
      }
    }
  }

  return {
    ladoInicial,
    ladoOrigem: entrada.run.ladoOrigem,
    inverteu,
    blocoDaInversao,
  };
}

/**
 * doc 11 §3.6 e doc 04 §7 — perfil observado, **normalizado pela exposição**.
 *
 * A normalização não é preciosismo estatístico: o feed serve mais conteúdo do
 * perfil que o jogo apontou, então o aluno naturalmente para mais nele. Sem
 * dividir pela exposição, o relatório "confirmaria" o perfil do jogo sempre — uma
 * profecia autorrealizável escrita com dados reais, que é o pior tipo de mentira.
 */
export function calcularPerfilObservado(
  entrada: Entrada,
  perfilDoJogo: Perfil | 'misto' | null,
): PerfilObservado {
  const { estado, porId } = entrada;

  const somaDwell: Record<string, number> = Object.fromEntries(PERFIS.map((perfil) => [perfil, 0]));
  for (const [postId, dwellMs] of Object.entries(estado.dwellPorPost)) {
    const meta = porId.get(postId);
    if (meta && meta.perfil in somaDwell) somaDwell[meta.perfil] = (somaDwell[meta.perfil] ?? 0) + dwellMs;
  }

  const exposicao = estado.exposicaoPorPerfil ?? {};
  const medias = PERFIS.map((perfil) => {
    const servidos = exposicao[perfil] ?? 0;
    return { perfil, media: servidos > 0 ? (somaDwell[perfil] ?? 0) / servidos : 0 };
  });

  const somaDasMedias = medias.reduce((soma, item) => soma + item.media, 0);
  const normalizado = Object.fromEntries(
    medias.map((item) => [item.perfil, somaDasMedias > 0 ? arredondar(item.media / somaDasMedias, 3) : 0]),
  ) as Record<Perfil, number>;

  // `!`: `medias` tem sempre 4 itens — um por perfil (noUncheckedIndexedAccess).
  const ordenados = [...medias].sort((a, b) => b.media - a.media);
  const margem =
    somaDasMedias > 0
      ? normalizado[ordenados[0]!.perfil as Perfil] - normalizado[ordenados[1]!.perfil as Perfil]
      : 0;
  const dominante = somaDasMedias > 0 && margem >= MARGEM_DE_EMPATE ? (ordenados[0]!.perfil as Perfil) : null;

  const veredito: PerfilObservado['veredito'] =
    perfilDoJogo === null || perfilDoJogo === 'misto' || dominante === null
      ? 'sem_referencia'
      : dominante === perfilDoJogo
        ? 'reforcou'
        : 'divergiu';

  return { normalizado, dominante, margem: arredondar(margem, 3), veredito };
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}
