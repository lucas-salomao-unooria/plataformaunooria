import { z } from 'zod';

/**
 * Cópia MÍNIMA de tipos/constantes puros de `lib/insta/*` do projeto origem,
 * feita no porte da tela da atividade do professor. Nada aqui toca banco, IA
 * ou servidor — é o vocabulário compartilhado que os painéis client precisam.
 *
 * Origem de cada bloco:
 * - `lib/insta/defaults.ts`  → PERFIS / Perfil
 * - `lib/insta/tipos.ts`     → schemas do antagonismo + ProgressoGeracao
 * - `lib/insta/perfis.ts`    → FICHAS (fichas dos 4 perfis de Schwartz)
 * - `lib/insta/etapas.ts`    → etapas da turma + CONTROLE_DO_PROFESSOR
 * - `lib/insta/avatar.ts`    → avatarProcedural / formatarContagem (funções
 *   puras, sem dependência — vieram junto porque o cartão de post as usa)
 */

/* ------------------------------------------------------------------ */
/* lib/insta/defaults.ts                                              */
/* ------------------------------------------------------------------ */

/**
 * Os 4 perfis de valores de Schwartz (doc 10). Ordem fixa: é ela que define o
 * rodízio do bloco inicial e a leitura da matriz no painel do professor.
 */
export const PERFIS = ['abertura', 'autotranscendencia', 'autopromocao', 'conservacao'] as const;

export type Perfil = (typeof PERFIS)[number];

/* ------------------------------------------------------------------ */
/* lib/insta/tipos.ts                                                 */
/* ------------------------------------------------------------------ */

/** Lado da tese: só A ou B (o neutro não entra na afinidade). */
export const ladoTeseSchema = z.enum(['A', 'B']);

export const ladoAntagonismoSchema = z.object({
  label: z.string().trim().min(2).max(60),
  tese: z.string().trim().min(10).max(600),
  argumentos: z.array(z.string().trim().min(2).max(200)).min(2).max(8),
  tom_tipico: z.string().trim().min(3).max(300),
});

export const equilibrioSchema = z.object({
  ok: z.boolean(),
  nota: z.number().min(0).max(1),
  aviso: z.string().trim().max(600).nullable(),
});

/**
 * Candidata a pergunta-chave proposta pela IA (doc 05 §1, passo 2). O professor
 * não escreve mais a pergunta: escolhe entre estas, edita ou digita a sua.
 */
export const perguntaCandidataSchema = z.object({
  pergunta: z.string().trim().min(10).max(280),
  equilibrio: equilibrioSchema,
  /** Por que esta pergunta sustenta dois lados — texto para o professor decidir. */
  por_que: z.string().trim().min(5).max(400),
});

export type PerguntaCandidata = z.infer<typeof perguntaCandidataSchema>;

/**
 * Afinidade perfil → lado, por EIXO bipolar (doc 10 §5.2). A IA decide só a
 * orientação de cada eixo; o perfil oposto recebe o outro lado por construção.
 *
 * Isso garante **2 perfis por lado** estruturalmente. Se a IA escolhesse um lado
 * para cada um dos 4 perfis, ela poderia mandar 3 ou 4 para o mesmo lado e a
 * turma nasceria toda numa bolha só por acidente de redação do modelo.
 */
export const afinidadeSchema = z.object({
  /** Lado que a Abertura à Mudança prefere; Conservação fica com o outro. */
  abertura: ladoTeseSchema,
  /** Lado que a Autopromoção prefere; Autotranscendência fica com o outro. */
  autopromocao: ladoTeseSchema,
  /** Justificativa de cada eixo, para o professor decidir e para o relatório. */
  por_que_abertura: z.string().trim().min(10).max(400),
  por_que_autopromocao: z.string().trim().min(10).max(400),
  /**
   * Justificativa do POLO OPOSTO de cada eixo. Opcionais porque atividades
   * geradas antes do M8 não as têm — mas sem elas o relatório de um aluno de
   * Conservação teria de explicar o lado dele com a frase da Abertura, que
   * defende o lado CONTRÁRIO. Quando faltam, a frase simplesmente não aparece:
   * melhor uma explicação mais curta que uma explicação incoerente.
   */
  por_que_conservacao: z.string().trim().min(10).max(400).optional(),
  por_que_autotranscendencia: z.string().trim().min(10).max(400).optional(),
});

export type Afinidade = z.infer<typeof afinidadeSchema>;

