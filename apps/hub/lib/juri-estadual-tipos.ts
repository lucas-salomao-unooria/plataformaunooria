/**
 * O que o hub lê da exp06ef1b (O Júri Estadual de Projetos) — espelho do Zod de
 * `apps/api/src/juri-estadual/contrato-de-rotas.ts`, que é a fonte da verdade,
 * e dos valores fechados de `vocabulario.ts`, `regras/passos.ts` e
 * `invariantes.ts` do mesmo módulo.
 *
 * O espelho é DECLARADO, e `juri-estadual-tipos.test.ts` lê os arquivos da api
 * como texto e compara lista por lista: uma segunda lista de valores é a que
 * ninguém atualiza junto, e o hub não importa a api.
 *
 * Note o que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum voto, taxa nem nível por criança.** A linha do painel é só
 *   progresso (`PROIBIDO_NA_LINHA_DO_PAINEL`, na api): o painel é PROJETADO na
 *   lousa no pico, e nome ligado a voto não vai para a parede. Os votos moram
 *   SÓ no agregado por área do resumo; o nível das habilidades mora no painel
 *   de habilidades (`lib/evidencias.ts`).
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle da
 *   experiência; daqui o hub só prepara e conduz.
 * - **Nenhum acervo padrão.** A missão não tem banco pronto (decisão de
 *   2026-10-02): sem saldo de IA não há atividade, e a tela diz isso em vez de
 *   oferecer um atalho que não existe.
 *
 * O GABARITO (a ordem dos blocos da cadeia, os cartões certos do caso
 * Mariana) aparece em `MaterialDoJuri`, que só rota de professor devolve.
 *
 * As funções daqui são PURAS: o painel ao vivo e a criação da atividade são
 * client components e importam deste arquivo, e o `vitest` do hub só varre
 * `lib/`.
 */

// ─────────────────────────────────────────────────────────────── o vocabulário

export const EXP_ID = "exp06ef1b";

/** As quatro áreas da mostra. O slug é fixo; o nome (Robótica, Meio Ambiente…) é do pacote gerado. */
export const AREAS = ["area_a", "area_b", "area_c", "area_d"] as const;
export type Area = (typeof AREAS)[number];

export const PROJETOS_POR_AREA = 4;
export const TOTAL_DE_PROJETOS = AREAS.length * PROJETOS_POR_AREA;

/** `proj-<letra da área><n>`: a letra diz a área (e a área está à vista na hashtag do post). */
export const IDS_DE_PROJETO: readonly string[] = AREAS.flatMap((area) =>
  Array.from({ length: PROJETOS_POR_AREA }, (_, i) => `proj-${area.slice(-1)}${i + 1}`),
);
export const ID_DE_PROJETO_RE = /^proj-[a-d][1-4]$/;

export function areaDoProjeto(projetoId: string): Area {
  return `area_${projetoId.charAt(5)}` as Area;
}

/** "Área A" — o rótulo curto do eixo do gráfico (o `BarChart` do DS corta acima de ~8 caracteres). */
export function rotuloCurtoDaArea(area: Area): string {
  return `Área ${area.slice(-1).toUpperCase()}`;
}

