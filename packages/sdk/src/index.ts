import { connectToHub, normalizarHubOrigin } from "./bridge";
import {
  carregarClarity,
  clarityEvent,
  clarityIdentify,
  claritySet,
  clarityUpgrade,
} from "./clarity";
import { instalarCapturaDeErros } from "./erros";
import { CHAVE_DO_FUSO, definirFusoDaPlataforma } from "./fuso";
import { iniciarTracesWeb, lerObsConfig } from "./otel-web";
import { TelemetryClient } from "./telemetry";
import { novoTraceparent } from "./trace";
import { instalarVitais } from "./vitals";
import type { ExperienciaHandle, OpcoesDeChamada } from "./types";
export * from "./types";
export * from "./clarity";
export { instalarCapturaDeErros, type ErroDeCliente } from "./erros";
export { instalarVitais, type Vital } from "./vitals";
export { lerDispositivo, type DispositivoDoNavegador } from "./dispositivo";
/* O fuso e as funções que formatam data para gente ler. Toda tela do hub e das
   experiências passa por aqui — o porquê está no cabeçalho de `fuso.ts`. */
export {
  FUSO_PADRAO,
  ENV_DO_FUSO,
  META_DO_FUSO,
  CHAVE_DO_FUSO,
  fusoDaPlataforma,
  definirFusoDaPlataforma,
  esquecerFusoDaPlataforma,
  fusoEhValido,
  data,
  dataCurta,
  dataHora,
  dataCurtaHora,
  hora,
  horaComSegundos,
  diaDaPlataforma,
} from "./fuso";
export { iniciarTracesWeb, lerObsConfig, type ObsConfig, type TracesWeb } from "./otel-web";

type MetodoHttp = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Ponto de entrada de TODA experiência:
 *   const exp = await createExperiencia({ expId: "exp-01", expVersion: "1.0.0" });
 */
