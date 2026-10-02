import type { Perfil } from "../auth/claims";
import { diaDaPlataforma } from "../comum/fuso";

/**
 * As regras PURAS da Ajuda com avatar (ADR-132) — sem banco, sem rede, sem Nest.
 * O que decide custo e identidade mora aqui para o teste alcançar sem montar a api.
 */

/**
 * Quem abre a Ajuda: todo mundo MENOS o estudante (decisão do dono do produto).
 * O CHECK `ck_ajuda_sessoes_perfil` da migration espelha esta tupla.
 */
export const PERFIS_DA_AJUDA = [
  "professor",
  "gestor_escola",
  "gestor_regional",
  "gestor_contrato",
  "admin",
] as const satisfies readonly Perfil[];

/** As chaves de `ajuda_limites` — o CHECK `ck_ajuda_limites_chave` espelha. */
export const CHAVES_DE_LIMITE = ["minutos-por-dia", "minutos-por-sessao"] as const;
export type ChaveDeLimite = (typeof CHAVES_DE_LIMITE)[number];
export type Limites = Record<ChaveDeLimite, number>;

/**
 * O que vale quando a linha NÃO existe — e ela deveria existir, porque a
 * migration a semeia. Falha ABERTA com a constante, como o `QuotaService`: uma
 * stack sem a linha não perde a Ajuda por um dado ausente; o log
 * `ajuda-limite-sem-linha` denuncia.
 */
export const LIMITES_PADRAO: Limites = { "minutos-por-dia": 30, "minutos-por-sessao": 10 };

/** Tetos de sanidade — os CHECKs da migration cobram os mesmos. */
export const MAXIMO_POR_DIA = 600;
export const MAXIMO_POR_SESSAO = 60;

/**
 * Menos que isto não vale abrir uma sessão: o avatar leva segundos para entrar
 * na sala e cumprimentar, e uma sessão de 20 s cairia no meio da primeira
 * resposta. Abaixo disso, a pessoa ouve "acabaram os minutos de hoje".
 */
export const SESSAO_MINIMA_S = 60;

export interface SessaoNoDia {
  inicio: Date;
  duracaoMaxS: number;
  fim: Date | null;
}

/**
 * Segundos de avatar já gastos HOJE (no fuso da plataforma) por uma pessoa.
 *
 * Sessão sem `fim` conta o TETO inteiro — falha para o lado do custo: o vendor
 * cobra até a sala fechar, e a api só sabe que fechou quando o hub avisa (ou o
 * teto chega). Sessão encerrada conta o tempo real, nunca mais que o teto.
 */
export function segundosUsadosNoDia(sessoes: SessaoNoDia[], agora: Date, fuso?: string): number {
  const hoje = diaDaPlataforma(agora, fuso);
  let total = 0;
  for (const s of sessoes) {
    if (diaDaPlataforma(s.inicio, fuso) !== hoje) continue;
    const real = s.fim ? Math.max(0, (s.fim.getTime() - s.inicio.getTime()) / 1000) : s.duracaoMaxS;
    total += Math.min(real, s.duracaoMaxS);
  }
  return Math.ceil(total);
}

/**
 * O teto da próxima sessão: o menor entre o limite por sessão e o que sobra do
 * dia. `null` = sem saldo para abrir (menos que `SESSAO_MINIMA_S`).
 */
export function duracaoDaProximaSessao(limites: Limites, usadosS: number): number | null {
  const sobra = limites["minutos-por-dia"] * 60 - usadosS;
  const duracao = Math.min(limites["minutos-por-sessao"] * 60, sobra);
  return duracao >= SESSAO_MINIMA_S ? Math.floor(duracao) : null;
}

/**
 * O marcador que o prompt do contexto do LiveAvatar carrega
 * (`[sessao:${sessao}]`, ver `scripts/liveavatar-configurar.mjs`). O vendor
 * substitui a variável pelo token que a api assinou ao abrir a sessão, e é
 * assim — e SÓ assim — que o endpoint de LLM sabe quem está falando.
 */
