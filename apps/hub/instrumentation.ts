/**
 * A forma do `onRequestError` (Next 16, `server/instrumentation/types.d.ts`),
 * declarada aqui em vez de `import type { Instrumentation } from "next"`: o
 * tipo da RAIZ do pacote arrasta as declarações globais de JSX do Next, que
 * resolvem `@types/react` a partir do `.pnpm/node_modules` (onde a versão
 * hoisted é a 18, das experiências) — e o typecheck do hub inteiro passa a ver
 * dois React ("Fragment cannot be used as a JSX component" em arquivos que
 * ninguém tocou). Os sub-caminhos (`next/server`, `next/headers`) não têm esse
 * efeito.
 */
type RequisicaoComErro = Readonly<{ path: string; method: string; headers: NodeJS.Dict<string | string[]> }>;
type ContextoDoErro = Readonly<{
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "proxy";
  renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering";
  revalidateReason: "on-demand" | "stale" | undefined;
}>;

/**
 * Ganchos de instrumentação do Next (arquivo estável desde o 15).
 *
 * `onRequestError` é chamado para todo erro não tratado de render, route
 * handler, server action ou proxy — inclusive os que o `error.tsx` mostra na
 * tela. A linha sai com o `digest` que o Next dá ao erro, que é o mesmo que a
 * tela exibe como código do incidente: é a ponte entre o relato e o registro,
 * no hub, sem inventar um id.
 *
 * O `register()` liga o OpenTelemetry (`lib/otel.node.ts`) — só no runtime
 * Node; no edge não há SDK.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { iniciarOtelDoHub } = await import("./lib/otel.node");
  iniciarOtelDoHub();
}

export async function onRequestError(erro: unknown, requisicao: RequisicaoComErro, contexto: ContextoDoErro): Promise<void> {
  // Import dinâmico: este arquivo também é avaliado no runtime edge, onde o
  // pino não roda. `onRequestError` só executa no Node.
  const { log, contextoDaRequisicao } = await import("./lib/log");
  const err = erro instanceof Error ? erro : new Error(String(erro));
  const digest = (erro as { digest?: string })?.digest;
  log.error(
    {
      ...contextoDaRequisicao(requisicao.headers),
      err,
      digest,
      rota: `${requisicao.method} ${requisicao.path.split("?")[0]}`,
      tipo: contexto.routeType,
      caminhoDaRota: contexto.routePath,
      origem: contexto.renderSource,
      codigo: "erro-de-servidor",
      "@type": "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
    },
    err.stack ?? err.message,
  );
}
