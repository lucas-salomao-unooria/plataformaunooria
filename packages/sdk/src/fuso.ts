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
 * ## De onde o valor vem (ADR-99)
 *
 * A ADR-98 decidiu que a plataforma assume UM fuso, num lugar só. A ADR-99
 * decide de onde esse lugar lê: a variável de ambiente **`FUSO_DA_PLATAFORMA`**,
 * porque 1 contrato = 1 stack de infra e haverá rede fora de Brasília. A
 * granularidade é a do DEPLOY, não a da escola.
 *
 * Este módulo roda em três lugares e a env só existe em um deles, então ele
 * resolve o valor por CASCATA, na ordem:
 *
 * 1. o que alguém definiu por `definirFusoDaPlataforma()` — é por aqui que a
 *    EXPERIÊNCIA recebe o valor, no `hub:init` (o bundle Vite é estático, foi
 *    construído uma vez e não conhece contrato);
 * 2. `process.env.FUSO_DA_PLATAFORMA` — o SERVIDOR do Next e qualquer processo
 *    Node. No bundle de navegador `process` não existe, e o `typeof` guarda;
 * 3. `<meta name="unooria-fuso">` — o NAVEGADOR no hub. O layout raiz o escreve
 *    a partir da env (mesmo caminho do `unooria-obs-ratio`, cap. 17), e é por
 *    isso que servidor e navegador não podem divergir: os dois lados da mesma
 *    resposta leem o mesmo valor;
 * 4. `FUSO_PADRAO`.
 *
 * **Por que `<meta>` e não `NEXT_PUBLIC_`:** `NEXT_PUBLIC_*` é assado no build.
 * Se a mesma imagem servir mais de um contrato, o valor fica errado e ninguém
 * vê. **Por que `<meta>` e não um provider React:** um provider depende da
 * ORDEM em que o React executa os componentes, e o `<meta>` já está no `<head>`
 * antes de a hidratação começar — a falha que estamos consertando é justamente
 * uma de hidratação, e não convém consertá-la com algo que ela possa quebrar.
 *
 * **Fuso inválido não derruba tela.** Um typo (`America/SaoPaulo`) cai no
 * padrão com um aviso alto no console. Quem falha ALTO é a api, no boot, pelo
 * Zod (`config/env.ts`): é lá que o erro é barato de consertar, e uma tela
 * branca para a rede inteira nunca é.
 *
 * `apps/api/src/comum/fuso.ts` carrega o MESMO padrão e lê a MESMA env, porque
 * a api não consome pacote de workspace (ver `packages/AGENTS.md`). As duas são
 * amarradas por teste, não por confiança.
 */

/**
 * O valor quando ninguém configurou nada — e o que a plataforma foi até a
 * ADR-99. Continua sendo `America/Sao_Paulo` porque a primeira rede é de lá;
 * o que mudou é que agora isso é um DEFAULT, não uma decisão de código.
 */
export const FUSO_PADRAO = "America/Sao_Paulo";

/** O nome da variável de ambiente, num lugar só — ele aparece em 3 superfícies. */
export const ENV_DO_FUSO = "FUSO_DA_PLATAFORMA";

/** O nome do `<meta>` que o layout raiz do hub escreve para o navegador ler. */
export const META_DO_FUSO = "unooria-fuso";

/**
 * A chave dentro do `config` do `hub:init` por onde o fuso chega à EXPERIÊNCIA.
 *
 * Vai em `config`, e não como campo de topo do `hub:init`, porque o contrato
 * (`apps/experiencias/AGENTS.md`) é explícito: **mudar a FORMA do `hub:init`
 * pede bump do `PROTOCOL_VERSION`; campo novo em `config` é aditivo e não
 * pede.** Subir o major faria todo bundle já publicado recusar o handshake com
 * "protocolo incompatível" — uma tela de erro para a criança, e o rollback
 * entre majors deixaria de funcionar. É o mesmo caminho do `clarityProjectId`
 * e do `obs.traceRatio`, pela mesma razão: valor de runtime do hub.
 *
 * A constante existe para o hub ESCREVER e o SDK LER o mesmo nome: `config` é
 * `Record<string, unknown>`, então um typo na chave não reprovaria o typecheck
 * e a experiência ficaria calada no fuso padrão.
 */
export const CHAVE_DO_FUSO = "fuso";

/**
 * Válido = o `Intl` aceita. Não há lista de fusos IANA para conferir contra:
 * `Intl.supportedValuesOf("timeZone")` existe, mas omite os aliases legados
 * (`America/Sao_Paulo` está lá, `Brazil/East` não), e recusar um alias que o
 * `Intl` aceita seria recusar configuração que funciona. Construir o formatador
 * é o teste exato: é o que vai acontecer depois.
 *
 * **Um offset fixo (`-03:00`) PASSA**, porque o `Intl` o aceita. Ele congela o
 * deslocamento: se a rede voltar a ter horário de verão, fica uma hora atrasada
 * sem nada acusar. Não recusamos — recusar o que o `Intl` aceita é recusar
 * configuração que funciona —, mas a documentação pede o nome IANA.
 */
