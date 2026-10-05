import type { EquipeNoPainel } from "./equipe-no-painel";

/**
 * O que o hub lê da exp05ef1b v2.2 (Quem Mandou Isso?) — a leitura, do lado
 * do PROFESSOR, do contrato Zod de
 * `apps/api/src/quem-mandou-isso/contrato-de-rotas.ts`. A api é a fonte; estes
 * tipos só dizem ao `tsc` do hub a forma que ela promete.
 *
 * O que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum tipo do estudante.** O lado dele vive no bundle da experiência;
 *   daqui o hub só prepara e conduz.
 * - **Nenhuma coluna de acerto por criança.** O nível de cada habilidade é da
 *   evidência (E14, `PainelDeHabilidades`), onde o professor também o ajusta.
 * - **Nenhuma lista de motivos.** Os rótulos da enquete chegam da api (`GET /quem-mandou-isso/professor/material`, `opcoes`):
 *   uma segunda lista aqui seria a que ninguém atualiza junto ("rótulo visível
 *   em dois lugares muda nos DOIS", ADR-91).
 *
 * O gabarito (`veracidade`, `tom`) aparece nas mensagens do PACOTE, que só
 * rota de professor devolve: é com ele que a professora cura e conduz. Quem o
 * esconde do estudante é a api, por construção do tipo público.
 *
 * A regra Se/Então saiu da missão (ADR-145): a folha não tem mais texto livre
 * de menor, e as perguntas de múltipla escolha são a reflexão.
 */

/** O eixo da verdade. Independente do tom: é a descoberta da missão (EF05CO03). */
export type Veracidade = "verdadeira" | "falsa";

/** O eixo do tom. */
export type Tom = "emocional" | "neutra";

/** Os quatro quadrantes da matriz 2x2, na ordem da curadoria. */
export type Quadrante = "VE" | "VN" | "FE" | "FN";

/** O formato do balão. Sem mídia binária: a imagem é o comunicado desenhado e o link é a prévia. */
export type TipoDeMensagem = "texto" | "imagem" | "link";

/** De onde veio o pacote. `padrao` não é falha: é o banco curado da Unooria. */
export type Origem = "ia" | "padrao";

/** O relógio da TURMA, que os três botões do painel movem — só para a frente. */
export type Fase = "triagem" | "revelacao" | "explicar" | "reflexao";

/** Os três botões da aula. Espelho de `ACOES_DO_GATE` em `regras/passos.ts` da api. */
export type AcaoDoGate = "liberar_revelacao" | "apresentar_sintese" | "liberar_reflexao";

/**
 * Onde o estudante está — DERIVADO no servidor dos carimbos da sessão e da
 * fase da turma. Espelho de `PASSOS` em `regras/passos.ts` da api.
 */
export type Passo =
  | "abertura"
  | "grupo"
  | "enquete"
  | "espera"
  | "revelacao"
  | "sintese"
  | "perguntas"
  | "concluida";

/** Uma mensagem COMPLETA do pacote — com o gabarito. Só entra e sai por rota de professor. */
export interface MensagemDoPacote {
  /** `msg_1` a `msg_8`: a posição no grupo. */
  id: string;
  remetente: string;
  tipo: TipoDeMensagem;
  /** O texto do balão (até 45 palavras). */
  texto: string;
  /** Só na imagem (o texto do comunicado desenhado) e no link (a manchete da prévia). */
  legenda?: string;
  veracidade: Veracidade;
  tom: Tom;
}

/** O pacote como o professor o vê. `aprovadoEm: null` = rascunho. */
export interface PacoteDoProfessor {
  id: string;
  disciplina: string;
  tema: string;
  assuntos: string[];
  contexto: string | null;
  origem: Origem;
  mensagens: MensagemDoPacote[];
  aprovadoEm: string | null;
  ativo: boolean;
  rodadaAtual: number;
  criadoEm: string;
  atualizadoEm: string;
}

/** O banco curado — "O Mistério do Passeio ao Museu" —, sempre à mão. */
export interface PadraoDoPacote {
  nome: string;
  /** A frase que entra na fala da Nina: "Rolou uma confusão sobre {tema}." */
  tema: string;
  assuntos: string[];
  mensagens: MensagemDoPacote[];
}

export interface DisciplinaDaMissao {
  slug: string;
  rotulo: string;
}

export interface TurmaDaMissao {
  id: string;
  nome: string;
  serie: string | null;
}

