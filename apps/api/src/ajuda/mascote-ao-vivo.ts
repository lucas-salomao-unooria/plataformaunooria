import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpAdapterHost } from "@nestjs/core";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import type { ConversaDeVoz, EventoDaVoz } from "../ai/voz-ao-vivo.port";
import { origensPermitidas } from "../config/origens";
import { logger } from "../observabilidade/logger";
import { AjudaService } from "./ajuda.service";
import { MensagemDoNavegadorSchema } from "./contrato-de-rotas";
import { ESPERA_DO_BILHETE_MS, FECHAMENTOS_DO_MASCOTE, MENSAGENS_POR_SEGUNDO_DO_MASCOTE } from "./regras";
import { verificarTokenDaSessao, type ClaimsDaSessao } from "./token-da-sessao";

/**
 * A CONEXÃO DE VOZ DO MASCOTE (ADR-158): `WS /ajuda/mascote/ao-vivo`.
 *
 * O navegador fala com ESTA api, e só ela fala com o Gemini Live (com o ADC,
 * pela porta `VOZ_AO_VIVO`). É o "proxy" do PoC `poc-mascote-visemas`, com três
 * diferenças que são o motivo de ele morar aqui e não num serviço à parte:
 *
 * 1. **A instrução do sistema e a base nunca saem da api** (regra 2): o setup
 *    é montado AQUI, e o navegador só manda o que a pessoa disse ou escreveu,
 *    num protocolo fechado (`MensagemDoNavegadorSchema`). Nada do formato do
 *    vendor atravessa — nem para lá, nem para cá.
 * 2. **Quem entra prova quem é** com o bilhete que `POST /ajuda/sessoes`
 *    devolveu (HS256, audiência `ajuda-mascote`, 2 min), na PRIMEIRA mensagem —
 *    não na URL, que vai parar em log de balanceador. O bilhete entra uma vez
 *    só (`entrarNoMascote` marca a linha de forma atômica).
 * 3. **O custo tem teto**: a conexão cai no prazo da sessão (`ajuda_limites`),
 *    e a cada meio minuto a linha e o produto são conferidos — encerrar em
 *    outra aba, ou o `admin` desligar a Ajuda, derruba a conversa no ar.
 *
 * O `Origin` é conferido contra a lista do CORS (`config/origens.ts`): o CORS
 * não alcança WebSocket, e qualquer site aberto no navegador poderia abrir uma
 * conexão — mas sem bilhete não passaria da primeira mensagem de qualquer jeito.
 *
 * O que NÃO vai ao log: o que foi dito ou escrito (regra 6). A linha da sessão
 * é `ajuda.mascote` com `sid`, `perfil`, `duracaoMs`, `turnos` e `motivo`.
 */

export const CAMINHO_DO_MASCOTE = "/ajuda/mascote/ao-vivo";
/** De quanto em quanto tempo a conexão confere se a sessão e o produto ainda valem. */
export const CONFERENCIA_MS = 30_000;

/** O pedaço do `AjudaService` que a conexão usa — o teste o imita. */
export interface ServicoDoMascote {
  entrarNoMascote(claims: ClaimsDaSessao): Promise<{ prazo: Date } | null>;
  encerrarMascote(claims: ClaimsDaSessao): Promise<void>;
  abrirVozDoMascote(claims: ClaimsDaSessao): Promise<ConversaDeVoz>;
  sessaoValida(claims: ClaimsDaSessao): Promise<boolean>;
  produtoLigado(claims: ClaimsDaSessao): Promise<boolean>;
}

/** O pedaço do socket do `ws` que a conexão usa — o teste o imita. */
export interface SocketDoNavegador {
  readonly readyState: number;
  send(dados: string): void;
  close(codigo?: number, motivo?: string): void;
  on(evento: "message", cb: (dados: RawData) => void): unknown;
  on(evento: "close", cb: () => void): unknown;
  on(evento: "error", cb: (erro: Error) => void): unknown;
}

const ABERTO = 1;

/** O que a api manda ao navegador: os eventos do vendor, já neutros, e o `pronto`. */
type MensagemAoNavegador = EventoDaVoz | { tipo: "pronto"; prazo: string };

/**
 * UMA conversa, do primeiro byte ao fim. Sem Nest e sem `http`: o teste monta
 * com um socket e um serviço de mentira.
 */
