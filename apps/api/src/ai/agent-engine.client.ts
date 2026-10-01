import { GoogleAuth } from "google-auth-library";
import { Agent, fetch as fetchDoUndici } from "undici";
import {
  AgenteIndisponivel,
  ENGINE_RE,
  SessaoInexistente,
  type AgenteProfessorPort,
  type EventoAgente,
  type ModoDoAgente,
  type SessaoAgente,
} from "./agente-professor.port";

/**
 * O CLIENTE DO VERTEX AI AGENT ENGINE — a única peça da api que conhece o
 * vendor do agente de IA do professor (contrato: `docs/regras/agente-professor.md`).
 *
 * Um cliente só para dois alvos, e é de propósito:
 *
 *   - `agent-engine`: `POST https://{região}-aiplatform.googleapis.com/v1/{engine}:query`
 *     e `...:streamQuery?alt=sse`, com token do ADC (a SA da api em Cloud Run).
 *   - `local`: o shim de `apps/agente-professor`, que expõe O MESMO contrato do
 *     container do Agent Engine (`/api/reasoning_engine` e
 *     `/api/stream_reasoning_engine`), sem token.
 *
 * Os dois recebem o mesmo corpo `{ class_method, input }` e devolvem o mesmo
 * `output`/stream — se o local divergisse, o bug de produção não reproduziria
 * em dev.
 *
 * O `fetch` é o DO UNDICI, junto com o `Agent` do MESMO pacote, pela razão que
 * está em `vertex.provider.ts`: passar o `Agent` do undici instalado ao `fetch`
 * global (o undici embutido no Node, outra versão) morre com `fetch failed` sem
 * pista nenhuma.
 */

/** O stream tem teto de 240 s na api; o dispatcher dá folga para o erro ser o NOSSO. */
const TIMEOUT_DO_STREAM_MS = 250_000;
/** Criar, ler e apagar sessão são chamadas curtas. */
const TIMEOUT_DE_SESSAO_MS = 30_000;
const dispatcher = new Agent({ headersTimeout: TIMEOUT_DO_STREAM_MS, bodyTimeout: TIMEOUT_DO_STREAM_MS });

/* ==========================================================================
   Normalização — o evento do ADK chega em snake_case (o `model_dump` do
   `AdkApp`) ou camelCase (a representação REST de sessão). Aceita os dois.
   ========================================================================== */

type Objeto = Record<string, unknown>;

function objeto(v: unknown): Objeto | undefined {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Objeto) : undefined;
}

