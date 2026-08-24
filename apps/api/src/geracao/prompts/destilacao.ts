import type { AiJsonSchema, AiProvider } from '../../ai/provider';
import { PUBLICO_ALVO } from '../../comum/insta/defaults';
import { antagonismoSchema, type Antagonismo } from '../../comum/insta/tipos';

import { GUARDRAILS } from './guardrails';

/**
 * Porte de `lib/gemini/destilacao.ts`. Diferenças para o origem: o provider
 * chega por parâmetro e o schema virou o `AiJsonSchema` neutro — sem
 * `propertyOrdering`, sem `Type.INTEGER` (vira "number") e sem
 * `nullable: true` no aviso (o schema neutro não o expressa; o zod aceita
 * null/"" e `normalizarAntagonismo` preenche o aviso quando falta).
 */

function equilibrioSchema(): AiJsonSchema {
  return {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      nota: { type: 'number' },
      aviso: { type: 'string' },
    },
    required: ['ok', 'nota', 'aviso'],
  };
}

const RESPONSE_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    perguntas_candidatas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pergunta: { type: 'string' },
          equilibrio: equilibrioSchema(),
          por_que: { type: 'string' },
        },
        required: ['pergunta', 'equilibrio', 'por_que'],
      },
    },
    escolhida: { type: 'number' },
    equilibrio: equilibrioSchema(),
    ladoA: ladoSchema(),
    ladoB: ladoSchema(),
    afinidade: {
      type: 'object',
      properties: {
        abertura: { type: 'string', enum: ['A', 'B'] },
        autopromocao: { type: 'string', enum: ['A', 'B'] },
        por_que_abertura: { type: 'string' },
        por_que_conservacao: { type: 'string' },
        por_que_autopromocao: { type: 'string' },
        por_que_autotranscendencia: { type: 'string' },
      },
      required: [
        'abertura',
        'autopromocao',
        'por_que_abertura',
        'por_que_conservacao',
        'por_que_autopromocao',
        'por_que_autotranscendencia',
      ],
    },
    categorias_neutras_sugeridas: { type: 'array', items: { type: 'string' } },
    neutros_no_tema_sugeridos: { type: 'array', items: { type: 'string' } },
    reformulacoes_sugeridas: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'perguntas_candidatas',
    'escolhida',
    'equilibrio',
    'ladoA',
    'ladoB',
    'afinidade',
    'categorias_neutras_sugeridas',
    'neutros_no_tema_sugeridos',
    'reformulacoes_sugeridas',
  ],
};

function ladoSchema(): AiJsonSchema {
  return {
    type: 'object',
    properties: {
      label: { type: 'string' },
      tese: { type: 'string' },
      argumentos: { type: 'array', items: { type: 'string' } },
      tom_tipico: { type: 'string' },
    },
    required: ['label', 'tese', 'argumentos', 'tom_tipico'],
  };
}

export interface EntradaDestilacao {
  /**
   * Quando ausente, a IA **gera** de 2 a 3 candidatas a partir do tema e
   * destila a melhor (doc 05 §1). Quando presente, é a pergunta do professor —
   * ele editou ou escreveu a sua — e a IA só destila essa.
   */
  perguntaChave?: string | null;
  disciplina: string;
  recorte: string;
  temaGeral: string;
  contextoAula?: string | null;
}

/**
 * Passo 2 do doc 05: a IA **gera** a pergunta-chave a partir do tema e destila os
 * dois lados do antagonismo.
 *
 * Por que a IA gera: com uma turma inteira e perfis diferentes, exigir que o
 * professor formule de cabeça uma pergunta com dois lados igualmente defensáveis
 * era o gargalo do fluxo. Ele continua com a palavra final — escolhe, edita ou
 * escreve a sua —, mas parte de candidatas já avaliadas.
 */