/** `GET /quem-mandou-isso/turmas/:turmaId/pacote`. */
export interface PacoteDaTurma {
  turma: TurmaDaMissao;
  /** O pacote aprovado que a turma usa — a ATIVIDADE da evidência (E14). */
  ativo: PacoteDoProfessor | null;
  /** O último rascunho gerado e ainda não aprovado. É gravado: o preparo custou saldo de IA. */
  rascunho: PacoteDoProfessor | null;
  padrao: PadraoDoPacote;
  disciplinas: DisciplinaDaMissao[];
}

/** Por que a geração não usou IA: `sem-saldo` (a frase do 429) ou `indisponivel` (a do 503). */
export type MotivoSemIa = "sem-saldo" | "indisponivel";

/** `POST /quem-mandou-isso/turmas/:turmaId/gerar`. `usouIa: false` = o rascunho é o banco curado. */
export interface RespostaDaGeracao {
  rascunho: PacoteDoProfessor;
  usouIa: boolean;
  motivo: MotivoSemIa | null;
}

/** O recorte da aula (E0-PROF-02) — o corpo do `POST /gerar`. */
export interface RecorteDaAula {
  disciplina: string;
  tema: string;
  assuntos: string[];
  contexto: string | null;
}

/** O corpo do `POST /aprovar`: o recorte e o pacote INTEIRO como a professora o deixou. */
export interface CorpoDaAprovacao extends RecorteDaAula {
  origem: Origem;
  mensagens: MensagemDoPacote[];
}

/** A atividade da evidência: o PACOTE aprovado; a rodada é a reaplicação. */
export interface AtividadeDaMissao {
  pacoteId: string;
  rodada: number;
}

/**
 * `GET :turmaId/pacotes` — as ATIVIDADES da turma (ADR-130): os pacotes
 * APROVADOS, do mais recente ao mais antigo. O rascunho não entra.
 */
export interface PacotesDaTurmaQuemMandou {
  /** O em andamento, ou `null` quando o professor ainda não pôs nenhum no ar. */
  emAndamento: AtividadeDaMissao | null;
  historico: Array<{
    id: string;
    disciplina: string;
    tema: string;
    origem: Origem;
    /** Em andamento na turma? */
    ativo: boolean;
    aprovadoEm: string;
    /** A maior rodada com sessão; 0 = nunca rodou. */
    rodadas: number;
  }>;
}

/** `GET :turmaId/pacotes/:pacoteId` — UMA atividade, em andamento ou pronta. */
export interface PacoteDaAtividadeQuemMandou extends PacoteDoProfessor {
  /** A maior rodada com sessão; 0 = nunca rodou. */
  rodadas: number;
}

/** `POST /quem-mandou-isso/turmas/:turmaId/gate`. */
export interface GateDaTurma {
  turma: TurmaDaMissao;
  fase: Fase;
  atividade: AtividadeDaMissao;
  atualizadoEm: string;
}

/** `POST /quem-mandou-isso/turmas/:turmaId/nova-rodada`. */
export interface RespostaDaNovaRodada {
  atividade: AtividadeDaMissao;
  fase: Fase;
}

/** O progresso — por COMPUTADOR quando a turma tem equipes nesta missão. */
export interface ProgressoDaTurma {
  unidades: number;
  entraram: number;
  confirmaram: number;
  votaram: number;
  concluiram: number;
}

/**
 * O TERMÔMETRO DA TURMA — `null` antes da revelação. Sem nome nenhum: a
 * assinatura da conta, na api, não tem lugar para ele.
 */
export interface TermometroDaTurma {
  /** A base: unidades que CONFIRMARAM o Mural. */
  unidades: number;
  falsaNeutra: { unidades: number; percentual: number };
  verdadeiraEmocionalDescartada: { descartadas: number; total: number; percentual: number };
  /** O cruzamento motivo × "encaminhou falsa neutra", sobre quem votou. */
  motivos: Array<{ motivo: string; unidades: number; comFalsaNeutra: number }>;
}

/** Uma linha da FOLHA NOMINAL — uma por computador quando há equipe. */
export interface LinhaDoPainel {
  estudanteId: string;
  nome: string;
  equipe: EquipeNoPainel | null;
  passo: Passo;
  /** As três do Mural — só depois de confirmado. */
  selecao: string[] | null;
  motivo: string | null;
  tempoFeedSegundos: number | null;
}

/** O roteiro da roda de conversa e as instruções fixas dos botões (D0-5), literais da api. */
export interface RoteiroDaAula {
  perguntas: string[];
  instrucoes: { revelacao: string; reflexao: string };
}

