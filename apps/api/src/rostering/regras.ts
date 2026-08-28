/**
 * Regras PURAS da importação de pessoas — sem banco, sem Nest, testáveis
 * sozinhas. O que depende do estado da escola (colisão de login, turma que já
 * existe) recebe o estado por parâmetro.
 */
import {
  GRADE_PARA_SERIE,
  SERIES,
  SERIE_PARA_GRADE,
  SINONIMOS_DE_PAPEL,
  TURNOS,
  type PapelImportavel,
  type Serie,
  type Turno,
} from "./catalogo";

const semAcento = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Normaliza para comparação: sem acento, sem espaço nas pontas, minúsculo. */
export function chave(bruto: string): string {
  return semAcento(bruto).trim().toLowerCase();
}

export function normalizarPapel(bruto: string): PapelImportavel | null {
  return SINONIMOS_DE_PAPEL[chave(bruto).replace(/[\s._-]/g, "")] ?? null;
}

/**
 * Aceita `8EF`, `8ef`, `ext:8EF` (extensão do OneRoster) e o `grades` do
 * padrão (`08`, `8`). `9` é o 9º do fundamental; `10`..`12` são as três séries
 * do médio.
 */
export function normalizarSerie(bruto: string): Serie | null {
  const valor = chave(bruto).replace(/^ext:/, "").toUpperCase();
  if ((SERIES as readonly string[]).includes(valor)) return valor as Serie;
  const numero = valor.match(/^(\d{1,2})$/)?.[1];
  if (numero) return GRADE_PARA_SERIE[numero.padStart(2, "0")] ?? null;
  return null;
}

export function serieParaGrade(serie: Serie): string {
  return SERIE_PARA_GRADE[serie];
}

export function normalizarTurno(bruto: string): Turno | null {
  const valor = chave(bruto);
  if (!valor) return null;
  const encontrado = TURNOS.find((t) => t === valor);
  if (encontrado) return encontrado;
  if (valor === "matutino") return "manha";
  if (valor === "vespertino") return "tarde";
  if (valor === "noturno") return "noite";
  return null;
}

const USUARIO_VALIDO = /^[a-z0-9._-]{3,64}$/;

export function usuarioEhValido(usuario: string): boolean {
  return USUARIO_VALIDO.test(usuario);
}

/**
 * Login a partir do nome: primeiro nome + último sobrenome, sem acento.
 * Colisão ganha sufixo numérico.
 *
 * Existe porque a coluna `usuario` é opcional: pedir que a escola invente 10 mil
 * logins únicos à mão é pedir que o arquivo nunca fique pronto. O relatório
 * devolve os logins gerados para o gestor imprimir e entregar.
 */
export function gerarUsuario(nome: string, jaUsados: ReadonlySet<string>): string {
  const partes = semAcento(nome)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const primeiro = partes[0] ?? "";
  const ultimo = partes.length > 1 ? partes[partes.length - 1]! : "";
  let base = [primeiro, ultimo].filter(Boolean).join(".").slice(0, 56);
  // Nome curto demais ("Ana") não formaria um login válido de 3 caracteres.
  while (base.length > 0 && base.length < 3) base += "0";
  if (!base) base = "usuario";

  if (!jaUsados.has(base)) return base;
  for (let n = 2; n < 10_000; n += 1) {
    const tentativa = `${base}${n}`;
    if (!jaUsados.has(tentativa)) return tentativa;
  }
  throw new Error(`não foi possível gerar login único a partir de "${nome}"`);
}

/**
 * Senha inicial legível em voz alta: sem 0/O nem 1/l, porque ela vai ser ditada
 * numa sala com 30 crianças. Vale só até o primeiro acesso.
 */
export function gerarSenha(tamanho = 10): string {
  const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  let senha = "";
  for (const b of bytes) senha += alfabeto[b % alfabeto.length];
  return senha;
}

export const TAMANHO_MINIMO_DE_SENHA = 8;

export function senhaAceitavel(senha: string): boolean {
  return senha.length >= TAMANHO_MINIMO_DE_SENHA && senha.length <= 200;
}

/**
 * O período letivo "de hoje": o ano letivo que contém a data. Sem coluna
 * `ativo` — flag de estado que ninguém atualiza mente mais do que ajuda; a
 * verdade já está nas datas. Sem nenhum vigente, vale o mais recente.
 */
export function periodoVigente<T extends { inicio: Date; fim: Date }>(
  periodos: readonly T[],
  agora: Date,
): T | null {
  const dentro = periodos.filter((p) => p.inicio <= agora && agora <= p.fim);
  const candidatos = dentro.length > 0 ? dentro : [...periodos];
  return (
    candidatos.sort((a, b) => b.inicio.getTime() - a.inicio.getTime())[0] ?? null
  );
}
