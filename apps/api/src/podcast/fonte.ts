import type { z } from "zod";
import type { AiFalante } from "../ai/provider";
import type { FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "./roteiro";

/**
 * O que uma MISSÃO declara para ter podcast (ADR-150). As rotas, o motor do
 * áudio, a escrita das falas pela IA e a tabela são do módulo `podcast`; a
 * missão só diz QUAL é o roteiro e COMO achar a atividade da turma.
 *
 * A missão registra a fonte na subida (`PodcastService.registrarFonte`, no
 * `onModuleInit`), como registra o contexto das enquetes nas evidências: o
 * módulo `podcast` não importa nenhuma missão, e a dependência vai num sentido
 * só.
 */
export interface FonteDoPodcast {
  /** O código da experiência (ADR-110) — o `:expId` das rotas. */
  expId: string;
  /** "A Seleção — o podcast de recapitulação", no player. */
  titulo: string;
  /** "Lucas e Clara · cerca de 3 min 45 s", abaixo do título. */
  descricao: string;
  /** Quem fala, como o roteiro chama, e o timbre neutro de vendor. */
  falantes: AiFalante[];
  /** O prefixo no bucket, a versão do pedido de voz e a direção de atuação. */
  voz: PedidoDeVoz;
  /** As falas que mudam com o tema, na ordem em que aparecem no roteiro. */
  vagas: readonly VagaDoTema[];
  /** As falas do banco padrão — as do sheet aprovado. */
  falasPadrao: FalasDoTema;
  /** O roteiro inteiro, com as falas do tema no lugar delas. */
  roteiro(falas: FalasDoTema): TrechoDoRoteiro[];

  /**
   * A atividade do podcast: a pedida, ou a em andamento sem pedido. Lança o
   * erro da própria missão (404 para turma alheia ou atividade de outra
   * turma; 403 sem atividade) — é o carregador que a missão já usa para as
   * imagens, com a guarda de turma dentro.
   */
  atividade(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    atividadeId: string | undefined,
  ): Promise<AtividadeDoPodcast>;

  /**
   * A ESCRITA das falas pela IA, na customização da missão. Ausente = a
   * missão escreve as falas no próprio preparo (a A Seleção, no lote).
   */
  escrita?: EscritaDasFalas;
}

export interface AtividadeDoPodcast {
  id: string;
  tema: string;
  /** A atividade é o banco padrão como a Unooria o escreveu? Sem linha na tabela, valem as do sheet. */
  padrao: boolean;
  /** As falas que a missão guarda ela mesma (a A Seleção, na cobertura); ausente = as da tabela. */
  falasProprias?: FalasDoTema;
}

export interface EscritaDasFalas {
  /**
   * O conteúdo da atividade como a tela de customização o tem — o rascunho
   * que ainda não foi gravado. Zod da própria missão: o corpo vem do cliente.
   */
  conteudo: z.ZodType<unknown>;
  /** A guarda de turma, ANTES de gastar token. */
  exigirTurma(escolaId: string, turmaId: string, professorId: string | undefined): Promise<void>;
  /** O conteúdo é o banco padrão, intocado? Então valem as falas do sheet, sem IA. */
  ehPadrao(conteudo: unknown): boolean;
  /**
   * As falas que a MISSÃO já tem para este conteúdo, sem IA — um pacote pronto
   * que não é o banco padrão (a Horta e o Museu da exp02ef1b, ADR-204). `null`
   * = escreva com a IA. Ausente = só o banco padrão tem falas prontas.
   */
  falasProntas?(conteudo: unknown): FalasDoTema | null;
  /**
   * O que a IA lê para escrever as falas: o conteúdo em texto, com o papel de
   * cada peça na missão. O gabarito vai junto: quem lê é o professor, e é ele
   * que diz qual notícia é a antiga (a regra 3 protege o ESTUDANTE).
   */
  material(conteudo: unknown): string;
  /** O público, para a IA: "estudantes de 9 e 10 anos do 4º ano". */
  publico: string;
}