/** As disciplinas do preparo, na ordem da api. A missão é transversal. */
export const DISCIPLINAS = [
  "lingua-portuguesa",
  "ciencias",
  "historia",
  "geografia",
  "matematica",
  "arte",
  "educacao-fisica",
  "lingua-inglesa",
  "projeto-interdisciplinar",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

/** `Record` exaustivo: disciplina nova na api sem rótulo aqui é erro de compilação (e o teste compara as chaves). */
export const ROTULO_DA_DISCIPLINA: Record<Disciplina, string> = {
  "lingua-portuguesa": "Língua Portuguesa",
  ciencias: "Ciências",
  historia: "História",
  geografia: "Geografia",
  matematica: "Matemática",
  arte: "Arte",
  "educacao-fisica": "Educação Física",
  "lingua-inglesa": "Língua Inglesa",
  "projeto-interdisciplinar": "Projeto interdisciplinar",
};

/** O rótulo de um slug que veio da api — e o próprio slug, se o hub ainda não o conhece. */
export function rotuloDaDisciplina(slug: string): string {
  return (ROTULO_DA_DISCIPLINA as Record<string, string>)[slug] ?? slug;
}

/** Só `ia`: a missão não tem acervo padrão. */
export const ORIGENS_DO_PACOTE = ["ia"] as const;
export type OrigemDoPacote = (typeof ORIGENS_DO_PACOTE)[number];

/** Onde o estudante está, na ordem em que ele percorre a missão. */
export const PASSOS = [
  "credencial",
  "feed",
  "lacrada",
  "galeria",
  "cadeia",
  "mariana",
  "enquetes",
  "fim",
] as const;
export type PassoDoEstudante = (typeof PASSOS)[number];

/** As etapas da TURMA, na ordem em que o botão único as abre. */
export const ETAPAS = ["exploracao", "galeria"] as const;
export type EtapaDaTurma = (typeof ETAPAS)[number];

// ─────────────────────────────────────────────────── as invariantes do pacote

/** Teto de leitura de Anos Finais: legenda até 60 palavras, bastidor até 40. */
export const MAX_PALAVRAS_DA_LEGENDA = 60;
export const MAX_PALAVRAS_DO_BASTIDOR = 40;

export const HASHTAG_RE = /^#[a-z0-9_]{2,24}$/;
export const PERFIL_RE = /^@[a-z0-9_.]{3,30}$/;

/** Marcas e nomes de terceiros que não entram num estande — espelho de `TERMOS_PROIBIDOS`. */
export const TERMOS_PROIBIDOS = [
  "instagram",
  "facebook",
  "tiktok",
  "whatsapp",
  "youtube",
  "google",
  "arduino",
  "raspberry",
  "lego",
  "apple",
  "samsung",
  "microsoft",
  "chatgpt",
  "openai",
] as const;

/** Os tetos de CARACTERE de `ProjetoDoPacoteSchema` (depois do `trim`). */
export const CARACTERES = {
  titulo: { min: 3, max: 60 },
  escola: { min: 3, max: 60 },
  legenda: { min: 10, max: 420 },
  bastidor: { min: 10, max: 280 },
  descricao: { min: 10, max: 240 },
  alt: { min: 3, max: 140 },
} as const;

/** Os tetos de `ParametrosDoPreparoSchema`. */
export const PARAMETROS = {
  tema: { min: 3, max: 60 },
  assuntos: { min: 10, max: 600 },
  contextoMax: 120,
} as const;

export function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Os termos proibidos num texto, por palavra inteira, sem acento e sem caixa — como a api confere. */
export function termosProibidosEm(texto: string): string[] {
  const p = new Set(semAcento(texto).split(/[^a-z0-9]+/));
  return TERMOS_PROIBIDOS.filter((termo) => p.has(termo));
}

/**
 * A exclamação: a missão inteira tem UMA (a do Léo, na experiência). O preparo
 * da api normaliza o texto gerado ("!" vira "."); a edição do professor viaja
 * normalizada também, pela mesma regra, para o que ele digitou não ser o único
 * texto da mostra com exclamação.
 */
export function semExclamacao(texto: string): string {
  return texto.replace(/!+/g, ".").replace(/\.\.+/g, ".");
}

// ────────────────────────────────────────────────────────────── o conteúdo

export interface CategoriaDaMostra {
  area: Area;
  nome: string;
  hashtag: string;
}

/** Um estande COMPLETO, como o professor o lê e o edita. Só entra e sai por rota de professor. */
export interface ProjetoDoPacote {
  id: string;
  area: Area;
  titulo: string;
  escola: string;
  perfil: string;
  /** A legenda da apresentação (o post do estande). */
  legenda: string;
  /** O texto do post de bastidor (o protótipo sendo testado). */
  bastidor: string;
  hashtags: string[];
  /** `descricao` é o pedido da geração da imagem; `alt`, o texto alternativo que a criança ouve. */
  imagem: { descricao: string; alt: string };
}

export interface ConteudoDoPacote {
  tema: string;
  categorias: CategoriaDaMostra[];
  projetos: ProjetoDoPacote[];
}

/** O corpo de `gerar-conteudo` (`ParametrosDoPreparoSchema`). `contexto` é OPCIONAL, não anulável. */
export interface ParametrosDoPreparo {
  disciplina: Disciplina;
  tema: string;
  assuntos: string;
  contexto?: string;
}

// ─────────────────────────────────────────────────────── as rotas do professor

/**
 * Os caminhos da api, num lugar só (sem o prefixo do BFF). As rotas do
 * professor espelham as do Jornal (`jornal-escola/turmas/...`).
 */
export function caminhoDaTurma(turmaId: string): string {
  return `/juri-estadual/turmas/${encodeURIComponent(turmaId)}`;
}
export const CAMINHO_DAS_TURMAS = "/juri-estadual/turmas";
export const CAMINHO_DO_MATERIAL = "/juri-estadual/professor/material";

/** `GET /juri-estadual/turmas`. */
export interface TurmaDoJuri {
  id: string;
  nome: string;
  serie: string | null;
  estudantes: number;
}

export interface ResumoDaMidia {
  total: number;
  prontas: number;
}

export interface PacoteResumo {
  id: string;
  disciplina: string;
  tema: string;
  origem: OrigemDoPacote;
}

/** O pacote como as telas do professor o mostram. */
export interface PacoteNaTela extends PacoteResumo {
  assuntos: string;
  conteudo: ConteudoDoPacote;
  midia: ResumoDaMidia;
  /** As URLs já geradas, por id de projeto. */
  imagens: Record<string, string>;
}

/** `GET :turmaId/pacotes`. */
export interface PacotesDoJuri {
  /** A atividade EM ANDAMENTO, ou `null`: a plataforma não cria atividade (ADR-130). */
  ativo: (PacoteNaTela & { rodada: number; etapa: EtapaDaTurma }) | null;
  historico: Array<
    PacoteResumo & {
      ativo: boolean;
      criadoEm: string;
      /** A maior rodada com sessão; 0 = nunca rodou. */
      rodadas: number;
      /** A segunda fase da aprovação passou? Sem ela, a atividade não vai ao ar (409 `imagens-nao-aprovadas`). */
      imagensAprovadas: boolean;
    }
  >;
}

/** `GET :turmaId/pacotes/:pacoteId` — UMA atividade, em andamento ou pronta. */
export interface PacoteDetalhe extends PacoteNaTela {
  ativo: boolean;
  rodada: number | null;
  etapa: EtapaDaTurma | null;
  criadoEm: string;
  rodadas: number;
  /** Quando o professor aprovou as imagens; `null` = a segunda fase não passou, e a atividade não vai ao ar. */
  imagensAprovadasEm: string | null;
}

/** `POST :turmaId/pacotes/:pacoteId/aprovar-imagens` — a segunda fase da aprovação. */
export interface ImagensAprovadas {
  pacoteId: string;
  imagensAprovadasEm: string;
}

/** `POST :turmaId/pacotes/:pacoteId/imagens/:projetoId/refazer` — a imagem nova de UM estande. */
export interface ImagemRefeita {
  pacoteId: string;
  projetoId: string;
  url: string;
}

/** `POST gerar-conteudo` — RASCUNHO, não persiste. */
export interface RascunhoDoPacote {
  parametros: ParametrosDoPreparo;
  conteudo: ConteudoDoPacote;
}

/** `POST regenerar-projeto`. `usouIa: false` = o projeto voltou como estava. */
export interface ProjetoRegenerado {
  projeto: ProjetoDoPacote;
  usouIa: boolean;
}

/** `POST homologar` — a atividade criada, PRONTA (ADR-130). */
export interface PacoteHomologado extends PacoteResumo {
  ativo: boolean;
}

/** `POST :turmaId/pacotes/:pacoteId/em-andamento`. */
export interface EmAndamento {
  pacoteId: string;
  rodada: number;
  etapa: EtapaDaTurma;
  mudou: boolean;
}

/** `POST gerar-midia?pacoteId=` — o progresso de UMA chamada (até duas imagens novas). */
export interface ProgressoDaMidia {
  pacoteId: string;
  total: number;
  prontas: number;
  faltam: number;
  geradas: string[];
  /** As que falharam NESTA chamada — seguem com a arte procedural. */
  falharam: string[];
  completo: boolean;
  imagens: Record<string, string>;
}

/** Uma linha do painel — um COMPUTADOR quando a turma montou equipes, uma criança quando não. **Só progresso.** */
export interface LinhaDoPainel {
  estudanteId: string;
  nome: string;
  usuario: string;
  equipe: { id: string; nome: string } | null;
  entrou: boolean;
  passo: PassoDoEstudante;
  votou: boolean;
  abriuAGaleria: boolean;
  buscou: boolean;
  revisou: boolean;
  concluiu: boolean;
}

export type VotosDaArea = CategoriaDaMostra & { votos: number };

/** `GET :turmaId/painel`. */
export interface PainelDoJuri {
  turma: { id: string; nome: string; serie: string | null };
  pacote: PacoteResumo & { midia: ResumoDaMidia };
  rodada: number;
  etapa: EtapaDaTurma;
  proximaEtapa: EtapaDaTurma | null;
  linhas: LinhaDoPainel[];
  resumo: {
    total: number;
    entraram: number;
    votaram: number;
    revisaram: number;
    concluiram: number;
    computadores: { votaram: number; total: number };
    porComputador: boolean;
    /** A lousa do PICO: o voto inicial (lacrado), por área. */
    votosPorArea: VotosDaArea[];
    /** A média da taxa real de quem votou, 0–100, ou `null` sem voto. */
    invisibilidadeMedia: number | null;
    revisao: { mantiveram: number; trocaram: number };
    /** O voto final (revisado, se trocou), por área — a lousa depois da galeria. */
    votosRevisadosPorArea: VotosDaArea[];
  };
}

/** `POST :turmaId/gate`. */
export interface GateDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  pacoteId: string;
  rodada: number;
  etapa: EtapaDaTurma;
  proximaEtapa: EtapaDaTurma | null;
  atualizadoEm: string;
}

