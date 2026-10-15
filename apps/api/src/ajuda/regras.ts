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

/* ------------------------------------------------- os dois atendentes (ADR-158) */

/**
 * Quem atende na Ajuda: o `mascote` (o mascote 3D da Unooria falando pelo
 * Gemini Live) ou o `avatar` (o atendente em vídeo do LiveAvatar, ADR-132). Os
 * CHECKs `ck_ajuda_sessoes_atendente` e `ck_ajuda_configuracao_atendente`
 * espelham esta tupla.
 */
export const ATENDENTES = ["mascote", "avatar"] as const;
export type Atendente = (typeof ATENDENTES)[number];

/**
 * As 30 vozes pré-definidas do Gemini Live, com o jeito de cada uma segundo o
 * catálogo (lista do PoC do mascote, out/2026). É a lista FECHADA que o painel
 * oferece: a voz vai para o setup do vendor, e um nome livre ali seria texto
 * de fora entrando no pedido.
 */
export const VOZES_DO_MASCOTE = [
  ["Leda", "jovem"], ["Puck", "animada"], ["Zephyr", "brilhante"], ["Kore", "firme"],
  ["Aoede", "leve"], ["Achird", "amigável"], ["Laomedeia", "animada"], ["Sadachbia", "viva"],
  ["Autonoe", "brilhante"], ["Callirrhoe", "tranquila"], ["Umbriel", "tranquila"],
  ["Despina", "suave"], ["Algieba", "suave"], ["Vindemiatrix", "gentil"], ["Achernar", "macia"],
  ["Sulafat", "calorosa"], ["Erinome", "clara"], ["Iapetus", "clara"], ["Charon", "informativa"],
  ["Rasalgethi", "informativa"], ["Fenrir", "empolgada"], ["Orus", "firme"], ["Alnilam", "firme"],
  ["Schedar", "equilibrada"], ["Gacrux", "madura"], ["Pulcherrima", "direta"],
  ["Zubenelgenubi", "casual"], ["Sadaltager", "experiente"], ["Enceladus", "sussurrada"],
  ["Algenib", "rouca"],
] as const satisfies ReadonlyArray<readonly [string, string]>;
export type VozDoMascote = (typeof VOZES_DO_MASCOTE)[number][0];
export const NOMES_DAS_VOZES = VOZES_DO_MASCOTE.map(([nome]) => nome) as [VozDoMascote, ...VozDoMascote[]];

/**
 * O modelo 3D do mascote no bucket de assets (`gs://{contrato}-assets/...`).
 * Sai do PoC comprimido (meshopt + texturas 1024: 12,7 MB → 3,4 MB); subir um
 * mascote novo é publicar `-v2` e trocar AQUI — o caminho publicado é imutável.
 */
export const CAMINHO_DO_MODELO_DO_MASCOTE = "ajuda/mascote/mascote-v1.glb";

/** O formato do nome de modelo — o CHECK `ck_ajuda_configuracao_modelo` cobra o mesmo. */
export const MODELO_DO_MASCOTE_RE = /^[a-z0-9][a-z0-9.-]{2,80}$/;

/** A configuração da Ajuda como a api a usa (a linha `ajuda_configuracao`, sem a autoria). */
export interface ConfiguracaoDaAjuda {
  atendentePadrao: Atendente;
  permitirTroca: boolean;
  mascote: {
    voz: string;
    modelo: string;
    /** 0 a 1: quantos dB abaixo do pico ainda abrem a boca. */
    sensibilidade: number;
    /** 0 a 1: o quanto a boca demora para abrir e fechar. */
    suavizacao: number;
    /** 0 a 200 ms: a boca se mexe antes do som, como na fala de verdade. */
    antecipacaoMs: number;
    /** 0 a 1: parado, de boca fechada (0) até o sorriso original do modelo (1). */
    bocaRepouso: number;
  };
  /**
   * As instruções de "como responder" editadas no painel (ADR-165). `null` =
   * o texto padrão do código (`instrucoesPadrao`, em `prompt.ts`).
   */
  instrucoes: Record<Atendente, string | null>;
}

