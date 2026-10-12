import { z } from "zod";

/**
 * A CONEXÃO DE VOZ DO MASCOTE (ADR-158), lado do navegador.
 *
 * O navegador abre `WS {api}/ajuda/mascote/ao-vivo` e manda, PRIMEIRO, o
 * bilhete que `POST /ajuda/sessoes` devolveu — nunca na URL. Depois disso só
 * vão o texto da pessoa e o microfone; voltam o áudio do mascote, as
 * transcrições e os marcos do turno. O formato do vendor (Gemini Live) nunca
 * chega aqui: a api traduz (`apps/api/src/ai/gemini-live.client.ts`).
 *
 * O bilhete vive só nesta closure (regra 4: nada de token em `localStorage`).
 */

/** Espelha `FECHAMENTOS_DO_MASCOTE` de `apps/api/src/ajuda/regras.ts`. */
export const FECHAMENTOS = {
  BILHETE_INVALIDO: 4401,
  PRODUTO_DESLIGADO: 4403,
  TEMPO_ESGOTADO: 4408,
  ABUSO: 4429,
  VOZ_FALHOU: 4502,
  INDISPONIVEL: 4503,
} as const;

/** O que a api manda. Mensagem fora disto é ignorada, nunca derruba a conversa. */
export const EventoDoMascoteSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("pronto"), prazo: z.string() }),
  z.object({ tipo: z.literal("audio"), base64: z.string(), taxa: z.number().int().positive() }),
  z.object({ tipo: z.literal("transcricao-saida"), texto: z.string() }),
  z.object({ tipo: z.literal("transcricao-entrada"), texto: z.string() }),
  z.object({ tipo: z.literal("interrompido") }),
  z.object({ tipo: z.literal("fim-do-turno") }),
]);
export type EventoDoMascote = z.infer<typeof EventoDoMascoteSchema>;

export function lerEvento(dados: unknown): EventoDoMascote | null {
  if (typeof dados !== "string") return null;
  try {
    const lido = EventoDoMascoteSchema.safeParse(JSON.parse(dados));
    return lido.success ? lido.data : null;
  } catch {
    return null;
  }
}

/** `http://api` → `ws://api/ajuda/mascote/ao-vivo` (e `https` → `wss`). */
export function enderecoDoMascote(apiUrl: string): string {
  const url = new URL("/ajuda/mascote/ao-vivo", apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/**
 * Como a conversa acabou, na língua da tela. `encerrada` = fim normal (o tempo
 * acabou, ou a pessoa encerrou em outra aba): a janela oferece começar de novo.
 */
export function fechamentoParaTela(codigo: number): { tipo: "encerrada" | "erro"; mensagem: string; podeRepetir: boolean } {
  switch (codigo) {
    case FECHAMENTOS.TEMPO_ESGOTADO:
      return { tipo: "encerrada", mensagem: "O tempo desta conversa acabou.", podeRepetir: true };
    case FECHAMENTOS.PRODUTO_DESLIGADO:
      return { tipo: "erro", mensagem: "A Ajuda com atendente não está disponível na sua rede.", podeRepetir: false };
    case FECHAMENTOS.INDISPONIVEL:
      return { tipo: "erro", mensagem: "A Ajuda com o mascote não está disponível agora.", podeRepetir: false };
    case FECHAMENTOS.ABUSO:
      return { tipo: "erro", mensagem: "A conversa foi interrompida. Comece de novo, por favor.", podeRepetir: true };
    case FECHAMENTOS.BILHETE_INVALIDO:
      return { tipo: "erro", mensagem: "A conversa não pôde começar. Tente de novo.", podeRepetir: true };
    default:
      return {
        tipo: "erro",
        mensagem:
          "A conversa com o mascote caiu. A rede da escola pode estar bloqueando a conexão. Tente de novo ou use outra rede.",
        podeRepetir: true,
      };
  }
}

export interface AoVivo {
  enviarTexto(texto: string): void;
  enviarAudio(base64: string): void;
  fimDoAudio(): void;
  fechar(): void;
}

const ABERTO = 1;

/**
 * Abre a conexão e entra com o bilhete. Resolve quando a api manda `pronto`
 * (o Gemini confirmou a sessão); rejeita com o código de fechamento.
 */
export function conectarAoMascote(opcoes: {
  endereco: string;
  bilhete: string;
  aoEvento: (evento: EventoDoMascote) => void;
  aoFechar: (codigo: number) => void;
  criar?: (endereco: string) => WebSocket;
}): Promise<{ conexao: AoVivo; prazo: Date }> {
  const ws = (opcoes.criar ?? ((e) => new WebSocket(e)))(opcoes.endereco);
  const enviar = (msg: object) => {
    if (ws.readyState === ABERTO) ws.send(JSON.stringify(msg));
  };
  const conexao: AoVivo = {
    enviarTexto: (texto) => enviar({ tipo: "texto", texto }),
    enviarAudio: (base64) => enviar({ tipo: "audio", base64 }),
    fimDoAudio: () => enviar({ tipo: "fim-do-audio" }),
    fechar: () => {
      if (ws.readyState <= ABERTO) ws.close(1000);
    },
  };
  return new Promise((resolver, rejeitar) => {
    let pronto = false;
    ws.onopen = () => enviar({ tipo: "entrar", bilhete: opcoes.bilhete });
    ws.onmessage = (ev: MessageEvent) => {
      const evento = lerEvento(ev.data);
      if (!evento) return;
      if (evento.tipo === "pronto") {
        if (!pronto) {
          pronto = true;
          resolver({ conexao, prazo: new Date(evento.prazo) });
        }
        return;
      }
      opcoes.aoEvento(evento);
    };
    ws.onclose = (ev: CloseEvent) => {
      if (pronto) opcoes.aoFechar(ev.code);
      else rejeitar(new ErroDeConexao(ev.code));
    };
  });
}

export class ErroDeConexao extends Error {
  constructor(readonly codigo: number) {
    super(`conexão do mascote fechada: ${codigo}`);
    this.name = "ErroDeConexao";
  }
}