/** `POST :turmaId/zerar`. */
export interface TurmaZerada {
  pacoteId: string;
  rodada: number;
  etapa: EtapaDaTurma;
}

interface CartaoComGabarito {
  id: string;
  texto: string;
  certo: boolean;
}

/** `GET /juri-estadual/professor/material` — o esqueleto fixo COM gabarito, a plenária e a regra do feed. */
export interface MaterialDoJuri {
  blocos: Array<{ posicao: number; rotulo: string }>;
  mariana: { caso: string; mecanismos: CartaoComGabarito[]; atitudes: CartaoComGabarito[] };
  plenaria: string[];
  regra: { pesoDaCurtida: number; pesoDaPermanencia: number; limiar: number; postsNoFeed: number };
}

/** O corpo de erro da api: `{codigo, mensagem}`, e `erros[]` no `pacote-invalido`. */
export interface ErroDoJuri {
  codigo?: string;
  mensagem?: string;
  erros?: string[];
}

/** O erro de uma resposta, com a frase de reserva quando a api não mandou nenhuma. */
export function erroDaResposta(corpo: unknown, padrao: string): { codigo: string | null; mensagem: string; erros: string[] } {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as ErroDoJuri;
  return {
    codigo: typeof c.codigo === "string" ? c.codigo : null,
    mensagem: typeof c.mensagem === "string" && c.mensagem.trim() ? c.mensagem : padrao,
    erros: Array.isArray(c.erros) ? c.erros.filter((e): e is string => typeof e === "string") : [],
  };
}