/**
 * O que vale sem a linha — e ela deveria existir, porque a migration a semeia.
 * Falha ABERTA, como `LIMITES_PADRAO`; o log `ajuda-configuracao-sem-linha` acusa.
 */
export const CONFIGURACAO_PADRAO: ConfiguracaoDaAjuda = {
  atendentePadrao: "mascote",
  permitirTroca: true,
  mascote: { voz: "Leda", modelo: "gemini-3.8-live", sensibilidade: 0.5, suavizacao: 0.5, antecipacaoMs: 60, bocaRepouso: 0.5 },
  instrucoes: { mascote: null, avatar: null },
};

/**
 * Quais atendentes estão MONTADOS nesta stack. Um lugar só, porque duas telas
 * perguntam (a janela da Ajuda e o painel do `admin`) e a resposta não pode
 * divergir: o avatar precisa do vendor e das duas chaves da api; o mascote, da
 * Vertex (o Gemini Live) e da chave que assina o bilhete.
 */
export function atendentesMontados(pecas: {
  avatarLigado: boolean;
  vozLigada: boolean;
  chaveDaSessao: unknown;
  segredoDoLlm: unknown;
}): Record<Atendente, boolean> {
  const chave = Boolean(pecas.chaveDaSessao);
  return {
    avatar: pecas.avatarLigado && chave && Boolean(pecas.segredoDoLlm),
    mascote: pecas.vozLigada && chave,
  };
}

/**
 * Quem atende de fato: o pedido da pessoa (se a troca é permitida), senão o
 * padrão — e, se o escolhido não está montado nesta stack, o outro. `null` =
 * nenhum dos dois está disponível.
 */
export function atendenteEfetivo(
  config: Pick<ConfiguracaoDaAjuda, "atendentePadrao" | "permitirTroca">,
  disponiveis: Record<Atendente, boolean>,
  pedido?: Atendente,
): Atendente | null {
  const preferido = pedido && config.permitirTroca ? pedido : config.atendentePadrao;
  if (disponiveis[preferido]) return preferido;
  const outro: Atendente = preferido === "mascote" ? "avatar" : "mascote";
  return disponiveis[outro] ? outro : null;
}

/* ------------------------------------------- o protocolo do mascote ao vivo */

/** Teto de uma pergunta escrita — o mesmo do `ChatComposer` do hub. */
export const MAXIMO_DO_TEXTO_DO_MASCOTE = 500;
/**
 * Teto de um pedaço de microfone em base64. O hub manda 100 ms de PCM 16 kHz
 * (3.200 bytes → ~4,3 mil caracteres); dez vezes isso é folga, não convite.
 */
export const MAXIMO_DO_AUDIO_DO_MASCOTE = 48_000;
/** Mensagens por segundo vindas do navegador: o microfone manda 10; o resto é abuso. */
export const MENSAGENS_POR_SEGUNDO_DO_MASCOTE = 30;
/** A primeira mensagem (o bilhete) tem de chegar logo depois de a conexão abrir. */
export const ESPERA_DO_BILHETE_MS = 10_000;
/** O bilhete vale para ENTRAR — a conexão tem de abrir logo depois do `POST /ajuda/sessoes`. */
export const VALIDADE_DO_BILHETE_S = 120;

/**
 * Os códigos com que a api fecha a conexão do mascote — o hub traduz cada um
 * numa frase (`lib/ajuda/mascote.ts`). Faixa 4000–4999, a das aplicações.
 */
export const FECHAMENTOS_DO_MASCOTE = {
  /** O bilhete não chegou, não confere, venceu ou já foi usado. */
  BILHETE_INVALIDO: 4401,
  /** O produto `ajuda` foi desligado para a escola. */
  PRODUTO_DESLIGADO: 4403,
  /** O teto da sessão chegou. */
  TEMPO_ESGOTADO: 4408,
  /** A pessoa mandou mensagem demais, ou fora do formato. */
  ABUSO: 4429,
  /** O Gemini não abriu a sessão, ou caiu no meio. */
  VOZ_FALHOU: 4502,
  /** A stack não tem a Vertex nem a chave da sessão. */
  INDISPONIVEL: 4503,
} as const;
