/**
 * O LEITOR DE FRAMES SSE do turno do agente de IA do professor.
 *
 * Por que não `EventSource`: ele só faz `GET`, e o turno é um `POST` com corpo
 * (a pergunta). A leitura é `fetch` + `ReadableStream` + `TextDecoder`, e este
 * módulo é a metade que transforma TEXTO em frames — pura, sem rede, para o
 * teste poder partir o stream em qualquer ponto.
 *
 * O formato é o do WHATWG (`text/event-stream`), no que a api usa:
 *
 *   - linhas terminam em `\n`, `\r\n` ou `\r` — e um `\r` no FIM de um pedaço
 *     pode ser a primeira metade de um `\r\n` que chega no próximo;
 *   - `event: x` dá o nome; `data: y` acumula (várias linhas `data:` viram uma
 *     só, juntas por `\n`); um espaço depois dos dois-pontos é descartado;
 *   - linha que começa com `:` é comentário (o `: ping` de 15 s da api);
 *   - linha em branco DESPACHA o frame.
 *
 * Um afastamento declarado do WHATWG: frame com `event:` e SEM `data:` é
 * despachado (com `dados` vazio). Pela norma ele seria descartado — e o `fim`
 * é justamente o evento que não pode se perder, senão a mensagem fica
 * "escrevendo" para sempre.
 */

export interface FrameSse {
  evento: string;
  dados: string;
}

export class LeitorDeSse {
  private resto = "";
  private evento = "";
  private dados: string[] = [];
  private temDados = false;
  private inicio = true;

  /** Entrega um pedaço de texto; devolve os frames que ele completou. */
  empurrar(pedaco: string): FrameSse[] {
    let texto = this.resto + pedaco;
    if (this.inicio && texto.length > 0) {
      // O BOM só vale no começo do stream.
      if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
      this.inicio = false;
    }
    const frames: FrameSse[] = [];
    let comeco = 0;
    for (let i = 0; i < texto.length; i += 1) {
      const c = texto[i];
      if (c !== "\n" && c !== "\r") continue;
      if (c === "\r" && i === texto.length - 1) {
        // Pode ser a metade de um `\r\n`: espera o próximo pedaço para decidir.
        break;
      }
      this.linha(texto.slice(comeco, i), frames);
      if (c === "\r" && texto[i + 1] === "\n") i += 1;
      comeco = i + 1;
    }
    this.resto = texto.slice(comeco);
    return frames;
  }

  /**
   * O stream acabou. Um `\r` pendente era fim de linha; uma linha sem
   * terminador e um frame sem a linha em branco final são despachados — a
   * conexão que caiu depois do último `data:` não pode engolir o pedaço.
   */
  terminar(): FrameSse[] {
    const frames: FrameSse[] = [];
    const resto = this.resto.replace(/\r$/, "");
    this.resto = "";
    if (resto.length > 0) this.linha(resto, frames);
    this.despachar(frames);
    return frames;
  }

  private linha(linha: string, frames: FrameSse[]): void {
    if (linha === "") {
      this.despachar(frames);
      return;
    }
    if (linha.startsWith(":")) return; // comentário (`: ping`)
    const doisPontos = linha.indexOf(":");
    const campo = doisPontos === -1 ? linha : linha.slice(0, doisPontos);
    let valor = doisPontos === -1 ? "" : linha.slice(doisPontos + 1);
    if (valor.startsWith(" ")) valor = valor.slice(1);
    if (campo === "event") this.evento = valor;
    else if (campo === "data") {
      this.dados.push(valor);
      this.temDados = true;
    }
    // `id` e `retry` não têm uso aqui: o turno não se reconecta.
  }

  private despachar(frames: FrameSse[]): void {
    if (this.evento !== "" || this.temDados) {
      frames.push({ evento: this.evento || "message", dados: this.dados.join("\n") });
    }
    this.evento = "";
    this.dados = [];
    this.temDados = false;
  }
}
