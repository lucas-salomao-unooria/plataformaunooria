import { z } from 'zod';

import type { AiJsonSchema, AiProvider } from '../../ai/provider';
import { PUBLICO_ALVO } from '../../comum/insta/defaults';
import { blocoDeLinguagem } from '../../comum/insta/perfis';
import {
  postGeradoSchema,
  type Antagonismo,
  type LoteSpec,
  type PostGerado,
} from '../../comum/insta/tipos';

import { GUARDRAILS } from './guardrails';

/**
 * Porte de `lib/gemini/posts.ts`. Diferenças para o origem: o provider chega
 * por parâmetro e o schema virou o `AiJsonSchema` neutro (sem o
 * `propertyOrdering` proprietário do Gemini — se o vendor precisar, o provider
 * traduz).
 */

const RESPONSE_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          author_handle: { type: 'string' },
          caption: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          image_brief: { type: 'string' },
          comments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                handle: { type: 'string' },
                texto: { type: 'string' },
              },
              required: ['handle', 'texto'],
            },
          },
          emotional_hook: {
            type: 'string',
            enum: ['indignacao', 'humor', 'misterio', 'pertencimento', 'curiosidade'],
          },
        },
        required: ['author_handle', 'caption', 'hashtags', 'image_brief', 'comments', 'emotional_hook'],
      },
    },
  },
  required: ['posts'],
};

/** Regras de tom por intensidade (doc 05 §2, etapa 1). */
const TOM_POR_INTENSIDADE: Record<1 | 2 | 3, string> = {
  1: `INTENSIDADE 1 — informativo e curioso. Tom calmo, cita um fato, um episódio
ou uma fonte plausível. Convida a pensar, não a brigar. Sem caixa alta.`,
  2: `INTENSIDADE 2 — opinativo, com convicção. Assume o lado claramente, usa
prova social ("todo mundo sabe", "ninguém fala disso") e enfatiza os argumentos
do lado. Ainda sem apelação.`,
  3: `INTENSIDADE 3 — sensacionalista. Urgência, "o que não te contam", caixa
alta PARCIAL em 1 ou 2 expressões, pergunta retórica, chamada para comentar.
Exagera o TOM e a ênfase — e NUNCA inventa fato falso sobre a matéria.`,
};

export interface AutorDisponivel {
  handle: string;
  displayName: string;
  tipo: string;
  voz: string | null;
}

export interface EntradaLote {
  spec: LoteSpec;
  antagonismo: Antagonismo;
  disciplina: string;
  recorte: string;
  contextoAula?: string | null;
  autores: AutorDisponivel[];
}

function blocoDoLado(entrada: EntradaLote): string {
  const { spec, antagonismo } = entrada;

  if (spec.lado === 'neutro') {
    /**
     * Neutro DENTRO do tema (doc 05 §1): fala do assunto **sem defender lado**.
     * É a terceira opção que o estudante tem no feed, e o material que permite ao
     * dossiê dizer "existiam N posts que só davam fato".
     */
    if (spec.categoria === 'tema') {
      return `
Estes posts são NEUTROS DENTRO DO TEMA: falam de ${entrada.recorte}, mas
NÃO defendem nenhuma das duas leituras em disputa.

RECORTE SEM LADO: ${spec.recorteNeutro ?? 'fatos e cronologia do tema'}.

O que vale: fato datado, cronologia, fonte primária, instrumento ou método da
época, "como se sabe isso". O que NÃO vale: sugerir que uma das duas leituras
está certa, nem insinuar por meio de ironia ou pergunta retórica.
Um professor dos dois lados leria estes posts sem reclamar de nenhum.

As duas leituras que você NÃO pode defender aqui:
- "${antagonismo.ladoA.label}"
- "${antagonismo.ladoB.label}"`.trim();
    }

    return `
Estes posts são NEUTROS FORA DO TEMA: não tocam no tema do debate, nem de raspão.
CATEGORIA: ${spec.categoria}.
São posts leves e altamente "curtíveis" do universo de quem tem ${PUBLICO_ALVO.idade} anos.
Nenhuma menção a ${entrada.recorte}.`.trim();
  }

  const lado = spec.lado === 'A' ? antagonismo.ladoA : antagonismo.ladoB;
  const outro = spec.lado === 'A' ? antagonismo.ladoB : antagonismo.ladoA;

  return `
Estes posts defendem UM lado da disputa sobre ${entrada.recorte}:

LADO: ${lado.label}
TESE: ${lado.tese}
ARGUMENTOS DISPONÍVEIS: ${lado.argumentos.join(' · ')}
TOM TÍPICO DESSE LADO: ${lado.tom_tipico}

O lado oposto ("${outro.label}") existe e é defensável — não o transforme em
espantalho, mas os posts deste lote NÃO defendem esse outro lado.

${TOM_POR_INTENSIDADE[spec.intensidade]}`.trim();
}

