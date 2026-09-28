/**
 * As regras PURAS da sala de aula (ADR-69). Sem Prisma, sem Nest — é o que o
 * teste exercita sem banco.
 */

/**
 * O que o estudante e o professor veem em cada missão da grade.
 *
 * `bloqueada` é a AUSÊNCIA de linha em `liberacoes` — não existe estado
 * "bloqueada" no banco. Ela aparece na tela com cadeado, e essa foi uma decisão
 * explícita: some da tela seria mais simples, mas a trilha do ano é a promessa
 * que a criança tem do que vem depois, e uma lista que muda de tamanho sozinha
 * não deixa ninguém entender que a próxima unidade existe.
 *
 * `encerrada` continua VISÍVEL, com o rótulo. O que a criança fez não pode
 * evaporar da tela quando o professor fecha a aula.
 */
export type EstadoDaMissao = "liberada" | "encerrada" | "bloqueada";

/** O que o banco guarda. `bloqueada` não entra: ela é a ausência da linha. */
export type EstadoGravado = Extract<EstadoDaMissao, "liberada" | "encerrada">;

export const ESTADOS_GRAVADOS = ["liberada", "encerrada"] as const;

/** A experiência, como o catálogo (`experiencias`) a descreve. */
export interface ExperienciaDoCatalogo {
  expId: string;
  nome: string;
  /** Vazio = TODAS as séries — é como uma transversal se declara (app-70). */
  series: string[];
  /** A unidade do ano (1 a 4). `null` na transversal: ela não mora em unidade. */
  unidade?: number | null;
  publico: string;
}

export interface MissaoNaGrade {
  expId: string;
  nome: string;
  /** A unidade do ano; `null` na transversal e em quem não declarou. */
  unidade: number | null;
  estado: EstadoDaMissao;
  /** Vale para qualquer ano (a `series: []` do manifesto). */
  transversal: boolean;
  /** A missão não é da série desta turma — só aparece com `?todas=1`. */
  deOutraSerie: boolean;
}

/**
 * A missão serve a esta série?
 *
 * `series: []` quer dizer TODAS, nunca NENHUMA. É o contrato do manifesto, e
 * inverter isso faz a transversal desaparecer de todas as grades sozinha.
 */
export function serveASerie(experiencia: ExperienciaDoCatalogo, serie: string): boolean {
  return experiencia.series.length === 0 || experiencia.series.includes(serie);
}

export function ehTransversal(experiencia: ExperienciaDoCatalogo): boolean {
  return experiencia.series.length === 0;
}

/**
 * A GRADE de uma turma: o que pode ser liberado ali, e em que estado está.
 *
 * Só experiência de `publico: "estudante"` entra. As ferramentas do professor
 * (app-90, app-91) não são missões de turma — elas nem passam por `/exp/*` — e
 * uma delas na grade seria um botão de liberar que não liberaria nada.
 *
 * `incluirOutrasSeries` é o "ver outras séries" da tela. Existe porque turma
 * multisseriada e reforço existem: a ausência total viraria pedido de suporte, e
 * a presença por padrão afogaria a grade da série em 40 missões de outros anos.
 *
 * TRANSVERSAL PRIMEIRO, e isso é ordem pedagógica, não estética: a Vila do Lume
 * é o Ato 1 do Instanooria, e no fim da lista a criança encontrava o Ato 2
 * antes do Ato 1.
 */
export function gradeDaTurma(
  serie: string,
  catalogo: ExperienciaDoCatalogo[],
  estados: Map<string, EstadoGravado>,
  incluirOutrasSeries = false,
): MissaoNaGrade[] {
  return catalogo
    .filter((e) => e.publico === "estudante")
    .filter((e) => incluirOutrasSeries || serveASerie(e, serie))
    .map((e): MissaoNaGrade => ({
      expId: e.expId,
      nome: e.nome,
      unidade: e.unidade ?? null,
      estado: estados.get(e.expId) ?? "bloqueada",
      transversal: ehTransversal(e),
      deOutraSerie: !serveASerie(e, serie),
    }))
    .sort((a, b) => {
      if (a.transversal !== b.transversal) return a.transversal ? -1 : 1;
      // As de outra série vão para o fim: são o extra, não a grade da turma.
      if (a.deOutraSerie !== b.deOutraSerie) return a.deOutraSerie ? 1 : -1;
      /* Pela UNIDADE, que é a ordem do ano letivo. Sem ela a ordem caía no
         `exp_id` — numeração da experiência, não do ano: a exp07ef1b é do 7º ano e
         a exp08ef1b do 8º, e por `exp_id` a segunda vinha antes. Quem não declara
         unidade (transversal, ou missão publicada antes do campo) vai por
         último dentro do próprio grupo, nunca no lugar da unidade 1. */
      const ua = a.unidade ?? Number.POSITIVE_INFINITY;
      const ub = b.unidade ?? Number.POSITIVE_INFINITY;
      if (ua !== ub) return ua - ub;
      return a.expId.localeCompare(b.expId);
    });
}

/**
 * O que gravar quando o professor aperta Liberar ou Encerrar.
 *
 * `encerrada_em` acompanha o estado — o CHECK da migration cobra isso, e é a
 * armadilha do `expires_at`: data sem regra que a cumpra faz o painel mentir
 * sobre quando a aula fechou.
 *
 * Reliberar LIMPA `encerrada_em` em vez de guardar histórico. A tabela responde
 * "esta missão está nesta sala AGORA"; quem conta a história do que a criança
 * fez é o dado da experiência, que a liberação nunca toca.
 */
export function camposDaTransicao(estado: EstadoGravado, agora: Date) {
  return estado === "encerrada"
    ? { estado, encerradaEm: agora }
    : { estado, encerradaEm: null };
}
