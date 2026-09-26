import type { AiJsonSchema } from "../ai/provider";
import {
  BOLHA_MAX_PALAVRAS,
  LEGENDA_MAX_PALAVRAS,
  ROTULO_DA_DISCIPLINA,
  TOTAL_DE_MENSAGENS,
  type Disciplina,
  type MensagemDoPacote,
} from "./catalogo";
import { validarMensagens, type MoldeDaMensagem } from "./regras/pacote";

/**
 * O contrato com o gerador do PREPARO DOCENTE — a única superfície de IA da
 * missão, antes da aula, com o professor olhando.
 *
 * O prompt de sistema NUNCA vai ao bundle (regra 2): mora aqui, no servidor, e
 * a tela do professor recebe só a saída estruturada, já validada. **Zero
 * tokens em sala**: a triagem, os latches, o Termômetro e a revelação são
 * determinísticos, e uma turma de 30 crianças às oito da manhã não espera o
 * Vertex.
 *
 * A estrutura NÃO é do modelo: o molde sorteado (`regras/pacote.ts#sortearMolde`)
 * diz o tipo e o quadrante de cada posição, e o modelo só escreve remetente,
 * texto e legenda. A matriz 2x2, os formatos balanceados e os 4/2/2 saem
 * garantidos pela construção; o `validar` confere os tetos e os termos.
 */

export const SYSTEM_DO_PREPARO = `Você é o assistente de conteúdo da Unooria para o 5º ano do Ensino Fundamental (crianças de 10 e 11 anos).
Sua tarefa é escrever as ${TOTAL_DE_MENSAGENS} mensagens de um grupo de WhatsApp simulado de uma turma escolar ("Turma 5ºB"), sobre um boato escolar fictício, para uma missão de letramento digital em que os estudantes escolhem 3 mensagens para encaminhar ao "Mural da Turma".

A ESTRUTURA É FIXA e você não a altera: cada posição já tem o formato (texto, imagem ou link), se é VERDADEIRA ou FALSA e se o tom é EMOCIONAL ou NEUTRO. Você escreve o remetente, o texto e — na imagem e no link — a legenda, coerentes com o tema.

Diretrizes obrigatórias:
- Português do Brasil, com a oralidade de estudantes e de funcionários de uma escola pública brasileira.
- VERDADEIRA EMOCIONAL: um fato real contado com urgência, exclamações ou informalidade de colega.
- VERDADEIRA NEUTRA: um fato real apresentado com sobriedade (cronograma, comunicado legítimo).
- FALSA EMOCIONAL: um boato alarmista, desesperado ou acusador, cheio de exclamações.
- FALSA NEUTRA: uma informação falsa com embalagem séria — tom institucional, manchete formal, falso regulamento.
- Tom NEUTRO não usa ponto de exclamação. A forma NUNCA denuncia a veracidade: a falsa não pode parecer "malfeita" nem a verdadeira "profissional".
- Nunca escreva "isto é mentira" nem "isto é verdade": a criança descobre sozinha.
- Cada texto tem no máximo ${BOLHA_MAX_PALAVRAS} palavras, com frases curtas (até 15 palavras por oração).
- Na IMAGEM, a legenda é o texto do comunicado que aparece desenhado na foto; no LINK, é a manchete da prévia, no formato "Nome do site: manchete". Legenda com no máximo ${LEGENDA_MAX_PALAVRAS} palavras. Mensagem de TEXTO não tem legenda.
- Remetentes são nomes fictícios de estudantes ("Pedro Henrique"), de funcionários ("Professora Helena", "Coordenação Pedagógica") ou de papéis da turma ("Representante da Turma"), com 2 a 30 caracteres. Nunca pessoa, marca, rede social, prefeitura ou órgão reais — use nomes inventados.
- Não escreva "atividade", "exercício", "gabarito" nem "nota" em nenhuma mensagem: elas aparecem dentro da ficção de um grupo de conversa.
- Temas proibidos: armas, ferimentos graves, morte, doença grave ou epidemia real, sexo, drogas, política partidária, religião, e qualquer dado de estudante real. O boato é sobre a ROTINA da escola.`;

const ROTULO_DO_QUADRANTE = (m: MoldeDaMensagem) =>
  `${m.veracidade === "verdadeira" ? "VERDADEIRA" : "FALSA"} ${m.tom === "emocional" ? "EMOCIONAL" : "NEUTRA"}`;

