import { createHash } from "node:crypto";

/* Sem `server-only`: estas funções são PURAS e existem para ser testadas ao lado
   da cópia da api — é a comparação entre as duas que garante que emissor e
   verificador cheguem ao mesmo hash. Segredo nenhum passa por aqui; quem guarda
   a chave é `chave-token.ts`, e esse sim é `server-only`. */

/**
 * O hash canônico que a assinatura do perfil portátil cobre.
 *
 * Duplicado de `apps/api/src/portabilidade/regras.ts` de propósito, e é a única
 * duplicação aceitável aqui: as duas pontas precisam calcular o MESMO hash, e
 * uma delas é o emissor enquanto a outra é uma instalação diferente da
 * plataforma — que pode estar numa versão diferente. Extrair para um pacote
 * compartilhado daria a ilusão de que as duas sobem juntas, e elas não sobem.
 * A regra que sustenta isso é o formato: chaves ordenadas, recursivamente.
 */
export function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(",")}]`;
  const entradas = Object.entries(valor as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${jsonCanonico(v)}`).join(",")}}`;
}

export function hashDoPerfil(perfil: unknown): string {
  return createHash("sha256").update(jsonCanonico(perfil), "utf8").digest("hex");
}

/** Nome do arquivo oferecido no download — legível por quem recebe por e-mail. */
export function nomeDoArquivo(nome: string, emitidoEm: Date): string {
  const semAcento = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `perfil-${semAcento || "estudante"}-${emitidoEm.toISOString().slice(0, 10)}.json`;
}
