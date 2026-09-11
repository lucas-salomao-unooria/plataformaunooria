/**
 * O FUSO da plataforma, e as únicas funções que formatam data para gente ler.
 *
 * ## Por que isto existe
 *
 * `new Date(iso).toLocaleDateString("pt-BR", …)` **sem `timeZone`** usa o fuso
 * de quem executa. No hub isso não é detalhe: a mesma linha roda no servidor e
 * no navegador, e os dois discordam — o container do Cloud Run está em **UTC**
 * e o navegador da professora em `America/Sao_Paulo` (UTC-3). Um registro
 * criado às 22h de Brasília é `10/09` para ela e `11/09` para o servidor.
 *
 * O React acusa (`Hydration failed because the server rendered text didn't
 * match the client`), **regenera a árvore** e, enquanto regenera, o clique da
 * pessoa cai no vazio. Foi assim que a suíte e2e da exp-08 morreu com
 * `page.click: Timeout 30000ms` — um sintoma a três saltos da causa.
 *
 * E ele é **intermitente por desenho**: só diverge entre 21h e a meia-noite de
 * Brasília, que é exatamente quando ninguém está olhando.
 *
 * ## A regra
 *
 * **Nenhuma tela chama `toLocaleDateString`, `toLocaleTimeString`,
 * `toLocaleString` nem `Intl.DateTimeFormat` sobre uma data.** Use as funções
 * abaixo. Número não tem fuso: `n.toLocaleString("pt-BR")` para milhar continua
 * livre.
 *
 * ## O valor, e o dia em que ele muda
 *
 * A plataforma assume **um** fuso, e hoje ele é `America/Sao_Paulo`. Isso é
 * falso para uma rede em Rio Branco (UTC-5) ou Manaus (UTC-4) — e é por isso
 * que o valor mora numa constante só: quando a primeira rede fora de Brasília
 * entrar, muda **aqui**, não nos onze lugares que formatam data. A decisão, as
 * alternativas descartadas e o gatilho de reavaliação estão na ADR-98.
 *
 * `apps/api/src/comum/fuso.ts` carrega a MESMA constante, porque a api não
 * consome pacote de workspace (ver `packages/AGENTS.md`). As duas são amarradas
 * por teste, não por confiança.
 */
export const FUSO_DA_PLATAFORMA = "America/Sao_Paulo";

/** Formatadores são caros de construir; `Intl` os reusa se nós reusarmos. */
const cache = new Map<string, Intl.DateTimeFormat>();

function formatador(opcoes: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const chave = JSON.stringify(opcoes);
  let f = cache.get(chave);
  if (!f) {
    f = new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: FUSO_DA_PLATAFORMA });
    cache.set(chave, f);
  }
  return f;
}

/**
 * Data inválida vira travessão, nunca "Invalid Date" na tela.
 *
 * `null`/`undefined` entram porque metade das chamadas vem de coluna anulável
 * ("ainda não jogou"), e obrigar cada tela a testar antes produziria a linha
 * `iso ? formatar(iso) : "—"` repetida — que é onde uma delas escreveria `""`.
 */
function comData(iso: string | Date | null | undefined, fn: (d: Date) => string): string {
  if (iso === null || iso === undefined) return "—";
  const data = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : fn(data);
}

/** `11/09/2026` */
export function data(iso: string | Date | null | undefined): string {
  return comData(iso, (d) =>
    formatador({ day: "2-digit", month: "2-digit", year: "numeric" }).format(d),
  );
}

/** `11/09` — quando o ano é óbvio pelo contexto (a turma do ano corrente). */
export function dataCurta(iso: string | Date | null | undefined): string {
  return comData(iso, (d) => formatador({ day: "2-digit", month: "2-digit" }).format(d));
}

/** `11/09/2026, 22:15` — a vírgula é do `Intl` em pt-BR, não nossa. */
export function dataHora(iso: string | Date | null | undefined): string {
  return comData(iso, (d) =>
    formatador({
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d),
  );
}

/** `11/09, 22:15` */
export function dataCurtaHora(iso: string | Date | null | undefined): string {
  return comData(iso, (d) =>
    formatador({
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d),
  );
}

/** `22:15` */
export function hora(iso: string | Date | null | undefined): string {
  return comData(iso, (d) => formatador({ hour: "2-digit", minute: "2-digit" }).format(d));
}

/** `22:15:07` — só onde a ordem dentro do minuto importa (a fala numa aula). */
export function horaComSegundos(iso: string | Date | null | undefined): string {
  return comData(iso, (d) =>
    formatador({ hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d),
  );
}

/**
 * `2026-09-11` — o DIA no fuso da plataforma, para comparar e agrupar.
 *
 * Não é texto de tela: é chave. `new Date().toISOString().slice(0, 10)` daria o
 * dia em UTC, e às 22h de Brasília isso é o dia seguinte — um check-in feito à
 * noite contaria como o de amanhã.
 */
export function diaDaPlataforma(iso: string | Date = new Date()): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  // `en-CA` porque o formato dele JÁ é `YYYY-MM-DD`; montar a string a partir
  // das partes de `pt-BR` reintroduziria a inversão de dia e mês.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_PLATAFORMA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
