import "server-only";
import { auth } from "./auth";
import { assinarTokenExperiencia } from "./chave-token";

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

  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  const resposta = await fetch(`${apiUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!resposta.ok) return null;
  return (await resposta.json()) as T;
}

/**
 * Igual ao `apiDoServidor`, mas devolve o STATUS e o corpo do erro.
 *
 * O `apiDoServidor` engole a falha em `null`, o que serve para uma página que
 * simplesmente não tem o que mostrar. Não serve para uma AÇÃO do gestor: quando
 * a importação de um perfil é recusada, a diferença entre "assinatura
 * adulterada", "não existe aluno com esse CPF aqui" e "documento de uma versão
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

  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  const resposta = await fetch(`${apiUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const dados = (await resposta.json().catch(() => null)) as T | null;
  return { ok: resposta.ok, status: resposta.status, dados };
}
