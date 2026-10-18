import type { NewsMedium } from "@edu/ui/ds";

/**
 * O que o hub lê da exp04ef1b (Jornal da Escola: A Edição de Bento) — espelho
 * do Zod de `apps/api/src/jornal-escola/contrato-de-rotas.ts`, que é a fonte da
 * verdade, e dos valores fechados de `vocabulario.ts`, `regras/passos.ts` e
 * `invariantes.ts` do mesmo módulo.
 *
 * O espelho é DECLARADO, e `jornal-escola-tipos.test.ts` lê os arquivos da api
 * como texto e compara lista por lista: uma segunda lista de valores é a que
 * ninguém atualiza junto, e o hub não importa a api.
 *
 * Note o que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum nível, nota, acerto nem "verificadas" por criança.** A linha do
 *   painel é só progresso (`PROIBIDO_NA_LINHA_DO_PAINEL`, na api). Quantas
 *   notícias verificadas cada computador teve mora SÓ no histograma anônimo do
 *   resumo; o nível das habilidades mora no painel de habilidades
 *   (`lib/evidencias.ts`), com a origem e o ajuste do professor.
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle da
 *   experiência; daqui o hub só prepara e conduz.
 *
 * O GABARITO de cada notícia (`gabarito`, `consequencia`) aparece em
 * `NoticiaDoPacote`, que só rota de professor devolve. Quem o esconde do
 * estudante é a api, pela allowlist da notícia pública — não esta camada.
 *
 * As funções daqui são PURAS: o painel ao vivo e a criação da atividade são
 * client components e importam deste arquivo, e o `vitest` do hub só varre
 * `lib/`.
 */

// ─────────────────────────────────────────────────────────────── o vocabulário

/** Os ids são a POSIÇÃO na mesa, e não dizem nada do gabarito. */
export const IDS_DE_NOTICIA = ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"] as const;
export type IdDeNoticia = (typeof IDS_DE_NOTICIA)[number];

export const TOTAL_DE_NOTICIAS = 8;
export const TAMANHO_DA_EDICAO = 3;

/** Os oito meios: cada notícia do pacote vem de um diferente. */
export const MEIOS = ["jornal", "radio", "tv", "blog", "portal", "rede_social", "mensagem", "mural"] as const;
export type Meio = (typeof MEIOS)[number];

export const MEIOS_TRADICIONAIS: readonly Meio[] = ["jornal", "radio", "tv", "mural"];
export const MEIOS_DIGITAIS: readonly Meio[] = ["blog", "portal", "rede_social", "mensagem"];

/** As três pistas de checagem — e os três pilares da Chave do Editor. */
export const TIPOS_DE_PISTA = ["fonte", "data", "autoria"] as const;
export type TipoDePista = (typeof TIPOS_DE_PISTA)[number];

/** Os seis blocos da Chave: os três pilares e as três iscas. */
export const IDS_DE_BLOCO = ["fonte", "data", "autoria", "foto", "urgencia", "compartilhada"] as const;
export type IdDeBloco = (typeof IDS_DE_BLOCO)[number];

/** As três ARMADILHAS da Chave — os blocos que parecem critério e não são. */
export const BLOCOS_ISCA = ["foto", "urgencia", "compartilhada"] as const;
export type BlocoIsca = (typeof BLOCOS_ISCA)[number];

/** O lado de um cartão de condição na Chave: o que faz a pista passar, ou falhar. */
export const LADOS_DA_CONDICAO = ["aprova", "reprova"] as const;
export type LadoDaCondicao = (typeof LADOS_DA_CONDICAO)[number];

/**
 * As duas matérias da SIMULAÇÃO (3.0.0): inéditas, sem imagem, uma que pode ir
 * para a capa e uma com UMA pista em falta. Ids próprios, fora da mesa.
 */
export const IDS_DE_SIMULACAO = ["s1", "s2"] as const;
export type IdDeSimulacao = (typeof IDS_DE_SIMULACAO)[number];

/** As duas respostas da pergunta de motivo, feita DEPOIS da 1ª publicação. */
export const MOTIVOS = ["visual", "checagem"] as const;
export type Motivo = (typeof MOTIVOS)[number];

export const ORIGENS_DO_PACOTE = ["padrao", "ia"] as const;
export type OrigemDoPacote = (typeof ORIGENS_DO_PACOTE)[number];

/** As etapas da TURMA, na ordem em que o botão único as abre. */
export const ETAPAS = ["exploracao", "resultado", "revisao"] as const;
export type EtapaDaTurma = (typeof ETAPAS)[number];

/** Onde o estudante está — o passo EFETIVO, já reconciliado com a etapa. */
export const PASSOS = [
  "desafio",
  "mesa",
  "motivo",
  "publicada",
  "resultado",
  "chave",
  "revisao",
  "comparativo",
  "simulacao",
  "transferencia",
  "fim",
] as const;
export type PassoDoEstudante = (typeof PASSOS)[number];

/**
 * O meio da api no vocabulário do DS (`NewsMedium`), para o hub mostrar o
 * MESMO rótulo e o mesmo glifo que o cartão da mesa mostra à criança
 * (`NEWS_MEDIUM_LABELS`/`NEWS_MEDIUM_ICONS`). `Record` exaustivo: meio novo sem
 * tradução é erro de compilação, não um cartão sem rótulo.
 */
export const MEIO_NO_DS: Record<Meio, NewsMedium> = {
  jornal: "newspaper",
  radio: "radio",
  tv: "tv",
  blog: "blog",
  portal: "portal",
  rede_social: "social",
  mensagem: "message",
  mural: "bulletin",
};

// ────────────────────────────────────────────────────────────────── a notícia

/**
 * Uma notícia COMPLETA, com o gabarito e a consequência — o que o professor
 * lê, edita e aprova. Só entra e sai por rota de professor.
 */
export interface NoticiaDoPacote {
  id: IdDeNoticia;
  meio: Meio;
  /** O nome do veículo como a criança o lê: "Gazeta do Bairro", "@fofocas_da_vila". */
  veiculo: string;
  /** O locutor do rádio ou da TV; quem mandou a mensagem; `null` quando não há. */
  falante: string | null;
  manchete: string;
  resumo: string;
  /** A matéria no formato original, como a gaveta a abre. */
  corpo: string;
  /** A legenda da foto ou do quadro de TV; `null` sem imagem. */
  legenda: string | null;
  /** O que a imagem mostra — o pedido da geração E o texto alternativo. `null` = sem imagem. */
  descricaoImagem: string | null;
  pistas: Record<TipoDePista, string>;
  gabarito: {
    publicavel: boolean;
    /** `null` na publicável; exatamente um na que não vai para a capa. */
    pilarEmFalta: TipoDePista | null;
    /** Para o PROFESSOR: por que esta notícia vai ou não vai para a capa. */
    explicacao: string;
  };
  /** A reação do leitor quando a notícia circula — uma por notícia. */
  consequencia: { leitor: string; fala: string };
}