export const antagonismoSchema = z.object({
  /**
   * Candidatas geradas nesta chamada. Quando o professor manda uma pergunta
   * pronta, vem uma só — a dele.
   */
  perguntas_candidatas: z.array(perguntaCandidataSchema).min(1).max(3),
  /** Índice da candidata destilada em ladoA/ladoB. */
  escolhida: z.number().int().min(0).max(2).default(0),
  /**
   * Equilíbrio da candidata escolhida, no topo. Fica duplicado de propósito: é
   * o campo que as guardas de aprovação e ativação leem (doc 07), e mantê-lo
   * aqui evita que cada consumidor tenha que resolver o índice.
   */
  equilibrio: equilibrioSchema,
  ladoA: ladoAntagonismoSchema,
  ladoB: ladoAntagonismoSchema,
  /** Mapa perfil → lado, por eixo (doc 10 §5.2). */
  afinidade: afinidadeSchema,
  categorias_neutras_sugeridas: z.array(z.string().trim().min(2).max(40)).min(3).max(10),
  /** Rótulos de neutro DENTRO do tema: fato, cronologia, fontes (doc 05 §1). */
  neutros_no_tema_sugeridos: z.array(z.string().trim().min(2).max(60)).max(8).default([]),
  reformulacoes_sugeridas: z.array(z.string().trim().min(5).max(300)).max(5).default([]),
});

export type Antagonismo = z.infer<typeof antagonismoSchema>;
export type LadoAntagonismo = z.infer<typeof ladoAntagonismoSchema>;

/** Progresso reportado ao painel (doc 07). */
export interface ProgressoGeracao {
  etapa: 'personas' | 'posts' | 'imagens' | 'validacao' | 'concluido';
  feitos: number;
  total: number;
  erros: string[];
  status: string;
  postsCriados: number;
  imagensOk: number;
  imagensFallback: number;
  imagensPendentes: number;
}

/* ------------------------------------------------------------------ */
/* lib/insta/perfis.ts                                                */
/* ------------------------------------------------------------------ */

/**
 * Fichas operacionais dos 4 perfis de valores de Schwartz (doc 10 §3).
 *
 * Esta é a tradução da teoria em instrução de escrita: o que muda entre perfis é
 * **linguagem, ênfase e gancho — nunca o fato** (guardrail 3 do doc 05). São
 * quatro maneiras de contar a mesma coisa, e é exatamente o que uma plataforma
 * real faz com cada pessoa.
 */
export interface FichaDePerfil {
  /** Nome de exibição no painel do professor e no dossiê. */
  rotulo: string;
  /** Valores de Schwartz que o perfil agrega. */
  valores: string;
  /** O que prende a atenção de quem se move por esse valor. */
  prende: string;
  /** Vocabulário e bordões típicos. */
  vocabulario: string[];
  /** Forma narrativa que funciona. */
  narrativa: string;
  /** Ganchos emocionais permitidos (entram em `emotional_hook`). */
  ganchos: string[];
  /** Perfil oposto no círculo — conteúdo dele deve prender MENOS (doc 10 §3.5). */
  oposto: Perfil;
}

export const FICHAS: Record<Perfil, FichaDePerfil> = {
  abertura: {
    rotulo: 'Abertura à Mudança',
    valores: 'autodireção (pensar e escolher por conta própria) e estímulo (novidade, desafio)',
    prende:
      'descoberta, versão que ninguém contou, quebra de rotina, liberdade de tirar a própria conclusão',
    vocabulario: ['poucos sabem', 'e se', 'ninguém te contou', 'descobri', 'repensar', 'vira o jogo'],
    narrativa:
      'revelar um detalhe pouco conhecido que reabre a interpretação; convidar a duvidar da versão pronta',
    ganchos: ['curiosidade', 'misterio'],
    oposto: 'conservacao',
  },
  autotranscendencia: {
    rotulo: 'Autotranscendência',
    valores: 'universalismo (justiça, igualdade) e benevolência (cuidado com quem está perto)',
    prende: 'quem foi prejudicado, quem pagou a conta, cuidado, empatia, bem coletivo',
    vocabulario: [
      'quem sofreu com isso',
      'por trás disso tem gente',
      'justo',
      'ninguém fala de',
      'o preço que alguém pagou',
    ],
    narrativa:
      'deslocar o foco do feito para o efeito sobre pessoas e lugares; dar nome e rosto a quem ficou de fora da história oficial',
    ganchos: ['indignacao', 'pertencimento'],
    oposto: 'autopromocao',
  },
  autopromocao: {
    rotulo: 'Autopromoção',
    valores: 'realização (competência, sucesso) e poder (status, influência)',
    prende: 'mérito, competição, feito difícil, força, números que impressionam, quem venceu e por quê',
    vocabulario: [
      'recorde',
      'primeiro do mundo',
      'conseguiu o que ninguém',
      'estratégia',
      'dominou',
      'os números não mentem',
    ],
    narrativa: 'disputa com vencedor claro; a escala do feito ou da falha, medida em números',
    ganchos: ['admiracao', 'humor'],
    oposto: 'autotranscendencia',
  },
  conservacao: {
    rotulo: 'Conservação',
    valores: 'segurança (ordem, estabilidade), conformidade (respeito a regras) e tradição',
    prende: 'risco, ordem, autoridade reconhecida, herança, consequência de mexer no que funciona',
    vocabulario: [
      'sempre se soube',
      'os especialistas dizem',
      'consequência',
      'não é seguro',
      'foi construído com esforço',
      'cuidado com',
    ],
    narrativa: 'alerta apoiado em autoridade ou em precedente; defesa do que já está estabelecido',
    ganchos: ['cautela', 'pertencimento'],
    oposto: 'abertura',
  },
};

