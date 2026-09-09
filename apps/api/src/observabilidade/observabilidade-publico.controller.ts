import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req } from "@nestjs/common";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { TIPO_ERRO_REPORTADO } from "./filtro-de-excecao";
import { classificarDispositivo } from "./dispositivo";
import { logger } from "./logger";
import { Metricas } from "./metricas";
import { normalizarRota } from "./normalizar-rota";
import { redigirTexto } from "./redaction";
import { CotaExcedidaSchema, ErroClienteSchema, SemCorpoSchema, VitalSchema } from "./contrato-de-rotas";

/**
 * Os sinais do navegador ANTES do login (ADR-84).
 *
 * A tela de login e a landing são as únicas superfícies por onde TODO mundo
 * passa, e eram as únicas cujo erro não deixava rastro nenhum: sem sessão, o
 * BFF do hub responde 401 e o erro morria no console do estudante. "Ninguém
 * consegue entrar" era, literalmente, o defeito mais invisível da plataforma.
 *
 * O que muda em relação ao controller autenticado, e por quê:
 *
 *  - **sem `OidcGuard`**, que é o ponto: aqui não há token para exigir;
 *  - **sem id de pessoa**. O que correlaciona é o `sessaoId` do
 *    `sessionStorage`, que morre com a aba. Pedir identidade a quem ainda não
 *    entrou seria inventá-la;
 *  - **`expId` é sempre `hub`**, ignorando o que vier no corpo: a superfície
 *    pública é o hub, e uma experiência sequer conhece a URL da api antes do
 *    `hub:init`;
 *  - **cota por IP E teto global**, ver abaixo;
 *  - **nenhuma linha de log por requisição recusada** — a regra do
 *    `/telemetry/beacon` vale igual aqui: rota pública que loga recusa é vetor
 *    de inundação, cobrada por GiB. O sinal do descarte é contador.
 *
 * **Por que IP aqui, se o `rate-limit.ts` diz que a chave certa é o usuário.**
 * A lição dele é sobre rota de PRODUTO: uma turma inteira sai pelo mesmo NAT da
 * escola, e limitar por IP derrubaria a turma. Aqui não há usuário — é o que
 * define a rota —, e estourar a cota não derruba ninguém: descarta AMOSTRA de
 * telemetria. Cinco erros por minuto de uma escola bastam para saber que a tela
 * de login quebrou; o milésimo não acrescenta nada. O teto global existe porque
 * o IP é forjável (o `X-Forwarded-For` é do cliente até o GFE reescrevê-lo), e
 * sem ele um laço distribuído viraria conta de log.
 */
export const ERROS_PUBLICOS_POR_IP_POR_MINUTO = 5;
export const VITAIS_PUBLICOS_POR_IP_POR_MINUTO = 20;
/** Teto da INSTÂNCIA, somando todo mundo: a contenção que não depende do IP ser verdadeiro. */
export const SINAIS_PUBLICOS_GLOBAIS_POR_MINUTO = 300;

/**
 * O IP de quem chamou, para servir de chave de cota — e só para isso.
 *
 * `X-Forwarded-For` chega como `cliente, proxy1, proxy2`. O primeiro elemento é
 * o cliente quando existe um proxy confiável na frente (é o caso: Cloud Run
 * atrás do Load Balancer), e é forjável quando não existe. Como o valor aqui
 * decide quantas amostras de telemetria se aceita, e não autorização, a troca é
 * consciente — e o teto global cobre o caso do valor mentiroso.
 *
 * NÃO vai para log nem para rótulo de métrica: IP é dado pessoal, e num
 * contrato com dado de menor ele não tem por que existir fora desta função.
 */
export function ipDoCliente(cabecalhos: Record<string, unknown>): string {
  const bruto = cabecalhos["x-forwarded-for"];
  const linha = Array.isArray(bruto) ? bruto[0] : bruto;
  if (typeof linha !== "string" || linha.length === 0) return "desconhecido";
  const primeiro = linha.split(",")[0]?.trim();
  return primeiro && primeiro.length <= 45 ? primeiro : "desconhecido";
}

type RequisicaoCrua = { headers: Record<string, unknown> };

/** O user-agent do CABEÇALHO, não o do corpo: o corpo é do cliente, o cabeçalho é o que a requisição trouxe. */
function userAgentDoCabecalho(cabecalhos: Record<string, unknown>): string | undefined {
  const ua = cabecalhos["user-agent"];
  return typeof ua === "string" && ua.length > 0 ? ua : undefined;
}

@Controller("observabilidade/publico")
export class ObservabilidadePublicoController {
  constructor(private readonly metricas: Metricas) {}

  /** Duas cotas, na ordem barata: a global primeiro, que é uma chave só. */
  private recusadoPorCota(chaveDoIp: string, limiteDoIp: number): boolean {
    if (!rateLimit("publico:global", SINAIS_PUBLICOS_GLOBAIS_POR_MINUTO, 60_000).ok) return true;
    return !rateLimit(chaveDoIp, limiteDoIp, 60_000).ok;
  }

