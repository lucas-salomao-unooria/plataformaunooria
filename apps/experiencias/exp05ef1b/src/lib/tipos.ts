/**
 * O contrato de `/quem-mandou-isso/*` como o CLIENTE o vê.
 *
 * Espelha `apps/api/src/quem-mandou-isso/contrato-de-rotas.ts` (`SessaoSchema`,
 * `EstadoSchema`, `GateDoEstudanteSchema`, `RevelacaoSchema`, `AlertaSchema`,
 * `RoboDoEstudanteSchema`) — e só o que a TELA precisa ver. Desde a 0.5.0 a
 * missão não tem pergunta de evidência: as três habilidades são medidas pelo
 * que a criança FAZ — na 0.6.0, o Mural, o alerta do grupo e o robô do grupo.
 *
 * **Não existe campo para o gabarito dentro do pacote**, e a ausência é a regra
 * 3 desenhada em TypeScript: `MensagemPublica` não tem `veracidade` nem `tom`
 * porque a api a monta por `Omit`. Acrescentar um opcional aqui "por garantia"
 * seria escrever a suspeita de que eles podem vir — e a próxima pessoa leria
 * isso como permissão. O gabarito aparece depois do voto E da revelação aberta
 * pela turma, em dois lugares: `Revelacao` (as três do estudante) e o quadro do
 * `Alerta` (as oito, decisão de produto). A expressão esperada de cada pedido e
 * o tipo de cada ação do robô NUNCA descem.
 *
 * Os ids de mensagem são `string`, e não a união `msg_1 … msg_8` do catálogo: o
 * cliente nunca CONSTRÓI um id, ele devolve o que veio no pacote. Uma segunda
 * cópia da lista aqui seria a que ninguém atualiza.
 */

export const EXP_ID = "exp05ef1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O CI lê a do manifesto para montar o caminho
 * IMUTÁVEL no bucket; `src/versao.test.ts` compara os três (ADR-84).
 */
export const EXP_VERSION = "0.6.6";

// ──────────────────────────────────────────────────────────── vocabulário

/**
 * O passo DERIVADO no servidor (`regras/passos.ts#passoEfetivo`). `grupo` cobre
 * o grupo E o Mural: as duas vistas da mesma seleção — alternar entre elas é do
 * cliente. `regra` é o robô do grupo (o nome ficou da 0.5.0); o alerta não é
 * passo, é uma janela da revelação.
 */
export type Passo =
  | "abertura"
  | "grupo"
  | "enquete"
  | "espera"
  | "revelacao"
  | "sintese"
  | "regra"
  | "concluida";

/** O relógio da TURMA, que o professor move pelos três botões do painel. */
export type Fase = "triagem" | "revelacao" | "explicar" | "reflexao";

export type TipoDeMensagem = "texto" | "imagem" | "link";

/** Só existem DENTRO de `Revelacao`. Ver a nota do topo. */
export type Veracidade = "verdadeira" | "falsa";
export type Tom = "emocional" | "neutra";

// ─────────────────────────────────────────────────────────────── o pacote

/** Uma mensagem como o estudante a recebe. Sem gabarito, por construção. */
export interface MensagemPublica {
  id: string;
  remetente: string;
  tipo: TipoDeMensagem;
  /** O texto do balão. */
  texto: string;
  /**
   * Só na `imagem` (o texto do comunicado DESENHADO) e no `link` (a manchete da
   * prévia, no formato "Nome do site: manchete").
   */
  legenda?: string;
}

export interface PacotePublico {
  /** O tema que a Nina cita. A fala dela já chega pronta em `textos.nina.convite`. */
  tema: string;
  grupo: { nome: string; participantes: number };
  mural: { nome: string };
  mensagens: MensagemPublica[];
}

// ───────────────────────────────────────────────────────────── revelação

export interface Revelacao {
  /** Só as TRÊS que o estudante encaminhou, com os dois eixos. */
  mensagens: { id: string; veracidade: Veracidade; tom: Tom }[];
  motivo: string;
  /** O callback do bimestre para o motivo declarado, já escrito pelo servidor. */
  callback: string;
  /** As duas barras da turma (por computador quando há equipe), sem nome nenhum. */
  turma: { unidades: number; falsaNeutra: number; verdadeiraEmocionalDescartada: number };
}

// ──────────────────────────────────────────────────────────────── estado

export interface Atividade {
  /** O id do PACOTE aprovado — é a atividade da evidência (E14). */
  pacoteId: string;
  rodada: number;
}