/* ------------------------------------------------------------------ */
/* lib/insta/etapas.ts                                                */
/* ------------------------------------------------------------------ */

/** Etapas da turma, na ordem em que o professor as abre. */
export const ETAPAS_DA_TURMA = [
  'investigacao',
  'conclusao',
  'debate',
  'explicabilidade',
  'perdidos',
  'reflexao',
  'fim',
] as const;

export type EtapaDaTurma = (typeof ETAPAS_DA_TURMA)[number];

/**
 * O controle do professor. `nome` é o substantivo do momento (vai no stepper);
 * `rotulo` é o VERBO da ação que leva até ele (vai no botão).
 *
 * A separação não é preciosismo: com o mesmo texto nos dois, o rótulo do passo e
 * o do botão colidiam — inclusive para leitor de tela, porque o `Stepper` do DS
 * renderiza cada passo como `<button>` mesmo quando não é clicável.
 */
export const CONTROLE_DO_PROFESSOR: {
  etapa: EtapaDaTurma;
  nome: string;
  rotulo: string;
  descricao: string;
}[] = [
  {
    etapa: 'investigacao',
    nome: 'Investigação',
    rotulo: 'Começar investigação',
    descricao: 'A turma explora o feed e salva os posts que vão ajudar a responder.',
  },
  {
    etapa: 'conclusao',
    nome: 'Resposta',
    rotulo: 'Encerrar investigação',
    descricao: 'Fecha o feed e pede a resposta: cada aluno escolhe um dos três lados.',
  },
  {
    etapa: 'debate',
    nome: 'Debate',
    rotulo: 'Iniciar debate',
    descricao: 'Trava as telas nos posts que cada um salvou. A conversa é entre pares.',
  },
  {
    etapa: 'explicabilidade',
    nome: 'Explicação',
    rotulo: 'Encerrar debate',
    descricao: 'Libera a explicação de como o feed de cada um foi montado.',
  },
  {
    etapa: 'perdidos',
    nome: 'O que perderam',
    rotulo: 'Mostrar o que perderam',
    descricao: 'O feed do outro lado, em cinza: o que o algoritmo escondeu de cada um.',
  },
  {
    etapa: 'reflexao',
    nome: 'Reflexão',
    rotulo: 'Abrir reflexão',
    descricao: 'Fecha a atividade com a escrita livre sobre o que eles entenderam.',
  },
  { etapa: 'fim', nome: 'Fim', rotulo: 'Encerrar atividade', descricao: 'Fim da missão.' },
];

/* ------------------------------------------------------------------ */
/* lib/insta/avatar.ts                                                */
/* ------------------------------------------------------------------ */

/**
 * Avatares procedurais consistentes por handle (doc 03 §8): iniciais sobre
 * gradiente, sempre o mesmo par cor/handle. Sem 'server-only' — o cliente
 * também desenha.
 */

const PARES = [
  ['#FF8A80', '#FF5C6E'],
  ['#82B1FF', '#5C6BC0'],
  ['#B9F6CA', '#26A69A'],
  ['#FFE082', '#FFA726'],
  ['#CE93D8', '#7B4DFF'],
  ['#80DEEA', '#0097A7'],
  ['#F48FB1', '#EC407A'],
  ['#C5E1A5', '#7CB342'],
] as const;

function hash(texto: string): number {
  let valor = 0;
  for (let i = 0; i < texto.length; i += 1) {
    valor = (valor * 33 + texto.charCodeAt(i)) % 2147483647;
  }
  return valor;
}

export interface AvatarProcedural {
  gradiente: string;
  iniciais: string;
}

export function avatarProcedural(handle: string): AvatarProcedural {
  const limpo = handle.replace(/^@/, '');
  // `!`: o módulo garante índice dentro de PARES (noUncheckedIndexedAccess).
  const [de, para] = PARES[hash(limpo) % PARES.length]!;

  const partes = limpo.split(/[._-]/).filter(Boolean);
  const iniciais = (
    partes.length > 1 ? partes[0]!.charAt(0) + partes[1]!.charAt(0) : limpo.slice(0, 2)
  ).toUpperCase();

  return { gradiente: `linear-gradient(135deg, ${de} 0%, ${para} 100%)`, iniciais };
}

/** Números no formato pt-BR do feed: 1.234 · 12,4 mil (doc 03 §8). */
export function formatarContagem(valor: number): string {
  if (valor < 1000) return String(valor);
  if (valor < 10000) return valor.toLocaleString('pt-BR');
  const mil = valor / 1000;
  const arredondado = mil >= 100 ? Math.round(mil) : Math.round(mil * 10) / 10;
  return `${arredondado.toLocaleString('pt-BR')} mil`;
}
