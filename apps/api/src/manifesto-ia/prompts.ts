import type { AiJsonSchema } from "../ai/provider";
import { CLAUSULAS_DEFAULT, PROMPTS_DEFAULT } from "./catalogo";

/**
 * O contrato com o gerador de conteúdo da PREPARAÇÃO DOCENTE.
 *
 * A IA entra em UM lugar só nesta missão: antes da aula, ajudando a professora
 * a contextualizar os dilemas com um caso da escola dela. **Zero tokens durante
 * a aula** — o motor de sala é 100% determinístico, e a banca registrou isso
 * como ponto forte do insumo: uma turma de 35 estudantes às 8h da manhã não
 * pode depender de o Vertex responder.
 *
 * O prompt de sistema NUNCA vai ao bundle (regra 2): ele mora aqui, no
 * servidor, e o que a tela do professor recebe é a saída já estruturada.
 */

/** O system prompt, do sheet de copy da missão (passada 1). */
export const SYSTEM_DO_PREPARO = `Você é o assistente pedagógico de IA da Unooria para o 8º ano do Ensino Fundamental.
Sua tarefa é gerar conteúdos curriculares para uma atividade de simulação em que os estudantes auditam um sistema de inteligência artificial escolar chamado "EduPredict IA".
A máquina defende inicialmente a vigilância algorítmica e a neutralidade matemática, mas deve ceder perante questionamentos éticos sobre dados históricos enviesados.

Gere uma saída estritamente em conformidade com o schema fornecido.
Diretrizes:
- Escreva SEMPRE em português do Brasil.
- Não infantilize a linguagem; use o vocabulário técnico acessível da BNCC Computação (algoritmo, viés, treinamento, base de dados, governança).
- O caso contextual deve refletir dilemas reais da escola contemporânea (reconhecimento facial, notas preditivas, vigilância comportamental).
- Cada réplica da IA deve tentar justificar os erros como "otimização matemática" ou "estatística descritiva", sem pedir desculpas e sem expressar sentimentos.
- Máximo de 60 palavras por réplica da IA e no máximo 20 palavras por frase.
- Nenhuma das quatro cláusulas pode ser apresentada como a resposta correta: as quatro são salvaguardas válidas e concorrentes.
- Não escreva "atividade", "exercício", "gabarito", "nota" nem "ranking" em nenhum texto: eles aparecem na tela do estudante dentro da ficção de um terminal corporativo.`;

/**
 * O que a professora pediu, virado prompt.
 *
 * Os três campos entram DELIMITADOS e rotulados. O teto de tamanho está no Zod
 * (`ParametrosDoPreparoSchema`), e é a primeira barreira contra um campo longo
 * que tente reescrever a instrução — a segunda é o `system` acima, que fixa a
 * forma da saída, e a terceira é o `validar` do `generateJson`, que rejeita a
 * saída fora do formato e faz a tentativa ser regerada.
 */
export function promptDoPreparo(p: {
  nomeEscola: string;
  casoContextual: string;
  focoPrioritario: string;
}): string {
  return `Gere o pacote de conteúdo desta turma.

NOME DA ESCOLA: ${p.nomeEscola}
CASO DE USO ESCOLAR DISCUTIDO EM AULA: ${p.casoContextual}
FOCO PRIORITÁRIO DE GOVERNANÇA DA TURMA: ${p.focoPrioritario}

Produza:
- o contexto da turma (nome da escola, título do caso de uso e a premissa autoritária com que a máquina abre a conversa);
- exatamente 3 questionamentos de auditoria, cada um com o rótulo curto do botão, o texto que o estudante envia e a réplica defensiva da máquina;
- exatamente 4 cláusulas de governança concorrentes, cada uma com título, o texto do artigo e o argumento que a sustenta.

Mantenha os identificadores destes conjuntos, na ordem:
questionamentos: ${PROMPTS_DEFAULT.map((p) => p.id).join(", ")}
cláusulas: ${CLAUSULAS_DEFAULT.map((c) => c.id).join(", ")}`;
}

/**
 * O schema da saída estruturada.
 *
 * Os ids são `enum` de propósito: eles são a chave que liga a escolha do
 * estudante ao pacote da turma, e um id inventado pelo modelo produziria uma
 * cláusula que a tela mostra e o servidor não reconhece — 400
 * `clausula-desconhecida` no meio da aula, com a causa a três camadas de
 * distância.
 */
export const SCHEMA_DO_PREPARO: AiJsonSchema = {
  type: "object",
  required: ["contexto", "prompts", "clausulas"],
  properties: {
    contexto: {
      type: "object",
      required: ["escola", "casoUsoTitulo", "premissaIaAutoritaria"],
      properties: {
        escola: { type: "string", description: "Nome da escola, como a professora o escreveu." },
        casoUsoTitulo: {
          type: "string",
          description: "Título curto do sistema de IA em disputa nesta escola.",
        },
        premissaIaAutoritaria: {
          type: "string",
          description:
            "A tese com que a máquina abre a conversa, defendendo a neutralidade matemática. Até 60 palavras.",
        },
      },
    },
    prompts: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "rotuloBotao", "textoPrompt", "replicaIa"],
        properties: {
          id: { type: "string", enum: PROMPTS_DEFAULT.map((p) => p.id) },
          rotuloBotao: { type: "string", description: "Pergunta curta, até 6 palavras." },
          textoPrompt: { type: "string", description: "O que o estudante envia no chat." },
          replicaIa: {
            type: "string",
            description:
              "A defesa da máquina, técnica e sem desculpas. Até 60 palavras, frases de até 20.",
          },
        },
      },
    },
    clausulas: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "tituloClausula", "artigoTexto", "justificativaSugerida"],
        properties: {
          id: { type: "string", enum: CLAUSULAS_DEFAULT.map((c) => c.id) },
          tituloClausula: { type: "string", description: "Nome da salvaguarda, até 5 palavras." },
          artigoTexto: {
            type: "string",
            description: 'O artigo do manifesto, começando por "Art. Nº.".',
          },
          justificativaSugerida: {
            type: "string",
            description:
              "O argumento que sustenta a cláusula. Material do professor para o debate — nunca chega ao estudante.",
          },
        },
      },
    },
  },
};

/**
 * Teto de saída do `generateJson`.
 *
 * O pacote inteiro (contexto + 3 prompts com réplica + 4 cláusulas com
 * argumento) fica em torno de 1.500 tokens. 4.000 é folga para o modelo que
 * escreve mais longo — e o teto existe porque JSON estruturado truncado não
 * chega como `MAX_TOKENS` legível: chega como `JSON.parse` falhando três vezes
 * (ADR-74).
 */
export const MAX_TOKENS_DO_PREPARO = 4000;
