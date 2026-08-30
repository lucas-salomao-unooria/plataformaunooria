import { z } from 'zod';
import { PERFIS, type Perfil } from './defaults';

/**
 * Shapes do doc 05 (destilação do antagonismo) e do doc 06 (posts gerados),
 * com validação zod usada tanto na saída do Gemini quanto nas API routes.
 */

export const ladoSchema = z.enum(['A', 'B', 'neutro']);
export type Lado = z.infer<typeof ladoSchema>;

export const intensidadeSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Intensidade = z.infer<typeof intensidadeSchema>;

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
   * geradas antes do M8 não as têm — mas sem elas o relatório de um estudante de
   * Conservação teria de explicar o lado dele com a frase da Abertura, que
   * defende o lado CONTRÁRIO. Quando faltam, a frase simplesmente não aparece:
   * melhor uma explicação mais curta que uma explicação incoerente.
   */
  por_que_conservacao: z.string().trim().min(10).max(400).optional(),
  por_que_autotranscendencia: z.string().trim().min(10).max(400).optional(),
});

export type Afinidade = z.infer<typeof afinidadeSchema>;

/**
 * Resolve os 4 perfis a partir dos 2 eixos. Função pura e testada: é ela que
 * decide em que lado cada estudante da turma começa.
 */
export function ladoPorPerfil(afinidade: Afinidade): Record<Perfil, 'A' | 'B'> {
  const oposto = (lado: 'A' | 'B') => (lado === 'A' ? 'B' : 'A');
  return {
    abertura: afinidade.abertura,
    conservacao: oposto(afinidade.abertura),
    autopromocao: afinidade.autopromocao,
    autotranscendencia: oposto(afinidade.autopromocao),
  };
}

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

export const personaSchema = z.object({
  handle: z
    .string()
    .trim()
    .regex(/^@[a-z0-9._]{3,28}$/, 'handle precisa ser @minusculas.sem.espaco'),
  display_name: z.string().trim().min(2).max(40),
  tipo: z.enum(['pagina_tema', 'fofoca_tema', 'checagem', 'humor', 'vida_escolar']),
  lado: ladoSchema,
  /** Perfil de Schwartz cuja linguagem esta persona fala melhor (doc 10 §3). */
  perfil_afim: z.enum(PERFIS),
  bio: z.string().trim().max(160),
  voz: z.string().trim().min(5).max(300),
});

export type Persona = z.infer<typeof personaSchema>;

export const comentarioGeradoSchema = z.object({
  handle: z.string().trim().max(40).optional(),
  texto: z.string().trim().min(2).max(220),
});

export const postGeradoSchema = z.object({
  author_handle: z.string().trim().min(2).max(40),
  caption: z.string().trim().min(10).max(400),
  hashtags: z.array(z.string().trim().min(2).max(40)).min(1).max(5),
  image_brief: z.string().trim().min(10).max(400),
  comments: z.array(comentarioGeradoSchema).min(3).max(6),
  emotional_hook: z.enum(['indignacao', 'humor', 'misterio', 'pertencimento', 'curiosidade']),
});

export type PostGerado = z.infer<typeof postGeradoSchema>;

/** Especificação de um lote pedido ao Gemini (o servidor decide o mix). */
export interface LoteSpec {
  lado: Lado;
  /**
   * Perfil de Schwartz (doc 10). Um lote **nunca mistura perfis**: o prompt
   * precisa de uma ficha de linguagem por vez, e é isso que faz o mesmo
   * argumento sair escrito de quatro maneiras.
   */
  perfil: Perfil;
  intensidade: Intensidade;
  categoria: string;
  /**
   * Só para neutro DENTRO do tema: o recorte sem lado a abordar (cronologia,
   * fontes, instrumentos). A categoria nesse caso é sempre `'tema'`.
   */
  recorteNeutro?: string;
  quantidade: number;
}

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