/** O que TODA rota de ação devolve. Sem o pacote: ele só vem na `sessao`. */
export interface Estado {
  passo: Passo;
  /** `null` sem pacote aprovado. */
  fase: Fase | null;
  /** O professor já aprovou um pacote? Sem isso, a tela é de espera. */
  preparada: boolean;
  atividade: Atividade | null;
  /** A seleção guardada (0 a 3). É o que um F5 restaura. */
  selecao: string[];
  confirmado: boolean;
  motivo: string | null;
  concluido: boolean;
  /** `null` até o voto E a revelação aberta. */
  revelacao: Revelacao | null;
  /** O alerta do grupo (EF05CO03) — `null` antes da revelação desta criança. */
  alerta: Alerta | null;
  /** O robô do grupo (EF05CO04) — `null` antes do passo `regra` (a reflexão). */
  robo: RoboDoEstudante | null;
}

// ─────────────────────────────────────────── as ações do Canal A

/** Os dois chips do filtro. Sem "verdadeira" nem "neutra": elas são o NÃO deles. */
export type Atributo = "falsa" | "emocional";
export type Conector = "E" | "OU";

/** Uma condição do filtro: o chip e o interruptor NÃO antes dele. */
export interface CondicaoDoFiltro {
  attr: Atributo;
  nao: boolean;
}

/** Uma condição sozinha, ou duas ligadas por um conector (`op` e `b` juntos). */
export interface Expressao {
  a: CondicaoDoFiltro;
  op?: Conector;
  b?: CondicaoDoFiltro;
}

/** Um filtro executado pelo servidor: a expressão e quem passou, na ordem do grupo. */
export interface Execucao {
  expressao: Expressao;
  passam: string[];
}

export interface MensagemDoQuadro {
  id: string;
  /** "Mensagem de {remetente}" — escrito pelo servidor. */
  rotulo: string;
  veracidade: Veracidade;
  tom: Tom;
  voceEnviou: boolean;
}

export interface Alerta {
  quadro: MensagemDoQuadro[];
  /** O número e o texto de cada pedido. A expressão esperada fica no servidor. */
  pedidos: { n: number; texto: string }[];
  /** Um por pedido já aberto, em ordem. */
  andamento: { pedido: number; execucoes: Execucao[]; enviado: Execucao | null }[];
  /** Aceita jogada? Fecha na síntese. */
  aberto: boolean;
}

/** O robô montado: o laço (ou não), a condição e uma ou duas ações, em ordem. */
export interface Robo {
  laco: boolean;
  condicao: string;
  acoes: string[];
}

export interface RoboMontado extends Robo {
  /** "Para cada mensagem nova, se a mensagem for…" — escrito pelo servidor. */
  emPalavras: string;
}

export interface MensagemDoRobo {
  id: string;
  remetente: string;
  texto: string;
  tipo: "audio" | "texto";
  /** Os sinais da mensagem, ABERTOS: ids de condição. */
  atributos: string[];
}

/** O que o robô fez com uma mensagem — o servidor executa; a tela anima. */
export interface ResultadoDaMensagem {
  mensagemId: string;
  situacao: string;
  texto: string;
}

export interface Ligacao extends RoboMontado {
  resultados: ResultadoDaMensagem[];
  resumo: string;
}

export interface RoboDoEstudante {
  mensagens: MensagemDoRobo[];
  ligacoes: Ligacao[];
  podeLigar: boolean;
  enviado: RoboMontado | null;
}

export interface Opcao {
  id: string;
  rotulo: string;
}

/** Um bloco do robô: id, rótulo curto e o ícone (emoji provisório do Figma). */
export interface Bloco extends Opcao {
  icone: string;
}

export interface Sessao extends Estado {
  /** `null` enquanto o professor não aprovou: a missão NASCE VAZIA. */
  pacote: PacotePublico | null;
  textos: {
    /** `tio` é o desafio que abre o robô. */
    nina: { convite: string | null; encerramento: string; tio: string };
  };
  /** Os blocos do robô: o TIPO de cada ação fica no servidor. */
  opcoes: { motivos: Opcao[]; laco: { rotulo: string; icone: string }; condicoes: Bloco[]; acoes: Bloco[] };
  limites: { encaminhamentos: number; execucoes: number; ligacoes: number };
}

export interface Gate {
  fase: Fase | null;
  passo: Passo;
  preparada: boolean;
  atividade: Atividade | null;
  /** O instante do SERVIDOR: o relógio da máquina da escola atrasa. */
  agora: string;
}

// ───────────────────────────────────────────────────────────────── erros

/**
 * As classes de falha que a TELA distingue — não os `codigo` da api.
 *
 * O SDK joga `Error` com "API POST /x → 409" **sem o corpo**, então a
 * classificação é pelo STATUS. Quem sabe o que um 400 ou um 409 quis dizer é a
 * tela, que conhece a ação que fez: um 409 em qualquer ação é o relógio da turma (ou outra aba) na frente — e a resposta é reler a sessão.
 */
export type ClasseDeFalha =
  | "rede"
  | "sessao-expirada"
  | "nao-liberada"
  | "conflito"
  | "recusada"
  | "inesperada";