  @Post("erros-cliente")
  @HttpCode(204)
  @Contrato({
    resumo: "Registra um erro de navegador ocorrido ANTES do login (landing, tela de login, troca de senha).",
    descricao:
      "Mesma captura da SDK, sem token: é a única rota de observabilidade sem `OidcGuard` (ADR-84). A api força `expId = hub`, redige `mensagem`/`stack`, classifica o user-agent em rótulos fechados e emite UMA linha `ERROR` no formato do Error Reporting, com `autenticado: false` e SEM id de pessoa — quem ainda não entrou não tem identidade a registrar. O que correlaciona os eventos de uma mesma aba é o `sessaoId`.",
    corpo: ErroClienteSchema,
    resposta: SemCorpoSchema,
    notas: [
      `Cota de ${ERROS_PUBLICOS_POR_IP_POR_MINUTO} por minuto por IP e ${SINAIS_PUBLICOS_GLOBAIS_POR_MINUTO} por minuto no total da instância: acima, **429**, contado e sem linha de log.`,
      "`expId` do corpo é IGNORADO (sempre `hub`): antes do `hub:init` nenhuma experiência conhece a api.",
      "O IP serve de chave de cota e não é registrado em lugar nenhum.",
    ],
  })
  errosCliente(@Body() body: unknown, @Req() req: RequisicaoCrua) {
    const ip = ipDoCliente(req.headers);
    if (this.recusadoPorCota(`erro-publico:${ip}`, ERROS_PUBLICOS_POR_IP_POR_MINUTO)) {
      this.metricas.errosDeClienteRecusados.add(1, { motivo: "cota", superficie: "publico" });
      throw new HttpException({ codigo: "cota-excedida", retryAfterSeconds: 60 }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const lido = ErroClienteSchema.safeParse(body);
    if (!lido.success) {
      // Contado, e não só recusado: foi a AUSÊNCIA deste contador que deixou o
      // `versao` grande demais recusar todo erro do hub por seis dias.
      this.metricas.errosDeClienteRecusados.add(1, { motivo: "invalido", superficie: "publico" });
      throw new HttpException({ codigo: "corpo-invalido" }, HttpStatus.BAD_REQUEST);
    }
    const erro = lido.data;
    const dispositivo = classificarDispositivo(userAgentDoCabecalho(req.headers) ?? erro.userAgent);
    this.metricas.errosDeClienteRecebidos.add(1, { superficie: "publico" });
    const mensagem = redigirTexto(erro.mensagem);
    const stack = erro.stack ? redigirTexto(erro.stack) : undefined;
    logger.error(
      {
        "@type": TIPO_ERRO_REPORTADO,
        serviceContext: { service: "hub", version: erro.versao },
        codigo: "erro-cliente",
        expId: "hub",
        versao: erro.versao,
        url: redigirTexto(erro.url),
        userAgent: erro.userAgent,
        sessaoId: erro.sessaoId,
        /** O que separa esta linha da do controller autenticado: aqui não há quem identificar. */
        autenticado: false,
        navegador: dispositivo.navegador,
        so: dispositivo.so,
        tipoDeDispositivo: dispositivo.tipo,
        ...(erro.dispositivo ? { dispositivo: erro.dispositivo } : {}),
        stack_trace: stack ?? mensagem,
      },
      stack ? `${mensagem}\n${stack}` : mensagem,
    );
  }

  @Post("vitals")
  @HttpCode(204)
  @Contrato({
    resumo: "Recebe um Web Vital medido antes do login.",
    descricao:
      "A tela de login é a primeira de toda sessão, e o vital dela é o único que mede a primeira impressão de desempenho da plataforma. Registrado no mesmo histograma das telas autenticadas, com `perfil: anonimo` — sem token não há perfil a declarar.",
    corpo: VitalSchema,
    resposta: SemCorpoSchema,
    notas: [`Cota de ${VITAIS_PUBLICOS_POR_IP_POR_MINUTO} por minuto por IP, mais o teto global da instância.`],
  })
  vitals(@Body() body: unknown, @Req() req: RequisicaoCrua) {
    const ip = ipDoCliente(req.headers);
    if (this.recusadoPorCota(`vital-publico:${ip}`, VITAIS_PUBLICOS_POR_IP_POR_MINUTO)) {
      this.metricas.vitaisRecusados.add(1, { motivo: "cota", superficie: "publico" });
      throw new HttpException(CotaExcedidaSchema.parse({ codigo: "cota-excedida", retryAfterSeconds: 60 }), HttpStatus.TOO_MANY_REQUESTS);
    }
    const lido = VitalSchema.safeParse(body);
    if (!lido.success) {
      this.metricas.vitaisRecusados.add(1, { motivo: "invalido", superficie: "publico" });
      throw new HttpException({ codigo: "corpo-invalido" }, HttpStatus.BAD_REQUEST);
    }
    const vital = lido.data;
    this.metricas.vital(vital.nome).record(vital.valor, {
      superficie: vital.superficie,
      rota: normalizarRota(vital.rota, vital.superficie),
      perfil: "anonimo",
      tipo_dispositivo: classificarDispositivo(userAgentDoCabecalho(req.headers)).tipo,
    });
  }
}
