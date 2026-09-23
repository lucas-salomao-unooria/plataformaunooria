/**
 * O que o hub lê da exp05ef1b — espelho de `apps/api/src/quem-mandou-isso`.
 *
 * Note o que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum campo de acerto por criança.** Não há `score`, `nivel`, `nota`
 *   nem "quantas falsas ela encaminhou" — a lista está em `PROIBIDO_NO_PAINEL`
 *   (`apps/api/src/quem-mandou-isso/invariantes.ts`), com teste do lado de lá.
 *   Com o gabarito à mão, "quantas mentiras cada um passou adiante" é a coluna
 *   natural de quem chegar depois, e ela é ranking de quem caiu no boato numa
 *   turma de 5º ano. O que existe é o histograma da SALA, por mensagem: lá o
 *   número diz o que a mensagem fez, nunca o que a criança é (PED-07, PED-11).
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle da
 *   experiência; daqui o hub só conduz.
 *
 * `reflexaoTexto` vem preenchido só para quem LECIONA a turma — para gestor e
 * admin a api o devolve em `null`, e a tela cai no vazio sem ramo próprio.
 * É caixa livre de menor de idade, e quem a lê é o
 * professor DA TURMA dela. Nenhuma rota de gestor a alcança (LGPD art. 14).
 *
 * O gabarito (`veracidade`, `tom`, `explicacao`) aparece nos tipos do
 * PROFESSOR — `MensagemDoLote`, `Barra`, `ConteudoDaTurma`,
 * `MaterialDoProfessor` — e em nenhum outro. Ele chega a esta tela porque a
 * professora prepara e conduz com ele; quem o esconde do estudante é a api, por
 * construção do tipo público, não uma decisão desta camada.
 */

/** As três etapas que a professora abre pelo painel. */
export type EtapaDaTurma = "exploracao" | "revelacao" | "reflexao";

/** Onde o estudante está. Espelho de `PASSOS` em `regras/passos.ts`. */
export type PassoDoEstudante =
  | "contexto"
  | "curadoria"
  | "espera"
  | "revelado"
  | "reflexao"
  | "fim";

/** O gabarito de cada mensagem. Só o professor o lê antes da revelação. */
export type Veracidade = "verdadeira" | "falsa" | "ambigua";

/** O foco emocional que a professora escolhe ao gerar o lote. */
export type Gatilho = "urgencia" | "indignacao" | "medo";

/** O formato do balão. Sem mídia binária: áudio é transcrição, imagem é legenda. */
export type TipoDeMensagem = "texto" | "audio" | "imagem" | "link";

/** De onde veio o lote homologado. `padrao` não é falha: é o banco curado. */
export type OrigemDoLote = "ia" | "padrao";

/** Para que lado a turma pendeu — é o que escolhe a frase do card de síntese. */
export type Polaridade = "urgencia-venceu" | "informativas-venceram" | "empate";

/**
 * O `SeletorDeTurma` é compartilhado com a exp02em1b, a exp06ef2b, a exp07ef1b e a
 * exp08ef4b e exige `estudantes`; a api o devolve sempre.
 *
 * `serie` é anulável AQUI e não lá: o contrato da api a declara
 * `z.string().nullable()` (turma sem série cadastrada existe no rostering), e
 * `TurmaResumo` do seletor exige `string`. Quem concilia é a tela, depois de
 * filtrar por série — ver `resultados-quem-mandou-isso.tsx`.
 */
export interface TurmaDoQuemMandou {
  id: string;
  nome: string;
  serie: string | null;
  estudantes: number;
}

/**
 * Uma mensagem COMPLETA, com o gabarito. Só entra e sai por rota de professor:
 * é o que ela edita no preparo e o que ela lê no guia da aula.
 */
export interface MensagemDoLote {
  id: string;
  remetente: string;
  /** "HH:MM" — o histórico recente da manhã, em ordem crescente. */
  hora: string;
  tipo: TipoDeMensagem;
  /** No `audio` é a transcrição; na `imagem`, a legenda; no `link`, a descrição. */
  corpo: string;
  /** Só em `audio`. */
  duracaoSeg?: number;
  /** `imagem`: o rótulo do que a foto mostra. `link`: a manchete. */
  titulo?: string;
  /** Só em `link`: o veículo. */
  fonte?: string;
  /** Só em `link`: a data visível no card — o detalhe que a ambígua esconde. */
  data?: string;
  veracidade: Veracidade;
  /** GABARITO — não aparece na tela dela, mas vai junto no que ela publica. */
  tom: string;
  /** GABARITO — a justificativa sob o selo, na revelação. */
  explicacao: string;
}

/**
 * Uma linha da folha da turma.
 *
 * O que ela mostra é PROGRESSO e CONDUTA: onde está, quantas encaminhou, se
 * leu o grupo inteiro, se abriu o áudio, quanto tempo levou até o primeiro
 * encaminhamento. Nenhum desses números diz "acertou" — o tempo até o primeiro
 * é indicativo de impulsividade, que é matéria de conversa, não de nota.
 */