/**
 * A falha da IA pelo status OU pelo código (o BFF repassa os dois). Sem saldo
 * NÃO tem saída nesta missão — não há banco padrão —; indisponível pede para
 * tentar de novo.
 */
export function falhaDaIa(status: number, codigo: string | null): "sem-saldo" | "indisponivel" | null {
  if (status === 429 || codigo === "sem-saldo-de-ia") return "sem-saldo";
  if (status === 503 || codigo === "ia-indisponivel") return "indisponivel";
  return null;
}

// ───────────────────────────────────────────────────────────── os rótulos

export const ROTULO_DA_ETAPA: Record<EtapaDaTurma, string> = {
  exploracao: "Exploração — cada computador navega no feed da mostra e lacra o voto",
  galeria: "Galeria Oculta liberada — cada computador audita o que não viu, revisa o voto e segue no próprio ritmo",
};

/** O rótulo do botão único, pela etapa de DESTINO. A suíte e2e casa por texto exato. */
export const ROTULO_DO_BOTAO: Record<Exclude<EtapaDaTurma, "exploracao">, string> = {
  galeria: "Liberar a Galeria Oculta",
};

export function rotuloDoBotao(proxima: EtapaDaTurma | null): string | null {
  if (proxima === null || proxima === "exploracao") return null;
  return ROTULO_DO_BOTAO[proxima];
}