/**
 * Uma matéria da SIMULAÇÃO (3.0.0), COMPLETA — com o gabarito. A criança aplica
 * a Chave do Editor dela a esta matéria; ela não vai para capa nenhuma, não tem
 * imagem, corpo nem reação do leitor. Só rota de professor a devolve inteira.
 */
export interface MateriaDaSimulacao {
  id: IdDeSimulacao;
  meio: Meio;
  veiculo: string;
  falante: string | null;
  manchete: string;
  resumo: string;
  pistas: Record<TipoDePista, string>;
  gabarito: NoticiaDoPacote["gabarito"];
}

/** Um cartão de condição de um bloco da Chave, com o lado CERTO — `null` nas armadilhas. Só o professor o recebe. */
export interface CartaoDaChave {
  texto: string;
  exemplo: string;
  lado: LadoDaCondicao | null;
}

// ─────────────────────────────────────────────────────── as rotas do professor

/** `GET /jornal-escola/turmas`. `serie` é anulável no contrato (rostering sem série). */
export interface TurmaDoJornal {
  id: string;
  nome: string;
  serie: string | null;
  estudantes: number;
}

/**
 * Quantas notícias pedem imagem, quantas já têm e quantas o professor aprovou
 * (ADR-147). A atividade só vai ao ar com `aprovadas === total`.
 */
export interface ResumoDaMidia {
  total: number;
  prontas: number;
  aprovadas: number;
}

export interface PacoteResumo {
  id: string;
  disciplina: string;
  tema: string;
  origem: OrigemDoPacote;
}

/**
 * Uma linha do painel — um COMPUTADOR quando a turma montou equipes, uma
 * criança quando não (`resumo.porComputador`). **Só progresso.**
 */
export interface LinhaDoPainel {
  estudanteId: string;
  nome: string;
  usuario: string;
  /** Como ESTA api a devolve: sem os membros (a tela os cruza com as equipes da missão). */
  equipe: { id: string; nome: string } | null;
  /** Abriu a missão nesta rodada (tem sessão). Diferente de `iniciou`. */
  entrou: boolean;
  /** `true` depois da 1ª publicação — é o critério do colapso por computador. */
  iniciou: boolean;
  passo: PassoDoEstudante;
  pistasAbertas: number;
  publicouAPrimeira: boolean;
  chaveFormada: boolean;
  publicouASegunda: boolean;
  /** Aplicou a Chave nas duas matérias novas (3.0.0). */
  simulou: boolean;
  concluiu: boolean;
}

/** Uma notícia no radar: quantos computadores a puseram em cada edição. É do OBJETO, não de quem escolheu. */
export interface NoticiaNoRadar {
  noticiaId: IdDeNoticia;
  manchete: string;
  meio: Meio;
  publicavel: boolean;
  pilarEmFalta: TipoDePista | null;
  naEdicao1: number;
  naEdicao2: number;
}

/** `GET /jornal-escola/turmas/:turmaId/painel`. */
export interface PainelDoJornal {
  turma: { id: string; nome: string; serie: string | null };
  pacote: PacoteResumo & { midia: ResumoDaMidia };
  rodada: number;
  etapa: EtapaDaTurma;
  /** O rótulo do botão único: a próxima etapa, ou `null` depois da revisão. */
  proximaEtapa: EtapaDaTurma | null;
  linhas: LinhaDoPainel[];
  resumo: {
    total: number;
    iniciaram: number;
    publicaramAPrimeira: number;
    formaramAChave: number;
    publicaramASegunda: number;
    concluiram: number;
    /** "X de Y computadores publicaram". Y sai da montagem das equipes quando há. */
    computadores: { publicaram: number; total: number };
    porComputador: boolean;
    /** [com 0, com 1, com 2, com 3 verificadas] — por computador, sem nome. */
    histograma: { edicao1: number[]; edicao2: number[] };
    /** O motivo agregado da 1ª edição (a pergunta depois do latch). Não avalia: é roteiro da conversa. */
    motivos: Record<Motivo, number>;
    /**
     * A Chave da turma, AGREGADA (3.0.0) — o roteiro da conversa, nunca o nível
     * de alguém: quantos montaram, quantos puseram cada armadilha, quantos
     * escolheram "Olho a próxima pista" em alguma vaga e quantos "Só na
     * primeira notícia".
     */
    chave: { montaram: number; iscas: Record<BlocoIsca, number>; seguir: number; soNaPrimeira: number };
    /** A mensagem nova, AGREGADA: quantos decidiram, quantos repassaram sem abrir pista nenhuma, quantos não repassaram. */
    transferencia: { decidiram: number; repassaramSemAbrir: number; naoRepassaram: number };
    radar: NoticiaNoRadar[];
  };
}

/** `POST /jornal-escola/turmas/:turmaId/gate`. */
export interface GateDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  pacoteId: string;
  rodada: number;
  etapa: EtapaDaTurma;
  proximaEtapa: EtapaDaTurma | null;
  atualizadoEm: string;
}

/** `POST /jornal-escola/turmas/:turmaId/zerar`. */
export interface TurmaZerada {
  pacoteId: string;
  rodada: number;
  etapa: EtapaDaTurma;
}

/** O pacote como as telas do professor o mostram, com o gabarito. */
export interface PacoteComGabarito extends PacoteResumo {
  topicos: string | null;
  noticias: NoticiaDoPacote[];
  /** As duas matérias da simulação — as do banco padrão nos pacotes anteriores à 3.0.0. */
  simulacao: MateriaDaSimulacao[];
  midia: ResumoDaMidia;
  /** As URLs já geradas, por id de notícia. */
  imagens: Record<string, string>;
  /** As notícias cuja imagem ATUAL o professor aprovou (ADR-147). Só estas chegam à turma. */
  aprovadas: IdDeNoticia[];
}

/** `GET /jornal-escola/turmas/:turmaId/pacotes`. */
export interface PacotesDaTurma {
  /**
   * A atividade EM ANDAMENTO, COM o gabarito — ou `null` quando o professor
   * ainda não pôs nenhuma no ar: a plataforma não cria atividade (ADR-130).
   */
  ativo: (PacoteComGabarito & { rodada: number; etapa: EtapaDaTurma }) | null;
  /** Todos os pacotes da turma, o ativo incluso — é o `?pacote=` do painel de habilidades. */
  historico: Array<
    PacoteResumo & {
      ativo: boolean;
      criadoEm: string;
      /** A maior rodada com sessão; 0 = nunca rodou. */
      rodadas: number;
      /** Todas as imagens geradas e aprovadas (ADR-147)? Sem isso, a atividade não vai ao ar. */
      imagensAprovadas: boolean;
    }
  >;
}

/** O corpo de `POST gerar-conteudo` (`ParametrosDoPreparoSchema`). `topicos` é OPCIONAL, não anulável. */
export interface ParametrosDoPreparo {
  disciplina: string;
  tema: string;
  topicos?: string;
}

