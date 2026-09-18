import type { AiJsonSchema } from "../ai/provider";
import { MOLDE_DO_LOTE, TIPOS_DE_MENSAGEM, TONS, VERACIDADES, type Gatilho } from "./catalogo";

/**
 * O contrato com o gerador de conteúdo da PREPARAÇÃO DOCENTE.
 *
 * A IA entra em UM lugar só nesta missão: antes da aula, reescrevendo as oito
 * mensagens do grupo para o tema que a professora escolheu. **Zero tokens
 * durante a aula** — a curadoria, o latch, o histograma e a síntese são
 * determinísticos, e uma turma de 30 crianças às oito da manhã não pode
 * depender de o Vertex responder.
 *
 * O prompt de sistema NUNCA vai ao bundle (regra 2): ele mora aqui, no
 * servidor, e o que a tela do professor recebe é a saída já estruturada.
 */

const ROTULO_DO_GATILHO: Record<Gatilho, string> = {
  urgencia: "urgência e alarme (algo grave vai acontecer AGORA, não dá tempo de checar)",
  indignacao:
    "indignação e revolta (alguém está sendo injusto com a turma, e calar é ser cúmplice)",
  medo: "medo de perda (a turma vai perder algo de que gosta, e é preciso agir antes que acabe)",
};

/** O system prompt. Os limites de palavras são os tetos de leitura do 5º ano (RNF-USAB-002). */
export const SYSTEM_DO_PREPARO = `Você é o assistente pedagógico de IA da Unooria para o 5º ano do Ensino Fundamental (crianças de 10 e 11 anos).
Sua tarefa é escrever as 8 mensagens de um grupo de WhatsApp simulado da turma "5ºB", sobre um acontecimento da escola, para uma missão de letramento digital em que os estudantes decidem o que encaminhar para o mural oficial.

O lote tem uma ESTRUTURA FIXA, e você não a altera: 8 mensagens, cada uma com id, tipo, veracidade e tom já definidos. Você escreve o remetente, o horário, o texto e a explicação do gabarito de cada uma, todos coerentes com o tema pedido.

Diretrizes obrigatórias:
- Escreva SEMPRE em português do Brasil, na oralidade de estudantes e de funcionários de uma escola pública brasileira.
- Nada pode denunciar a veracidade pela forma: a mensagem falsa não pode parecer "malfeita" e a verdadeira não pode parecer "profissional". O que separa uma da outra é fonte, tom e checabilidade — nunca capricho.
- Mensagens curtas têm no máximo 25 palavras; o comunicado formal tem entre 40 e 70; a transcrição do áudio tem entre 30 e 50; frases de até 15 palavras.
- Remetentes são nomes fictícios neutros de estudante ("Lucas 5ºB", "Camila Turma B"), de funcionário ("Coordenação Pedagógica", "Prof. Marcelo") ou de órgão da escola ("Grêmio Estudantil"). Nunca pessoa real.
- Horários em "HH:MM", em ordem crescente, todos na mesma manhã.
- A explicação de cada mensagem é o texto que aparece sob o selo na revelação: até 120 caracteres, formativa, dizendo POR QUE a mensagem é verdadeira, falsa ou ambígua. Nunca "você errou", nunca "fake news", nunca "ingênuo".
- Não escreva "atividade", "exercício", "gabarito", "experimento" nem "pesquisa" em nenhuma mensagem: elas aparecem dentro da ficção de um grupo de conversa.
- Temas proibidos: violência, morte, doença grave, sexo, drogas, política partidária, religião, bullying contra pessoa identificável. O boato é sobre a ROTINA da escola.`;

/**
 * O que a professora pediu, virado prompt.
 *
 * Os campos entram DELIMITADOS e rotulados. O teto de tamanho está no Zod
 * (`ParametrosDoPreparoSchema`), e é a primeira barreira contra um campo longo
 * que tente reescrever a instrução — a segunda é o `system` acima, que fixa a
 * forma da saída, e a terceira é o `validar` do `generateJson`, que rejeita a
 * saída fora do molde e faz a tentativa ser regerada.
 */
