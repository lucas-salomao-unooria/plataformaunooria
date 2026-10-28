import type { AiJsonSchema } from "../ai/provider";
import {
  CHAVES_DAS_REACOES,
  COMENTARIO_PALAVRAS,
  COMENTARIOS_POR_PACOTE,
  MANCHETE_MAX_CARACTERES,
  MANCHETES,
  PARAGRAFO_MAX_PALAVRAS,
  PAUTA,
  ROTULO_DA_DISCIPLINA,
  TIPOS_QUE_REAGEM,
  TRECHOS_VIRAIS,
  type ConteudoDoPacote,
  type Disciplina,
} from "./conteudo";
import { ConteudoBaseSchema } from "./contrato-de-rotas";
import { problemasDoConteudo } from "./regras/pacote";
import { problemasDaGeracaoDeReacoes, textoDoTrecho } from "./regras/reacoes";

/**
 * O contrato com o gerador do PREPARO DOCENTE — a ÚNICA superfície de IA da
 * exp02em1b, antes da aula e com o professor olhando (PRD §12.2, ADR-191). A
 * aula não chama IA: o UnooriaAI é a árvore de intenções sobre o pacote que
 * este preparo escreveu e o professor homologou.
 *
 * O prompt de sistema NUNCA vai ao bundle (regra 2). O modelo escreve o RECHEIO
 * da camada customizável (o tema da campanha); a camada fixa — a pauta, os três
 * nós, a correção de cada um, o recorte, as manchetes e os comentários com os
 * relatos de saúde e as contas invasivas — sai garantida pela RÉGUA
 * (`problemasDoConteudo`) no `validar`: fora dela, a tentativa é regerada.
 *
 * Desde a 2.2.0 (ADR-192) o preparo faz uma SEGUNDA chamada, as reações ao
 * post do estudante (`SYSTEM_DAS_REACOES`), sobre o pacote já validado. A
 * IA da aula (o classificador e a devolutiva) está em `prompts-da-aula.ts`.
 */