/** `POST gerar-conteudo` — RASCUNHO, não persiste. `usouIa: false` = é o banco padrão. */
export interface RascunhoDoPacote {
  disciplina: string;
  tema: string;
  topicos: string | null;
  origem: OrigemDoPacote;
  usouIa: boolean;
  noticias: NoticiaDoPacote[];
  /** As duas matérias da simulação (3.0.0), escritas junto das oito. */
  simulacao: MateriaDaSimulacao[];
}

/** `POST regenerar-noticia`. */
export interface NoticiaRegenerada {
  noticia: NoticiaDoPacote;
  usouIa: boolean;
}

/**
 * `POST homologar` — a atividade criada, PRONTA (ADR-130). `ativo` só é
 * `true` no segundo clique sobre um pacote que já estava no ar.
 */
export interface PacoteHomologado extends PacoteResumo {
  ativo: boolean;
  noticias: NoticiaDoPacote[];
}

/** `GET :turmaId/pacotes/:pacoteId` — UMA atividade, em andamento ou pronta. */
export interface PacoteDaAtividade extends PacoteComGabarito {
  /** Em andamento na turma? */
  ativo: boolean;
  /** A rodada e a etapa do gate, só quando em andamento. */
  rodada: number | null;
  etapa: EtapaDaTurma | null;
  criadoEm: string;
  /** A maior rodada com sessão; 0 = nunca rodou. */
  rodadas: number;
}

/** `POST gerar-midia` — o progresso de UMA chamada (até duas imagens novas). */
export interface ProgressoDaMidia {
  pacoteId: string;
  total: number;
  prontas: number;
  faltam: number;
  /** As notícias cuja imagem saiu NESTA chamada. */
  geradas: IdDeNoticia[];
  /** As que falharam NESTA chamada — seguem com o cartão desenhado pelo meio. */
  falharam: IdDeNoticia[];
  completo: boolean;
  imagens: Record<string, string>;
}

/** `POST :turmaId/pacotes/:pacoteId/aprovar-imagens` (ADR-147). */
export interface ImagensAprovadas {
  pacoteId: string;
  aprovadas: IdDeNoticia[];
  /** As que estavam na tela com URL que já não é a do pacote (outra aba gerou outra): não entraram. */
  desatualizadas: IdDeNoticia[];
  midia: ResumoDaMidia;
  prontaParaAula: boolean;
}

/** `POST :turmaId/pacotes/:pacoteId/imagens/:noticiaId/regerar` — o "Gerar outra" (ADR-147). */
export interface ImagemRegerada {
  pacoteId: string;
  noticiaId: IdDeNoticia;
  url: string;
}

/**
 * `GET /jornal-escola/professor/material` — o BANCO PADRÃO com gabarito (as
 * oito notícias e as duas matérias da simulação), a Chave com os pilares
 * marcados e o lado certo de cada cartão, e o roteiro da mediação (copy
 * revisada, §4b). É o "Usar o banco pronto da Unooria" da criação da
 * atividade, o roteiro do painel e o bloco vivo do guia.
 */
export interface MaterialDoJornal {
  disciplina: string;
  tema: string;
  noticias: NoticiaDoPacote[];
  simulacao: MateriaDaSimulacao[];
  blocos: Array<{ id: IdDeBloco; rotulo: string; legenda: string; pilar: boolean; cartoes: CartaoDaChave[] }>;
  roteiro: { gatilhoDoResultado: string; perguntas: string[]; gatilhoDaRevisao: string };
}

/** O corpo de erro da api: `{codigo, mensagem}`, e `erros[]` no `pacote-invalido`. */
export interface ErroDoJornal {
  codigo?: string;
  mensagem?: string;
  erros?: string[];
}

/** O erro de uma resposta, com a frase de reserva quando a api não mandou nenhuma. */
export function erroDaResposta(corpo: unknown, padrao: string): { codigo: string | null; mensagem: string; erros: string[] } {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as ErroDoJornal;
  return {
    codigo: typeof c.codigo === "string" ? c.codigo : null,
    mensagem: typeof c.mensagem === "string" && c.mensagem.trim() ? c.mensagem : padrao,
    erros: Array.isArray(c.erros) ? c.erros.filter((e): e is string => typeof e === "string") : [],
  };
}

// ───────────────────────────────────────────────────────────── os rótulos

/** O que cada etapa quer dizer na tela do professor. */
export const ROTULO_DA_ETAPA: Record<EtapaDaTurma, string> = {
  exploracao: "Exploração — cada computador monta e publica a 1ª edição",
  resultado: "Resultado liberado — as reações dos leitores e a conversa com a turma",
  revisao: "Revisão liberada — a Chave do Editor, a 2ª edição, o teste da Chave e a mensagem nova",
};

/**
 * O rótulo do botão único, pela etapa de DESTINO. A suíte e2e casa por texto
 * exato: mudar aqui é mudar lá.
 */
export const ROTULO_DO_BOTAO: Record<Exclude<EtapaDaTurma, "exploracao">, string> = {
  resultado: "Liberar resultado",
  revisao: "Liberar revisão",
};

/** O rótulo do botão para a próxima etapa, ou `null` quando não há próxima. */
export function rotuloDoBotao(proxima: EtapaDaTurma | null): string | null {
  if (proxima === null || proxima === "exploracao") return null;
  return ROTULO_DO_BOTAO[proxima];
}

/** O que o estudante está vendo agora, em uma linha. */
export const ROTULO_DO_PASSO: Record<PassoDoEstudante, string> = {
  desafio: "No começo, com o Bento",
  mesa: "Na mesa, escolhendo as notícias",
  motivo: "Publicou — dizendo por que escolheu",
  publicada: "Publicou — esperando o resultado",
  resultado: "Lendo as reações dos leitores",
  chave: "Montando a Chave do Editor",
  revisao: "Revisando a 1ª edição",
  comparativo: "Comparando as duas edições",
  simulacao: "Testando a Chave em duas matérias novas",
  transferencia: "Decidindo sobre a mensagem nova",
  fim: "Concluiu",
};

export const ROTULO_DA_ORIGEM: Record<OrigemDoPacote, string> = {
  padrao: "banco padrão da Unooria",
  /* "aprovado", sem "por você": quem aprovou pode ter sido a coordenação. */
  ia: "gerado com IA e aprovado",
};

/**
 * As duas respostas da pergunta de motivo (3.0.0) — a frase que a criança
 * tocou depois da 1ª publicação, e o professor precisa lê-la igual para
 * conduzir a conversa. A pergunta NÃO avalia: nenhum marcador da ficha a lê.
 */
export const ROTULO_DO_MOTIVO: Record<Motivo, string> = {
  visual: "Escolhi porque chamou atenção",
  checagem: "Escolhi porque conferi as pistas",
};

/**
 * O nome de cada armadilha da Chave, como a bandeja o mostra — espelho dos
 * rótulos de `BLOCOS_DA_CHAVE` em `apps/api/src/jornal-escola/catalogo.ts` (o
 * teste compara). Mora aqui porque o painel da aula os mostra sem ler o
 * material.
 */