export function fusoEhValido(fuso: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

/** Formatadores são caros de construir; `Intl` os reusa se nós reusarmos. */
const cache = new Map<string, Intl.DateTimeFormat>();

/** O valor resolvido, ou `null` enquanto a cascata ainda não rodou. */
let resolvido: string | null = null;
/** O que `definirFusoDaPlataforma` gravou — vence a env e o `<meta>`. */
let definido: string | null = null;

function avisar(fuso: string, origem: string): void {
  console.error(
    `[fuso] "${fuso}" (${origem}) não é um fuso IANA que o Intl aceite — ` +
      `usando "${FUSO_PADRAO}". Confira a variável ${ENV_DO_FUSO}.`,
  );
}

/**
 * Passo 2 da cascata.
 *
 * Chega por `globalThis`, e não por `process.env.FUSO_DA_PLATAFORMA` escrito
 * direto, por duas razões que já custaram um typecheck vermelho aqui:
 *
 * 1. **Tipo.** Este pacote é compilado dentro de cada experiência, e um bundle
 *    de navegador não carrega `@types/node` — `process` solto vira
 *    `TS2580: Cannot find name 'process'` no `tsc` da exp-70, que não tem o
 *    pacote de tipos e não deveria mesmo ter.
 * 2. **Bundler.** `process.env.NOME` escrito literalmente é SUBSTITUÍDO em
 *    tempo de build pelo Next e pelo Vite. O acesso dinâmico não é: no
 *    navegador `process` simplesmente não existe e a cascata segue para o
 *    `<meta>`, que é o comportamento que queremos.
 */
function daEnv(): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  const bruto = g.process?.env?.[ENV_DO_FUSO];
  return bruto === undefined || bruto === "" ? undefined : bruto;
}

/** Passo 3 da cascata. Só o hub tem `<meta>`; a experiência vive num iframe seu. */
function doMeta(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const bruto = document
    .querySelector(`meta[name="${META_DO_FUSO}"]`)
    ?.getAttribute("content");
  return bruto === null || bruto === undefined || bruto === "" ? undefined : bruto;
}

/**
 * O fuso em vigor. Resolvido uma vez e memorizado — as funções de formatação
 * abaixo o chamam a cada linha de tabela.
 */
export function fusoDaPlataforma(): string {
  if (resolvido !== null) return resolvido;

  const candidatos: Array<[string | undefined, string]> = [
    [definido ?? undefined, "definido em runtime"],
    [daEnv(), `env ${ENV_DO_FUSO}`],
    [doMeta(), `<meta name="${META_DO_FUSO}">`],
  ];
  for (const [valor, origem] of candidatos) {
    if (valor === undefined) continue;
    if (fusoEhValido(valor)) {
      resolvido = valor;
      return resolvido;
    }
    avisar(valor, origem);
  }
  resolvido = FUSO_PADRAO;
  return resolvido;
}

/**
 * Define o fuso em runtime — o caminho da EXPERIÊNCIA, que o recebe no
 * `hub:init` (`createExperiencia` chama isto antes de a tela montar).
 *
 * As funções de formatação continuam com a assinatura de sempre (`data(iso)`):
 * passar o fuso em cada chamada espalharia por onze sítios o problema que a
 * ADR-98 juntou num lugar só.
 *
 * Devolve o valor que ficou valendo. Chamar com o valor já vigente é barato e
 * não invalida nada — é o caso do `hub:init` repetido.
 */
export function definirFusoDaPlataforma(fuso: unknown): string {
  // `unknown` e não `string`: o valor vem de um `postMessage`, que é entrada
  // externa, e do `config` do `hub:init`, que é `Record<string, unknown>`.
  if (typeof fuso !== "string" || fuso === "") return fusoDaPlataforma();
  if (!fusoEhValido(fuso)) {
    avisar(fuso, "hub:init");
    return fusoDaPlataforma();
  }
  if (definido === fuso && resolvido === fuso) return fuso;
  definido = fuso;
  resolvido = fuso;
  // Os formatadores em cache carregam o fuso ANTIGO dentro deles.
  cache.clear();
  return fuso;
}

/**
 * Esquece o que foi resolvido, para a cascata rodar de novo. Existe para
 * TESTE — é o que permite provar que trocar a variável muda o texto, dentro do
 * mesmo processo. Em produção ninguém chama: o valor é do deploy.
 */
export function esquecerFusoDaPlataforma(): void {
  resolvido = null;
  definido = null;
  cache.clear();
}

function formatador(opcoes: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const fuso = fusoDaPlataforma();
  // O fuso entra na CHAVE: sem ele, trocar o fuso devolveria o formatador
  // antigo e a tela continuaria na hora de Brasília sem ninguém entender.
  const chave = `${fuso}|${JSON.stringify(opcoes)}`;
  let f = cache.get(chave);
  if (!f) {
    f = new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: fuso });
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
    timeZone: fusoDaPlataforma(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