function texto(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** O primeiro valor definido entre as grafias de um mesmo campo. */
function campo(o: Objeto | undefined, ...nomes: string[]): unknown {
  if (!o) return undefined;
  for (const nome of nomes) if (o[nome] !== undefined) return o[nome];
  return undefined;
}

/**
 * Um evento cru do ADK → `EventoAgente`. `null` quando o valor não é evento
 * (linha de controle, objeto vazio).
 *
 * As partes com `thought: true` (raciocínio do modelo) NÃO entram em `textos`:
 * são pensamento, não fala, e repassá-las poria o rascunho do modelo na tela do
 * professor — a mesma regra do `vertex.provider.ts`.
 */
export function normalizarEvento(bruto: unknown): EventoAgente | null {
  const o = objeto(bruto);
  if (!o || Object.keys(o).length === 0) return null;

  /* Erro de transporte do Agent Engine no meio do stream (`{"error": {...}}`
     ou `{"code": 500, "message": ...}`): vira evento com `erro`, e quem conduz
     o turno decide. */
  const erroDoEngine = objeto(o.error);
  if (erroDoEngine || (typeof o.code === "number" && typeof o.message === "string" && !o.content)) {
    const origem = erroDoEngine ?? o;
    return {
      autor: "engine",
      parcial: false,
      textos: [],
      chamadasDeFerramenta: [],
      respostasDeFerramenta: [],
      erro: {
        codigo: String(campo(origem, "status", "code") ?? "erro"),
        mensagem: texto(origem.message)?.slice(0, 300),
      },
    };
  }

  const conteudo = objeto(o.content);
  const partes = Array.isArray(conteudo?.parts) ? (conteudo.parts as unknown[]) : [];
  const textos: string[] = [];
  const chamadasDeFerramenta: EventoAgente["chamadasDeFerramenta"] = [];
  const respostasDeFerramenta: EventoAgente["respostasDeFerramenta"] = [];

  for (const bruta of partes) {
    const parte = objeto(bruta);
    if (!parte) continue;
    const t = texto(parte.text);
    if (t !== undefined && parte.thought !== true) textos.push(t);

    const chamada = objeto(campo(parte, "function_call", "functionCall"));
    if (chamada) {
      chamadasDeFerramenta.push({
        nome: texto(chamada.name) ?? "",
        args: objeto(chamada.args) ?? {},
      });
    }
    const resposta = objeto(campo(parte, "function_response", "functionResponse"));
    if (resposta) {
      respostasDeFerramenta.push({ nome: texto(resposta.name) ?? "", resposta: resposta.response });
    }
  }

  const uso = objeto(campo(o, "usage_metadata", "usageMetadata"));
  const total = campo(uso, "total_token_count", "totalTokenCount");
  const acoes = objeto(o.actions);
  const delta = objeto(campo(acoes, "state_delta", "stateDelta"));
  const codigoDeErro = texto(campo(o, "error_code", "errorCode"));

  const evento: EventoAgente = {
    autor: texto(o.author) ?? (conteudo?.role === "user" ? "user" : "agente"),
    parcial: o.partial === true,
    textos,
    chamadasDeFerramenta,
    respostasDeFerramenta,
  };
  if (delta && Object.keys(delta).length > 0) evento.estadoDelta = delta;
  if (typeof total === "number" && Number.isFinite(total)) evento.tokens = total;
  if (campo(o, "turn_complete", "turnComplete") === true) evento.fimDeTurno = true;
  if (codigoDeErro) {
    evento.erro = {
      codigo: codigoDeErro,
      mensagem: texto(campo(o, "error_message", "errorMessage"))?.slice(0, 300),
    };
  }
  return evento;
}

/** A sessão como o `async_get_session`/`async_create_session` a devolve. */
export function normalizarSessao(bruto: unknown, sessaoPedida?: string): SessaoAgente | null {
  const o = objeto(bruto);
  if (!o) return null;
  /* `id` no ADK; `name` (resource name) na representação REST nativa. */
  const nome = texto(o.name);
  const sessaoId = texto(o.id) ?? (nome ? nome.split("/").pop() : undefined) ?? sessaoPedida;
  if (!sessaoId) return null;
  const estado = objeto(campo(o, "state", "session_state", "sessionState")) ?? {};
  const eventos = Array.isArray(o.events)
    ? (o.events as unknown[]).map(normalizarEvento).filter((e): e is EventoAgente => e !== null)
    : [];
  return { sessaoId, estado, eventos };
}

/* ==========================================================================
   O parser do stream — NDJSON puro OU linhas `data: {...}`
   ========================================================================== */

/**
 * Uma linha do corpo → o JSON dela, ou `undefined` quando a linha não carrega
 * evento (vazia, comentário `:`, `event:`/`id:`/`retry:`, `[DONE]`).
 *
 * Os dois formatos convivem porque o `:streamQuery?alt=sse` ora responde
 * `text/event-stream` com `data: {...}`, ora `application/json` com NDJSON puro
 * (issue aberta no python-aiplatform). Decidir pelo `content-type` seria
 * confiar justamente no que está errado — a decisão é por LINHA.
 *
 * Linha que não é JSON LANÇA `SyntaxError`: quem chama conta e descarta, para
 * o descarte aparecer no log em vez de sumir.
 */
export function interpretarLinha(linha: string): unknown {
  const limpa = linha.trim();
  if (!limpa || limpa.startsWith(":")) return undefined;
  if (/^(event|id|retry):/.test(limpa)) return undefined;
  const carga = limpa.startsWith("data:") ? limpa.slice(5).trim() : limpa;
  if (!carga || carga === "[DONE]") return undefined;
  return JSON.parse(carga) as unknown;
}

/**
 * Acumula pedaços do corpo e devolve os objetos das linhas COMPLETAS.
 *
 * O pedaço de rede não respeita linha: um evento pode chegar partido em dois
 * `read()`, e o resto fica no buffer até a quebra de linha seguinte. `terminar`
 * processa o que sobrou sem `\n` no fim.
 */
export class ParserDeStream {
  private resto = "";
  /** Linhas que não eram JSON — só a contagem sai daqui (nunca o conteúdo). */
  descartadas = 0;

  empurrar(pedaco: string): unknown[] {
    this.resto += pedaco;
    const linhas = this.resto.split(/\r?\n/);
    this.resto = linhas.pop() ?? "";
    return this.interpretar(linhas);
  }

  terminar(): unknown[] {
    const ultima = this.resto;
    this.resto = "";
    return this.interpretar([ultima]);
  }

  private interpretar(linhas: string[]): unknown[] {
    const saida: unknown[] = [];
    for (const linha of linhas) {
      try {
        const valor = interpretarLinha(linha);
        if (valor !== undefined) saida.push(valor);
      } catch {
        this.descartadas += 1;
      }
    }
    return saida;
  }
}

/* ==========================================================================
   Endereços
   ========================================================================== */


export interface Enderecos {
  query: string;
  stream: string;
  /** Base da API NATIVA de sessões (só `agent-engine`). */
  sessoes?: string;
}

/** A região sai do próprio resource name — uma env a menos para divergir. */
export function enderecosDoEngine(engine: string): Enderecos {
  const casou = ENGINE_RE.exec(engine);
  if (!casou) throw new Error(`AGENTE_PROFESSOR_ENGINE fora do formato projects/<p>/locations/<r>/reasoningEngines/<id>`);
  const regiao = casou[1] as string;
  const host = regiao === "global" ? "aiplatform.googleapis.com" : `${regiao}-aiplatform.googleapis.com`;
  return {
    query: `https://${host}/v1/${engine}:query`,
    stream: `https://${host}/v1/${engine}:streamQuery?alt=sse`,
    sessoes: `https://${host}/v1beta1/${engine}/sessions`,
  };
}

export function enderecosLocais(url: string): Enderecos {
  const base = url.replace(/\/+$/, "");
  return { query: `${base}/api/reasoning_engine`, stream: `${base}/api/stream_reasoning_engine` };
}

/* ==========================================================================
   O cliente HTTP (agent-engine e local)
   ========================================================================== */

/** "Não existe" dito pelo engine — o texto varia com a versão do ADK e do Vertex. */
const NAO_EXISTE_RE = /not[ _-]?found|NOT_FOUND|does not exist|não existe|does not belong to user/i;

type Fetch = typeof fetchDoUndici;

export interface OpcoesDoCliente {
  modo: "agent-engine" | "local";
  enderecos: Enderecos;
  /** `null` = sem cabeçalho de autorização (o shim local). */
  token: () => Promise<string | null>;
  fetch?: Fetch;
}

export class ClienteAgentEngine implements AgenteProfessorPort {
  readonly modo: ModoDoAgente;
  private readonly fetch: Fetch;

  constructor(private readonly opcoes: OpcoesDoCliente) {
    this.modo = opcoes.modo;
    this.fetch = opcoes.fetch ?? fetchDoUndici;
  }

  private async cabecalhos(): Promise<Record<string, string>> {
    let token: string | null;
    try {
      token = await this.opcoes.token();
    } catch (erro) {
      throw new AgenteIndisponivel(
        "Sem credencial do Google Cloud para falar com o Agent Engine.",
        `${erro instanceof Error ? erro.message : String(erro)}. Em dev: 'gcloud auth application-default login'.`,
      );
    }
    return {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    };
  }

  /** `:query` — criar, ler e apagar sessão. Devolve o `output`. */
  private async consultar(metodo: string, input: Objeto): Promise<unknown> {
    let res: Awaited<ReturnType<Fetch>>;
    try {
      res = await this.fetch(this.opcoes.enderecos.query, {
        method: "POST",
        headers: await this.cabecalhos(),
        body: JSON.stringify({ class_method: metodo, input }),
        dispatcher,
        signal: AbortSignal.timeout(TIMEOUT_DE_SESSAO_MS),
      });
    } catch (erro) {
      if (erro instanceof AgenteIndisponivel) throw erro;
      throw new AgenteIndisponivel("O agente não respondeu.", causa(erro));
    }
    if (!res.ok) {
      const corpo = (await res.text()).slice(0, 300);
      throw new ErroHttpDoAgente(res.status, corpo);
    }
    const json = objeto(await res.json());
    return json?.output ?? null;
  }

  async criarSessao(usuarioId: string, estado: Objeto, expiraEm?: Date): Promise<{ sessaoId: string }> {
    const base = { user_id: usuarioId, state: estado };
    let saida: unknown;
    try {
      /* `expire_time` segue pelos `**kwargs` do `AdkApp.async_create_session`
         até o `sessions.create` do Vertex. Não é garantido que TODA versão do
         ADK (nem o `InMemorySessionService` do shim local) aceite o campo — e
         por isso a segunda tentativa, sem ele: a sessão nasce com o TTL padrão
         do engine (365 dias) em vez de a conversa não nascer. */
      saida = await this.consultar(
        "async_create_session",
        expiraEm ? { ...base, expire_time: expiraEm.toISOString() } : base,
      );
    } catch (erro) {
      if (!expiraEm || !(erro instanceof ErroHttpDoAgente) || erro.status === 401 || erro.status === 403) {
        throw paraIndisponivel(erro);
      }
      saida = await this.consultar("async_create_session", base).catch((e: unknown) => {
        throw paraIndisponivel(e);
      });
    }
    const sessao = normalizarSessao(saida);
    if (!sessao) throw new AgenteIndisponivel("O agente não devolveu a sessão criada.");
    return { sessaoId: sessao.sessaoId };
  }

  async lerSessao(usuarioId: string, sessaoId: string): Promise<SessaoAgente> {
    let saida: unknown;
    try {
      saida = await this.consultar("async_get_session", { user_id: usuarioId, session_id: sessaoId });
    } catch (erro) {
      if (erro instanceof ErroHttpDoAgente && (erro.status === 404 || NAO_EXISTE_RE.test(erro.corpo))) {
        throw new SessaoInexistente(sessaoId);
      }
      throw paraIndisponivel(erro);
    }
    /* O `InMemorySessionService` (shim local) devolve `None` para sessão que não existe. */
    const sessao = normalizarSessao(saida, sessaoId);
    if (!sessao || saida === null) throw new SessaoInexistente(sessaoId);
    return sessao;
  }

  async apagarSessao(usuarioId: string, sessaoId: string): Promise<void> {
    try {
      await this.consultar("async_delete_session", { user_id: usuarioId, session_id: sessaoId });
    } catch (erro) {
      /* Já não existe = o que se queria. Apagar é idempotente. */
      if (erro instanceof ErroHttpDoAgente && (erro.status === 404 || NAO_EXISTE_RE.test(erro.corpo))) return;
      throw paraIndisponivel(erro);
    }
  }

  /**
   * A API NATIVA de sessões, porque o `:query` do ADK não tem método de
   * atualizar sessão. Só no `agent-engine`: o shim local não a tem, e lá a
   * sessão vive na memória do processo.
   */
  async renovarSessao(sessaoId: string, expiraEm: Date): Promise<void> {
    const base = this.opcoes.enderecos.sessoes;
    if (!base) return;
    let res: Awaited<ReturnType<Fetch>>;
    try {
      res = await this.fetch(`${base}/${encodeURIComponent(sessaoId)}?updateMask=expireTime`, {
        method: "PATCH",
        headers: await this.cabecalhos(),
        body: JSON.stringify({ expireTime: expiraEm.toISOString() }),
        dispatcher,
        signal: AbortSignal.timeout(TIMEOUT_DE_SESSAO_MS),
      });
    } catch (erro) {
      throw paraIndisponivel(erro);
    }
    if (!res.ok) throw new ErroHttpDoAgente(res.status, (await res.text()).slice(0, 300));
  }

  async *enviar(usuarioId: string, sessaoId: string, mensagem: string, signal: AbortSignal): AsyncIterable<EventoAgente> {
    let res: Awaited<ReturnType<Fetch>>;
    try {
      res = await this.fetch(this.opcoes.enderecos.stream, {
        method: "POST",
        headers: await this.cabecalhos(),
        body: JSON.stringify({
          class_method: "async_stream_query",
          input: {
            user_id: usuarioId,
            session_id: sessaoId,
            message: mensagem,
            /* Sem isto o ADK não emite parciais: a resposta chegaria de uma vez
               no fim, e o painel ficaria mudo por dezenas de segundos. */
            run_config: { streaming_mode: "sse" },
          },
        }),
        dispatcher,
        signal,
      });
    } catch (erro) {
      if (signal.aborted) throw erro;
      throw paraIndisponivel(erro);
    }
    if (!res.ok) {
      const corpo = (await res.text()).slice(0, 300);
      if (res.status === 404 || NAO_EXISTE_RE.test(corpo)) throw new SessaoInexistente(sessaoId);
      throw new AgenteIndisponivel(`O agente respondeu ${res.status}.`, corpo, res.status);
    }
    if (!res.body) throw new AgenteIndisponivel("O agente respondeu sem corpo.");

    const parser = new ParserDeStream();
    const decodificador = new TextDecoder();
    const leitor = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        for (const bruto of parser.empurrar(decodificador.decode(value, { stream: true }))) {
          const evento = normalizarEvento(bruto);
          if (evento) yield evento;
        }
      }
      for (const bruto of [...parser.empurrar(decodificador.decode()), ...parser.terminar()]) {
        const evento = normalizarEvento(bruto);
        if (evento) yield evento;
      }
    } finally {
      leitor.releaseLock();
    }
    if (parser.descartadas > 0) {
      /* Só a CONTAGEM: a linha pode carregar o texto da resposta. */
      yield {
        autor: "engine",
        parcial: false,
        textos: [],
        chamadasDeFerramenta: [],
        respostasDeFerramenta: [],
        erro: { codigo: "linhas-descartadas", mensagem: String(parser.descartadas) },
      };
    }
  }
}