export class ConexaoDoMascote {
  private claims: ClaimsDaSessao | null = null;
  private conversa: ConversaDeVoz | null = null;
  private encerrada = false;
  private entrando = false;
  private readonly inicio = Date.now();
  private turnos = 0;
  private janela = { inicio: Date.now(), mensagens: 0 };
  private readonly timers: Array<ReturnType<typeof setTimeout>> = [];
  private relogio: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly socket: SocketDoNavegador,
    private readonly servico: ServicoDoMascote,
    private readonly chave: string,
    private readonly conferenciaMs = CONFERENCIA_MS,
  ) {
    socket.on("message", (dados) => void this.receber(dados));
    socket.on("close", () => void this.encerrar("navegador-fechou"));
    socket.on("error", () => void this.encerrar("navegador-falhou"));
    this.timers.push(
      setTimeout(() => {
        if (!this.claims) this.fechar(FECHAMENTOS_DO_MASCOTE.BILHETE_INVALIDO, "bilhete-nao-chegou");
      }, ESPERA_DO_BILHETE_MS),
    );
  }

  private async receber(dados: RawData): Promise<void> {
    if (this.encerrada) return;
    if (!this.dentroDoRitmo()) {
      this.fechar(FECHAMENTOS_DO_MASCOTE.ABUSO, "ritmo");
      return;
    }
    let bruto: unknown;
    try {
      bruto = JSON.parse(Buffer.isBuffer(dados) ? dados.toString("utf8") : String(dados));
    } catch {
      this.fechar(FECHAMENTOS_DO_MASCOTE.ABUSO, "nao-e-json");
      return;
    }
    const lida = MensagemDoNavegadorSchema.safeParse(bruto);
    if (!lida.success) {
      this.fechar(FECHAMENTOS_DO_MASCOTE.ABUSO, "fora-do-protocolo");
      return;
    }
    const msg = lida.data;

    if (!this.claims) {
      // A primeira mensagem é o bilhete; qualquer outra coisa antes dele fecha.
      if (msg.tipo !== "entrar" || this.entrando) {
        if (!this.entrando) this.fechar(FECHAMENTOS_DO_MASCOTE.BILHETE_INVALIDO, "sem-bilhete");
        return;
      }
      this.entrando = true;
      await this.entrar(msg.bilhete);
      return;
    }
    if (msg.tipo === "entrar" || !this.conversa) return;
    if (msg.tipo === "texto") this.turnos++;
    this.conversa.enviar(msg);
  }

  private dentroDoRitmo(): boolean {
    const agora = Date.now();
    if (agora - this.janela.inicio >= 1000) this.janela = { inicio: agora, mensagens: 0 };
    this.janela.mensagens++;
    return this.janela.mensagens <= MENSAGENS_POR_SEGUNDO_DO_MASCOTE;
  }

  private async entrar(bilhete: string): Promise<void> {
    const claims = await verificarTokenDaSessao(bilhete, this.chave, "ajuda-mascote");
    if (this.encerrada) return;
    if (!claims) {
      this.fechar(FECHAMENTOS_DO_MASCOTE.BILHETE_INVALIDO, "bilhete-invalido");
      return;
    }
    if (!(await this.servico.produtoLigado(claims))) {
      await this.servico.encerrarMascote(claims);
      this.fechar(FECHAMENTOS_DO_MASCOTE.PRODUTO_DESLIGADO, "produto-desligado");
      return;
    }
    const entrada = await this.servico.entrarNoMascote(claims);
    if (this.encerrada) return;
    if (!entrada) {
      this.fechar(FECHAMENTOS_DO_MASCOTE.BILHETE_INVALIDO, "sessao-usada-ou-encerrada");
      return;
    }
    this.claims = claims;
    const restante = entrada.prazo.getTime() - Date.now();
    if (restante <= 0) {
      this.fechar(FECHAMENTOS_DO_MASCOTE.TEMPO_ESGOTADO, "tempo-esgotado");
      return;
    }

    let conversa: ConversaDeVoz;
    try {
      conversa = await this.servico.abrirVozDoMascote(claims);
    } catch (erro) {
      logger.error({ codigo: "ajuda.mascote-voz-falhou", sid: claims.sid, err: erro }, "o Gemini Live não abriu a sessão");
      this.fechar(FECHAMENTOS_DO_MASCOTE.VOZ_FALHOU, "voz-falhou");
      return;
    }
    if (this.encerrada) {
      conversa.fechar();
      return;
    }
    this.conversa = conversa;
    conversa.aoEvento((evento) => this.mandar(evento));
    conversa.aoFechar(({ codigo, motivo }) => {
      if (this.encerrada) return;
      // O motivo do vendor vai só ao log (pode trazer o id de sessão dele).
      logger.warn(
        { codigo: "ajuda.mascote-vendor-fechou", sid: claims.sid, codigoDoVendor: codigo, motivo: motivo.slice(0, 200) },
        "o Gemini Live encerrou a conversa",
      );
      this.fechar(FECHAMENTOS_DO_MASCOTE.VOZ_FALHOU, "vendor-fechou");
    });

    this.timers.push(setTimeout(() => this.fechar(FECHAMENTOS_DO_MASCOTE.TEMPO_ESGOTADO, "tempo-esgotado"), restante));
    this.relogio = setInterval(() => void this.conferir(), this.conferenciaMs);
    this.mandar({ tipo: "pronto", prazo: entrada.prazo.toISOString() });
  }

  /** A sessão ainda vale (não foi encerrada em outra aba) e o produto continua ligado? */
  private async conferir(): Promise<void> {
    const claims = this.claims;
    if (!claims || this.encerrada) return;
    try {
      if (!(await this.servico.sessaoValida(claims))) {
        this.fechar(FECHAMENTOS_DO_MASCOTE.TEMPO_ESGOTADO, "sessao-encerrada");
      } else if (!(await this.servico.produtoLigado(claims))) {
        this.fechar(FECHAMENTOS_DO_MASCOTE.PRODUTO_DESLIGADO, "produto-desligado");
      }
    } catch (erro) {
      // Banco fora do ar por um instante não derruba a conversa: o prazo ainda vale.
      logger.warn({ codigo: "ajuda.mascote-conferencia-falhou", sid: claims.sid, err: erro }, "não deu para conferir a sessão do mascote");
    }
  }

  private mandar(msg: MensagemAoNavegador): void {
    if (this.socket.readyState === ABERTO) this.socket.send(JSON.stringify(msg));
  }

  private fechar(codigo: number, motivo: string): void {
    if (this.socket.readyState === ABERTO) this.socket.close(codigo, motivo);
    void this.encerrar(motivo);
  }

  private async encerrar(motivo: string): Promise<void> {
    if (this.encerrada) return;
    this.encerrada = true;
    for (const t of this.timers) clearTimeout(t);
    if (this.relogio) clearInterval(this.relogio);
    this.conversa?.fechar();
    const claims = this.claims;
    if (!claims) return;
    await this.servico.encerrarMascote(claims).catch((erro: unknown) =>
      logger.warn({ codigo: "ajuda.mascote-fim-nao-gravado", sid: claims.sid, err: erro }, "o fim da sessão do mascote não foi gravado"),
    );
    logger.info(
      { codigo: "ajuda.mascote", sid: claims.sid, perfil: claims.perfil, duracaoMs: Date.now() - this.inicio, turnos: this.turnos, motivo },
      "conversa com o mascote encerrada",
    );
  }
}