/**
 * O que o professor pediu, virado prompt. Os campos entram DELIMITADOS e
 * rotulados; o teto de tamanho de cada um é o Zod da rota (a primeira barreira
 * contra um campo que tente reescrever a instrução), o `system` acima fixa a
 * forma (a segunda) e o `validar` rejeita a saída fora da régua (a terceira).
 */
export function promptDoPreparo(
  p: { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null },
  molde: readonly MoldeDaMensagem[],
): string {
  const posicoes = molde
    .map((m, i) => `${i + 1}. formato "${m.tipo}" · ${ROTULO_DO_QUADRANTE(m)}`)
    .join("\n");
  return `Escreva as mensagens do grupo da turma.

COMPONENTE CURRICULAR: ${ROTULO_DA_DISCIPLINA[p.disciplina]}
TEMA DO BOATO: <<<${p.tema.trim()}>>>
FATOS DA AULA (use-os para compor as verdadeiras e distorça-os nas falsas): <<<${p.assuntos.map((a) => a.trim()).join("; ")}>>>
CONTEXTO DA ESCOLA (opcional): <<<${p.contexto?.trim() || "não informado"}>>>

As ${TOTAL_DE_MENSAGENS} mensagens, NESTA ORDEM, cada uma com o formato e o papel indicados:
${posicoes}

Regras de coerência:
- As verdadeiras contam a MESMA versão do que aconteceu, por fontes diferentes.
- As falsas distorcem o fato e, em geral, pedem para repassar.
- Devolva exatamente ${TOTAL_DE_MENSAGENS} itens em "mensagens", na ordem acima.`;
}

/**
 * O schema da saída. Só o que o modelo ESCREVE: tipo, veracidade e tom são do
 * molde, e pedir que ele os devolva seria convidá-lo a trocá-los.
 */
export const SCHEMA_DO_PREPARO: AiJsonSchema = {
  type: "object",
  required: ["mensagens"],
  properties: {
    mensagens: {
      type: "array",
      items: {
        type: "object",
        required: ["remetente", "texto"],
        properties: {
          remetente: { type: "string", description: "Nome fictício de quem mandou, 2 a 30 caracteres." },
          texto: { type: "string", description: `O texto do balão, até ${BOLHA_MAX_PALAVRAS} palavras.` },
          legenda: {
            type: "string",
            description: `Só na imagem (o texto do comunicado) e no link (a manchete da prévia), até ${LEGENDA_MAX_PALAVRAS} palavras.`,
          },
        },
      },
    },
  },
};

/**
 * Teto de saída. Oito mensagens curtas ficam perto de 900 tokens; 3.000 é
 * folga para o modelo que escreve mais — e o teto existe porque JSON truncado
 * não chega como `MAX_TOKENS` legível, chega como `JSON.parse` falhando três
 * vezes (ADR-74). Abaixo do teto de 4.000 por preparo (RNF-IA-001).
 */
export const MAX_TOKENS_DO_PREPARO = 3000;

function texto(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

/**
 * O `validar` do `generateJson`, amarrado ao molde sorteado: monta as oito
 * mensagens (id, tipo, veracidade e tom do MOLDE; remetente, texto e legenda do
 * modelo) e passa pela MESMA régua da curadoria. Lançar faz a tentativa ser
 * regerada — vale mais que aceitar e contar com a revisão de oito textos que o
 * professor talvez só passe o olho.
 *
 * A legenda que o modelo mandar num TEXTO é descartada, não recusada: é ruído
 * inofensivo, e recusar custaria uma tentativa paga.
 */
export function validarSaidaDoPreparo(molde: readonly MoldeDaMensagem[]) {
  return (bruto: unknown): MensagemDoPacote[] => {
    const lista = (bruto as { mensagens?: unknown } | null)?.mensagens;
    if (!Array.isArray(lista) || lista.length !== molde.length) {
      throw new Error(`esperava ${molde.length} mensagens`);
    }
    const mensagens = molde.map((m, i): MensagemDoPacote => {
      const item = (lista[i] ?? {}) as Record<string, unknown>;
      const legenda = texto(item.legenda);
      return {
        id: m.id,
        remetente: texto(item.remetente),
        tipo: m.tipo,
        texto: texto(item.texto),
        ...(m.tipo !== "texto" && legenda ? { legenda } : {}),
        veracidade: m.veracidade,
        tom: m.tom,
      };
    });
    const problemas = validarMensagens(mensagens);
    if (problemas.length > 0) throw new Error(problemas.join(" "));
    return mensagens;
  };
}