/** Falha HTTP do engine, antes de virar `AgenteIndisponivel` ou `SessaoInexistente`. */
export class ErroHttpDoAgente extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string,
  ) {
    super(`o agente respondeu ${status}`);
    this.name = "ErroHttpDoAgente";
  }
}

function paraIndisponivel(erro: unknown): Error {
  if (erro instanceof AgenteIndisponivel || erro instanceof SessaoInexistente) return erro;
  if (erro instanceof ErroHttpDoAgente) {
    return new AgenteIndisponivel(`O agente respondeu ${erro.status}.`, erro.corpo, erro.status);
  }
  return new AgenteIndisponivel("O agente não respondeu.", causa(erro));
}

/** `fetch failed` sozinho não diz nada: a razão real mora em `error.cause`. */
function causa(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro);
  const c = (erro as Error & { cause?: unknown }).cause;
  return c instanceof Error ? `${erro.message}: ${c.message}` : erro.message;
}

/* ==========================================================================
   mock — o da suíte e2e
   ========================================================================== */

/**
 * O MODO `mock` É O DA SUÍTE E2E: o hub e o painel precisam de um agente que
 * responda sem GCP, sempre do mesmo jeito, para a suíte poder afirmar o que
 * aparece na tela. Sessões em memória do processo (somem no restart — é dev) e
 * um turno enlatado, DETERMINÍSTICO, que exercita cada tipo de evento que a api
 * trata:
 *
 *   1. chamada a `buscar_acervo` (não parcial, com tokens)
 *   2. a resposta dela, com UMA fonte (vira o evento `fontes`)
 *   3. três parciais de texto (viram `delta`)
 *   4. o final AGREGADO repetindo o texto inteiro (a armadilha do SSE do ADK:
 *      a api não pode repassá-lo de novo), com tokens
 *   5. no 1º turno, o `state_delta` com `titulo_conversa` (vira `titulo`)
 *
 * O texto cita `EF06MA01`, que existe na BNCC: o mock não produz `aviso`. Se a
 * suíte quiser o aviso, a mensagem do professor contendo `EF99ZZ99` faz o mock
 * citá-lo de volta.
 */
