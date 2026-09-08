/**
 * Papéis e roteamento por papel — edge-safe (o middleware importa daqui).
 * Contrato congelado com a api (apps/api/src/auth/claims.ts).
 *
 * SEIS papéis desde 2026-09-08 (ADR-80). Este arquivo é uma CÓPIA deliberada da
 * lista da api: o middleware roda no edge e não pode importar de lá. As duas
 * listas divergindo é o risco conhecido, e o que o segura é o `rotuloDoPapel`
 * ser exaustivo — papel novo sem rótulo não compila.
 */

export type Papel =
  | "estudante"
  | "professor"
  | "gestor_escola"
  | "gestor_regional"
  | "gestor_contrato"
  | "admin";

export const PAPEIS: readonly Papel[] = [
  "estudante",
  "professor",
  "gestor_escola",
  "gestor_regional",
  "gestor_contrato",
  "admin",
];

/** Quem administra UMA escola por vez. O `gestor_regional` está aqui, e não com
 *  os de contrato, porque ele também trabalha uma escola por vez — o que a
 *  regional dele determina é a LISTA de escolas que ele pode ativar. */
export const GESTORES_DA_ESCOLA: readonly Papel[] = ["gestor_escola", "gestor_regional"];

/** A exceção cross-escola: token sem escola, enxerga a rede inteira. */
export const GESTORES_DO_CONTRATO: readonly Papel[] = ["gestor_contrato", "admin"];

export const ehDoContrato = (papel: Papel) => GESTORES_DO_CONTRATO.includes(papel);
export const ehGestor = (papel: Papel) =>
  GESTORES_DA_ESCOLA.includes(papel) || GESTORES_DO_CONTRATO.includes(papel);

/** Área inicial de cada papel. Papéis são mutuamente exclusivos. */
export function homeDoPapel(papel: Papel): string {
  if (papel === "professor") return "/professor";
  if (papel === "estudante") {
    // O estudante tem hub próprio: ele escolhe a missão e de lá entra no
    // aparelho (`/exp/:expId`). Antes caía direto na experiência da série dele.
    return "/estudante";
  }
  // Os quatro papéis de gestão dividem a MESMA área. Quem separa o que cada um
  // pode é o `RolesGuard` da api, item a item — nunca o middleware.
  return "/admin/usuarios";
}

/**
 * A que área um pathname pertence, para o redirect cross-área. `/estudante` e
 * `/exp` são a MESMA área: o hub e o aparelho do estudante.
 */
export function areaDoPathname(pathname: string): string {
  if (pathname.startsWith("/professor")) return "/professor";
  if (pathname.startsWith("/admin")) return "/admin/usuarios";
  if (pathname.startsWith("/analise")) return "/admin/usuarios";
  return "/estudante";
}

export function areaDoPapel(papel: Papel): string {
  return homeDoPapel(papel);
}

/**
 * Como o papel se apresenta na interface — a linha de apoio do header padrão
 * (`components/header-plataforma.tsx`). Fica aqui, junto do resto do que se
 * sabe sobre papel, para não haver duas listas de rótulos divergindo.
 *
 * `Record` EXAUSTIVO de propósito, e não uma escada de `if`: papel novo sem
 * rótulo passa a ser erro de compilação, em vez de cair no `return` final e
 * aparecer no cabeçalho como "Estudante".
 *
 * "Coordenação" e não "Gestor": é a palavra que a rede usa, e é a que já estava
 * no filtro de Usuários — o modal dizia "gestor" e o filtro dizia "Coordenação"
 * para a MESMA coisa.
 */
const ROTULOS: Record<Papel, string> = {
  estudante: "Estudante",
  professor: "Professor",
  gestor_escola: "Coordenação da escola",
  gestor_regional: "Coordenação regional",
  gestor_contrato: "Administrador do contrato",
  admin: "Administrador Unooria",
};

export function rotuloDoPapel(papel: Papel): string {
  return ROTULOS[papel];
}

/**
 * A CADEIA DE ATRIBUIÇÃO, espelhada da api (`usuarios/regras.ts`) — cada nível
 * atribui o de baixo, e o alcance real é o fechamento transitivo:
 *
 *   admin → gestor_contrato → gestor_regional → gestor_escola → professor/estudante
 *
 * Aqui ela serve só para MONTAR o formulário: quem decide de verdade é a api,
 * que reprova com 403 (`podeCriarPapel`) mesmo se esta lista mentir. Existe
 * porque um seletor que oferece o que a api recusa é pior que um seletor curto
 * — a pessoa preenche a tela inteira para receber um erro no fim.
 */
const ATRIBUI_DIRETAMENTE: Record<Papel, readonly Papel[]> = {
  admin: ["gestor_contrato"],
  gestor_contrato: ["gestor_regional"],
  gestor_regional: ["gestor_escola"],
  gestor_escola: ["professor", "estudante"],
  professor: [],
  estudante: [],
};

export function papeisQueCria(autor: Papel): readonly Papel[] {
  const vistos = new Set<Papel>();
  const fila = [...ATRIBUI_DIRETAMENTE[autor]];
  while (fila.length > 0) {
    const papel = fila.shift()!;
    if (vistos.has(papel)) continue;
    vistos.add(papel);
    fila.push(...ATRIBUI_DIRETAMENTE[papel]);
  }
  return [...vistos];
}

/** Os papéis que não pertencem a escola nenhuma — vão pela rota
 *  `POST /usuarios/sem-escola`, não pelo importador. */
export const PAPEIS_SEM_ESCOLA: readonly Papel[] = ["gestor_contrato", "gestor_regional"];
export const ehPapelSemEscola = (papel: Papel) => PAPEIS_SEM_ESCOLA.includes(papel);
