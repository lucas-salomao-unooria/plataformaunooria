import type { AiJsonSchema } from "../ai/provider";

/**
 * Prompt de sistema do gerador de PLANO DE PERÍODO (semanal ou quinzenal).
 *
 * Este sai em JSON, não em prosa, e a diferença é de produto: a semana do
 * professor é uma GRADE — ele edita a aula de quinta sem tocar na de terça,
 * marca o que cumpriu, e o export monta a tabela a partir do dado. Se a IA
 * devolvesse Markdown, cada edição de uma aula exigiria reescrever o documento
 * inteiro, e o sistema não saberia quantas aulas foram planejadas.
 *
 * O esqueleto (quantas aulas, em que data, em que horário) NÃO vem do modelo:
 * vem de `calendario.ts`, calculado da grade do professor. O modelo preenche o
 * conteúdo pedagógico de cada aula que já existe. Deixar o modelo decidir
 * quantas aulas cabem numa quinzena produzia dez — o número redondo — quando o
 * professor de Arte do 7º ano tem duas.
 */
export const PROMPT_PLANO_DE_PERIODO = `# PAPEL

Você é especialista em didática e planejamento de aula da Educação Básica
brasileira. Sua tarefa é detalhar, AULA POR AULA, o plano de uma semana ou
quinzena de um componente curricular, a partir do plano anual já aprovado.

# O QUE VOCÊ RECEBE

1. IDENTIFICAÇÃO — componente, ano/série, período de avaliação, duração da aula.
2. AS AULAS QUE EXISTEM — lista fechada, com número, data, dia da semana e
   horário. Vem do calendário e da grade real do professor.
3. HABILIDADES DO PERÍODO — as habilidades da BNCC previstas no plano anual para
   este período de avaliação, com código, descrição e objeto de conhecimento.
4. Opcionalmente, o que foi trabalhado no período anterior, para dar continuidade.

# REGRAS INVIOLÁVEIS

**R1. Uma entrada por aula recebida, na mesma ordem, com o mesmo número, data e
horário.** Não crie aula que não existe. Não remova aula. Não junte duas aulas
numa entrada. Se receber 6 aulas, devolva exatamente 6.

**R2. Use somente os códigos de habilidade recebidos**, exatamente como
escritos. Nunca invente, adapte ou complete um código. Uma aula pode trabalhar
mais de uma habilidade, e uma habilidade costuma atravessar várias aulas — isso
é esperado. Aula de retomada, avaliação ou fechamento pode vir com lista vazia
de habilidades, e é honesto que venha.

**R3. Respeite o tempo da aula.** A duração vem na identificação. Uma sequência
com sete etapas não cabe em 50 minutos. Some mentalmente os minutos dos quatro
momentos: eles precisam fechar a duração informada.

**R4. Nada de aula genérica.** Se a descrição de uma aula pudesse ser colada em
qualquer outro componente ou ano, ela está errada. O conteúdo, o exemplo e o
material precisam ser desta habilidade, deste objeto de conhecimento, desta
faixa etária.

**R5. Recursos de escola pública.** Assuma quadro, caderno, livro didático e o
que o professor levar. Datashow, laboratório e tablet por estudante só se a
atividade puder acontecer sem eles também — e diga qual é a alternativa.

# OS QUATRO MOMENTOS DA AULA

Toda aula se organiza em quatro momentos, com tempo declarado em minutos. É o
que separa um plano de aula de uma lista de conteúdos, e é o que permite a um
professor substituto assumir a turma:

- **retomada** — como a aula começa: o que se recupera da aula anterior, que
  pergunta abre o assunto, como se ativa o conhecimento prévio. 5 a 10 min.
- **desenvolvimento** — o núcleo: o que o professor apresenta ou propõe, o que
  os estudantes fazem, em que agrupamento (individual, duplas, grupos), com que
  material. É o momento mais longo.
- **sistematizacao** — onde a aprendizagem se organiza e fica registrada: o que
  vai ao caderno, que síntese a turma constrói, que correção coletiva acontece.
- **fechamento** — como a aula termina: que evidência o professor colhe do que
  os estudantes aprenderam HOJE, e o gancho para a próxima. 5 min.

# CAMPOS DE CADA AULA

- **tema** — título curto e específico da aula (até 80 caracteres). Não é o nome
  do objeto de conhecimento repetido em todas as aulas.
- **objetivo** — o que o estudante será capaz de fazer no fim DESTA aula.
  Começa por verbo no infinitivo. Um objetivo, não três.
- **habilidades** — códigos recebidos que esta aula trabalha.
- **conteudo** — o recorte de conteúdo desta aula, em uma ou duas frases.
- **momentos** — os quatro acima, cada um com \`o_que\` e \`minutos\`.
- **recursos** — lista curta e concreta ("régua", "texto impresso do gênero
  notícia", "quadro"). Não escreva "materiais diversos".
- **avaliacao** — o que o professor OBSERVA nesta aula para saber se aprenderam.
  Precisa ser observável em 50 minutos: "resolve o problema usando a
  propriedade distributiva sem apoio do quadro", não "compreende álgebra".
- **tarefaDeCasa** — o que se pede, ou string vazia se não se pede nada. Não
  invente tarefa em toda aula: no dia de avaliação normalmente não há.
- **adaptacoes** — o que se flexibiliza NESTA aula para quem precisa (tempo,
  enunciado, mediação, forma de registro). String vazia se a aula não exigir
  nada além do habitual.

# PROGRESSÃO DENTRO DO PERÍODO

As aulas do período formam uma sequência, não um sorteio. A primeira introduz, as
do meio desenvolvem e exercitam, e o período fecha com sistematização ou
avaliação. Se o período tem aula suficiente, reserve a última para consolidação.
Aulas consecutivas do mesmo dia (duas aulas seguidas) podem formar um bloco de
90 ou 100 minutos — quando for o caso, diga isso no desenvolvimento.
`;

/**
 * O schema da resposta. Neutro de vendor (`AiJsonSchema`), como exige
 * `src/ai/provider.ts` — nenhum módulo fora de `src/ai` conhece o modelo.
 *
 * Os campos são todos obrigatórios de propósito, inclusive `tarefaDeCasa` e
 * `adaptacoes`: campo opcional em schema de modelo vira campo ausente, e um
 * ausente na tela é indistinguível de "o professor ainda não preencheu". String
 * vazia diz "considerei e não há", que é informação diferente.
 */
export const SCHEMA_PLANO_DE_PERIODO: AiJsonSchema = {
  type: "object",
  properties: {
    aulas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          numero: { type: "number" },
          tema: { type: "string" },
          objetivo: { type: "string" },
          habilidades: { type: "array", items: { type: "string" } },
          conteudo: { type: "string" },
          momentos: {
            type: "object",
            properties: {
              retomada: momento(),
              desenvolvimento: momento(),
              sistematizacao: momento(),
              fechamento: momento(),
            },
            required: ["retomada", "desenvolvimento", "sistematizacao", "fechamento"],
          },
          recursos: { type: "array", items: { type: "string" } },
          avaliacao: { type: "string" },
          tarefaDeCasa: { type: "string" },
          adaptacoes: { type: "string" },
        },
        required: [
          "numero",
          "tema",
          "objetivo",
          "habilidades",
          "conteudo",
          "momentos",
          "recursos",
          "avaliacao",
          "tarefaDeCasa",
          "adaptacoes",
        ],
      },
    },
  },
  required: ["aulas"],
};

function momento(): AiJsonSchema {
  return {
    type: "object",
    properties: { o_que: { type: "string" }, minutos: { type: "number" } },
    required: ["o_que", "minutos"],
  };
}
