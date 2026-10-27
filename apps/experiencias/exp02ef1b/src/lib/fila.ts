/**
 * A FILA DE ENVIO, em MEMÓRIA (one-pager §8: o envio da publicação "é
 * enfileirado e sincronizado assim que a conexão retornar"). Nunca `localStorage`: a jogada é da sessão autenticada desta aba,
 * e o servidor é quem reconstitui o estado num F5 (o checkpoint).
 *
 * Uma tarefa por CHAVE (a rota): a jogada mais nova substitui a pendente da
 * mesma rota. As rotas do estudante são idempotentes — repetir a jogada já
 * feita devolve o estado atual —, então reenviar é inofensivo.
 *
 * Puro de relógio: quem chama `tentar` é o despachante (num intervalo), e o
 * teste chama à mão.
 */
export class FilaDeEnvio {
  private readonly tarefas = new Map<string, () => Promise<void>>();
  private tentando = false;

  constructor(
    /** A falha é de REDE (sem status)? Só ela fica na fila; as outras saem e são reportadas. */
    private readonly ehDeRede: (erro: unknown) => boolean,
    private readonly aoDescartar: (erro: unknown) => void = () => {},
  ) {}

  enfileirar(chave: string, tarefa: () => Promise<void>) {
    this.tarefas.set(chave, tarefa);
  }

  tem(chave: string): boolean {
    return this.tarefas.has(chave);
  }

  get pendentes(): number {
    return this.tarefas.size;
  }

  /** Tenta cada pendente, na ordem em que entraram. Para no primeiro erro de rede (a conexão ainda não voltou). */
  async tentar(): Promise<void> {
    if (this.tentando) return;
    this.tentando = true;
    try {
      for (const [chave, tarefa] of [...this.tarefas]) {
        try {
          await tarefa();
          if (this.tarefas.get(chave) === tarefa) this.tarefas.delete(chave);
        } catch (erro) {
          if (this.ehDeRede(erro)) return;
          if (this.tarefas.get(chave) === tarefa) this.tarefas.delete(chave);
          this.aoDescartar(erro);
        }
      }
    } finally {
      this.tentando = false;
    }
  }

  limpar() {
    this.tarefas.clear();
  }
}