export const ROTULO_DA_ISCA: Record<BlocoIsca, string> = {
  foto: "Foto",
  urgencia: "Urgência",
  compartilhada: "Compartilhada",
};

export const ROTULO_DA_PISTA: Record<TipoDePista, string> = {
  fonte: "Fonte",
  data: "Data",
  autoria: "Autoria",
};

/**
 * O gabarito em linguagem de professor. Sem "falsa" nem "mentira" (PDF §3): a
 * notícia antiga pode ser verdadeira, e a mensagem sem autor não é
 * automaticamente falsa — o que falta é EVIDÊNCIA para publicar.
 */
export type EscolhaDoGabarito = "publicavel" | TipoDePista;

export const ROTULO_DO_GABARITO: Record<EscolhaDoGabarito, string> = {
  publicavel: "Pode ir para a capa",
  data: "Não vai para a capa: fato antigo apresentado como de hoje",
  fonte: "Não vai para a capa: aviso sem confirmação de quem tem como saber",
  autoria: "Não vai para a capa: ninguém assina nem se responsabiliza",
};

/** A versão curta, para a etiqueta. */
export const ETIQUETA_DO_GABARITO: Record<EscolhaDoGabarito, string> = {
  publicavel: "Pode ir para a capa",
  data: "Não: fato antigo",
  fonte: "Não: sem confirmação",
  autoria: "Não: sem assinatura",
};

export function escolhaDoGabarito(g: NoticiaDoPacote["gabarito"]): EscolhaDoGabarito {
  return g.publicavel || g.pilarEmFalta === null ? "publicavel" : g.pilarEmFalta;
}

/** A escolha do professor vira o par (publicável, pilar) — e o par nunca fica incoerente. */
export function gabaritoDaEscolha(escolha: EscolhaDoGabarito): Pick<NoticiaDoPacote["gabarito"], "publicavel" | "pilarEmFalta"> {
  return escolha === "publicavel" ? { publicavel: true, pilarEmFalta: null } : { publicavel: false, pilarEmFalta: escolha };
}

// ────────────────────────────────────────────────────── as leituras do painel

/** Inteiro de 0 a 100. Todo vazio: 0, nunca `NaN`. */
export function percentual(parte: number, todo: number): number {
  if (todo <= 0) return 0;
  return Math.round((parte / todo) * 100);
}

/** "computador"/"computadores" ou "estudante"/"estudantes": com equipes, o sujeito é a máquina. */
export function sujeito(porComputador: boolean, n: number): string {
  if (porComputador) return n === 1 ? "computador" : "computadores";
  return n === 1 ? "estudante" : "estudantes";
}

/**
 * O "X de Y computadores publicaram". Chamar de "estudantes" o que é uma
 * máquina com duas crianças diante dela faria o professor esperar gente que já
 * publicou.
 */
export function textoDoEnvio(computadores: PainelDoJornal["resumo"]["computadores"], porComputador: boolean): string {
  const verbo = computadores.publicaram === 1 && computadores.total === 1 ? "publicou" : "publicaram";
  return `${computadores.publicaram} de ${computadores.total} ${sujeito(porComputador, computadores.total)} ${verbo} a 1ª edição.`;
}

/**
 * O `e4.prof.termometro` da copy revisada, com o sujeito certo no lugar de
 * "duplas": o painel conta computadores quando há equipes, e crianças quando não.
 */
export function textoDoTermometro(computadores: PainelDoJornal["resumo"]["computadores"], porComputador: boolean): string {
  return `Jornais publicados pela turma: ${computadores.publicaram}/${computadores.total} ${sujeito(porComputador, computadores.total)} (${percentual(computadores.publicaram, computadores.total)}%)`;
}

/**
 * A aula ainda CORRE? É o que decide se o painel continua consultando. Para
 * quando a turma inteira concluiu com a revisão aberta — antes disso sempre há
 * algo a acompanhar (a publicação atrasada, a Chave, a 2ª edição).
 */
export function aulaEmAndamento(p: Pick<PainelDoJornal, "etapa" | "resumo">): boolean {
  return !(p.etapa === "revisao" && p.resumo.total > 0 && p.resumo.concluiram >= p.resumo.total);
}

/** Quantas linhas do painel já aplicaram a Chave nas duas matérias novas. */
export function quantosSimularam(linhas: readonly Pick<LinhaDoPainel, "simulou">[]): number {
  return linhas.filter((l) => l.simulou).length;
}

/**
 * Mudou algo que a EVIDÊNCIA registra (ADR-146)? Os cinco marcadores da ficha
 * v2 (3.0.0, só AÇÃO) são gravados na MESMA transação da jogada que o painel
 * conta: os julgamentos das pistas (EF15CO04) no latch da 1ª edição, a Chave
 * montada (EF15CO02, parcial) quando ela se forma, a 2ª edição (EF04CO08,
 * parcial) no latch dela, a simulação (EF15CO02, final) quando a criança a
 * envia e a mensagem nova (EF04CO08, final) quando ela decide. A simulação não
 * tem contador no resumo: conta pelas linhas (`simulou`). A atividade troca com
 * um pacote novo ou uma rodada nova. Só nesses casos o painel da aula relê a
 * página inteira, para o painel de habilidades acompanhar sem o professor
 * apertar F5. É o mesmo desenho da exp05ef1b (`mudouAEvidencia` em
 * `quem-mandou-regras.ts`).
 */
export function mudouAEvidencia(
  antes: Pick<PainelDoJornal, "pacote" | "rodada" | "resumo" | "linhas">,
  depois: Pick<PainelDoJornal, "pacote" | "rodada" | "resumo" | "linhas">,
): boolean {
  return (
    antes.resumo.publicaramAPrimeira !== depois.resumo.publicaramAPrimeira ||
    antes.resumo.formaramAChave !== depois.resumo.formaramAChave ||
    antes.resumo.chave.montaram !== depois.resumo.chave.montaram ||
    antes.resumo.publicaramASegunda !== depois.resumo.publicaramASegunda ||
    quantosSimularam(antes.linhas) !== quantosSimularam(depois.linhas) ||
    antes.resumo.transferencia.decidiram !== depois.resumo.transferencia.decidiram ||
    antes.resumo.concluiram !== depois.resumo.concluiram ||
    antes.pacote.id !== depois.pacote.id ||
    antes.rodada !== depois.rodada
  );
}

/**
 * As armadilhas da Chave, da MAIS escolhida para a menos — o roteiro da
 * conversa ("a Foto entrou em 5 Chaves: por que ela parece um bom critério?").
 * Empate fica na ordem da bandeja canônica. Armadilha que ninguém pôs não
 * entra: a lista vazia diz que a turma não caiu em nenhuma.
 */
export function iscasMaisEscolhidas(iscas: Record<BlocoIsca, number>): Array<{ isca: BlocoIsca; vezes: number }> {
  return BLOCOS_ISCA.map((isca) => ({ isca, vezes: iscas[isca] ?? 0 }))
    .filter((i) => i.vezes > 0)
    .sort((a, b) => b.vezes - a.vezes);
}

