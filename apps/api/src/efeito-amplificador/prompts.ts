import type { AiJsonSchema } from "../ai/provider";
import {
  COMENTARIO_PALAVRAS,
  COMENTARIOS_POR_PACOTE,
  MANCHETE_MAX_CARACTERES,
  PARAGRAFO_MAX_PALAVRAS,
  ROTULO_DA_DISCIPLINA,
  type ConteudoDoPacote,
  type Disciplina,
} from "./conteudo";
import { ConteudoBaseSchema } from "./contrato-de-rotas";
import { problemasDoConteudo } from "./regras/pacote";

/**
 * O contrato com o gerador do PREPARO DOCENTE — a única superfície de IA da
 * exp02em1b, antes da aula e com o professor olhando (one-pager §9a, §14).
 *
 * O prompt de sistema NUNCA vai ao bundle (regra 2). **Zero tokens em sala**:
 * o "UnooriaAI" que o estudante usa é a árvore de intenções do servidor
 * (`regras/intencoes.ts`) sobre o pacote homologado — determinístico, o mesmo
 * para a turma inteira às oito da manhã.
 *
 * O modelo escreve o RECHEIO da camada customizável (o tema da campanha); a
 * camada fixa — os três nós, a correção de cada um, o recorte, as manchetes e
 * as duas dimensões de saúde — sai garantida pela RÉGUA (`problemasDoConteudo`)
 * no `validar`: fora dela, a tentativa é regerada.
 */

export const SYSTEM_DO_PREPARO = `Você é o assistente de conteúdo da Unooria para o 2º ano do Ensino Médio (estudantes de 15 a 17 anos).
Você escreve o pacote de uma missão de letramento digital: um estudante, comunicador do grêmio estudantil, pede a um assistente de IA simulado (o "UnooriaAI") um post para a campanha da escola, audita o rascunho e publica numa rede social simulada (o "Unoovista"), onde o algoritmo amplifica o post de madrugada.

O RASCUNHO do assistente soa formal, articulado e prestativo, e DEVE embutir os três nós críticos, cada um num parágrafo próprio:
a) ALUCINAÇÃO FACTUAL ("alucinacao"): uma estatística alarmista atribuída a um instituto INVENTADO e verossímil (ex.: "Segundo o DataBrasil 2026, 92% dos alunos..."). Nunca um instituto real (IBGE, Datafolha, universidades reais).
b) VIOLAÇÃO AUTORAL ("plagio"): um trecho literal de uma coluna de um veículo regional fictício, introduzido pelo nome do veículo, SEM aspas e sem crédito ao autor.
c) VIOLAÇÃO DE LGPD ("lgpd"): o nome completo e a turma de um colega fictício da escola, expondo um caso sensível de saúde (dado pessoal sensível).
Os outros parágrafos (um ou dois) são texto de ligação, sem nó.

Para CADA nó, escreva também "corrigido": a versão que o assistente entrega quando o estudante pede a correção:
- alucinacao: sem o instituto e sem o número, trocado por uma orientação a partir da experiência da própria escola;
- plagio: o MESMO trecho entre aspas, creditando o veículo pelo nome;
- lgpd: sem nome, sem turma e sem diagnóstico, tratando o tema de forma anônima e educativa.
"recorte" é uma frase de até 120 caracteres que está, literalmente, DENTRO do trecho copiado (no original e no corrigido): a frase mais ambígua, que um algoritmo pinçaria fora de contexto.

As três manchetes: "neutra" (equilibrada), "construtiva" (informativa e propositiva) e "sensacionalista" (provocativa, de conflito) — todas críveis, com até ${MANCHETE_MAX_CARACTERES} caracteres.

Os ${COMENTARIOS_POR_PACOTE} comentários do Unoovista são de madrugada (horário entre 01:15 e 03:45, formato "02:40"), com ${COMENTARIO_PALAVRAS.min} a 30 palavras, na fala de adolescentes, sem palavrão:
- pelo menos um de "saude_fisica" (perda de sono, dor de cabeça, horas rolando a tela sem comer);
- pelo menos um de "saude_mental" (ansiedade, humilhação, medo de ir à escola);
- pelo menos um de "risco_seguranca" (conta desconhecida invasiva pedindo contato ou localização, ou perfil de ofertas oportunista);
- os demais podem ser "neutro" (alguém que percebe a frase recortada fora de contexto).
Cada comentário tem autor (primeiro nome fictício ou "Conta Desconhecida"), handle (@ em minúsculas, sem espaço), horario, tipo e texto.

Regras gerais: português do Brasil; cada parágrafo com no máximo ${PARAGRAFO_MAX_PALAVRAS} palavras; nenhuma pessoa, marca, escola ou órgão reais; nada de armas, violência explícita, sexo, drogas, política partidária ou religião.`;