export const TEXTO_DO_MOCK = [
  "Encontrei no acervo uma boa referência. ",
  "Para o 6º ano, a habilidade EF06MA01 trata de comparar e ordenar números naturais. ",
  "Sugiro começar com uma reta numérica na lousa.",
];
export const FONTE_DO_MOCK = { titulo: "BNCC — Ensino Fundamental", pagina_inicio: 300, pagina_fim: 301 };
export const TITULO_DO_MOCK = "Números naturais no 6º ano";
export const AUTOR_DO_MOCK = "agente_professor";

interface SessaoEmMemoria {
  usuarioId: string;
  estado: Objeto;
  eventos: EventoAgente[];
}

export class AgenteProfessorMock implements AgenteProfessorPort {
  readonly modo = "mock" as const;
  private readonly sessoes = new Map<string, SessaoEmMemoria>();
  private proximo = 1;

  /** `atrasoMs` entre eventos: 0 nos testes; alguns ms em dev, para o painel mostrar o stream. */
  constructor(private readonly atrasoMs = 0) {}

  async criarSessao(usuarioId: string, estado: Objeto): Promise<{ sessaoId: string }> {
    const sessaoId = `mock-${this.proximo++}-${Date.now().toString(36)}`;
    this.sessoes.set(sessaoId, { usuarioId, estado: { ...estado }, eventos: [] });
    return { sessaoId };
  }

