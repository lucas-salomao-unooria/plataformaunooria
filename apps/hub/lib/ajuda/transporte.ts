import { z } from "zod";

/**
 * O NAVEGADOR ABRINDO A AJUDA — sempre pelo hub (`/api/plataforma/ajuda/...`),
 * que segura a sessão e assina o token. O que volta é só o token da sala de
 * vídeo do vendor; a chave da conta, o prompt e a base ficam na api (regra 2).
 *
 * Funções puras sobre `fetch` (injetável), para o teste montar a resposta à mão.
 */

type Fetch = typeof fetch;

export const BASE_DA_AJUDA = "/api/plataforma/ajuda";

export const ATENDENTES = ["mascote", "avatar"] as const;
export type Atendente = (typeof ATENDENTES)[number];

/** Espelha `AjustesDoMascoteSchema` de `apps/api/src/ajuda/contrato-de-rotas.ts`. */
export const AjustesDoMascoteSchema = z.object({
  voz: z.string(),
  modelo: z.string(),
  sensibilidade: z.number().min(0).max(1),
  suavizacao: z.number().min(0).max(1),
  antecipacaoMs: z.number().int().min(0).max(200),
  bocaRepouso: z.number().min(0).max(1),
});
export type AjustesDoMascote = z.infer<typeof AjustesDoMascoteSchema>;

const SessaoComumSchema = z.object({
  id: z.string().uuid(),
  duracaoMaximaS: z.number().int().positive(),
  segundosRestantesHoje: z.number().int().min(0),
});

/** Espelha `SessaoAbertaSchema` de `apps/api/src/ajuda/contrato-de-rotas.ts` (ADR-132, ADR-158). */
export const SessaoAbertaSchema = z.discriminatedUnion("atendente", [
  SessaoComumSchema.extend({ atendente: z.literal("avatar"), tokenDaSessao: z.string().min(1) }),
  SessaoComumSchema.extend({ atendente: z.literal("mascote"), bilhete: z.string().min(1), ajustes: AjustesDoMascoteSchema }),
]);
export type SessaoAberta = z.infer<typeof SessaoAbertaSchema>;
export type SessaoDoAvatar = Extract<SessaoAberta, { atendente: "avatar" }>;
export type SessaoDoMascote = Extract<SessaoAberta, { atendente: "mascote" }>;

/** Espelha `ConfiguracaoDaJanelaSchema`: quem atende, se dá para trocar, e onde está o modelo 3D. */
export const ConfiguracaoDaJanelaSchema = z.object({
  atendente: z.enum(ATENDENTES).nullable(),
  podeTrocar: z.boolean(),
  modeloDoMascote: z.string().url(),
});
export type ConfiguracaoDaJanela = z.infer<typeof ConfiguracaoDaJanelaSchema>;

const RecusaSchema = z.object({ codigo: z.string().optional(), mensagem: z.string().optional() }).passthrough();

export type Abertura<S = SessaoAberta> = { ok: true; sessao: S } | { ok: false; mensagem: string; podeRepetir: boolean };

const SEM_CONEXAO = "Não foi possível falar com a plataforma. Confira a conexão e tente de novo.";

/**
 * Status + corpo `{ codigo, mensagem }` → a frase da tela. A frase da api vale
 * quando ela é para a pessoa (minutos do dia, vendor fora do ar); 401 e 403
 * têm a frase do próximo passo.
 */
export function recusaParaTela(status: number, corpo: unknown): { mensagem: string; podeRepetir: boolean } {
  const lido = RecusaSchema.safeParse(corpo);
  const codigo = lido.success ? lido.data.codigo : undefined;
  const daApi = lido.success ? lido.data.mensagem?.trim() || undefined : undefined;
  if (status === 401) return { mensagem: "Sua sessão terminou. Entre de novo para continuar.", podeRepetir: false };
  if (status === 403) {
    return {
      mensagem:
        codigo === "recurso-indisponivel"
          ? "A Ajuda com atendente não está disponível na sua rede."
          : "Você não tem acesso à Ajuda.",
      podeRepetir: false,
    };
  }
  if (codigo === "SEM_MINUTOS") return { mensagem: daApi ?? "Você já usou os minutos de Ajuda de hoje.", podeRepetir: false };
  return { mensagem: daApi ?? SEM_CONEXAO, podeRepetir: true };
}

/**
 * Quem atende: o padrão da rede (o `admin` escolhe em `/unooria/uso-de-ia`) e
 * se a pessoa pode trocar. Falha = `null`, e a janela tenta abrir do jeito
 * padrão — a api decide de novo na abertura.
 */
export async function lerConfiguracao(f: Fetch = fetch): Promise<ConfiguracaoDaJanela | null> {
  try {
    const res = await f(`${BASE_DA_AJUDA}/configuracao`);
    if (!res.ok) return null;
    const lido = ConfiguracaoDaJanelaSchema.safeParse(await res.json());
    return lido.success ? lido.data : null;
  } catch {
    return null;
  }
}

/**
 * Abre a sessão. `atendente` é o pedido da pessoa (vale se a troca é
 * permitida); sem ele, a api abre o padrão da rede.
 */
export async function abrirSessao(atendente?: Atendente, f: Fetch = fetch): Promise<Abertura> {
  let res: Response;
  try {
    res = await f(`${BASE_DA_AJUDA}/sessoes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(atendente ? { atendente } : {}),
    });
  } catch {
    return { ok: false, mensagem: SEM_CONEXAO, podeRepetir: true };
  }
  const corpo: unknown = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, ...recusaParaTela(res.status, corpo) };
  const lido = SessaoAbertaSchema.safeParse(corpo);
  if (!lido.success) return { ok: false, mensagem: SEM_CONEXAO, podeRepetir: true };
  return { ok: true, sessao: lido.data };
}

/**
 * Avisa a api que a sessão acabou — é o tempo REAL que passa a contar no dia.
 * `keepalive`: o aviso sobrevive ao fechamento da aba, que é justamente quando
 * ele mais importa. Falhar aqui não é erro de tela: o teto da sessão fecha a
 * sala de qualquer jeito.
 */
export function encerrarSessao(id: string, f: Fetch = fetch): void {
  void f(`${BASE_DA_AJUDA}/sessoes/${encodeURIComponent(id)}/encerrar`, { method: "POST", keepalive: true }).catch(
    () => undefined,
  );
}
