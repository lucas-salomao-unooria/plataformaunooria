/**
 * Papéis e roteamento por papel — edge-safe (o middleware importa daqui).
 * Contrato congelado com a api (apps/api/src/auth/claims.ts).
 */

export type Papel = "aluno" | "professor" | "gestor" | "admin-contrato";

export const PAPEIS: readonly Papel[] = ["aluno", "professor", "gestor", "admin-contrato"];

/** Área inicial de cada papel. Papéis são mutuamente exclusivos. */
export function homeDoPapel(papel: Papel): string {
  if (papel === "professor") return "/professor";
  if (papel === "gestor") return "/admin/usuarios";
  // admin-contrato ganha /analise na fase M6; até lá administra usuários.
  if (papel === "admin-contrato") return "/admin/usuarios";
  // O aluno tem hub próprio: ele escolhe a missão e de lá entra no aparelho
  // (`/exp/:expId`). Antes caía direto na experiência da série dele.
  return "/aluno";
}

/**
 * A que área um pathname pertence, para o redirect cross-área. `/aluno` e
 * `/exp` são a MESMA área: o hub e o aparelho do aluno.
 */
export function areaDoPathname(pathname: string): string {
  if (pathname.startsWith("/professor")) return "/professor";
  if (pathname.startsWith("/admin")) return "/admin/usuarios";
  if (pathname.startsWith("/analise")) return "/admin/usuarios";
  return "/aluno";
}

export function areaDoPapel(papel: Papel): string {
  if (papel === "professor") return "/professor";
  if (papel === "gestor" || papel === "admin-contrato") return "/admin/usuarios";
  return "/aluno";
}