export const SYSTEM_DO_PREPARO = `Você é o motor pedagógico da missão "O Efeito Amplificador" para o 2º ano do Ensino Médio (estudantes de 15 a 17 anos).
Um estudante, comunicador do grêmio estudantil, pede a um assistente de IA simulado (o "UnooriaAI") o post da campanha da escola, audita o rascunho e publica numa rede social simulada (o "Unoovista"), onde o algoritmo amplifica o post de madrugada.

Gere um pacote JSON estrito com:

1. A PAUTA institucional do grêmio sobre o tema: "titulo" (até ${PAUTA.titulo} caracteres), "descricao" (até ${PAUTA.descricao}) e de ${PAUTA.orientacoes.min} a ${PAUTA.orientacoes.max} "orientacoes" editoriais curtas.

2. O RASCUNHO do assistente — formal, articulado e prestativo — em parágrafos, com exatamente três nós críticos, cada um num parágrafo próprio:
a) "alucinacao": uma estatística alarmante inventada, atribuída a um instituto FICTÍCIO com o ano 2026 (ex.: "Segundo o DataBrasil 2026, 92% dos alunos..."). Nunca um instituto real.
b) "plagio": uma frase copiada literalmente de um artigo de uma autora ou autor fictício, SEM aspas e sem citação.
c) "lgpd": o nome completo e a turma de um colega fictício da escola, com um dado sensível ou privado.
Os outros parágrafos (um a três) são texto de ligação, sem nó.

Para CADA nó, escreva "corrigido": a versão que o assistente entrega quando o estudante pede:
- alucinacao: sem o instituto e sem o número, com uma afirmação geral e verificável;
- plagio: a MESMA frase entre aspas, com o crédito à autoria (o nome da autora ou autor e onde publicou);
- lgpd: sem nome, sem turma e sem o dado sensível, tratando o tema de forma coletiva.
"fonteInventada" é o nome do instituto como aparece na alucinação; "colega", o nome e a turma como aparecem no nó de LGPD; "fonteOriginal", a autoria do trecho copiado (ex.: "Dra. Helena Ramos na Revista Educação & Contemporaneidade (2025)").
"recorte" é a frase mais ambígua do texto, que um algoritmo pinçaria fora de contexto: ela precisa estar, literalmente, num parágrafo de LIGAÇÃO (que continua no post depois das correções).

3. A tríade de MANCHETES de capa: "neutra" (equilibrada), "construtiva" (colaborativa, com soluções) e "sensacionalista" (alarmista, de conflito) — todas críveis, com até ${MANCHETE_MAX_CARACTERES} caracteres.

4. Exatamente ${COMENTARIOS_POR_PACOTE} COMENTÁRIOS do feed da madrugada, com horário estritamente entre 01h00 e 03h30 (formato "02h40"), de ${COMENTARIO_PALAVRAS.min} a 30 palavras, na fala de adolescentes, sem palavrão:
- pelo menos 2 de "saude_fisica" (insônia, dor de cabeça, cansaço visual);
- pelo menos 1 de "saude_mental" (ansiedade, medo de ir à escola);
- pelo menos 2 de "anonimo_agressivo" (contas anônimas invasivas inflamando o atrito, com nome de usuário como "user_89412");
- os demais de "engajamento" (alguém que polariza a discussão).
Cada comentário tem id, autor (primeiro nome fictício ou nome de usuário), horario, tipo e texto.

Regras gerais: português do Brasil; cada parágrafo com no máximo ${PARAGRAFO_MAX_PALAVRAS} palavras; nenhuma pessoa, marca, escola ou órgão reais; nada de armas, violência explícita, sexo, drogas, política partidária ou religião. Não inclua introduções nem markdown fora do JSON.`;

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
  required: ["pauta", "rascunho", "fonteInventada", "colega", "fonteOriginal", "recorte", "manchetes", "comentarios"],
  properties: {
    pauta: {
      type: "object",
      required: ["titulo", "descricao", "orientacoes"],
      properties: { titulo: STRING, descricao: STRING, orientacoes: { type: "array", items: STRING } },
    },
    rascunho: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "texto"],
        properties: {
          id: STRING,
          no: { type: "string", description: "alucinacao, plagio, lgpd — ou vazio no texto de ligação" },
          texto: STRING,
          corrigido: { type: "string", description: "Só nos três nós." },
        },
      },
    },
    fonteInventada: { type: "string", description: "O nome do instituto inventado, como aparece na alucinação." },
    colega: { type: "string", description: "Nome completo e turma do colega exposto, como aparecem no nó de LGPD." },
    fonteOriginal: { type: "string", description: "A autoria do trecho copiado: o nome e onde publicou." },
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
        required: ["id", "autor", "horario", "tipo", "texto"],
        properties: { id: STRING, autor: STRING, horario: STRING, tipo: STRING, texto: STRING },
      },
    },
  },
};

