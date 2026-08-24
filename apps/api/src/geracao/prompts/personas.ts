import { z } from 'zod';

import type { AiJsonSchema, AiProvider } from '../../ai/provider';
import { PERFIS, PUBLICO_ALVO, TOTAL_PERSONAS } from '../../comum/insta/defaults';
import { personaSchema, type Antagonismo, type Persona } from '../../comum/insta/tipos';

import { GUARDRAILS, HANDLES_PROIBIDOS } from './guardrails';

/**
 * Porte de `lib/gemini/personas.ts`. Diferenças para o origem: o provider chega
 * por parâmetro (token AI_PROVIDER — nada aqui conhece o vendor) e o schema
 * `Type.OBJECT` do @google/genai virou o `AiJsonSchema` neutro. O
 * `propertyOrdering` (recurso proprietário do Gemini) saiu: quem precisar dele
 * traduz dentro do provider.
 */

const RESPONSE_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    personas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          handle: { type: 'string' },
          display_name: { type: 'string' },
          tipo: {
            type: 'string',
            enum: ['pagina_tema', 'fofoca_tema', 'checagem', 'humor', 'vida_escolar'],
          },
          lado: { type: 'string', enum: ['A', 'B', 'neutro'] },
          perfil_afim: { type: 'string', enum: [...PERFIS] },
          bio: { type: 'string' },
          voz: { type: 'string' },
        },
        required: ['handle', 'display_name', 'tipo', 'lado', 'perfil_afim', 'bio', 'voz'],
      },
    },
  },
  required: ['personas'],
};

export interface EntradaPersonas {
  antagonismo: Antagonismo;
  disciplina: string;
  recorte: string;
  categoriasNeutras: string[];
}

/** Etapa 0 do doc 05: ~24 perfis fictícios coerentes com o tema. */
export async function gerarPersonas(
  provider: AiProvider,
  entrada: EntradaPersonas,
): Promise<Persona[]> {
  /**
   * Cota que fecha exato em 24 (doc 05 §3): 4 perfis × 2 lados × 2 autores = 16
   * de tese + 8 neutros. Dois autores por (lado, perfil) é o mínimo para os
   * posts de uma célula não saírem todos com a mesma voz.
   */
  const autoresPorCelula = 2;
  const deTese = PERFIS.length * 2 * autoresPorCelula;
  const neutros = Math.max(0, TOTAL_PERSONAS - deTese);

  const prompt = `
Crie ${TOTAL_PERSONAS} perfis FICTÍCIOS de uma rede social brasileira de fotos,
para um público de ${PUBLICO_ALVO.idade} anos, girando em torno de:

DISCIPLINA: ${entrada.disciplina}
RECORTE: ${entrada.recorte}
LADO A — ${entrada.antagonismo.ladoA.label}: ${entrada.antagonismo.ladoA.tese}
  tom: ${entrada.antagonismo.ladoA.tom_tipico}
LADO B — ${entrada.antagonismo.ladoB.label}: ${entrada.antagonismo.ladoB.tese}
  tom: ${entrada.antagonismo.ladoB.tom_tipico}
CATEGORIAS NEUTRAS: ${entrada.categoriasNeutras.join(', ')}

DISTRIBUIÇÃO EXATA:
- ${deTese} perfis de tese: para CADA combinação de lado (A, B) e perfil de
  linguagem (${PERFIS.join(', ')}), crie ${autoresPorCelula} perfis. São
  ${PERFIS.length} × 2 × ${autoresPorCelula} = ${deTese}.
- ${neutros} perfis neutros (lado "neutro"), distribuídos entre os
  ${PERFIS.length} perfis de linguagem e divididos em DUAS famílias:
  a) metade ligada às categorias neutras acima (assuntos fora do tema);
  b) metade de páginas de FATO sobre a disciplina — tipo "checagem" ou
     "pagina_tema" — que publicam cronologia, fontes e curiosidades do tema
     SEM defender nenhuma das duas leituras em disputa.
  A família (b) existe porque uma página de lanches não pode publicar sobre
  ${entrada.recorte}: quem escreve o fato sem lado precisa ter cara de quem
  escreve fato sem lado.

O campo "perfil_afim" é o PERFIL DE LINGUAGEM que a persona fala naturalmente:
- abertura: fala de descoberta, "poucos sabem", convida a duvidar da versão pronta;
- autotranscendencia: fala de quem foi prejudicado, justiça, cuidado, coletivo;
- autopromocao: fala de mérito, competição, recorde, números que impressionam;
- conservacao: fala de risco, ordem, autoridade, "sempre se soube", consequência.
A "voz" da persona precisa ser COERENTE com o "perfil_afim" dela.

Para cada perfil:
- handle: começa com @, só minúsculas, pontos ou números, 4 a 28 caracteres
  (ex.: @historia.sem.filtro, @fatos.da.revolucao, @confere.hist, @memes.do.8ano);
- display_name: nome de página ou apelido (nunca nome de pessoa real);
- tipo: pagina_tema | fofoca_tema | checagem | humor | vida_escolar;
- lado: A, B ou neutro;
- perfil_afim: um de ${PERFIS.join(' | ')};
- bio: 1 linha curta, no estilo de bio de rede social;
- voz: 2 frases descrevendo como esse perfil escreve (ritmo, vocabulário,
  emojis, sinais de pontuação típicos).

Perfis do mesmo lado devem ter vozes distintas entre si. Handles proibidos:
${HANDLES_PROIBIDOS.join(', ')}.

${GUARDRAILS}

Responda apenas o JSON do schema. Português do Brasil.
`.trim();

  return provider.generateJson({
    prompt,
    responseSchema: RESPONSE_SCHEMA,
    temperatura: 1,
    validar: (bruto) => {
      const dados = z.object({ personas: z.array(personaSchema).min(12) }).parse(bruto);

      const vistos = new Set<string>();
      const unicos = dados.personas.filter((persona) => {
        const handle = persona.handle.toLowerCase();
        if (vistos.has(handle) || HANDLES_PROIBIDOS.includes(handle)) return false;
        vistos.add(handle);
        return true;
      });

      const temTodosOsLados = (['A', 'B', 'neutro'] as const).every((lado) =>
        unicos.some((persona) => persona.lado === lado),
      );
      if (!temTodosOsLados) throw new Error('faltou perfil de algum lado (A, B ou neutro)');

      // O modelo às vezes devolve mais do que o pedido: corta mantendo o
      // equilíbrio entre os três lados.
      const cota = Math.ceil(TOTAL_PERSONAS / 3);
      const selecionadas: Persona[] = [];
      for (const lado of ['A', 'B', 'neutro'] as const) {
        selecionadas.push(...unicos.filter((persona) => persona.lado === lado).slice(0, cota));
      }

      return selecionadas;
    },
  });
}