export async function destilarAntagonismo(
  provider: AiProvider,
  entrada: EntradaDestilacao,
): Promise<Antagonismo> {
  const perguntaDoProfessor = entrada.perguntaChave?.trim();

  const tarefaDaPergunta = perguntaDoProfessor
    ? `1) A pergunta-chave está DEFINIDA pelo professor:
   "${perguntaDoProfessor}"
   Devolva "perguntas_candidatas" com um único item, exatamente essa pergunta,
   com o equilíbrio dela avaliado, e "escolhida" = 0.
   NÃO reescreva a pergunta do professor — nem para melhorar.`
    : `1) PROPONHA de 2 a 3 candidatas a pergunta-chave para o debate final, a
   partir do tema e do recorte. Cada candidata precisa:
   - ter dois lados genuinamente defensáveis, com fatos reais do conteúdo
     sustentando cada um;
   - caber numa frase que um aluno de ${PUBLICO_ALVO.idade} anos entenda de
     primeira;
   - ser uma disputa de INTERPRETAÇÃO, não de fato ("foi planejado ou por
     acaso?", não "em que ano aconteceu?");
   - NÃO ter resposta moralmente unívoca (nada de "escravidão foi boa ou ruim").
   Em "por_que", explique em uma frase, para o professor, por que aquela pergunta
   sustenta as duas leituras.
   Em "escolhida", indique o índice da melhor candidata (maior nota de
   equilíbrio) — é a que você vai destilar.`;

  const prompt = `
Você prepara material para uma dinâmica de debate com estudantes de ${PUBLICO_ALVO.idade} anos.

DISCIPLINA: ${entrada.disciplina}
TEMA: ${entrada.temaGeral}
RECORTE: ${entrada.recorte}
${entrada.contextoAula ? `JÁ TRABALHADO EM AULA: ${entrada.contextoAula}` : ''}

TAREFA
${tarefaDaPergunta}

2) Para CADA candidata, avalie o EQUILÍBRIO:
   - nota: 0 a 1 (1 = perfeitamente disputável; 0 = resposta óbvia, consensual
     ou moralmente unívoca).
   - ok = true somente se nota >= 0.6 E existirem dois lados defensáveis.
   - Quando a candidata ESCOLHIDA tiver ok = false, escreva em "aviso" (no
     equilíbrio do topo, linguagem direta para quem vai conduzir o debate) por
     que a bolha não se formaria, e proponha de 2 a 3
     "reformulacoes_sugeridas": versões da pergunta que criam disputa real.
   - Quando ok = true, "aviso" deve ser null e "reformulacoes_sugeridas" vazio.
   Copie o equilíbrio da candidata escolhida para o campo "equilibrio" do topo.

3) Destile os dois lados do antagonismo DA CANDIDATA ESCOLHIDA (ladoA e ladoB):
   - label: rótulo curto (2 a 4 palavras) que resume a interpretação;
   - tese: uma frase densa com a leitura do lado;
   - argumentos: 4 a 6 apoios concretos (fatos, episódios, dados, evidências
     reais do conteúdo da disciplina);
   - tom_tipico: como esse lado fala — emoção dominante e bordões típicos.
   Os dois lados devem ter força argumentativa parecida. Nenhum lado pode ser
   caricatura ou espantalho do outro.

4) AFINIDADE POR EIXO — qual perfil de valores prefere qual lado.

   O framework de Schwartz tem dois eixos BIPOLARES. Você decide a orientação de
   cada eixo em relação a A/B; o polo oposto recebe automaticamente o outro lado.

   EIXO 1 — Abertura à Mudança ↔ Conservação
   - Abertura: busca o novo, duvida da versão pronta, quer descobrir por si.
   - Conservação: respeita o que foi construído, confia na autoridade e no
     documento, evita risco.
   Em "abertura", responda "A" ou "B": qual dos dois lados fala a língua de quem
   busca o novo? Em "por_que_abertura", explique em uma frase por que ESSE lado
   fala a língua da Abertura. Em "por_que_conservacao", explique por que o OUTRO
   lado fala a língua da Conservação — é uma frase diferente, não a negação da
   primeira.

   EIXO 2 — Autopromoção ↔ Autotranscendência
   - Autopromoção: mérito, competência, competição, feito, números.
   - Autotranscendência: justiça, cuidado, quem foi prejudicado, coletivo.
   Em "autopromocao", responda "A" ou "B": qual lado fala a língua do mérito e da
   estratégia? Em "por_que_autopromocao", explique em uma frase por que ESSE lado
   fala essa língua. Em "por_que_autotranscendencia", explique por que o OUTRO
   lado fala a língua da justiça e do cuidado.

   REGRAS DURAS:
   - Julgue pela LINGUAGEM e pelo enquadramento de cada lado, não por juízo moral
     sobre eles. Os dois lados são defensáveis.
   - As justificativas serão MOSTRADAS ao aluno de 13 anos no relatório final:
     escreva em português simples, sem jargão de psicologia. Cada aluno lê a
     justificativa DO PERFIL DELE, então as quatro precisam funcionar sozinhas.
   - Complete a frase "o lado que fala essa língua é X porque…": a justificativa
     tem de explicar o lado, não descrever o perfil.
   - Não escreva nada que sugira que um perfil é melhor que outro.

5) Sugira de 5 a 7 "categorias_neutras_sugeridas": assuntos leves e FORA da
   disputa, do universo de quem tem ${PUBLICO_ALVO.idade} anos, para compor o
   material neutro (ex.: memes de escola, animais, esportes, comida, música).

6) Sugira de 3 a 5 "neutros_no_tema_sugeridos": recortes DENTRO do tema que
   informam SEM defender nenhum dos dois lados — cronologia, fontes primárias,
   "como se sabe isso", instrumentos e métodos da época. São o material que
   apresenta fato sem tomar partido.

${GUARDRAILS}

Responda apenas o JSON do schema. Português do Brasil.
`.trim();

  return provider.generateJson({
    prompt,
    responseSchema: RESPONSE_SCHEMA,
    temperatura: 0.7,
    validar: (bruto) => normalizarAntagonismo(antagonismoSchema.parse(bruto), perguntaDoProfessor),
  });
}