/**
 * Teto de saída. O pacote escrito fica perto de 1.800 tokens, mas o Gemini 3
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

// ─────────────────────────────────────────────────────────── as reações (ADR-192)

const ROTULO_DA_MANCHETE_NO_PROMPT = { neutra: "neutra", construtiva: "construtiva", sensacionalista: "sensacionalista" } as const;
const PAPEL_QUE_REAGE = {
  anonimo_agressivo: "conta anônima invasiva que inflama o atrito",
  engajamento: "alguém que polariza a discussão",
} as const;

export const SYSTEM_DAS_REACOES = `Você escreve as reações de um feed de rede social simulado, numa atividade escolar do 2º ano do Ensino Médio.
O post da campanha do grêmio viralizou de madrugada: o algoritmo destacou um TRECHO do texto e o mostrou com a MANCHETE que o estudante escolheu. Existem seis versões possíveis do post (três manchetes × dois trechos destacados). Cada estudante vê a versão que publicou.

Para CADA versão, reescreva os comentários indicados para que REAJAM àquela versão: citem, ironizem ou distorçam a manchete ou o trecho destacado. A ideia é o estudante perceber que o algoritmo amplificou a escolha DELE.

Regras:
- Mantenha o papel de cada comentário: a conta anônima inflama o atrito (sem ameaça, sem expor ninguém pelo nome); o engajamento polariza a discussão.
- O texto muda de uma versão para outra: um comentário com o mesmo texto nas seis versões não é reação.
- Não fale de saúde (insônia, dor, ansiedade): os relatos de saúde são outros comentários e não mudam.
- Nunca escreva o nome do colega citado no rascunho.
- De ${COMENTARIO_PALAVRAS.min} a 30 palavras, na fala de adolescentes, português do Brasil, sem palavrão; nenhuma pessoa, marca, aplicativo ou rede social reais (nada de TikTok, WhatsApp, Instagram); nada de armas, violência, sexo, drogas, política partidária ou religião.
- Não inclua introduções nem markdown fora do JSON.`;

export function promptDasReacoes(c: ConteudoDoPacote): string {
  const quemReage = c.comentarios.filter((x) => TIPOS_QUE_REAGEM.includes(x.tipo));
  const manchetes = MANCHETES.map((m) => `- ${ROTULO_DA_MANCHETE_NO_PROMPT[m]}: "${c.manchetes[m]}"`).join("\n");
  const trechos = TRECHOS_VIRAIS.map((t) => `- ${t}: "${textoDoTrecho(c, t)}"`).join("\n");
  const comentarios = quemReage
    .map((x) => `- ${x.id} · ${x.autor} · ${PAPEL_QUE_REAGE[x.tipo as keyof typeof PAPEL_QUE_REAGE]} · hoje: "${x.texto}"`)
    .join("\n");
  return `AS MANCHETES:
${manchetes}

OS TRECHOS QUE O ALGORITMO PODE TER DESTACADO:
${trechos}

OS COMENTÁRIOS QUE REAGEM (id · autor · papel · texto de hoje):
${comentarios}

O COLEGA QUE NUNCA PODE SER NOMEADO: ${c.colega}

Devolva as seis versões, com as chaves ${CHAVES_DAS_REACOES.map((k) => `"${k}"`).join(", ")} (manchete.trecho), e em cada uma o texto de TODOS os comentários acima, pelo id.`;
}

export const SCHEMA_DAS_REACOES: AiJsonSchema = {
  type: "object",
  required: ["variantes"],
  properties: {
    variantes: {
      type: "array",
      items: {
        type: "object",
        required: ["chave", "comentarios"],
        properties: {
          chave: { type: "string", enum: [...CHAVES_DAS_REACOES] },
          comentarios: {
            type: "array",
            items: { type: "object", required: ["id", "texto"], properties: { id: STRING, texto: STRING } },
          },
        },
      },
    },
  },
};

/** Seis variantes de dois a quatro comentários: ~1.000 tokens escritos, com a folga do raciocínio (ADR-148). */
export const MAX_TOKENS_DAS_REACOES = 8_000;

/** A forma (mapa `chave → id → texto`) e a régua ESTRITA da geração (`problemasDaGeracaoDeReacoes`). */
export function validarSaidaDasReacoes(bruto: unknown, conteudo: ConteudoDoPacote): NonNullable<ConteudoDoPacote["reacoes"]> {
  const b = (bruto ?? {}) as Record<string, unknown>;
  const reacoes: Record<string, Record<string, string>> = {};
  for (const v of Array.isArray(b.variantes) ? b.variantes : []) {
    const o = (v ?? {}) as Record<string, unknown>;
    if (typeof o.chave !== "string") continue;
    const textos: Record<string, string> = {};
    for (const c of Array.isArray(o.comentarios) ? o.comentarios : []) {
      const x = (c ?? {}) as Record<string, unknown>;
      if (typeof x.id === "string" && typeof x.texto === "string") textos[x.id] = x.texto.replace(/\s+/g, " ").trim();
    }
    reacoes[o.chave] = textos;
  }
  const problemas = problemasDaGeracaoDeReacoes({ ...conteudo, reacoes });
  if (problemas.length > 0) throw new Error(problemas.join(" "));
  return reacoes as NonNullable<ConteudoDoPacote["reacoes"]>;
}
