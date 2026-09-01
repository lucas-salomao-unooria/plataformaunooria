/**
 * Microsoft Clarity — a ÚNICA porta do monorepo para o analytics de terceiro.
 *
 * Este arquivo existe para que o snippet do Clarity exista UMA vez. Ele é
 * consumido pelos dois lados da fronteira do iframe, que carregam o script de
 * formas diferentes pela mesma razão que tudo aqui é diferente:
 *
 *   - o HUB (Next) monta o snippet com `next/script`, que decide QUANDO baixar;
 *   - a EXPERIÊNCIA (Vite, dentro do iframe) injeta a tag na mão, depois do
 *     handshake — antes dele não existe `clarityProjectId`, que chega no
 *     `config` do `hub:init`.
 *
 * Por que não o pacote `@microsoft/clarity`: ele é CJS puro (sem campo
 * `module`), e o Vite das experiências já custou tempo com ESM/CJS neste repo.
 * Internamente o pacote só injeta o mesmo `<script>` que está aqui embaixo, e
 * pagar uma dependência por isso não se justifica.
 *
 * REGRA: nada aqui recebe nome, e-mail ou qualquer texto digitado. O
 * identificador é o UUID opaco do estudante — o mesmo que a telemetria usa.
 * `identify` é o que costura a sessão do hub com a sessão de dentro do iframe:
 * são ORIGENS diferentes, o cookie do iframe é particionado pelo navegador, e
 * sem um id em comum o painel mostra duas sessões que ninguém consegue ligar.
 */

/** Assinatura do `window.clarity` do snippet. Evita `any` sob TS strict. */
type FilaClarity = {
  (comando: "identify", customId: string, customSessionId?: string, customPageId?: string): void;
  (comando: "set", chave: string, valor: string | string[]): void;
  (comando: "event", nome: string): void;
  (comando: "upgrade", motivo: string): void;
  (comando: "consentv2", consentimento: { ad_Storage: string; analytics_Storage: string }): void;
  q?: unknown[];
};

declare global {
  interface Window {
    clarity?: FilaClarity;
  }
}

/** Onde o Clarity serve a tag. Aparece no DevTools — ver ADR-59. */
export const CLARITY_HOST = "https://www.clarity.ms";

/**
 * O snippet oficial, como corpo de script. O hub passa isto para o
 * `dangerouslySetInnerHTML` do `next/script`; a experiência usa
 * `carregarClarity`, abaixo.
 *
 * O `projectId` é interpolado numa string de código, então ele é validado por
 * `idValido` antes de chegar aqui: o valor vem de env/`postMessage`, e um id
 * com aspas fecharia o literal.
 */
export function snippetClarity(projectId: string): string {
  if (!idValido(projectId)) throw new Error("clarity: projectId inválido");
  return (
    `(function(c,l,a,r,i,t,y){` +
    `c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};` +
    `t=l.createElement(r);t.async=1;t.src="${CLARITY_HOST}/tag/"+i;` +
    `y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);` +
    `})(window, document, "clarity", "script", "${projectId}");`
  );
}

/**
 * Um id do Clarity é alfanumérico minúsculo e curto (`ybo0odt6cn`). A checagem
 * fecha a interpolação do snippet e serve de guarda contra id vindo torto do
 * `hub:init`, que é `Record<string, unknown>` — sem isto, um objeto vira
 * `"[object Object]"` numa URL e o erro só aparece no painel vazio, semanas
 * depois.
 */
export function idValido(projectId: unknown): projectId is string {
  return typeof projectId === "string" && /^[a-z0-9]{4,32}$/.test(projectId);
}

/**
 * Injeta a tag do Clarity no documento ATUAL. Idempotente: chamar duas vezes
 * (StrictMode remonta efeito em dev) não carrega o script duas vezes.
 *
 * Usada pelas experiências. O hub NÃO usa esta função — lá o `next/script`
 * cuida da inserção e da deduplicação pelo `id`.
 */
export function carregarClarity(projectId: unknown): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!idValido(projectId)) return;
  if (window.clarity) return;

  const fila = function (...args: unknown[]) {
    (fila.q = fila.q ?? []).push(args);
  } as unknown as FilaClarity;
  window.clarity = fila;

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `${CLARITY_HOST}/tag/${projectId}`;
  // O snippet oficial insere antes do primeiro <script>. Numa experiência que
  // carregue por módulo ele existe; num documento sem nenhum, o fallback é o
  // <head> — sem ele a tag simplesmente não entraria.
  const primeiro = document.getElementsByTagName("script")[0];
  if (primeiro?.parentNode) primeiro.parentNode.insertBefore(tag, primeiro);
  else document.head.appendChild(tag);
}

/*
 * As quatro chamadas da API do Clarity, tipadas e SILENCIOSAS quando o script
 * não está lá (id ausente, SSR, bloqueador de anúncio, rede da escola barrando
 * o domínio). Analytics que derruba a tela por não ter carregado é pior que
 * analytics nenhum — e numa rede pública o bloqueio é o caso comum, não a
 * exceção.
 */

/** `identify` deve ser chamado por PÁGINA, não uma vez por sessão (doc do Clarity). */
export function clarityIdentify(customId: string, customPageId?: string): void {
  if (!customId) return;
  window.clarity?.("identify", customId, undefined, customPageId);
}

export function claritySet(chave: string, valor: string | string[] | undefined): void {
  if (valor === undefined || valor === "") return;
  window.clarity?.("set", chave, valor);
}

export function clarityEvent(nome: string): void {
  if (!nome) return;
  window.clarity?.("event", nome);
}

/**
 * Prioriza a gravação desta sessão quando o projeto passa do teto diário de
 * 100k e o Clarity começa a amostrar. Reservado para o que não se pode perder:
 * a missão que chegou ao fim.
 */
export function clarityUpgrade(motivo: string): void {
  if (!motivo) return;
  window.clarity?.("upgrade", motivo);
}
