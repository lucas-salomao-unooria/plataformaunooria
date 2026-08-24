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