/** O que o computador está vendo agora, em uma linha. */
export const ROTULO_DO_PASSO: Record<PassoDoEstudante, string> = {
  credencial: "Na credencial de jurado",
  feed: "No feed da mostra",
  lacrada: "Votou — esperando a plenária",
  galeria: "Na Galeria Oculta",
  cadeia: "Montando a cadeia do feed",
  mariana: "No caso Mariana",
  enquetes: "Nas enquetes",
  fim: "Concluiu",
};

export const ROTULO_DA_ORIGEM: Record<OrigemDoPacote, string> = {
  /* "aprovado", sem "por você": quem aprovou pode ter sido a coordenação. */
  ia: "gerado com IA e aprovado",
};

// ────────────────────────────────────────────────────── as leituras do painel

/** Inteiro de 0 a 100. Todo vazio: 0, nunca `NaN`. */
export function percentual(parte: number, todo: number): number {
  if (todo <= 0) return 0;
  return Math.round((parte / todo) * 100);
}

/** "jurado"/"jurados" ou "computador"/"computadores": com equipes, quem vota é a máquina. */
export function sujeito(porComputador: boolean, n: number): string {
  if (porComputador) return n === 1 ? "computador" : "computadores";
  return n === 1 ? "jurado" : "jurados";
}

/** "24 de 26 jurados votaram." — o número que decide a hora de liberar a galeria. */
export function textoDosVotos(c: { votaram: number; total: number }, porComputador: boolean): string {
  const verbo = c.votaram === 1 && c.total === 1 ? "votou" : "votaram";
  return `${c.votaram} de ${c.total} ${sujeito(porComputador, c.total)} ${verbo}.`;
}

/** "Aguardando 2 jurados para fechar o lacre coletivo." — `null` quando ninguém falta. */
export function textoDoQueFalta(c: { votaram: number; total: number }, porComputador: boolean): string | null {
  const faltam = Math.max(0, c.total - c.votaram);
  if (faltam === 0 || c.total === 0) return null;
  return `Aguardando ${faltam} ${sujeito(porComputador, faltam)} para fechar o lacre coletivo.`;
}

/** A taxa média, como o professor a lê. O número é o REAL, calculado pela api. */
export function textoDaInvisibilidade(media: number | null): string {
  if (media === null) return "Aparece quando o primeiro voto for lacrado.";
  return `Em média, ${media}% dos estandes da mostra não chegaram ao feed de quem votou.`;
}

/** "3 jurados trocaram o voto e 20 mantiveram." */
export function textoDaRevisao(r: { mantiveram: number; trocaram: number }, porComputador: boolean): string | null {
  if (r.mantiveram + r.trocaram === 0) return null;
  return `${r.trocaram} ${sujeito(porComputador, r.trocaram)} ${r.trocaram === 1 ? "trocou" : "trocaram"} o voto e ${r.mantiveram} ${r.mantiveram === 1 ? "manteve" : "mantiveram"}.`;
}

export function totalDeVotos(v: readonly VotosDaArea[]): number {
  return v.reduce((soma, a) => soma + a.votos, 0);
}

/**
 * Os votos em percentual do total, na ORDEM das áreas — o eixo do `BarChart`
 * do DS é fixo em 0–100, e contagens de 0 a 30 sumiriam nele. Uma área que a
 * api não mandou conta zero, em vez de deslocar as barras.
 */
export function votosEmPercentual(v: readonly VotosDaArea[]): number[] {
  const total = totalDeVotos(v);
  return AREAS.map((area) => percentual(v.find((a) => a.area === area)?.votos ?? 0, total));
}

/** "Área A — Robótica (#robotica): 7 votos" — as contagens exatas, sem nome de ninguém. */
export function textoDosVotosDaArea(a: VotosDaArea): string {
  return `${rotuloCurtoDaArea(a.area)} — ${a.nome} (${a.hashtag}): ${a.votos} ${a.votos === 1 ? "voto" : "votos"}`;
}

/**
 * A aula ainda CORRE? É o que decide se o painel continua consultando. Para
 * quando a turma inteira concluiu com a galeria aberta.
 */
export function aulaEmAndamento(p: Pick<PainelDoJuri, "etapa" | "resumo">): boolean {
  return !(p.etapa === "galeria" && p.resumo.total > 0 && p.resumo.concluiram >= p.resumo.total);
}

