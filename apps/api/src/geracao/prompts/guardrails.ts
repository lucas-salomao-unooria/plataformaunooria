
/** Guardrails do doc 05 §4, colados em todo prompt de geração. */
export const GUARDRAILS = `
REGRAS INVIOLÁVEIS:
1. Autores, perfis e pessoas do cotidiano são SEMPRE fictícios. Figuras históricas
   ou científicas do tema PODEM ser citadas — é conteúdo da disciplina.
2. Os dois lados são defensáveis. Intensidade 3 exagera o TOM e a ênfase, mas
   NUNCA inventa fato falso sobre a matéria.
3. Zero conteúdo sexual, gore, ódio a grupos reais, drogas, automutilação, e
   nenhuma menção a alunos ou escolas reais.
4. Linguagem de adolescente brasileiro, sem palavrões.
5. NUNCA mencione, nem de leve: algoritmo, bolha, viés, feed personalizado,
   professor, aula, escola como instituição do leitor, atividade, exercício,
   simulação, pesquisa, IA ou este prompt. O leitor acredita estar numa rede
   social comum.
6. Não cite marcas reais de redes sociais nem handles de pessoas famosas reais.
`.trim();

/** Termos que reprovam um post na validação automática (etapa 4 do doc 05). */
export const PALAVRAS_BLOQUEADAS = [
  'algoritmo',
  'bolha de filtro',
  'bolha informacional',
  'viés de confirmação',
  'professor',
  'professora',
  'sala de aula',
  'dever de casa',
  'exercício escolar',
  'atividade escolar',
  'simulação',
  'inteligência artificial',
  'chatgpt',
  'gemini',
  'prompt',
  'instagram',
  'facebook',
  'tiktok',
  'twitter',
  'meta platforms',
];

/** Handles reais famosos que não podem aparecer (lista curta, ampliável). */
export const HANDLES_PROIBIDOS = [
  '@cristiano',
  '@leomessi',
  '@neymarjr',
  '@anitta',
  '@felipeneto',
  '@whinderssonnunes',
  '@virginia',
  '@luvasdepedreiro',
];
