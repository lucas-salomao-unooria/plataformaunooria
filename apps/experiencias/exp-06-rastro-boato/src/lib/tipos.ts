/**
 * O contrato de `/rastro-boato/*` como o cliente o vê.
 *
 * Espelha `apps/api/src/rastro-boato/contrato-de-rotas.ts`. **Nada de gabarito
 * aqui**: não existe tipo para o desfecho de cada opção nem para a ordem certa
 * dos blocos, porque esses campos não vêm — e não vir é o que impede a tela de
 * comparar `opcao === "B"` e entregar a resposta no DevTools (regra 3).
 */

export const EXP_ID = "exp-06-rastro-boato";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O CI lê a do manifesto, e a divergência já causou
 * bug — o teste `versao.test.ts` compara os três.
 */
export const EXP_VERSION = "0.1.3";

export type Passo =
  | "contexto"
  | "chats"
  | "decisao"
  | "breakpoint"
  | "resultado"
  | "ciclo"
  | "percurso"
  | "fim";

export type Etapa = "aula1" | "aula2";

export type IdDeOpcao = "A" | "B" | "C";

/** O que a intervenção produziu na rede. Só chega DEPOIS do envio. */
export type Desfecho = "interrompeu" | "amplificou" | "silenciou";

export type IdDeBloco = "gatilho" | "repasse" | "sem-checagem" | "desfecho";

export interface Metadados {
  /** `null` = a mensagem nasceu nesta conversa. NÃO é o mesmo que zero. */
  saltos: number | null;
  autor: string;
  detalhe: string;
  carimbo: string;
}

export interface Mensagem {
  id: string;
  chat: string;
  autor: string;
  hora: string;
  tipo: "texto" | "audio" | "documento";
  texto: string;
  /** Sempre presente no áudio: é acessibilidade, não fallback. */
  transcricao?: string;
  duracaoSeg?: number;
  encaminhada?: boolean;
  anexo?: string;
  metadados: Metadados;
}

export interface Conversa {
  id: string;
  nome: string;
  subtitulo: string;
  naoLidas: number;
  previa: string;
  hora: string;
}

export interface Convocacao {
  id: string;
  chat: string;
  autor: string;
  hora: string;
  duracaoSeg: number;
  texto: string;
  transcricao: string;
  banner: string;
}

/** Sem `desfecho` e sem `reacao` — o servidor manda só isto. */
export interface OpcaoPublica {
  id: IdDeOpcao;
  texto: string;
}

/** Sem posição: a ordem certa mora no servidor. */
export interface Bloco {
  id: IdDeBloco;
  texto: string;
}

/**
 * Um anel da malha, já AGRUPADO pelo servidor.
 *
 * `nos` é o número REAL (o que a legenda escreve por extenso); `desenhar` é
 * quantos círculos pôr no DOM. Desenhar `nos` diretamente é o que trava o
 * Chromebook da escola — 1.200 elementos SVG numa thread só.
 */
export interface Anel {
  nivel: number;
  nos: number;
  desenhar: number;
  aceso: boolean;
}

export interface Topologia {
  desfecho: Desfecho;
  alcance: number;
  nivelDoEstudante: number;
  interrompeu: boolean;
  aneis: Anel[];
  legenda: string;
}

export interface Curvas {
  minutos: number[];
  boato: number[];
  laudo: number[];
  razao: number;
}

export interface Podcast {
  titulo: string;
  blocos: { rotulo: string; falas: string[] }[];
}

export interface Estado {
  /** Já reconciliado com a etapa da turma — USE ESTE, nunca o cru. */
  passo: Passo;
  /** O passo cru do estudante. Divergente = a turma o está segurando. */
  passoDoEstudante: Passo;
  aguardandoATurma: boolean;
  auditadas: string[];
  totalAuditadas: number;
  cotaAtingida: boolean;
  faltamAuditar: number;
  opcao: IdDeOpcao | null;
  desfecho: Desfecho | null;
  reacao: string | null;
  topologia: Topologia | null;
  ordemBlocos: string[];
  coerente: boolean | null;
  entregouPercurso: boolean;
  concluidoEm: string | null;
  turma: { etapa: Etapa };
}

export interface Catalogo {
  conversas: Conversa[];
  mensagens: Mensagem[];
  convocacao: Convocacao;
  opcoes: OpcaoPublica[];
  blocos: Bloco[];
  auditoriasExigidas: number;
  perguntaDoPercurso: string;
  tetoDaReflexao: number;
  podcast: Podcast;
  curvas: Curvas;
}

export interface RespostaSessao extends Estado {
  catalogo: Catalogo;
  reflexao: { texto: string } | null;
  estudante: { nome: string };
}

export interface RespostaAuditoria extends Estado {
  /** `false` = releitura do mesmo balão. Não é erro. */
  novo: boolean;
}

export interface RespostaDecisao extends Estado {
  reacao: string;
}

export interface RespostaGate {
  etapa: Etapa;
  passoEfetivo: Passo;
  agora: string;
}

/** Os códigos que a tela distingue. O resto cai em `rede`. */
export type CodigoErro =
  | "aula2-nao-liberada"
  | "auditoria-insuficiente"
  | "decisao-ja-registrada"
  | "payload-invalido"
  | "rede";