/** Quantas linhas já passaram de `passo` — o que o resumo não conta, a folha diz. */
function passaramDe(linhas: readonly Pick<LinhaDoPainel, "passo">[], passo: PassoDoEstudante): number {
  const marco = PASSOS.indexOf(passo);
  return linhas.filter((l) => PASSOS.indexOf(l.passo) > marco).length;
}

/**
 * Mudou algo que a EVIDÊNCIA registra (ADR-146)? As três ações da ficha são
 * marcadas na MESMA transação do passo que o painel mostra: a EF06CO10 e a
 * EF06CO01 no latch da revisão do voto (`revisaram`) e a EF06CO03 quando a
 * cadeia se monta (a linha sai de `cadeia`) — e as enquetes vêm antes do crachá
 * (`concluiram`). A cadeia não tem contador no resumo, por isso a conta é sobre
 * o passo de cada linha. A atividade troca com um pacote novo ou uma rodada nova. Só nesses
 * casos o painel da aula relê a página inteira, para o painel de habilidades
 * acompanhar sem o professor apertar F5. É o mesmo desenho da exp05ef1b
 * (`mudouAEvidencia` em `quem-mandou-regras.ts`).
 */
export function mudouAEvidencia(
  antes: Pick<PainelDoJuri, "pacote" | "rodada" | "resumo" | "linhas">,
  depois: Pick<PainelDoJuri, "pacote" | "rodada" | "resumo" | "linhas">,
): boolean {
  return (
    antes.resumo.revisaram !== depois.resumo.revisaram ||
    passaramDe(antes.linhas, "cadeia") !== passaramDe(depois.linhas, "cadeia") ||
    antes.resumo.concluiram !== depois.resumo.concluiram ||
    antes.pacote.id !== depois.pacote.id ||
    antes.rodada !== depois.rodada
  );
}

/**
 * Alfabética pelo que a primeira célula MOSTRA — o nome da equipe, quando há
 * —, com número como número ("Equipe 2" antes de "Equipe 10"). Nunca por
 * progresso: listagem ordenável vira ranking.
 */
export function ordenarLinhas(linhas: readonly LinhaDoPainel[]): LinhaDoPainel[] {
  const rotulo = (l: LinhaDoPainel) => l.equipe?.nome ?? l.nome;
  return [...linhas].sort((a, b) => rotulo(a).localeCompare(rotulo(b), "pt-BR", { sensitivity: "base", numeric: true }));
}

// ────────────────────────────────────────────────────────────── o preparo

/** Os parâmetros como a tela os segura: tudo texto, `disciplina` vazia até escolher. */
export interface ParametrosNaTela {
  disciplina: string;
  tema: string;
  assuntos: string;
  contexto: string;
}

export const PARAMETROS_VAZIOS: ParametrosNaTela = { disciplina: "", tema: "", assuntos: "", contexto: "" };

export function ehDisciplina(valor: string): valor is Disciplina {
  return (DISCIPLINAS as readonly string[]).includes(valor);
}

/** O que falta nos parâmetros, por campo. A api confere de novo. */
export function problemasDosParametros(p: ParametrosNaTela): Partial<Record<keyof ParametrosNaTela, string>> {
  const erros: Partial<Record<keyof ParametrosNaTela, string>> = {};
  if (!ehDisciplina(p.disciplina)) erros.disciplina = "Escolha o componente curricular.";
  const tema = p.tema.trim().length;
  if (tema < PARAMETROS.tema.min || tema > PARAMETROS.tema.max) {
    erros.tema = `Escreva de ${PARAMETROS.tema.min} a ${PARAMETROS.tema.max} caracteres.`;
  }
  const assuntos = p.assuntos.trim().length;
  if (assuntos < PARAMETROS.assuntos.min || assuntos > PARAMETROS.assuntos.max) {
    erros.assuntos = `Escreva de ${PARAMETROS.assuntos.min} a ${PARAMETROS.assuntos.max} caracteres.`;
  }
  if (p.contexto.trim().length > PARAMETROS.contextoMax) erros.contexto = `Encurte para até ${PARAMETROS.contextoMax} caracteres.`;
  return erros;
}

/**
 * O corpo de `gerar-conteudo`: sem espaço nas pontas, e `contexto` AUSENTE
 * quando vazio (o Zod não aceita `null`). Só chame com os parâmetros válidos.
 */