/** "Foto: 5 computadores · Urgência: 2 computadores" — ou `null` quando nenhuma Chave tem armadilha. */
export function textoDasIscas(iscas: Record<BlocoIsca, number>, porComputador: boolean): string | null {
  const lista = iscasMaisEscolhidas(iscas);
  if (lista.length === 0) return null;
  return lista.map((i) => `${ROTULO_DA_ISCA[i.isca]}: ${i.vezes} ${sujeito(porComputador, i.vezes)}`).join(" · ");
}

/** Os rótulos das quatro faixas do histograma. Curtos: o eixo do `BarChart` do DS corta acima de ~8 caracteres. */
export const FAIXAS_DO_HISTOGRAMA = ["0 de 3", "1 de 3", "2 de 3", "3 de 3"] as const;

/** Quantos publicaram a edição que o histograma descreve. */
export function totalDoHistograma(h: readonly number[]): number {
  return h.reduce((soma, n) => soma + n, 0);
}

/**
 * O histograma em percentual de quem publicou AQUELA edição — o eixo do
 * `BarChart` do DS é fixo em 0–100, e contagens de 0 a 15 sumiriam nele.
 */
export function histogramaEmPercentual(h: readonly number[]): number[] {
  const total = totalDoHistograma(h);
  return FAIXAS_DO_HISTOGRAMA.map((_, i) => percentual(h[i] ?? 0, total));
}

/** "0 de 3 verificadas: 2 computadores · 1 de 3: 4 computadores…" — as contagens exatas, sem nome. */
export function textoDoHistograma(h: readonly number[], porComputador: boolean): string | null {
  if (totalDoHistograma(h) === 0) return null;
  return FAIXAS_DO_HISTOGRAMA.map((faixa, i) => {
    const n = h[i] ?? 0;
    return `${faixa}: ${n} ${sujeito(porComputador, n)}`;
  }).join(" · ");
}

/**
 * O destaque do radar — a versão CALCULADA do "68% das duplas publicaram a
 * notícia de 2018" do PRD, que era ilustração: a notícia que NÃO podia ir para
 * a capa e mais foi, na 1ª edição. Empate fica com a primeira da mesa (a ordem
 * que a turma vê). Nada é destacado enquanto ninguém publicou, ou quando
 * nenhuma notícia sem evidência chegou a uma capa.
 */
export function destaqueDoRadar(
  radar: readonly NoticiaNoRadar[],
  publicaram: number,
): (NoticiaNoRadar & { percentual: number }) | null {
  if (publicaram <= 0) return null;
  let destaque: NoticiaNoRadar | null = null;
  for (const n of radar) {
    if (n.publicavel || n.naEdicao1 <= 0) continue;
    if (!destaque || n.naEdicao1 > destaque.naEdicao1) destaque = n;
  }
  return destaque ? { ...destaque, percentual: percentual(destaque.naEdicao1, publicaram) } : null;
}

/** A frase do destaque, no lugar de `e4.prof.radar_erros`. */
export function textoDoDestaque(d: NonNullable<ReturnType<typeof destaqueDoRadar>>, porComputador: boolean): string {
  const quem = porComputador ? "dos computadores" : "dos estudantes";
  const motivo = d.pilarEmFalta ? ROTULO_DO_GABARITO[d.pilarEmFalta].replace("Não vai para a capa: ", "") : "";
  return `${d.percentual}% ${quem} que publicaram puseram na capa “${d.manchete}”${motivo ? ` — ${motivo}` : ""}.`;
}

/**
 * Alfabética pelo que a primeira célula MOSTRA — o nome da equipe, quando há
 * —, com número como número ("Equipe 2" antes de "Equipe 10"). Nunca por
 * progresso ou pistas: listagem ordenável vira ranking.
 */
export function ordenarLinhas(linhas: readonly LinhaDoPainel[]): LinhaDoPainel[] {
  const rotulo = (l: LinhaDoPainel) => l.equipe?.nome ?? l.nome;
  return [...linhas].sort((a, b) => rotulo(a).localeCompare(rotulo(b), "pt-BR", { sensitivity: "base", numeric: true }));
}

/** "nunca rodou" / "1 rodada" / "3 rodadas" — o histórico de pacotes. */
export function textoDasRodadas(n: number): string {
  if (n <= 0) return "nunca rodou";
  return n === 1 ? "1 rodada" : `${n} rodadas`;
}

// ────────────────────────────────────────────────────────────── o preparo

/**
 * As réguas de PALAVRAS de `apps/api/src/jornal-escola/invariantes.ts`,
 * repetidas de propósito (o teste compara): quem RECUSA é a api
 * (`pacote-invalido`, com a frase). O que mora aqui é o APONTAMENTO — qual
 * campo de qual notícia, enquanto o professor digita —, que só a tela sabe onde
 * desenhar. É a lição do preparo da v1 da exp05ef1b: um 400 sobre oito notícias
 * sem dizer qual faz o professor reler todas com a turma esperando.
 */
export const REGUAS_DE_PALAVRAS = {
  manchete: { min: 3, max: 10 },
  resumo: { min: 25, max: 35 },
  corpo: { min: 15, max: 80 },
  legenda: { min: 2, max: 20 },
  pista: { min: 2, max: 25 },
  fala: { min: 5, max: 25 },
  explicacao: { min: 5, max: 35 },
} as const;

/** Os tetos de CARACTERE do `NoticiaDoPacoteSchema` (depois do `trim`, em `.length`). */
export const CARACTERES = {
  veiculo: { min: 2, max: 60 },
  falante: { min: 2, max: 60 },
  manchete: { min: 5, max: 120 },
  resumo: { min: 20, max: 320 },
  corpo: { min: 20, max: 700 },
  legenda: { min: 2, max: 160 },
  descricaoImagem: { min: 5, max: 240 },
  pista: { min: 2, max: 200 },
  explicacao: { min: 5, max: 280 },
  leitor: { min: 2, max: 60 },
  fala: { min: 5, max: 220 },
} as const;

/** Os tetos de `ParametrosDoPreparoSchema`. */
export const PARAMETROS = {
  disciplina: { min: 2, max: 60 },
  tema: { min: 5, max: 60 },
  topicosMax: 600,
} as const;

/** Quantas de cada tipo o conjunto precisa (PDF §3). Espelho de `COMPOSICAO`. */
export const COMPOSICAO = {
  publicaveisMin: 3,
  antigas: { min: 2, max: 3 },
  semConfirmacao: { min: 2, max: 3 },
  comImagemMin: 4,
} as const;

/** Os meios que não existem sem imagem: o quadro de telejornal e o post. */
export const MEIOS_COM_IMAGEM_OBRIGATORIA: readonly Meio[] = ["tv", "rede_social"];

/**
 * Os termos que não aparecem em NADA que a criança lê — espelho de
 * `TERMOS_PROIBIDOS_NA_TELA`. Estão aqui para o campo acusar enquanto o
 * professor digita; a palavra final é da api, na homologação.
 */