export async function createExperiencia(meta: {
  expId: string;
  expVersion: string;
  /** origin do hub; em dev o template usa http://localhost:3000 */
  hubOrigin?: string;
}): Promise<ExperienciaHandle> {
  const bruto = meta.hubOrigin ?? new URLSearchParams(location.search).get("hubOrigin") ?? "";
  if (!bruto) throw new Error("hubOrigin ausente (query ?hubOrigin= em dev)");
  // A query string é ATACANTE-CONTROLÁVEL e decide de quem esta experiência
  // aceita o hub:init — ver normalizarHubOrigin.
  const hubOrigin = normalizarHubOrigin(bruto);

  /*
   * FALSO POSITIVO conhecido do Snyk aqui: "Code Injection" (CWE-94), com o
   * fluxo location.search -> ... -> setInterval. O sink que ele aponta é o
   * `setInterval(anunciar, READY_RETRY_MS)` da bridge, e `setInterval` só
   * AVALIA código quando o primeiro argumento é uma STRING — ali ele recebe uma
   * referência de função, e o `hubOrigin` entra por captura de closure para
   * terminar como `targetOrigin` de um `postMessage`, que não executa nada.
   *
   * O valor tem exatamente três usos, e nenhum é sink de execução: dois
   * `postMessage` e uma comparação com `ev.origin`. A vulnerabilidade REAL
   * daquele fluxo — a origem de confiança vinda da URL — é a que o
   * `normalizarHubOrigin` acima fecha (ADR-46).
   *
   * Não contorça este código para agradar o scanner: a alternativa seria
   * esconder a captura do closure, o que deixa o retry ilegível sem tirar um
   * risco que não existe.
   */
  // deepcode ignore javascript/CodeInjection: setInterval recebe função, não string — ver acima
  const { init, send, onMessage } = await connectToHub({ hubOrigin });

  /*
   * O FUSO da plataforma, antes de qualquer outra coisa (ADR-99). Este bundle é
   * estático: foi construído uma vez, pode servir contratos diferentes e não
   * tem `process.env` nem o `<meta>` do hub — o iframe é um documento à parte.
   * O único canal é este, e ele precisa valer ANTES da primeira tela, senão a
   * missão abre com a data no fuso padrão e a corrige ao vivo.
   *
   * As funções de formatação (`data`, `dataHora`, …) não mudam de assinatura:
   * é o módulo que passa a saber o fuso, não cada chamada.
   */
  definirFusoDaPlataforma(init.config[CHAVE_DO_FUSO]);

  let token = init.token;
  const sessaoId = crypto.randomUUID();

  const handlers: Record<"pause" | "resume", Array<() => void>> = { pause: [], resume: [] };

  // Mensagens pós-init já chegam validadas pelo schema (bridge.ts).
  onMessage((msg) => {
    if (msg.type === "hub:token") token = msg.token;
    if (msg.type === "hub:pause") handlers.pause.forEach((cb) => cb());
    if (msg.type === "hub:resume") handlers.resume.forEach((cb) => cb());
  });
  setInterval(() => send({ type: "exp:token-expirando" }), 10 * 60 * 1000); // TTL do token é 15min

  /*
   * OpenTelemetry Web (cap. 17): spans de document-load e de todo fetch,
   * exportados para a api. O ratio vem de `config.obs.traceRatio` do hub:init
   * — env de runtime do hub, então mudar a amostragem não republica as seis
   * experiências. Com 0 (dev), nada é sequer baixado. Enquanto o `import()`
   * resolve, as primeiras chamadas saem sem span — aceito, pela mesma razão
   * do Clarity: a alternativa é cravar config no bundle.
   */
  const obs = lerObsConfig(init.config);
  let traces: Awaited<ReturnType<typeof iniciarTracesWeb>> = null;
  const promessaDosTraces = iniciarTracesWeb({
    traceRatio: obs.traceRatio,
    apiUrl: init.apiUrl,
    expId: meta.expId,
    versao: meta.expVersion,
    getToken: () => token,
  })
    .then((t) => (traces = t))
    .catch(() => null);

  const telemetry = new TelemetryClient({
    apiUrl: init.apiUrl, getToken: () => token, estudante: init.estudante,
    expId: meta.expId, expVersion: meta.expVersion, sessaoId,
    traceparentPeloOtel: () => traces !== null,
  });

  /*
   * Clarity DENTRO do iframe (ADR-60). O id chega pelo `config` do `hub:init`,
   * não por `import.meta.env`: o `packages/sdk` é transpilado TAMBÉM pelo Next
   * (o hub o traz em `transpilePackages`), e `import.meta.env` ali quebra o
   * build do hub. Pelo `config`, uma env só do hub liga as duas superfícies e
   * desligar não exige republicar as seis experiências.
   *
   * Só carrega depois do handshake — é quando o id existe. Os primeiros
   * milissegundos da tela ficam de fora, e isso é aceito: a alternativa é
   * cravar o id em cada bundle.
   */
  carregarClarity(init.config.clarityProjectId);
  clarityIdentify(init.estudante.id, meta.expId);
  claritySet("superficie", "exp");
  claritySet("exp_id", meta.expId);
  claritySet("exp_versao", meta.expVersion);
  claritySet("escola_id", init.estudante.escolaId);
  claritySet("turma_id", init.estudante.turmaId);
  claritySet("serie", init.estudante.serie);
  claritySet("sessao_id", sessaoId);

  /**
   * Fetch com timeout e retry: GET tenta de novo em falha de rede/5xx
   * (idempotente); POST/PUT/PATCH/DELETE NUNCA — o caller decide se reenvia.
   *
   * O timeout default segue 10s. Rota que espera geração de texto passa
   * `timeoutMs` explícito (ver `OpcoesDeChamada`) — é decisão de QUEM CHAMA,
   * porque só ela sabe se o que está do outro lado é um SELECT ou um modelo.
   */
  const TIMEOUT_PADRAO_MS = 10_000;

  async function call<T>(
    method: MetodoHttp,
    path: string,
    body?: unknown,
    opcoes?: OpcoesDeChamada,
  ): Promise<T> {
    const tentativas = method === "GET" ? 2 : 1;
    let ultimoErro: unknown;
    for (let i = 0; i < tentativas; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opcoes?.timeoutMs ?? TIMEOUT_PADRAO_MS);
      try {
        const res = await fetch(`${init.apiUrl}${path}`, {
          method,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
            // Sem OTel Web, um traceparent novo dá `traceId` à api em 100% das
            // chamadas; com ele, quem escreve o cabeçalho é a instrumentação.
            ...(traces === null ? { traceparent: novoTraceparent() } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          if (method === "GET" && res.status >= 500 && i + 1 < tentativas) {
            ultimoErro = new Error(`API ${method} ${path} → ${res.status}`);
            continue;
          }
          throw new Error(`API ${method} ${path} → ${res.status}`);
        }
        return (await res.json()) as T;
      } catch (erro) {
        ultimoErro = erro;
        if (method !== "GET" || i + 1 >= tentativas) throw erro;
      } finally {
        clearTimeout(timer);
      }
    }
    throw ultimoErro;
  }

  /*
   * Erro não tratado → api (ADR-58) + `exp:erro` para o hub trocar a tela.
   * Instalado DEPOIS do handshake: antes dele não há token para postar. O
   * `traceAtivo` liga o erro ao span do navegador quando o OTel está ligado.
   */
  const captura = instalarCapturaDeErros({
    expId: meta.expId,
    versao: meta.expVersion,
    sessaoId,
    enviar: (erro) => call("POST", "/observabilidade/erros-cliente", erro),
    notificarHub: (resumo) => send({ type: "exp:erro", ...resumo }),
    traceAtivo: () => {
      if (traces === null) return undefined;
      // A API do OpenTelemetry é no-op sem provider registrado; com o Web
      // ligado, `trace.getActiveSpan()` é o span atual.
      const span = otelApi?.trace.getActiveSpan()?.spanContext();
      return span && span.traceId !== "0".repeat(32) ? { traceId: span.traceId, spanId: span.spanId } : undefined;
    },
  });
  // Só carregado se os traces ligaram (mesmo `import()`, já em cache).
  let otelApi: typeof import("@opentelemetry/api") | undefined;
  void promessaDosTraces.then(async (t) => {
    if (t) otelApi = await import("@opentelemetry/api");
  });

  // Web Vitals, 10% das sessões, sem identificador de pessoa no corpo.
  void instalarVitais({
    rota: meta.expId,
    superficie: "exp",
    enviar: (vital) => call("POST", "/observabilidade/vitals", vital),
  }).catch(() => false);

  return {
    estudante: init.estudante,
    config: init.config,
    api: {
      get: (p, o) => call("GET", p, undefined, o),
      post: (p, b, o) => call("POST", p, b, o),
      put: (p, b, o) => call("PUT", p, b, o),
      patch: (p, b, o) => call("PATCH", p, b, o),
      delete: (p, o) => call("DELETE", p, undefined, o),
    },
    ai: { gerar: (input) => call("POST", "/ai/gerar", { ...input, expId: meta.expId }) },
    /*
     * O MESMO `track` alimenta os dois destinos: a telemetria própria (que
     * corrige, pontua e vira relatório de professor) e o Clarity (que só
     * marca o funil da gravação). É o que dá "track das missões" sem tocar em
     * nenhuma experiência — os verbos que elas já emitem viram evento lá.
     * A carga útil NÃO vai junto: `resultado` e `contexto` carregam resposta
     * de estudante, e resposta de estudante não sai do contrato.
     */
    track: (verbo, objeto, dados) => {
      telemetry.track({ verbo, objeto, ...dados });
      clarityEvent(`${verbo}:${objeto}`);
    },
    progresso: {
      salvar: (dados) => call("POST", `/progresso/${meta.expId}`, { dados }),
      carregar: async <T,>() => {
        const r = await call<{ dados: T | null }>("GET", `/progresso/${meta.expId}`);
        return r.dados;
      },
    },
    concluir: (payload) => {
      telemetry.track({ verbo: "completed", objeto: meta.expId, resultado: payload });
      void telemetry.flush();
      void traces?.forceFlush();
      clarityEvent(`completed:${meta.expId}`);
      // Sessão que chegou ao fim é a que não se pode perder para a amostragem
      // do Clarity (teto de 100k gravações/dia por projeto).
      clarityUpgrade("exp:concluida");
      send({ type: "exp:concluir", payload: payload ?? {} });
    },
    on: (evento, cb) => handlers[evento]?.push(cb),
    enviarEstado: (estado) => send({ type: "exp:estado", estado }),
    reportarErro: (erro) => captura.reportar(erro),
  };
}