export function corpoDosParametros(p: ParametrosNaTela): ParametrosDoPreparo {
  const contexto = p.contexto.trim();
  return {
    disciplina: p.disciplina as Disciplina,
    tema: p.tema.trim(),
    assuntos: p.assuntos.trim(),
    ...(contexto ? { contexto } : {}),
  };
}

/** Os parâmetros que a api devolveu no rascunho, de volta para os campos. */
export function parametrosNaTela(p: ParametrosDoPreparo): ParametrosNaTela {
  return { disciplina: p.disciplina, tema: p.tema, assuntos: p.assuntos, contexto: p.contexto ?? "" };
}

/** Os campos de um estande que a tela aponta. */
export type CampoDoEstande = "titulo" | "escola" | "perfil" | "legenda" | "bastidor" | "hashtags" | "descricao" | "alt";

function conferirTexto(texto: string, tetos: { readonly min: number; readonly max: number }, maxPalavras?: number): string | null {
  const limpo = texto.trim();
  if (limpo.length === 0) return "Não pode ficar vazio.";
  if (limpo.length > tetos.max) return `Encurte para até ${tetos.max} caracteres.`;
  if (limpo.length < tetos.min) return `Escreva pelo menos ${tetos.min} caracteres.`;
  if (maxPalavras !== undefined) {
    const n = palavras(limpo);
    if (n > maxPalavras) return `Tem ${n} palavras; o máximo é ${maxPalavras}.`;
  }
  const proibidos = termosProibidosEm(limpo);
  if (proibidos.length > 0) return `Tire “${proibidos.join("”, “")}”: a mostra é fictícia e não cita marca.`;
  return null;
}

/**
 * O que impede cada campo de UM estande de ir para a turma, na frase do campo.
 * Espelho de `problemasDoPacote` da api, campo a campo; a api confere de novo
 * na homologação e é a palavra final.
 */
export function problemasPorCampo(p: ProjetoDoPacote, hashtagDaArea: string | undefined): Partial<Record<CampoDoEstande, string>> {
  const erros: Partial<Record<CampoDoEstande, string>> = {};
  const registrar = (campo: CampoDoEstande, problema: string | null) => {
    if (problema) erros[campo] = problema;
  };
  const c = CARACTERES;
  registrar("titulo", conferirTexto(p.titulo, c.titulo));
  registrar("escola", conferirTexto(p.escola, c.escola));
  registrar("perfil", PERFIL_RE.test(p.perfil.trim()) ? null : "O perfil precisa começar por @, com letras minúsculas, números, ponto ou _.");
  registrar("legenda", conferirTexto(p.legenda, c.legenda, MAX_PALAVRAS_DA_LEGENDA));
  registrar("bastidor", conferirTexto(p.bastidor, c.bastidor, MAX_PALAVRAS_DO_BASTIDOR));
  let hashtags: string | null = null;
  if (p.hashtags.length < 2 || p.hashtags.length > 4) hashtags = "O estande precisa de 2 a 4 hashtags.";
  else if (p.hashtags.some((h) => !HASHTAG_RE.test(h))) hashtags = "Hashtag com # e só letras minúsculas sem acento, números ou _.";
  else if (hashtagDaArea && p.hashtags[0] !== hashtagDaArea) hashtags = `A primeira hashtag precisa ser a da área, ${hashtagDaArea}.`;
  registrar("hashtags", hashtags);
  registrar("descricao", conferirTexto(p.imagem.descricao, c.descricao));
  registrar("alt", conferirTexto(p.imagem.alt, c.alt));
  return erros;
}

/** Os estandes de cada área, na ordem das áreas e dos ids — é a grade da curadoria. */
export function estandesPorArea(conteudo: ConteudoDoPacote): Array<{ categoria: CategoriaDaMostra; projetos: ProjetoDoPacote[] }> {
  return AREAS.map((area) => ({
    categoria: conteudo.categorias.find((c) => c.area === area) ?? { area, nome: rotuloCurtoDaArea(area), hashtag: "" },
    projetos: conteudo.projetos.filter((p) => p.area === area).sort((a, b) => a.id.localeCompare(b.id)),
  }));
}

