/**
 * O contrato de `/quem-mandou-isso/*` como o CLIENTE o vê.
 *
 * Espelha `apps/api/src/quem-mandou-isso/contrato-de-rotas.ts` (`SessaoSchema`,
 * `EstadoSchema`, `GateDoEstudanteSchema`, `RevelacaoSchema`, `CartaoSchema`,
 * `RegraDoEstudanteSchema`) — e só o que a TELA precisa ver. Desde a 0.5.0 a
 * missão não tem pergunta de evidência: as três habilidades são medidas pelo
 * que a criança FAZ (o Mural, o cartão de frases e a regra do tio).
 *
 * **Não existe campo para o gabarito dentro do pacote**, e a ausência é a regra
 * 3 desenhada em TypeScript: `MensagemPublica` não tem `veracidade` nem `tom`
 * porque a api a monta por `Omit`. Acrescentar um opcional aqui "por garantia"
 * seria escrever a suspeita de que eles podem vir — e a próxima pessoa leria
 * isso como permissão. O gabarito aparece UMA vez, dentro de `Revelacao`, e só
 * o das três mensagens do próprio estudante, depois do voto E da revelação
 * aberta pela turma.
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
export const EXP_VERSION = "0.5.0";

// ──────────────────────────────────────────────────────────── vocabulário

/**
 * O passo DERIVADO no servidor (`regras/passos.ts#passoEfetivo`). `grupo` cobre
 * o grupo E o Mural: as duas vistas da mesma seleção — alternar entre elas é do
 * cliente.
 */
export type Passo =
  | "abertura"
  | "grupo"
  | "enquete"
  | "espera"
  | "revelacao"
  | "sintese"
  | "cartao"
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
  /** `null` até o voto E a revelação aberta. O único lugar com gabarito. */
  revelacao: Revelacao | null;
  /** O cartão de frases (EF05CO03) — `null` antes da revelação desta criança. */
  cartao: Cartao | null;
  /** A regra do tio (EF05CO04) — `null` antes do passo `regra`. */
  regra: RegraDoEstudante | null;
}

// ─────────────────────────────────────────── as ações do Canal A

export type Operador = "E" | "OU" | "NAO";
export type Resposta = "sim" | "nao";

/** Uma frase do cartão: SEM a resposta esperada — ela nunca desce. */
export interface FraseDoCartao {
  id: string;
  operador: Operador;
  texto: string;
}

export interface Cartao {
  frases: FraseDoCartao[];
  /** Já enviou? Depois do envio o cartão trava. */
  enviado: boolean;
}

/** As peças: uma condição e uma ou duas ações, em ordem. */
export interface Regra {
  condicao: string;
  acoes: string[];
}

export interface RegraMontada extends Regra {
  /** "Se a mensagem for…, então eu…" — escrita pelo servidor. */
  emPalavras: string;
}

export interface TesteDaRegra extends RegraMontada {
  previsao: string;
  /** O que a regra fez com o áudio, e a frase que a tela mostra. */
  situacao: string;
  resultado: string;
}

export interface RegraDoEstudante {
  testes: TesteDaRegra[];
  podeTestar: boolean;
  enviada: RegraMontada | null;
}

export interface Opcao {
  id: string;
  rotulo: string;
}

export interface Sessao extends Estado {
  /** `null` enquanto o professor não aprovou: a missão NASCE VAZIA. */
  pacote: PacotePublico | null;
  textos: {
    /** `cartao` abre o cartão de frases; `tio` é o desafio da regra. */
    nina: { convite: string | null; encerramento: string; cartao: string; tio: string };
  };
  /** Os rótulos das peças: o tipo de cada uma fica no servidor. */
  opcoes: { motivos: Opcao[]; condicoes: Opcao[]; acoes: Opcao[]; previsoes: Opcao[] };
  limites: { encaminhamentos: number; testes: number };
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
