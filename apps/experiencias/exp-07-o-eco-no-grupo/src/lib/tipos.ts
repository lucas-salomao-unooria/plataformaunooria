/**
 * O contrato com `apps/api/src/o-eco-no-grupo` — espelho do que a api devolve.
 *
 * **Note a ausência do gabarito.** As opções chegam só com `id` e `texto`; não
 * há campo dizendo qual é a checada, nem qual desfecho cada uma produz, nem
 * quais estratégias do "Meu percurso" a missão considera prioritárias. Isso não
 * é omissão de digitação: o tipo do servidor é `Omit<...>`, e o bundle é
 * público — um campo a mais aqui seria a resposta da missão legível no DevTools
 * (regra inviolável nº 3).
 */

export const EXP_ID = "exp-07-o-eco-no-grupo";

/**
 * Sobe JUNTO com `package.json#version` e `public/experiencia.json#versao`.
 *
 * Os três precisam bater: o CI lê a versão do manifesto para montar o caminho
 * no bucket, que é imutável, e o `package.json` para decidir se republica.
 * `regras.test.ts` compara os três — a exp-02 e a exp-03 divergiram aqui, cada
 * uma com um comentário dizendo para não divergir.
 */
export const EXP_VERSION = "0.1.4";

// ------------------------------------------------------------------ estado

export type Passo =
  | "chat_amara"
  | "grupo"
  | "breakpoint"
  | "podcast"
  | "intervencao"
  | "desfecho"
  | "sintese"
  | "reflexao"
  | "fim";

export type Etapa = "investigacao" | "aula2" | "debate" | "reflexao";

export type IdDeOpcao = "A" | "B" | "C";

export interface Estado {
  /** Já reconciliado com a etapa da turma — é ELE que decide a tela. */
  passo: Passo;
  /** O passo cru do estudante, antes do gate. */
  passoDoEstudante: Passo;
  /** `true` quando a turma segura o estudante: a tela de espera do breakpoint
   *  é diferente da tela congelada do debate, e é este par que as distingue. */
  aguardandoATurma: boolean;
  inspecionouMateria: boolean;
  ouviuAudio: boolean;
  ouviuPodcast: boolean;
  cardsLidos: number;
  opcao: IdDeOpcao | null;
  /**
   * O que a resposta produziu no bairro. `null` até haver resposta.
   *
   * É por ele que a tela decide o que desenhar, e não por `opcao === "B"`: o
   * bundle é PÚBLICO, e comparar com a letra punha a resposta certa legível no
   * JS para quem abrisse o DevTools antes de responder (regra 3).
   */
  desfecho: "ruido" | "checada" | "conflito" | null;
  desfazerUsado: number;
  concluidoEm: string | null;
  turma: { etapa: Etapa };
}

// ---------------------------------------------------------------- catálogo

export type TipoDeMensagem = "texto" | "audio" | "foto" | "print";

export interface MensagemDoFeed {
  id: string;
  autor: string;
  hora: string;
  tipo: TipoDeMensagem;
  texto: string;
  midia?: string;
  /** Sempre presente em áudio: é o canal principal de acessibilidade, e o
   *  fallback quando a mídia não foi preparada. */
  transcricao?: string;
  duracaoSeg?: number;
  /** O selo nativo de duas setas. */
  encaminhada?: boolean;
  /** Abre o visualizador da matéria íntegra. */
  abreMateria?: boolean;
}

export interface Materia {
  fonte: string;
  manchetePrint: string;
  titulo: string;
  paragrafoExibido: string;
  paragrafoSuprimido: string;
  fotoDoPrint: string;
  fotoDaMateria: string;
}

export interface OpcaoPublica {
  id: IdDeOpcao;
  texto: string;
}

export interface Card {
  id: string;
  titulo: string;
  corpo: string;
}

export interface Escolha {
  id: string;
  texto: string;
}

export interface Catalogo {
  feed: MensagemDoFeed[];
  materia: Materia;
  opcoes: OpcaoPublica[];
  cards: Card[];
  estrategias: Escolha[];
  justificativas: Escolha[];
  amaraCelebra: string;
  amaraCutucao: string;
}

// ---------------------------------------------------------------- respostas

export interface Reacao {
  autor: string;
  texto: string;
  /** A cadência do servidor: 2s → 3s → 2s. Não é o cliente que a inventa. */
  atrasoMs: number;
}

export interface FalaDeAmara {
  papel: "estudante" | "amara";
  texto: string;
}

export interface RespostaSessao extends Estado {
  catalogo: Catalogo;
  /** `id → URL pública`, com `null` no que não foi preparado. */
  midia: { urls: Record<string, string | null> };
  reacoes: Reacao[] | null;
  amara: FalaDeAmara[];
  reflexao: { estrategias: string[]; justificativa: string; devolutiva: string | null } | null;
  estudante: { nome: string; avatar: string };
}

export interface RespostaIntervencao extends Estado {
  desfecho: "ruido" | "checada" | "conflito";
  reacoes: Reacao[];
  /** Só quando o bairro se acalma. */
  amaraCelebra?: string;
}

export interface RespostaReflexao extends Estado {
  score: number;
  devolutiva: string | null;
}

export interface RespostaAmara {
  texto: string;
  turnosRestantes: number;
}

export interface RespostaGate {
  etapa: Etapa;
  passoEfetivo: Passo;
  agora: string;
}

/** Os códigos que a api devolve e que têm frase de tela. */
export type CodigoErro =
  | "aula2-nao-liberada"
  | "debate-congelado"
  | "reflexao-nao-liberada"
  | "sem-inspecao"
  | "podcast-incompleto"
  | "resposta-ja-enviada"
  | "reflexao-ja-enviada"
  | "amara-em-silencio"
  | "sem-turno"
  | "teto-da-sessao"
  | "amara-indisponivel"
  | "payload-invalido"
  | "rede";