/**
 * Normaliza o que o modelo devolveu. Pura e exportada de propósito: é a regra
 * que decide qual pergunta vale, e regra que decide coisa assim merece teste
 * sem depender de uma chamada de rede.
 *
 * Três correções:
 * 1. **A nota manda no `ok`.** O modelo às vezes diz `ok: true` com nota 0.3.
 * 2. **`escolhida` é limitada ao array.** Um índice fora da faixa deixaria a
 *    pergunta e a destilação apontando para nada.
 * 3. **A pergunta do professor é soberana.** Se ele mandou uma, ela prevalece
 *    sobre qualquer redação que o modelo tenha devolvido — inclusive "melhorada".
 */
export function normalizarAntagonismo(
  dados: Antagonismo,
  perguntaDoProfessor?: string | null,
): Antagonismo {
  const normalizarEquilibrio = (equilibrio: Antagonismo['equilibrio']) => {
    const ok = equilibrio.nota >= 0.6 && equilibrio.ok;
    return {
      ...equilibrio,
      ok,
      aviso: ok
        ? null
        : (equilibrio.aviso ?? 'A pergunta não sustenta dois lados defensáveis.'),
    };
  };

  const candidatas = dados.perguntas_candidatas.map((candidata) => ({
    ...candidata,
    equilibrio: normalizarEquilibrio(candidata.equilibrio),
  }));

  const escolhidaBruta = Math.max(0, Math.min(dados.escolhida, candidatas.length - 1));
  const pergunta = perguntaDoProfessor?.trim();

  // `!`: `escolhidaBruta` foi limitada a [0, length-1] e o zod garante min(1).
  const finais = pergunta
    ? [{ ...candidatas[escolhidaBruta]!, pergunta }]
    : candidatas;
  const escolhida = pergunta ? 0 : escolhidaBruta;

  return {
    ...dados,
    perguntas_candidatas: finais,
    escolhida,
    // O equilíbrio do topo é sempre o da escolhida — as guardas leem daqui.
    equilibrio: finais[escolhida]!.equilibrio,
  };
}