export const MARCADOR_DA_SESSAO = "[sessao:${sessao}]";
const MARCADOR_RE = /\[sessao:([A-Za-z0-9_\-.]{20,1000})\]/;

/** O token de dentro da mensagem `system`; `null` se não houver. */
export function extrairTokenDaSessao(system: string): string | null {
  return MARCADOR_RE.exec(system)?.[1] ?? null;
}

/** Uma mensagem no formato OpenAI, como o vendor manda. */
export interface MensagemOpenAi {
  role: string;
  content?: unknown;
}

/** Quantas mensagens do histórico vão ao modelo — a conversa de uma sessão de 10 min cabe folgada. */
export const MAXIMO_DE_MENSAGENS = 30;
/** Teto por mensagem: fala transcrita longa demais é ruído (ou alguém colando um texto). */
export const MAXIMO_POR_MENSAGEM = 2_000;

/** `content` do OpenAI é string OU lista de partes `{ type: "text", text }`. */
function textoDe(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((parte: unknown) => {
      if (parte && typeof parte === "object" && "text" in parte && typeof parte.text === "string") return parte.text;
      return "";
    })
    .join("");
}

/**
 * O histórico OpenAI do vendor → o histórico neutro do `AiProvider`.
 *
 * - A mensagem `system` do vendor é DESCARTADA: o prompt de verdade é nosso e
 *   mora na api (regra 2). O que veio do vendor só serve para achar o token.
 * - Mensagens vazias somem; seguidas do mesmo papel se juntam (o Gemini quer a
 *   conversa alternada — e duas falas seguidas da pessoa acontecem quando a
 *   resposta anterior falhou e o avatar ficou mudo).
 * - A conversa começa na PESSOA: o cumprimento do avatar (`opening_text`) vem
 *   antes de qualquer pergunta e não ajuda o modelo a responder.
 */
export function paraHistorico(mensagens: MensagemOpenAi[]): Array<{ papel: "pessoa" | "agente"; texto: string }> {
  const saida: Array<{ papel: "pessoa" | "agente"; texto: string }> = [];
  for (const m of mensagens) {
    const papel = m.role === "user" ? "pessoa" : m.role === "assistant" ? "agente" : null;
    if (!papel) continue;
    const texto = textoDe(m.content).trim().slice(0, MAXIMO_POR_MENSAGEM);
    if (!texto) continue;
    const anterior = saida[saida.length - 1];
    if (anterior && anterior.papel === papel) {
      anterior.texto = `${anterior.texto}\n${texto}`.slice(0, MAXIMO_POR_MENSAGEM);
    } else {
      saida.push({ papel, texto });
    }
  }
  const recorte = saida.slice(-MAXIMO_DE_MENSAGENS);
  while (recorte.length > 0 && recorte[0]!.papel !== "pessoa") recorte.shift();
  return recorte;
}

/**
 * A fala quando o modelo falha. O vendor fica MUDO se o endpoint devolver
 * erro (medido no spike: sem retry, sem evento) — então a falha interna vira
 * uma frase falada, e a pessoa sabe que pode perguntar de novo.
 */
export const FALA_DE_FALHA =
  "Desculpe, tive um problema para responder agora. Pode repetir a sua pergunta, por favor?";

/** Um pedaço `chat.completion.chunk` do OpenAI, já como linha SSE. */
export function pedacoSse(
  base: { id: string; criado: number; modelo: string },
  delta: Record<string, unknown>,
  fim: string | null,
  uso?: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
): string {
  const corpo: Record<string, unknown> = {
    id: base.id,
    object: "chat.completion.chunk",
    created: base.criado,
    model: base.modelo,
    choices: uso ? [] : [{ index: 0, delta, finish_reason: fim }],
  };
  if (uso) corpo.usage = uso;
  return `data: ${JSON.stringify(corpo)}\n\n`;
}