/** O conteúdo tem a forma da mostra? Dezesseis estandes, quatro categorias. */
export function conteudoCompleto(conteudo: ConteudoDoPacote | null): conteudo is ConteudoDoPacote {
  return Boolean(conteudo && conteudo.projetos.length === TOTAL_DE_PROJETOS && conteudo.categorias.length === AREAS.length);
}

/**
 * Os problemas que a api devolveu no `pacote-invalido`, separados por estande.
 * As frases de `problemasDoPacote` citam o id (`legenda longa demais em
 * proj-b2`, `proj-a1 está na área errada`); o resto é do conjunto.
 */
export function distribuirErros(erros: readonly string[]): { porProjeto: Record<string, string[]>; geral: string[] } {
  const porProjeto: Record<string, string[]> = {};
  const geral: string[] = [];
  for (const erro of erros) {
    const id = /\bproj-[a-d][1-4]\b/.exec(erro)?.[0];
    if (id) (porProjeto[id] ??= []).push(erro);
    else geral.push(erro);
  }
  return { porProjeto, geral };
}

/**
 * O estande como ele VIAJA: sem espaço nas pontas e sem exclamação no que a
 * criança lê. As chaves na ordem do contrato.
 */
export function normalizarProjeto(p: ProjetoDoPacote): ProjetoDoPacote {
  const limpo = (t: string) => semExclamacao(t.trim());
  return {
    id: p.id,
    area: p.area,
    titulo: limpo(p.titulo),
    escola: limpo(p.escola),
    perfil: p.perfil.trim(),
    legenda: limpo(p.legenda),
    bastidor: limpo(p.bastidor),
    hashtags: p.hashtags.map((h) => h.trim()),
    imagem: { descricao: p.imagem.descricao.trim(), alt: limpo(p.imagem.alt) },
  };
}

export function normalizarConteudo(c: ConteudoDoPacote): ConteudoDoPacote {
  return {
    tema: c.tema.trim(),
    categorias: c.categorias.map((k) => ({ area: k.area, nome: k.nome.trim(), hashtag: k.hashtag.trim() })),
    projetos: c.projetos.map(normalizarProjeto),
  };
}

// ─────────────────────────────────────────────────────────────── as imagens

/**
 * O laço do "Gerar imagens": a api gera ATÉ DUAS por chamada (o BFF corta a
 * espera), e o cliente repete. Para quando não falta nada, ou quando a chamada
 * não gerou NENHUMA — repetir aí é pedir de novo as mesmas imagens que o
 * provedor acabou de recusar, cobrando da quota do professor a cada volta. A
 * falha não bloqueia nada: o estande sem imagem sai com a arte procedural.
 */
export function continuarGerando(p: Pick<ProgressoDaMidia, "completo" | "geradas">): boolean {
  return !p.completo && p.geradas.length > 0;
}

/** As falhas ACUMULADAS entre chamadas; a verdade é o `imagens` da última resposta. */
export function falhasAcumuladas(anteriores: readonly string[], p: Pick<ProgressoDaMidia, "falharam" | "imagens">): string[] {
  const todas = new Set([...anteriores, ...p.falharam]);
  return [...todas].filter((id) => !p.imagens[id]).sort();
}

/** O estado da imagem de UM estande na grade da aprovação. */
export type EstadoDaImagem = "aprovada" | "aguardando" | "gerando" | "sem-imagem";

/**
 * Onde a imagem de um estande está: refazendo/gerando agora, sem imagem (a
 * criança vê a arte desenhada), à espera do OK, ou aprovada. A aprovação é UMA
 * para o pacote (como na exp07ef1b, ADR-146): aprovadas, todas congelam — e o
 * estande sem imagem segue "sem imagem", com a arte procedural.
 */
export function estadoDaImagem(e: { temImagem: boolean; gerando: boolean; aprovadas: boolean }): EstadoDaImagem {
  if (e.gerando) return "gerando";
  if (!e.temImagem) return "sem-imagem";
  return e.aprovadas ? "aprovada" : "aguardando";
}

/** "3 de 16 imagens prontas." */
export function textoDoProgressoDaMidia(m: ResumoDaMidia): string {
  if (m.total === 0) return "Nenhum estande deste pacote pede imagem.";
  if (m.prontas >= m.total) return m.total === 1 ? "A imagem está pronta." : `As ${m.total} imagens estão prontas.`;
  return `${m.prontas} de ${m.total} ${m.total === 1 ? "imagem pronta" : "imagens prontas"}.`;
}
