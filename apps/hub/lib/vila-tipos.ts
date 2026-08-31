/**
 * O que a api do módulo `vila` devolve. Espelho dos tipos de
 * `apps/api/src/vila/vila.service.ts` — separado porque o hub não importa da
 * api (processos diferentes), e explícito porque é contrato entre os dois.
 *
 * A COISA MAIS IMPORTANTE AQUI é `LinhaDeLeitura`: união discriminada em que só
 * a variante `scored` tem `numero: number`. As outras têm `null` POR TIPO. Isso
 * não é estilo — é o que torna impossível uma tela desta pasta imprimir
 * "Poder 100" a partir de um sinal só. O `tsc` recusa antes de a página existir.
 */

export type Bolha = "A" | "B" | "C";

export type Grau = "scored" | "indicative" | "zero" | "none";

interface LinhaBase {
  valor: string;
  nome: string;
  texto: string;
  comportamento: string;
}

export type LinhaDeLeitura =
  | (LinhaBase & { grau: "scored"; numero: number })
  | (LinhaBase & { grau: "indicative" | "zero" | "none"; numero: null });

export interface CartaoRecebido {
  id: string;
  nivel: "comum" | Bolha;
  legitima: boolean;
  emMs: number;
  viuOpcoes: boolean;
  escolha: number | null;
  aceitou: boolean | null;
  decisaoMs: number | null;
}

export interface LeituraMensagens {
  bolha: Bolha;
  golpeAceito: number;
  golpeRecusado: number;
  legitimaAceita: number;
  legitimaRecusada: number;
  nemViu: number;
  deixouPassar: number;
  cartoes: CartaoRecebido[];
  leitura: string;
}

export interface RelatorioDaPartida {
  sessaoId: string;
  abertaEm: string;
  concluidaEm: string | null;
  status: string;
  duracaoSeg: number | null;
  bolha: Bolha;
  cartoesServidos: number;
  resumo: {
    fogueirasAcesas: number;
    pedrasQuebradas: number;
    aldeoesAjudados: number;
    lampioesAcesos: number;
    tochasAcesas: number;
    dilemasVistos: number;
    dilemasResolvidos: number;
    distanciaM: number;
  };
  perfil: {
    versaoMapeamento: number;
    linhas: LinhaDeLeitura[];
    aberturaVsConservacao: number | null;
    transcendenciaVsAutopromocao: number | null;
    amostraSuficiente: boolean;
    frase: string;
  } | null;
  mensagens: LeituraMensagens | null;
}

export interface LinhaDaTurma {
  estudanteId: string;
  nome: string;
  partidas: number;
  ultimaEm: string | null;
  bolha: Bolha | null;
  fogueirasAcesas: number | null;
  amostraSuficiente: boolean | null;
}

export interface ResumoDaTurma {
  estudantes?: number;
  alunos: number;
  jogaram: number;
  concluiram: number;
  abandonaram: number;
  comAmostra: number;
  porBolha: Record<Bolha, number>;
  mensagens: {
    comLeitura: number;
    golpeAceito: number;
    golpeRecusado: number;
    legitimaRecusada: number;
    naoResponderam: number;
  };
}

export interface TurmaResumida {
  id: string;
  nome: string;
  serie: string;
  estudantes?: number;
  alunos: number;
}

/** Um cartão COM gabarito — só a tela do guia recebe isto (`@Roles("professor")`).
 *  É a revelação: as três bolhas lado a lado, marcando quais eram verdadeiras. */
export interface CartaoDoGuia {
  id: string;
  nivel: "comum" | Bolha;
  legitima: boolean;
  tag: string;
  beats: Array<{ name: string; text: string }>;
  opcoes: Array<{ texto: string; aceita: boolean }>;
}

/** O que cada bolha significa, em português de professor. Duplicado do catálogo
 *  da api de propósito: é copy de tela, e a tela não deve depender de um fetch
 *  para explicar o nível que ela está mostrando. */
export const DESCRICAO_BOLHA: Record<Bolha, { titulo: string; texto: string }> = {
  A: {
    titulo: "golpe grosseiro",
    texto:
      "Erro de escrita, link falso, promessa absurda, remetente desconhecido. Chegou num momento tranquilo da partida. É o nível que quase toda criança reconhece — serve de controle.",
  },
  B: {
    titulo: "autoridade e urgência",
    texto:
      "Veio assinado como o suporte do próprio jogo — o mesmo nome que já tinha mandado uma mensagem verdadeira antes —, com português correto e um prazo de dois minutos. Chegou depois da quinta fogueira, quando ela já tinha o que perder.",
  },
  C: {
    titulo: "o colega, e o momento exato",
    texto:
      "Veio de alguém que se apresentou como colega da turma dela e que sabia o número dela. Não pediu senha: pediu um passo pequeno e plausível. E chegou no instante em que ela estava sem fagulha, travada. Não tem nenhum dos sinais que se ensina a procurar.",
  },
};

/** Rótulo curto do que ela fez em cada cartão, para a tabela do relatório. */
export function rotuloDoCartao(c: CartaoRecebido): { texto: string; tom: "ruim" | "bom" | "neutro" } {
  if (c.aceitou === null) {
    return c.viuOpcoes
      ? { texto: "deixou passar", tom: "neutro" }
      : { texto: "nem viu as opções", tom: "neutro" };
  }
  if (!c.legitima) {
    return c.aceitou ? { texto: "entregou", tom: "ruim" } : { texto: "recusou", tom: "bom" };
  }
  return c.aceitou ? { texto: "aceitou a ajuda", tom: "bom" } : { texto: "recusou ajuda real", tom: "ruim" };
}

export function tempoDecisao(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")}s`;
}