/** `GET /quem-mandou-isso/turmas/:turmaId/painel`. */
export interface PainelDaTurma {
  turma: TurmaDaMissao;
  /** `null` sem pacote aprovado. É o que o `PainelDeHabilidades` (E14) recebe. */
  atividade: (AtividadeDaMissao & { tema: string }) | null;
  fase: Fase | null;
  /** `true` = há equipes nesta missão e os números contam COMPUTADORES. */
  porComputador: boolean;
  progresso: ProgressoDaTurma;
  termometro: TermometroDaTurma | null;
  linhas: LinhaDoPainel[];
  roteiro: RoteiroDaAula;
}

/** Uma opção da enquete de motivo ou do `Se` do construtor, com o rótulo que a criança leu. */
export interface OpcaoDaMissao {
  id: string;
  rotulo: string;
}

export interface OpcoesDaMissao {
  motivos: OpcaoDaMissao[];
}

/**
 * `GET /quem-mandou-isso/professor/material` — o guia da aula: o banco curado
 * COM gabarito, o roteiro e as perguntas de evidência COM o nível de cada
 * alternativa. Sem tenancy: é o catálogo da missão, igual em todo contrato.
 */
export interface MaterialDoProfessor {
  padrao: PadraoDoPacote & { convite: string };
  roteiro: RoteiroDaAula;
  textos: { encerramento: string };
  perguntasDeEvidencia: Array<{
    perguntaId: string;
    habilidade: string;
    fala: string;
    enunciado: string;
    alternativas: Array<{ id: string; texto: string; status: "atingiu" | "em_processo" | "nao_atingiu" }>;
  }>;
  opcoes: OpcoesDaMissao;
}

/** O corpo de um erro de domínio da api: `codigo` estável, a frase e, no 400 do pacote, TODAS as frases. */
export interface ErroDaMissao {
  codigo?: string;
  mensagem?: string;
  erros?: string[];
}

// ─────────────────────────────────────────────────────────────── rótulos

/** Os selos da curadoria (`e0.professor.badge_*`), literais da copy. Só o professor os vê. */
export const ROTULO_DO_QUADRANTE: Readonly<Record<Quadrante, string>> = {
  VE: "Verdadeira Emocional",
  VN: "Verdadeira Neutra",
  FE: "Falsa Emocional",
  FN: "Falsa Neutra",
};

/** O formato, como o professor o lê no card da mensagem. */
export const ROTULO_DO_TIPO: Readonly<Record<TipoDeMensagem, string>> = {
  texto: "texto",
  imagem: "imagem de comunicado",
  link: "link com prévia",
};

/** O que o campo `legenda` é em cada formato — a mesma frase da recusa da api. */
export const ROTULO_DA_LEGENDA: Readonly<Record<Exclude<TipoDeMensagem, "texto">, string>> = {
  imagem: "Texto do comunicado na imagem",
  link: "Manchete da prévia do link",
};

export const ROTULO_DA_ORIGEM: Readonly<Record<Origem, string>> = {
  ia: "gerado com IA e revisado por você",
  padrao: "pacote curado da Unooria",
};

/** Em que ponto a TURMA está, na tela do professor. */
export const ROTULO_DA_FASE: Readonly<Record<Fase, string>> = {
  triagem: "Triagem — a turma lê o grupo e escolhe as 3 mensagens",
  revelacao: "Revelação liberada",
  explicar: "Síntese apresentada",
  reflexao: "Reflexão liberada",
};

/** O que o estudante (ou o computador) está vendo agora, em uma linha. */
export const ROTULO_DO_PASSO: Readonly<Record<Passo, string>> = {
  abertura: "Ainda não entrou no grupo",
  grupo: "No grupo, escolhendo as 3",
  enquete: "Confirmou o Mural; falta votar",
  espera: "Votou e aguarda a revelação",
  revelacao: "Vendo a revelação",
  sintese: "Vendo a síntese",
  perguntas: "Respondendo às perguntas da Nina",
  concluida: "Concluiu",
};

/**
 * Por que a geração não usou IA — `e0.professor.erro_429_*` e `erro_503_desc`,
 * literais da copy. Nos dois casos a api JÁ devolveu o banco curado como
 * rascunho, e a curadoria abaixo mostra isso: não há "Carregar Pacote Padrão"
 * a apertar, então o botão da copy não é desenhado.
 */
export const AVISO_SEM_IA: Readonly<Record<MotivoSemIa, { titulo: string; descricao: string }>> = {
  "sem-saldo": {
    titulo: "Limite de geração com IA atingido",
    descricao:
      "O saldo de IA da sua escola terminou. Você pode carregar o pacote curado oficial imediatamente.",
  },
  indisponivel: {
    titulo: "Serviço de geração instável",
    descricao:
      "Serviço de geração temporariamente instável. Carregando pacote padrão curado para não atrasar a aula.",
  },
};
