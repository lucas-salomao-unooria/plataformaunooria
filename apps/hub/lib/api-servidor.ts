import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { assinarTokenExperiencia } from "./chave-token";
import { cabecalhosComoObjeto, log, logDaRequisicao } from "./log";
import { lerTrace, traceparentPara } from "./trace-da-requisicao";

/**
 * Uma api pendurada não pode pendurar o hub junto: toda chamada server-side
 * tem teto. 10 s cobre a rota mais lenta que uma PÁGINA espera (as ações longas
 * — geração de IA — são assíncronas por desenho e devolvem 202).
 */
export const TIMEOUT_DA_API_MS = 10_000;

/**
 * Cabeçalhos da requisição que originou este render, quando existe uma. Fora
 * de requisição (build estático, teste) `headers()` lança — aí não há trace a
 * repassar nem contexto a logar, e o logger raiz basta.
 */
async function cabecalhosDaRequisicao(): Promise<Record<string, string | string[] | undefined> | undefined> {
  try {
    return cabecalhosComoObjeto(await headers());
  } catch {
    return undefined;
  }
}

/**
 * O `fetch` comum das duas funções abaixo: assina o token, repassa o
 * `traceparent` da requisição de origem (o trace do navegador atravessa
 * hub → api) e aplica o teto. Falha de rede e timeout viram uma `Response`
 * sintética 599/598 — quem chama trata status, não exceção.
 */
async function chamarApi(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } | undefined,
  token: string,
): Promise<{ resposta: Response; cabecalhos: Record<string, string | string[] | undefined> | undefined }> {
  const cabecalhos = await cabecalhosDaRequisicao();
  const traceparent = traceparentPara(lerTrace(cabecalhos ?? {}));
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  try {
    const resposta = await fetch(`${apiUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(traceparent ? { traceparent } : {}),
        ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_DA_API_MS),
    });
    return { resposta, cabecalhos };
  } catch (erro) {
    const timeout = erro instanceof Error && erro.name === "TimeoutError";
    const status = timeout ? 598 : 599;
    (cabecalhos ? logDaRequisicao(cabecalhos) : log).warn(
      { rota: path, status, codigo: timeout ? "api-timeout" : "api-indisponivel", err: erro },
      timeout ? "a api não respondeu no teto" : "a api não respondeu",
    );
    return { resposta: new Response(null, { status }), cabecalhos };
  }
}

/**
 * Fetch server-side do hub para a api NestJS — o que as páginas do professor
 * faziam com `prisma.*` no origem vira `await apiDoServidor(...)` aqui.
 * O token é assinado da sessão (mesma moeda do BFF e da experiência) e nunca
 * chega ao client.
 */
export async function apiDoServidor<T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown },
): Promise<T | null> {
  const session = await auth();
  if (!session?.usuario) return null;
  const u = session.usuario;

  const token = await assinarTokenExperiencia({
    sub: u.id,
    escola_id: u.escolaId,
    turma_id: u.turmaId,
    perfil: u.papel,
  });

  const { resposta, cabecalhos } = await chamarApi(path, init, token);
  if (!resposta.ok) {
    // Continua devolvendo `null` (as páginas dependem disso), mas deixa de ser
    // mudo: "a api recusou" e "não há dados" eram indistinguíveis no log. O
    // `requestIdDaApi` é o que liga esta linha à linha ERROR da api.
    if (resposta.status < 598) {
      const corpo = (await resposta.json().catch(() => null)) as { requestId?: string; codigo?: string } | null;
      (cabecalhos ? logDaRequisicao(cabecalhos) : log).warn(
        { rota: path, status: resposta.status, requestIdDaApi: corpo?.requestId, codigoDaApi: corpo?.codigo, codigo: "api-recusou" },
        "a api recusou a chamada do hub",
      );
    }
    return null;
  }
  return (await resposta.json()) as T;
}

/**
 * Igual ao `apiDoServidor`, mas devolve o STATUS e o corpo do erro.
 *
 * O `apiDoServidor` engole a falha em `null`, o que serve para uma página que
 * simplesmente não tem o que mostrar. Não serve para uma AÇÃO do gestor: quando
 * a importação de um perfil é recusada, a diferença entre "assinatura
 * adulterada", "não existe estudante com esse CPF aqui" e "documento de uma versão
 * que não sei ler" é a única coisa que ele precisa ler na tela.
 */
export async function apiDoServidorBruto<T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown },
): Promise<{ ok: boolean; status: number; dados: T | null }> {
  const session = await auth();
  if (!session?.usuario) return { ok: false, status: 401, dados: null };
  const u = session.usuario;

  const token = await assinarTokenExperiencia({
    sub: u.id,
    escola_id: u.escolaId,
    turma_id: u.turmaId,
    perfil: u.papel,
  });

  const { resposta } = await chamarApi(path, init, token);
  const dados = (await resposta.json().catch(() => null)) as T | null;
  return { ok: resposta.ok, status: resposta.status, dados };
}