  private daSessao(usuarioId: string, sessaoId: string): SessaoEmMemoria {
    const sessao = this.sessoes.get(sessaoId);
    /* A mesma defesa do ADK ≥ 2.2: sessão de outro usuário não existe para quem pede. */
    if (!sessao || sessao.usuarioId !== usuarioId) throw new SessaoInexistente(sessaoId);
    return sessao;
  }

  async lerSessao(usuarioId: string, sessaoId: string): Promise<SessaoAgente> {
    const s = this.daSessao(usuarioId, sessaoId);
    return { sessaoId, estado: { ...s.estado }, eventos: [...s.eventos] };
  }

  async apagarSessao(usuarioId: string, sessaoId: string): Promise<void> {
    const s = this.sessoes.get(sessaoId);
    if (s && s.usuarioId === usuarioId) this.sessoes.delete(sessaoId);
  }

  async *enviar(usuarioId: string, sessaoId: string, mensagem: string, signal: AbortSignal): AsyncIterable<EventoAgente> {
    const sessao = this.daSessao(usuarioId, sessaoId);
    const primeiroTurno = sessao.estado.titulo_conversa === undefined;
    const vazio = { chamadasDeFerramenta: [], respostasDeFerramenta: [], textos: [] };
    const textos = [...TEXTO_DO_MOCK];
    const inexistente = /EF99ZZ99/.exec(mensagem);
    if (inexistente) textos.push(` Veja também a ${inexistente[0]}.`);

    const roteiro: EventoAgente[] = [
      {
        ...vazio,
        autor: AUTOR_DO_MOCK,
        parcial: false,
        chamadasDeFerramenta: [{ nome: "buscar_acervo", args: { texto: "números naturais", anos: ["6"] } }],
        tokens: 120,
      },
      {
        ...vazio,
        autor: AUTOR_DO_MOCK,
        parcial: false,
        respostasDeFerramenta: [{ nome: "buscar_acervo", resposta: { trechos: [FONTE_DO_MOCK] } }],
      },
      /* `tokens` nos PARCIAIS de propósito: o ADK os repete ali, e a api tem de
         ignorá-los — somá-los cobraria o turno várias vezes. */
      ...textos.map((t) => ({ ...vazio, autor: AUTOR_DO_MOCK, parcial: true, textos: [t], tokens: 999 })),
      { ...vazio, autor: AUTOR_DO_MOCK, parcial: false, textos: [textos.join("")], tokens: 350 },
    ];
    if (primeiroTurno) {
      roteiro.push({
        ...vazio,
        autor: AUTOR_DO_MOCK,
        parcial: false,
        estadoDelta: { titulo_conversa: TITULO_DO_MOCK },
        fimDeTurno: true,
      });
    }

    sessao.eventos.push({ ...vazio, autor: "user", parcial: false, textos: [mensagem] });
    for (const evento of roteiro) {
      if (this.atrasoMs > 0) await new Promise((r) => setTimeout(r, this.atrasoMs));
      else await Promise.resolve();
      if (signal.aborted) throw signal.reason ?? new Error("abortado");
      if (!evento.parcial) sessao.eventos.push(evento);
      if (evento.estadoDelta) Object.assign(sessao.estado, evento.estadoDelta);
      yield evento;
    }
  }
}