export interface LinhaDaTurma {
  estudanteId: string;
  nome: string;
  usuario: string;
  iniciou: boolean;
  passo: PassoDoEstudante;
  totalEncaminhadas: number;
  leuTudo: boolean;
  ouviuAudio: boolean;
  abriuLink: boolean;
  /** Segundos entre entrar no grupo e o primeiro encaminhamento. */
  segundosAteOPrimeiroEncaminhamento: number | null;
  confirmou: boolean;
  entregouReflexao: boolean;
  reflexaoTexto: string | null;
  /** Minutos desde a última ação; `null` para quem não começou ou já concluiu. */
  ociosoMin: number | null;
}

/**
 * Uma barra do telão.
 *
 * Nenhum nome chega aqui, e não por disciplina: a barra é por MENSAGEM, e a
 * assinatura da conta (`contaDaTurma`, na api) não tem lugar para quem
 * encaminhou. A anonimização do telão é estrutural.
 */
export interface Barra {
  id: string;
  remetente: string;
  tipo: TipoDeMensagem;
  /** O rótulo curto da barra, calculado pela api a partir do título ou do corpo. */
  resumo: string;
  veracidade: Veracidade;
  explicacao: string;
  /** Quantos estudantes CONFIRMADOS encaminharam. Quem não confirmou não conta. */
  total: number;
  percentual: number;
}

/** A leitura do card de síntese: para que lado a sala pendeu. */
export interface SinteseDaSala {
  emocionais: number;
  informativas: number;
  polaridade: Polaridade;
}

export interface PainelDaTurma {
  turma: {
    id: string;
    nome: string;
    serie: string | null;
    etapa: EtapaDaTurma;
    /** A professora já homologou um lote? Sem isso o estudante vê tela de espera. */
    preparada: boolean;
  };
  estudantes: LinhaDaTurma[];
  resumo: {
    total: number;
    iniciaram: number;
    confirmaram: number;
    /** `confirmaram` sobre `total`, inteiro. É a barra de prontidão. */
    percentualConfirmados: number;
    entregaram: number;
    ociosos: number;
    histograma: Barra[];
    sintese: SinteseDaSala;
  };
}

/**
 * O lote da turma COM o gabarito — professor-only.
 *
 * `usouIa` só existe na resposta de `gerar-lote`: ele é o que faz a tela dizer
 * "estamos usando o lote curado da Unooria" em vez de fingir que a IA
 * respondeu. Fora dali o campo não vem, e a origem gravada é `origem`.
 */
export interface ConteudoDaTurma {
  tema: string;
  gatilho: Gatilho;
  origem: OrigemDoLote;
  mensagens: MensagemDoLote[];
  aprovadoPorProfessor: boolean;
  atualizadoEm: string | null;
  usouIa?: boolean;
}

/**
 * O material do GUIA DA AULA: o banco curado com gabarito e o roteiro do
 * episódio. Sem tenancy — é o catálogo da missão, igual em todo contrato.
 * Se a professora gerou um lote próprio, o que a turma leu está no painel da
 * turma, não aqui.
 */
export interface MaterialDoProfessor {
  tema: string;
  mensagens: MensagemDoLote[];
  paridade: { verdadeira: number; falsa: number; ambigua: number };
  pisoDeEncaminhamentos: number;
  podcast: { titulo: string; blocos: Array<{ rotulo: string; falas: string[] }> };
}

/** O que cada etapa quer dizer na tela da professora. */
export const ROTULO_DA_ETAPA: Record<EtapaDaTurma, string> = {
  exploracao: "Grupo aberto — cada um lendo e escolhendo",
  revelacao: "Telão aceso — o Mural está fechado para todos",
  reflexao: "Reflexão final liberada",
};

/** O que o estudante está vendo agora, em uma linha. */
export const ROTULO_DO_PASSO: Record<PassoDoEstudante, string> = {
  contexto: "Ouvindo o pedido da direção",
  curadoria: "Lendo o grupo e escolhendo",
  espera: "Confirmou e está esperando a turma",
  revelado: "Vendo o Mural com os selos",
  reflexao: "Respondendo sobre o áudio do tio",
  fim: "Concluída",
};

/**
 * O selo de cada mensagem, como ele aparece na revelação.
 *
 * Em CAIXA ALTA porque é assim que ele é projetado no telão, e porque o rótulo
 * fala da MENSAGEM: não existe "você errou" em lugar nenhum desta missão — a
 * criança que encaminhou a falsa não é rotulada por isso (PED-11).
 */
export const ROTULO_DA_VERACIDADE: Record<Veracidade, string> = {
  verdadeira: "VERDADEIRA",
  falsa: "FALSA",
  ambigua: "AMBÍGUA",
};

/** O foco emocional do lote, como a professora o escolhe no preparo. */
export const ROTULO_DO_GATILHO: Record<Gatilho, string> = {
  urgencia: "Urgência — “é agora ou nunca”",
  indignacao: "Indignação — “estão escondendo de você”",
  medo: "Medo — “vai acontecer algo ruim”",
};