/** O `Origin` do navegador está na lista do CORS? Sem `Origin` (não é navegador) = não. */
export function origemPermitida(origem: string | undefined, permitidas: readonly string[]): boolean {
  return Boolean(origem && permitidas.includes(origem));
}

/**
 * Pendura a conexão do mascote no servidor HTTP do Nest. Não é um gateway do
 * `@nestjs/websockets`: é UM caminho, sem salas nem broadcast, e o adapter
 * inteiro seria dependência para nada. Outro `upgrade` (nenhum, hoje) segue
 * adiante intocado.
 */
@Injectable()
export class MascoteAoVivo implements OnApplicationBootstrap, OnModuleDestroy {
  private wss: WebSocketServer | null = null;
  private servidor: Server | null = null;
  private readonly aoPedirUpgrade = (req: IncomingMessage, socket: Duplex, cabeca: Buffer) =>
    this.upgrade(req, socket, cabeca);

  constructor(
    private readonly adaptador: HttpAdapterHost,
    private readonly service: AjudaService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const servidor = this.adaptador.httpAdapter?.getHttpServer() as Server | undefined;
    if (!servidor) return;
    this.servidor = servidor;
    // O protocolo é JSON com pedaços de 100 ms de microfone: 256 KB é folga larga.
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
    servidor.on("upgrade", this.aoPedirUpgrade);
  }

  onModuleDestroy(): void {
    this.servidor?.off("upgrade", this.aoPedirUpgrade);
    for (const cliente of this.wss?.clients ?? []) cliente.close(1001, "api-desligando");
    this.wss?.close();
  }

  private upgrade(req: IncomingMessage, socket: Duplex, cabeca: Buffer): void {
    const caminho = (req.url ?? "/").split("?")[0];
    if (caminho !== CAMINHO_DO_MASCOTE || !this.wss) return;
    if (!origemPermitida(req.headers.origin, origensPermitidas())) {
      logger.warn({ codigo: "ajuda.mascote-origem-recusada", origem: req.headers.origin ?? null }, "origem recusada na conexão do mascote");
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    const chave = this.config.get<string>("AJUDA_SESSAO_CHAVE");
    this.wss.handleUpgrade(req, socket, cabeca, (cliente: WebSocket) => {
      if (!chave || !this.service.mascoteLigado) {
        cliente.close(FECHAMENTOS_DO_MASCOTE.INDISPONIVEL, "indisponivel");
        return;
      }
      new ConexaoDoMascote(cliente, this.service, chave);
    });
  }
}