/* ==========================================================================
   desligado — toda chamada vira AGENTE_INDISPONIVEL
   ========================================================================== */

const DESLIGADO = "O agente de IA do professor não está configurado nesta instalação.";

export class AgenteProfessorDesligado implements AgenteProfessorPort {
  readonly modo = "desligado" as const;
  async criarSessao(): Promise<{ sessaoId: string }> {
    throw new AgenteIndisponivel(DESLIGADO, "AGENTE_PROFESSOR_MODO=desligado");
  }
  async lerSessao(): Promise<SessaoAgente> {
    throw new AgenteIndisponivel(DESLIGADO, "AGENTE_PROFESSOR_MODO=desligado");
  }
  async apagarSessao(): Promise<void> {
    throw new AgenteIndisponivel(DESLIGADO, "AGENTE_PROFESSOR_MODO=desligado");
  }
  // eslint-disable-next-line require-yield
  async *enviar(): AsyncIterable<EventoAgente> {
    throw new AgenteIndisponivel(DESLIGADO, "AGENTE_PROFESSOR_MODO=desligado");
  }
}

/* ==========================================================================
   A fábrica — o `AiModule` a chama com as envs já validadas pelo Zod
   ========================================================================== */

let auth: GoogleAuth | undefined;
async function tokenDoAdc(): Promise<string> {
  /* Instância única e preguiçosa: a lib cacheia e renova o token; criada só no
     modo `agent-engine`, para os outros modos nem tocarem no ADC. */
  auth ??= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("a credencial resolvida não devolveu access token");
  return token;
}

export function criarAgenteProfessor(config: {
  modo: ModoDoAgente;
  engine?: string;
  urlLocal?: string;
}): AgenteProfessorPort {
  switch (config.modo) {
    case "agent-engine":
      if (!config.engine) throw new Error("AGENTE_PROFESSOR_ENGINE é obrigatório no modo agent-engine");
      return new ClienteAgentEngine({ modo: "agent-engine", enderecos: enderecosDoEngine(config.engine), token: tokenDoAdc });
    case "local":
      if (!config.urlLocal) throw new Error("AGENTE_PROFESSOR_URL_LOCAL é obrigatório no modo local");
      return new ClienteAgentEngine({ modo: "local", enderecos: enderecosLocais(config.urlLocal), token: async () => null });
    case "mock":
      return new AgenteProfessorMock(40);
    case "desligado":
      return new AgenteProfessorDesligado();
  }
}