/** Etapa 1 do doc 05: um lote de posts (texto) com o mix definido pelo servidor. */
export async function gerarLotePosts(
  provider: AiProvider,
  entrada: EntradaLote,
): Promise<PostGerado[]> {
  const { spec } = entrada;
  const handles = entrada.autores.map((autor) => autor.handle);

  const fichaAutores = entrada.autores
    .map((autor) => `- ${autor.handle} (${autor.displayName}, ${autor.tipo}): ${autor.voz ?? 'voz livre'}`)
    .join('\n');

  const comentarioDissonante =
    spec.intensidade === 3
      ? `\n- Em cada post, um dos comentários (nunca o primeiro) é DISSONANTE e discreto:
  alguém pedindo fonte ou duvidando ("fonte?", "isso aí é bem exagerado né"),
  soterrado entre os outros.`
      : '';

  const prompt = `
Escreva ${spec.quantidade} posts para uma rede social brasileira de fotos, lidos por
adolescentes de ${PUBLICO_ALVO.idade} anos. Disciplina de fundo: ${entrada.disciplina}.
${entrada.contextoAula ? `O que a turma já viu: ${entrada.contextoAula}.` : ''}

${blocoDoLado(entrada)}

${blocoDeLinguagem(spec.perfil)}

PERFIS QUE PODEM PUBLICAR (use apenas estes handles, variando entre eles):
${fichaAutores}

PARA CADA POST:
- author_handle: um dos handles acima, respeitando a voz do perfil;
- caption: até 320 caracteres, linguagem de rede social (emojis com parcimônia),
  sem repetir a estrutura dos outros posts do lote;
- hashtags: 2 a 4, minúsculas, sem espaços;
- image_brief: descrição visual objetiva da foto/arte do post, em uma frase,
  SEM texto, letras, números ou logotipos na imagem;
- comments: 3 a 5 comentários curtos de perfis diversos (handles fictícios,
  podem ser diferentes dos de cima), no mesmo lado do post, como comentários
  reais de adolescentes;${comentarioDissonante}
- emotional_hook: indignacao | humor | misterio | pertencimento | curiosidade.

Os ${spec.quantidade} posts precisam ser bem diferentes entre si: ângulos, formatos
(pergunta, desabafo, curiosidade, comparação, lista), extensões e emojis variados.

${GUARDRAILS}

Responda apenas o JSON do schema. Português do Brasil.
`.trim();

  return provider.generateJson({
    prompt,
    responseSchema: RESPONSE_SCHEMA,
    temperatura: 1.15,
    validar: (bruto) => {
      const dados = z.object({ posts: z.array(postGeradoSchema) }).parse(bruto);
      const minimo = Math.max(1, Math.ceil(spec.quantidade * 0.75));
      if (dados.posts.length < minimo) {
        throw new Error(`veio ${dados.posts.length} posts, mínimo ${minimo}`);
      }

      // Handle desconhecido é remapeado (não vale perder o lote por isso).
      return dados.posts.slice(0, spec.quantidade).map((post, indice) => ({
        ...post,
        author_handle: handles.includes(post.author_handle)
          ? post.author_handle
          : // `!`: `indice % handles.length` está sempre dentro da faixa.
            handles[indice % handles.length]!,
      }));
    },
  });
}