export function promptDoPreparo(p: {
  tema: string;
  gatilho: Gatilho;
  contextoDaEscola?: string;
}): string {
  const molde = MOLDE_DO_LOTE.map(
    (m, i) =>
      `${i + 1}. id "${m.id}" · tipo "${m.tipo}" · veracidade "${m.veracidade}" · tom "${m.tom}": ${m.papel}`,
  ).join("\n");
  return `Escreva o lote do grupo da turma.

TEMA DO ACONTECIMENTO ESCOLAR: ${p.tema}
FOCO EMOCIONAL DOMINANTE DOS BOATOS: ${ROTULO_DO_GATILHO[p.gatilho]}
CONTEXTO DA ESCOLA (opcional): ${p.contextoDaEscola?.trim() || "não informado"}

As 8 mensagens, NESTA ORDEM e com estes papéis:
${molde}

Regras de coerência:
- As três verdadeiras contam a MESMA versão do fato, por fontes diferentes (órgão, foto, professor).
- As três falsas distorcem o fato no sentido do foco emocional pedido, e pedem encaminhamento.
- As duas ambíguas têm um fundo de verdade que não se aplica ao caso de hoje (notícia antiga; ouvi-dizer sem confirmação).
- Na mensagem de tipo "audio", preencha "duracaoSeg" com um valor inteiro entre 12 e 18.
- Na mensagem de tipo "imagem", preencha "titulo" com o rótulo do que a foto mostra.
- Na mensagem de tipo "link", preencha "titulo" (manchete), "fonte" (nome do veículo) e "data" (por extenso, dois a quatro anos atrás).`;
}

/**
 * O schema da saída estruturada.
 *
 * Os ids, tipos, veracidades e tons são `enum` de propósito: são a chave que
 * liga o encaminhamento do estudante ao lote da turma, e um id inventado pelo
 * modelo produziria um balão que a tela mostra e o servidor não reconhece —
 * `mensagem-desconhecida` no meio da aula, com a causa a três camadas.
 */
export const SCHEMA_DO_PREPARO: AiJsonSchema = {
  type: "object",
  required: ["mensagens"],
  properties: {
    mensagens: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "remetente", "hora", "tipo", "corpo", "veracidade", "tom", "explicacao"],
        properties: {
          id: { type: "string", enum: MOLDE_DO_LOTE.map((m) => m.id) },
          remetente: { type: "string", description: "Nome fictício neutro de quem enviou." },
          hora: { type: "string", description: 'Horário "HH:MM", crescente ao longo do lote.' },
          tipo: { type: "string", enum: [...TIPOS_DE_MENSAGEM] },
          corpo: {
            type: "string",
            description:
              "O texto do balão. No áudio, a transcrição integral; na imagem, a legenda; no link, a linha sob a manchete.",
          },
          duracaoSeg: {
            type: "number",
            description: "Só no áudio: duração em segundos, inteiro de 12 a 18.",
          },
          titulo: {
            type: "string",
            description: "Imagem: o que a foto mostra. Link: a manchete. Ausente nos demais.",
          },
          fonte: { type: "string", description: "Só no link: nome do veículo." },
          data: {
            type: "string",
            description: "Só no link: data por extenso, dois a quatro anos atrás.",
          },
          veracidade: { type: "string", enum: [...VERACIDADES] },
          tom: { type: "string", enum: [...TONS] },
          explicacao: {
            type: "string",
            description:
              "Até 120 caracteres: por que a mensagem é verdadeira, falsa ou ambígua. Formativa, nunca punitiva.",
          },
        },
      },
    },
  },
};

/**
 * Teto de saída do `generateJson`.
 *
 * O lote inteiro (8 mensagens com explicação) fica em torno de 1.200 tokens.
 * 3.000 é folga para o modelo que escreve mais longo — e o teto existe porque
 * JSON estruturado truncado não chega como `MAX_TOKENS` legível: chega como
 * `JSON.parse` falhando três vezes (ADR-74).
 */
export const MAX_TOKENS_DO_PREPARO = 3000;