export const TERMOS_PROIBIDOS_NA_TELA = [
  "fake news",
  "notícia falsa",
  "falsa",
  "falso",
  "mentira",
  "mentiroso",
  "mentirosa",
  "você errou",
  "errou",
  "errado",
  "errada",
  "aluno",
  "alunos",
  "gabarito",
  "sua nota",
  "pontuação",
  "ranking",
] as const;

export function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function normalizarParaRegua(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const REGUAS_DE_TERMOS = TERMOS_PROIBIDOS_NA_TELA.map((termo) => {
  const alvo = normalizarParaRegua(termo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { termo, re: new RegExp(`(^|[^a-z0-9])${alvo}($|[^a-z0-9])`) };
});

/** Os termos proibidos num texto visível ao estudante, por palavra inteira, sem caixa e sem acento. */
export function termosProibidosEm(texto: string): string[] {
  const alvo = normalizarParaRegua(texto);
  return REGUAS_DE_TERMOS.filter((r) => r.re.test(alvo)).map((r) => r.termo);
}

/** Os campos editáveis de uma notícia — a chave com que a tela aponta o problema. */
export type CampoDaNoticia =
  | "veiculo"
  | "falante"
  | "manchete"
  | "resumo"
  | "corpo"
  | "legenda"
  | "descricaoImagem"
  | "fonte"
  | "data"
  | "autoria"
  | "explicacao"
  | "leitor"
  | "fala";

function conferirTexto(
  texto: string,
  caracteres: { readonly min: number; readonly max: number },
  regua?: { readonly min: number; readonly max: number },
): string | null {
  const limpo = texto.trim();
  if (limpo.length === 0) return "Não pode ficar vazio.";
  if (limpo.length > caracteres.max) return `Encurte para até ${caracteres.max} caracteres.`;
  if (limpo.length < caracteres.min) return `Escreva pelo menos ${caracteres.min} caracteres.`;
  if (regua) {
    const n = palavras(limpo);
    if (n < regua.min) return `Tem ${n} ${n === 1 ? "palavra" : "palavras"}; o mínimo é ${regua.min}.`;
    if (n > regua.max) return `Tem ${n} palavras; o máximo é ${regua.max}.`;
  }
  return null;
}

/** O problema de um campo que PODE ficar vazio (vazio = `null` no envio). */
function conferirOpcional(
  texto: string | null,
  caracteres: { readonly min: number; readonly max: number },
  regua?: { readonly min: number; readonly max: number },
): string | null {
  if (texto === null || texto.trim() === "") return null;
  return conferirTexto(texto, caracteres, regua);
}

function comTermos(problema: string | null, texto: string | null): string | null {
  if (problema || !texto) return problema;
  const termos = termosProibidosEm(texto);
  return termos.length > 0 ? `Tire “${termos.join("”, “")}”: a criança lê este texto.` : null;
}

/**
 * O que impede cada campo de UMA notícia de ir para a turma, na frase do campo.
 * Espelho de `problemasDaNoticia` da api, campo a campo; a api confere de novo
 * na homologação e é a palavra final.
 */
export function problemasPorCampo(n: NoticiaDoPacote): Partial<Record<CampoDaNoticia, string>> {
  const p: Partial<Record<CampoDaNoticia, string>> = {};
  const r = REGUAS_DE_PALAVRAS;
  const c = CARACTERES;
  const registrar = (campo: CampoDaNoticia, problema: string | null) => {
    if (problema) p[campo] = problema;
  };

  let veiculo = comTermos(conferirTexto(n.veiculo, c.veiculo), n.veiculo);
  if (!veiculo && n.meio === "rede_social" && !n.veiculo.trim().startsWith("@")) {
    veiculo = "O post precisa de um perfil com @ no lugar do veículo.";
  }
  registrar("veiculo", veiculo);

  let falante = comTermos(conferirOpcional(n.falante, c.falante), n.falante);
  if (!falante && n.meio === "radio" && !n.falante?.trim()) falante = "O boletim de rádio precisa do nome do locutor.";
  registrar("falante", falante);

  registrar("manchete", comTermos(conferirTexto(n.manchete, c.manchete, r.manchete), n.manchete));
  registrar("resumo", comTermos(conferirTexto(n.resumo, c.resumo, r.resumo), n.resumo));
  registrar("corpo", comTermos(conferirTexto(n.corpo, c.corpo, r.corpo), n.corpo));
  registrar("legenda", comTermos(conferirOpcional(n.legenda, c.legenda, r.legenda), n.legenda));

  let imagem = conferirOpcional(n.descricaoImagem, c.descricaoImagem);
  if (!imagem && MEIOS_COM_IMAGEM_OBRIGATORIA.includes(n.meio) && !n.descricaoImagem?.trim()) {
    imagem = n.meio === "tv" ? "O quadro de telejornal precisa de imagem." : "O post precisa de imagem.";
  }
  registrar("descricaoImagem", imagem);

  for (const tipo of TIPOS_DE_PISTA) {
    registrar(tipo, comTermos(conferirTexto(n.pistas[tipo], c.pista, r.pista), n.pistas[tipo]));
  }
  /* A explicação é do PROFESSOR: nenhuma criança a lê, e por isso a régua de termos não passa nela. */
  registrar("explicacao", conferirTexto(n.gabarito.explicacao, c.explicacao, r.explicacao));
  registrar("leitor", comTermos(conferirTexto(n.consequencia.leitor, c.leitor), n.consequencia.leitor));
  registrar("fala", comTermos(conferirTexto(n.consequencia.fala, c.fala, r.fala), n.consequencia.fala));
  return p;
}

/** Quantas notícias de cada tipo o pacote na tela tem. */
export function composicaoDoPacote(noticias: readonly NoticiaDoPacote[]): {
  publicaveis: number;
  antigas: number;
  semConfirmacao: number;
  comImagem: number;
} {
  const naoPublicaveis = noticias.filter((n) => !n.gabarito.publicavel);
  return {
    publicaveis: noticias.length - naoPublicaveis.length,
    antigas: naoPublicaveis.filter((n) => n.gabarito.pilarEmFalta === "data").length,
    semConfirmacao: naoPublicaveis.filter((n) => n.gabarito.pilarEmFalta !== "data").length,
    comImagem: noticias.filter((n) => n.descricaoImagem?.trim()).length,
  };
}

/** "4 podem ir para a capa · 2 fatos antigos · 2 sem confirmação ou sem assinatura · 5 com imagem". */
export function textoDaComposicao(noticias: readonly NoticiaDoPacote[]): string {
  const c = composicaoDoPacote(noticias);
  return [
    `${c.publicaveis} ${c.publicaveis === 1 ? "pode" : "podem"} ir para a capa`,
    `${c.antigas} ${c.antigas === 1 ? "fato antigo" : "fatos antigos"}`,
    `${c.semConfirmacao} sem confirmação ou sem assinatura`,
    `${c.comImagem} com imagem`,
  ].join(" · ");
}

/**
 * Os problemas do PACOTE inteiro — o que nenhuma notícia sozinha tem. Espelho
 * da metade de conjunto de `problemasDoPacote` da api (PDF §3): um conjunto que
 * EXIGE investigar. Mexer no gabarito de uma notícia pode quebrá-lo, e a tela
 * diz isso antes do clique.
 */
export function problemasDaComposicao(noticias: readonly NoticiaDoPacote[]): string[] {
  const p: string[] = [];
  if (noticias.length !== TOTAL_DE_NOTICIAS) return [`O pacote tem ${noticias.length} notícias; a mesa precisa de ${TOTAL_DE_NOTICIAS}.`];
  if (new Set(noticias.map((n) => n.meio)).size !== MEIOS.length) {
    p.push("Cada notícia precisa vir de um meio diferente, e os oito meios precisam aparecer.");
  }
  if (new Set(noticias.map((n) => normalizarParaRegua(n.manchete))).size !== noticias.length) {
    p.push("Duas notícias têm a mesma manchete.");
  }
  const c = composicaoDoPacote(noticias);
  const k = COMPOSICAO;
  if (c.publicaveis < k.publicaveisMin) p.push(`O pacote precisa de pelo menos ${k.publicaveisMin} notícias que possam ir para a capa (tem ${c.publicaveis}).`);
  if (c.antigas < k.antigas.min || c.antigas > k.antigas.max) {
    p.push(`O pacote precisa de ${k.antigas.min} a ${k.antigas.max} fatos antigos apresentados como de hoje (tem ${c.antigas}).`);
  }
  if (c.semConfirmacao < k.semConfirmacao.min || c.semConfirmacao > k.semConfirmacao.max) {
    p.push(`O pacote precisa de ${k.semConfirmacao.min} a ${k.semConfirmacao.max} avisos sem confirmação ou sem assinatura (tem ${c.semConfirmacao}).`);
  }
  const publicaveis = noticias.filter((n) => n.gabarito.publicavel);
  const naoPublicaveis = noticias.filter((n) => !n.gabarito.publicavel);
  const misturaMeios = (grupo: readonly NoticiaDoPacote[]) =>
    grupo.some((n) => MEIOS_TRADICIONAIS.includes(n.meio)) && grupo.some((n) => MEIOS_DIGITAIS.includes(n.meio));
  if (!misturaMeios(publicaveis) || !misturaMeios(naoPublicaveis)) {
    p.push("As que vão e as que não vão para a capa precisam misturar meios tradicionais e digitais: nenhum meio pode carregar a resposta sozinho.");
  }
  if (c.comImagem < k.comImagemMin) p.push(`Pelo menos ${k.comImagemMin} notícias precisam de imagem (tem ${c.comImagem}).`);
  const temImagem = (n: NoticiaDoPacote) => Boolean(n.descricaoImagem?.trim());
  if (!publicaveis.some(temImagem) || !naoPublicaveis.some(temImagem)) {
    p.push("As que vão e as que não vão para a capa precisam ter imagem: notícia bonita não pode ser sinal de nada.");
  }
  return p;
}

/**
 * Os problemas que a api devolveu no `pacote-invalido`, separados por notícia
 * e por matéria da simulação. A frase da api começa por "Notícia n3, …" ou
 * "Notícia n3: …" quando é de uma notícia (`problemasDaNoticia`), e por "A
 * matéria s1 da simulação…" quando é de uma matéria
 * (`problemasDaMateriaDaSimulacao`); o resto é do conjunto.
 */
export function distribuirErros(erros: readonly string[]): {
  porNoticia: Partial<Record<IdDeNoticia, string[]>>;
  porMateria: Partial<Record<IdDeSimulacao, string[]>>;
  geral: string[];
} {
  const porNoticia: Partial<Record<IdDeNoticia, string[]>> = {};
  const porMateria: Partial<Record<IdDeSimulacao, string[]>> = {};
  const geral: string[] = [];
  for (const erro of erros) {
    const id = /^Notícia (n[1-8])\b/.exec(erro)?.[1] as IdDeNoticia | undefined;
    const materia = /^A matéria (s[12]) da simulação/.exec(erro)?.[1] as IdDeSimulacao | undefined;
    if (id) (porNoticia[id] ??= []).push(erro);
    else if (materia) (porMateria[materia] ??= []).push(erro);
    else geral.push(erro);
  }
  return { porNoticia, porMateria, geral };
}

/** O que falta nos parâmetros do preparo personalizado, por campo. */
export function problemasDosParametros(p: { disciplina: string; tema: string; topicos: string }): Partial<
  Record<"disciplina" | "tema" | "topicos", string>
> {
  const erros: Partial<Record<"disciplina" | "tema" | "topicos", string>> = {};
  const disciplina = p.disciplina.trim().length;
  const tema = p.tema.trim().length;
  if (disciplina < PARAMETROS.disciplina.min || disciplina > PARAMETROS.disciplina.max) {
    erros.disciplina = `Escreva o componente curricular (de ${PARAMETROS.disciplina.min} a ${PARAMETROS.disciplina.max} caracteres).`;
  }
  if (tema < PARAMETROS.tema.min || tema > PARAMETROS.tema.max) {
    erros.tema = `Escreva de ${PARAMETROS.tema.min} a ${PARAMETROS.tema.max} caracteres.`;
  }
  if (p.topicos.trim().length > PARAMETROS.topicosMax) erros.topicos = `Encurte para até ${PARAMETROS.topicosMax} caracteres.`;
  return erros;
}

/** O corpo de `gerar-conteudo`: sem espaço nas pontas, e `topicos` AUSENTE quando vazio (o Zod não aceita `null`). */
export function corpoDosParametros(p: { disciplina: string; tema: string; topicos: string }): ParametrosDoPreparo {
  const topicos = p.topicos.trim();
  return { disciplina: p.disciplina.trim(), tema: p.tema.trim(), ...(topicos ? { topicos } : {}) };
}

function limparOpcional(texto: string | null): string | null {
  const limpo = texto?.trim() ?? "";
  return limpo === "" ? null : limpo;
}

/**
 * A notícia como ela VIAJA: sem espaço nas pontas, e os três campos anuláveis
 * (`falante`, `legenda`, `descricaoImagem`) vazios viram `null`. As chaves na
 * ordem do contrato.
 */
export function normalizarNoticia(n: NoticiaDoPacote): NoticiaDoPacote {
  return {
    id: n.id,
    meio: n.meio,
    veiculo: n.veiculo.trim(),
    falante: limparOpcional(n.falante),
    manchete: n.manchete.trim(),
    resumo: n.resumo.trim(),
    corpo: n.corpo.trim(),
    legenda: limparOpcional(n.legenda),
    descricaoImagem: limparOpcional(n.descricaoImagem),
    pistas: { fonte: n.pistas.fonte.trim(), data: n.pistas.data.trim(), autoria: n.pistas.autoria.trim() },
    gabarito: {
      publicavel: n.gabarito.publicavel,
      pilarEmFalta: n.gabarito.publicavel ? null : n.gabarito.pilarEmFalta,
      explicacao: n.gabarito.explicacao.trim(),
    },
    consequencia: { leitor: n.consequencia.leitor.trim(), fala: n.consequencia.fala.trim() },
  };
}

// ──────────────────────────────────────────────────── a simulação (3.0.0)

/**
 * Os meios que uma matéria da simulação pode ter: os que existem SEM imagem e
 * sem locutor — espelho de `MEIOS_DA_SIMULACAO` em `invariantes.ts` da api.
 */
export const MEIOS_DA_SIMULACAO: readonly Meio[] = ["jornal", "blog", "portal", "mural"];

/** Os campos editáveis de uma matéria da simulação — a chave com que a tela aponta o problema. */
export type CampoDaMateria = "meio" | "veiculo" | "falante" | "manchete" | "resumo" | TipoDePista | "explicacao";

/**
 * O que impede cada campo de UMA matéria da simulação de ir para a turma.
 * Espelho de `problemasDaMateriaDaSimulacao` da api, campo a campo: as mesmas
 * réguas de palavras da mesa, os tetos de caractere do
 * `MateriaDaSimulacaoSchema` (os mesmos da notícia) e os termos proibidos no
 * que a criança lê. A explicação é do professor: sem régua de termos.
 */
export function problemasDaMateria(m: MateriaDaSimulacao): Partial<Record<CampoDaMateria, string>> {
  const p: Partial<Record<CampoDaMateria, string>> = {};
  const r = REGUAS_DE_PALAVRAS;
  const c = CARACTERES;
  const registrar = (campo: CampoDaMateria, problema: string | null) => {
    if (problema) p[campo] = problema;
  };
  if (!MEIOS_DA_SIMULACAO.includes(m.meio)) registrar("meio", "A matéria da simulação é de jornal, blog, portal ou mural: não tem imagem nem locutor.");
  registrar("veiculo", comTermos(conferirTexto(m.veiculo, c.veiculo), m.veiculo));
  registrar("falante", conferirOpcional(m.falante, c.falante));
  registrar("manchete", comTermos(conferirTexto(m.manchete, c.manchete, r.manchete), m.manchete));
  registrar("resumo", comTermos(conferirTexto(m.resumo, c.resumo, r.resumo), m.resumo));
  for (const tipo of TIPOS_DE_PISTA) {
    registrar(tipo, comTermos(conferirTexto(m.pistas[tipo], c.pista, r.pista), m.pistas[tipo]));
  }
  registrar("explicacao", conferirTexto(m.gabarito.explicacao, c.explicacao, r.explicacao));
  return p;
}

/**
 * Os problemas das DUAS matérias juntas — espelho da metade de conjunto de
 * `problemasDaSimulacao` da api: uma que pode ir para a capa e uma com furo,
 * de meios diferentes. Mexer no gabarito de uma pode quebrar o par, e a tela
 * diz isso antes do clique.
 */
export function problemasDoParDaSimulacao(ms: readonly MateriaDaSimulacao[]): string[] {
  if (ms.length !== IDS_DE_SIMULACAO.length) return [`A simulação tem ${ms.length} matérias; precisa de ${IDS_DE_SIMULACAO.length}.`];
  const p: string[] = [];
  if (ms.filter((m) => m.gabarito.publicavel).length !== 1) {
    p.push("Das duas matérias da simulação, uma precisa poder ir para a capa e a outra não.");
  }
  if (new Set(ms.map((m) => m.meio)).size !== ms.length) p.push("As duas matérias da simulação precisam ser de meios diferentes.");
  return p;
}

/** A matéria como ela VIAJA na homologação: sem espaço nas pontas, `falante` vazio = `null`, as chaves na ordem do contrato. */
export function normalizarMateria(m: MateriaDaSimulacao): MateriaDaSimulacao {
  return {
    id: m.id,
    meio: m.meio,
    veiculo: m.veiculo.trim(),
    falante: limparOpcional(m.falante),
    manchete: m.manchete.trim(),
    resumo: m.resumo.trim(),
    pistas: { fonte: m.pistas.fonte.trim(), data: m.pistas.data.trim(), autoria: m.pistas.autoria.trim() },
    gabarito: {
      publicavel: m.gabarito.publicavel,
      pilarEmFalta: m.gabarito.publicavel ? null : m.gabarito.pilarEmFalta,
      explicacao: m.gabarito.explicacao.trim(),
    },
  };
}

// ─────────────────────────────────────────────────────────────── as imagens

/**
 * O laço do "Gerar imagens": a api gera ATÉ DUAS por chamada (o BFF corta em
 * 30 s), e o cliente repete. Para em dois casos:
 *
 * - `completo` — não falta nada;
 * - a chamada não gerou NENHUMA — tudo o que sobrou falhou. Repetir aí é pedir
 *   de novo as mesmas imagens que o provedor acabou de recusar, em laço, e
 *   cobrar da quota do professor a cada volta.
 */
export function continuarGerando(p: Pick<ProgressoDaMidia, "completo" | "geradas">): boolean {
  return !p.completo && p.geradas.length > 0;
}

/**
 * As falhas ACUMULADAS entre chamadas. Uma notícia que falhou numa volta e saiu
 * na seguinte deixa de ser falha — a verdade é o `imagens` da última resposta.
 */
export function falhasAcumuladas(
  anteriores: readonly IdDeNoticia[],
  p: Pick<ProgressoDaMidia, "falharam" | "imagens">,
): IdDeNoticia[] {
  const todas = new Set([...anteriores, ...p.falharam]);
  return [...todas].filter((id) => !p.imagens[id]).sort();
}

/** "3 de 5 imagens prontas, 1 aprovada" — e o pacote que não pede imagem. */
export function textoDoProgressoDaMidia(m: ResumoDaMidia): string {
  if (m.total === 0) return "Nenhuma notícia deste pacote pede imagem.";
  if (m.aprovadas >= m.total) return m.total === 1 ? "A imagem está aprovada." : `As ${m.total} imagens estão aprovadas.`;
  const aprovadas = m.aprovadas === 1 ? "1 aprovada" : `${m.aprovadas} aprovadas`;
  if (m.prontas >= m.total) {
    return `${m.total === 1 ? "A imagem está pronta" : `As ${m.total} imagens estão prontas`}, ${aprovadas}.`;
  }
  return `${m.prontas} de ${m.total} ${m.total === 1 ? "imagem pronta" : "imagens prontas"}, ${aprovadas}.`;
}

/**
 * A atividade pode ir ao ar? Toda notícia que pede imagem com imagem gerada E
 * aprovada (ADR-147) — a mesma regra que a api cobra no `em-andamento` (409
 * `imagens-nao-aprovadas`); aqui ela só decide o que a tela oferece.
 */
export function imagensProntasParaAula(m: ResumoDaMidia): boolean {
  return m.aprovadas >= m.total;
}