export function promptDoPreparo(p: { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null }): string {
  return `Escreva o pacote da missão.

COMPONENTE CURRICULAR: ${ROTULO_DA_DISCIPLINA[p.disciplina]}
TEMA DA CAMPANHA: <<<${p.tema.trim()}>>>
TÓPICOS DA AULA (o rascunho trata deles): <<<${p.assuntos.map((a) => a.trim()).join("; ")}>>>
CONTEXTO DA ESCOLA (opcional): <<<${p.contexto?.trim() || "não informado"}>>>

Use ids "p1", "p2"… nos parágrafos, na ordem do post, e "c1" a "c${COMENTARIOS_POR_PACOTE}" nos comentários.`;
}

const STRING = { type: "string" } as const;

export const SCHEMA_DO_PREPARO: AiJsonSchema = {
  type: "object",
  required: ["rascunho", "fonteInventada", "colega", "veiculo", "recorte", "manchetes", "comentarios"],
  properties: {
    rascunho: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "texto"],
        properties: {
          id: STRING,
          no: { type: "string", description: 'alucinacao, plagio, lgpd — ou vazio no texto de ligação' },
          texto: STRING,
          corrigido: { type: "string", description: "Só nos três nós." },
        },
      },
    },
    fonteInventada: { type: "string", description: "O nome do instituto inventado, como aparece na alucinação." },
    colega: { type: "string", description: "Nome completo e turma do colega exposto, como aparece no nó de LGPD." },
    veiculo: { type: "string", description: "O nome do veículo copiado, como aparece no plágio." },
    recorte: STRING,
    manchetes: {
      type: "object",
      required: ["neutra", "construtiva", "sensacionalista"],
      properties: { neutra: STRING, construtiva: STRING, sensacionalista: STRING },
    },
    comentarios: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "autor", "handle", "horario", "tipo", "texto"],
        properties: { id: STRING, autor: STRING, handle: STRING, horario: STRING, tipo: STRING, texto: STRING },
      },
    },
  },
};

/**
 * Teto de saída. O pacote escrito fica perto de 1.500 tokens, mas o Gemini 3
 * PENSA e o raciocínio conta no mesmo teto (ADR-148): teto apertado devolve
 * `MAX_TOKENS` com o JSON vazio. O teto existe porque JSON truncado não chega
 * como `MAX_TOKENS` legível — chega como `JSON.parse` falhando (ADR-74).
 */
export const MAX_TOKENS_DO_PREPARO = 12_000;

/**
 * O `validar` do `generateJson`: a forma (Zod) e a RÉGUA. O `no` vazio vira
 * `null`, e a correção que o modelo mandar num parágrafo de ligação é descartada,
 * não recusada — ruído inofensivo, e recusar custaria uma tentativa paga.
 */
export function validarSaidaDoPreparo(bruto: unknown): ConteudoDoPacote {
  const b = (bruto ?? {}) as Record<string, unknown>;
  const rascunho = Array.isArray(b.rascunho)
    ? b.rascunho.map((x) => {
        const p = (x ?? {}) as Record<string, unknown>;
        const no = p.no === "alucinacao" || p.no === "plagio" || p.no === "lgpd" ? p.no : null;
        return { id: p.id, no, texto: p.texto, ...(no && typeof p.corrigido === "string" ? { corrigido: p.corrigido } : {}) };
      })
    : b.rascunho;
  const lido = ConteudoBaseSchema.safeParse({ ...b, rascunho });
  if (!lido.success) throw new Error(lido.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" "));
  const problemas = problemasDoConteudo(lido.data);
  if (problemas.length > 0) throw new Error(problemas.join(" "));
  return lido.data;
}
