/**
 * O que o hub lê da exp01em1b (O Assistente Invisível, ADR-185) — espelho do
 * Zod de `apps/api/src/assistente-invisivel/contrato-de-rotas.ts`, que é a
 * fonte da verdade, e dos vocabulários de `conteudo.ts` e `regras/passos.ts`
 * do mesmo módulo.
 *
 * O espelho é DECLARADO, e `assistente-invisivel-tipos.test.ts` lê os arquivos
 * da api como texto e compara lista por lista: o hub não importa a api.
 *
 * O que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle.
 * - **Nenhum gabarito da bancada** (a coluna certa dos cartões, os passos
 *   dispensáveis, a opção certa dos blocos): o painel recebe o gabarito JÁ
 *   aplicado (acertos, `correto`, `niveis`, `alinhamento`), nunca a chave.
 *
 * Puro: o painel ao vivo e a criação da atividade são client components.
 */

export const EXP_ID = "exp01em1b";

// ─────────────────────────────────────────────────────────────── vocabulários

export const DISCIPLINAS = [
  "lingua-portuguesa",
  "lingua-inglesa",
  "arte",
  "educacao-fisica",
  "matematica",
  "biologia",
  "fisica",
  "quimica",
  "filosofia",
  "geografia",
  "historia",
  "sociologia",
  "computacao",
  "projeto-interdisciplinar",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

export const ROTULO_DA_DISCIPLINA: Record<Disciplina, string> = {
  "lingua-portuguesa": "Língua Portuguesa e suas Literaturas",
  "lingua-inglesa": "Língua Inglesa",
  arte: "Arte",
  "educacao-fisica": "Educação Física",
  matematica: "Matemática",
  biologia: "Biologia",
  fisica: "Física",
  quimica: "Química",
  filosofia: "Filosofia",
  geografia: "Geografia",
  historia: "História",
  sociologia: "Sociologia",
  computacao: "Computação",
  "projeto-interdisciplinar": "Projeto Interdisciplinar",
};

export function rotuloDaDisciplina(slug: string): string {
  return (ROTULO_DA_DISCIPLINA as Record<string, string>)[slug] ?? slug;
}

export const ORIGENS = ["padrao", "ia"] as const;
export type Origem = (typeof ORIGENS)[number];

/** As fases da TURMA, só para a frente (cinco liberações e duas pausas opcionais). */
export const FASES = ["aguardando-inicio", "testes", "simulacao", "debate-1", "explicar", "debate-2", "publicar"] as const;
export type Fase = (typeof FASES)[number];

export const APOSTAS = ["a", "b", "c"] as const;
export type Aposta = (typeof APOSTAS)[number];

/** A barra de cada aposta no painel (E3-PROF-01, literal do Figma). */
export const ROTULO_DA_APOSTA: Record<Aposta, string> = {
  a: "(A) Todos receberão o nível Avançado",
  b: "(B) Apenas alguns receberão Avançado",
  c: "(C) Todos receberão nível Básico",
};

export const FUNCOES = ["exercicios", "duvidas", "sugestoes"] as const;
export type Funcao = (typeof FUNCOES)[number];
export const OPCOES_DE_CRITERIO = ["a", "b", "c"] as const;
export type OpcaoDeCriterio = (typeof OPCOES_DE_CRITERIO)[number];
export type Criterios = Record<Funcao, OpcaoDeCriterio>;

/** O número da função no código do critério ("1A", "2B", "3A"). */
export const NUMERO_DA_FUNCAO: Record<Funcao, number> = { exercicios: 1, duvidas: 2, sugestoes: 3 };

/** A configuração no ar quando o estudante chega: B-B-A (E0-PROF-05, "Configuração ativa inicial"). */
export const CRITERIOS_INICIAIS: Criterios = { exercicios: "b", duvidas: "b", sugestoes: "a" };

/** "B-B-A". */
export function codigoDosCriterios(c: Criterios): string {
  return FUNCOES.map((f) => c[f].toUpperCase()).join("-");
}

/** "1B · 2B · 3A". */
export function criteriosEmTexto(c: Criterios): string {
  return FUNCOES.map((f) => `${NUMERO_DA_FUNCAO[f]}${c[f].toUpperCase()}`).join(" · ");
}

export const CARTOES = ["trilha-avancada", "nome-turma", "horario", "sinal-de-rede", "endereco-ip", "modelo-aparelho"] as const;
export const BLOCOS = ["problema", "inferencia", "regra", "salvaguarda"] as const;
export const PERFIS = ["lucas", "beatriz", "thiago"] as const;

/** Os itens que o professor edita ou regenera um a um ("Editar Texto" / "Regenerar Este Item"). */
export const ITENS_DO_PACOTE = [
  "trilhaAvancada",
  "reforcoBasico",
  "duvidas.lucas",
  "duvidas.beatriz",
  "duvidas.thiago1",
  "duvidas.thiago2",
  "duvidas.thiago3",
  "respostas.lucas",
  "respostas.beatriz",
  "respostas.thiago1",
  "respostas.thiago2",
  "respostas.thiago3",
  "leitura",
] as const;
export type ItemDoPacote = (typeof ITENS_DO_PACOTE)[number];

export const PASSOS = [
  "boas-vindas",
  "funcoes",
  "aposta",
  "simulacao",
  "confronto",
  "fichas",
  "classificacao",
  "algoritmo",
  "criterios",
  "reteste",
  "publicacao",
  "concluida",
] as const;
export type Passo = (typeof PASSOS)[number];

/** O passo em palavras do professor (as etapas do Figma), para a folha. */
export const ROTULO_DO_PASSO: Record<Passo, string> = {
  "boas-vindas": "Boas-vindas (Etapa 1)",
  funcoes: "Explorando as funções (Etapa 2)",
  aposta: "Na aposta (Etapa 3)",
  simulacao: "Na simulação de chat (Etapa 4)",
  confronto: "No confronto com a aposta (Etapa 4)",
  fichas: "Nas fichas de auditoria (Etapa 4)",
  classificacao: "Classificando os cartões (Etapa 5)",
  algoritmo: "Nas etapas do algoritmo (Etapa 5)",
  criterios: "No banco de critérios (Etapa 5)",
  reteste: "No resultado do reteste (Etapa 5)",
  publicacao: "Na publicação (Etapa 6)",
  concluida: "Concluiu",
};

/** Os tetos do recorte (o mesmo Zod da api: `TEMA`, `TOPICOS`, `CONTEXTO_MAX`) e dos textos do pacote (`LIMITES`). */
export const TEMA = { min: 3, max: 60 } as const;
export const TOPICOS = { min: 3, max: 5, maxCaracteres: 80 } as const;
export const CONTEXTO_MAX = 120;
export const LIMITES = { titulo: 80, enunciado: 280, duvida: 200, resposta: 400, resumo: 280 } as const;

// ─────────────────────────────────────────────────────────────── o pacote

export interface ConteudoDoPacote {
  versao: 1;
  trilhaAvancada: { titulo: string; enunciado: string };
  reforcoBasico: { titulo: string; enunciado: string };
  duvidas: { lucas: string; beatriz: string; thiago1: string; thiago2: string; thiago3: string };
  respostas: { lucas: string; beatriz: string; thiago1: string; thiago2: string; thiago3: string };
  leitura: { titulo: string; resumo: string };
}

export interface PacoteDoProfessor {
  id: string;
  disciplina: Disciplina;
  tema: string;
  topicos: string[];
  contexto: string | null;
  origem: Origem;
  conteudo: ConteudoDoPacote;
  /** Os itens que o professor editou ("Editado pelo professor"). */
  editados: ItemDoPacote[];
  contingencia: boolean;
  aprovadoEm: string | null;
  ativo: boolean;
  rodadaAtual: number;
}

export interface TurmaDoPacote {
  id: string;
  nome: string;
  serie: string | null;
}

/** `GET …/turmas/:turmaId/pacote`. */
export interface PacoteDaTurma {
  turma: TurmaDoPacote;
  ativo: PacoteDoProfessor | null;
  rascunho: PacoteDoProfessor | null;
  disciplinas: { slug: Disciplina; rotulo: string }[];
}

/** `POST …/gerar-conteudo`. `motivo` = E0-PROF-03 (sem saldo / 503); o rascunho é o banco padrão nos dois. */
export interface RespostaDoGerar {
  rascunho: PacoteDoProfessor;
  usouIa: boolean;
  motivo: "sem-saldo" | "indisponivel" | null;
}

export interface AtividadeDaTurma {
  pacoteId: string;
  rodada: number;
}

/** `POST …/pacotes/:pacoteId/em-andamento`. */
export interface EmAndamento {
  atividade: AtividadeDaTurma;
  fase: Fase;
  mudou: boolean;
}

/** `GET …/turmas/:turmaId/pacotes`. */
export interface PacotesDaTurmaAssistente {
  emAndamento: AtividadeDaTurma | null;
  historico: {
    id: string;
    disciplina: Disciplina;
    tema: string;
    origem: Origem;
    ativo: boolean;
    aprovadoEm: string;
    rodadas: number;
  }[];
}

/** `POST …/gate`. */
export interface GateDaTurma {
  fase: Fase;
  atividade: AtividadeDaTurma;
  atualizadoEm: string;
}

export type Nivel = "atingiu" | "em_processo" | "nao_atingiu";

export const ROTULO_DO_NIVEL: Record<Nivel, { rotulo: string; variante: "success" | "info" | "warning" }> = {
  atingiu: { rotulo: "Atingiu", variante: "success" },
  em_processo: { rotulo: "Em processo", variante: "info" },
  nao_atingiu: { rotulo: "Não atingiu", variante: "warning" },
};

export type Comunicado = Partial<Record<(typeof BLOCOS)[number], string>>;

/** Uma linha do painel: UM estudante (ou um computador, com equipe). */
export interface LinhaDoPainel {
  unidadeId: string;
  nome: string;
  equipe: { id: string; nome: string; membros: { id: string; nome: string }[] } | null;
  passo: Passo;
  aguardandoProfessor: boolean;
  aposta: Aposta | null;
  simulacaoConcluida: boolean;
  cartoes: { acertos: number; completa: boolean } | null;
  algoritmo: { aberto: boolean; marcados: number[]; correto: boolean };
  criterios: Criterios | null;
  retestes: number;
  equidade: "total" | "parcial" | "nenhuma" | null;
  avancouComVies: boolean;
  publicacao: {
    paginaAtiva: boolean;
    comunicado: Comunicado;
    texto: string;
    alinhamento: "pleno" | "incompleto" | "descaracterizado";
  } | null;
  niveis: { co20: Nivel; co01: Nivel; co18: Nivel; co03: Nivel } | null;
}

export interface RoteiroDaAula {
  /** As quatro perguntas do roteiro do PO (§9a): 1 e 2 na Etapa 4, 3 e 4 no fechamento. */
  perguntas: string[];
}

/** `GET …/turmas/:turmaId/painel`. */
export interface PainelDaTurma {
  turma: TurmaDoPacote;
  atividade: { pacoteId: string; rodada: number; tema: string; disciplina: string } | null;
  fase: Fase | null;
  porComputador: boolean;
  resumo: {
    sessoes: number;
    apostas: Record<Aposta, number>;
    todosApostaram: boolean;
    faltamApostar: string[];
    simulacoesConcluidas: number;
    naBancada: number;
    criterioExercicios: Record<OpcaoDeCriterio, number>;
    avancaramComVies: string[];
    publicaram: number;
    paginasAtivas: number;
    habilidades: { co20: number; co01: number; co18: number; co03Participou: number };
  };
  linhas: LinhaDoPainel[];
  roteiro: RoteiroDaAula;
}

/** `GET /assistente-invisivel/professor/material` — o bloco vivo do guia. */
export interface Material {
  roteiro: RoteiroDaAula;
  habilidades: { codigo: string; rotulo: string; criterios: { atingiu: string; em_processo: string; nao_atingiu: string } }[];
}

// ─────────────────────────────────────────────────────────────── os caminhos

export function caminhoDaTurma(turmaId: string): string {
  return `/assistente-invisivel/turmas/${encodeURIComponent(turmaId)}`;
}
export const CAMINHO_DO_MATERIAL = "/assistente-invisivel/professor/material";

/**
 * As rotas da turma, abaixo de `caminhoDaTurma` — num lugar só, como a api as
 * declara (`assistente-invisivel-turmas.controller.ts`). ATENÇÃO à diferença
 * com as missões irmãs: aqui `GET /pacotes` é o PREPARO (`PacoteDaTurma`) e a
 * lista das atividades é `GET /historico` (`PacotesDaTurma`).
 */
export const ROTAS_DA_CURADORIA = {
  pacote: "/pacotes",
  historico: "/historico",
  gerar: "/gerar-conteudo",
  bancoPadrao: "/banco-padrao",
  regenerar: "/rascunho/regenerar",
  editar: "/rascunho/editar",
  homologar: "/homologar",
} as const;

// ─────────────────────────────────────────────────────────────── a curadoria

/** O rótulo de cada item no card da curadoria (E0-PROF-04), na ordem do pacote. */
export const ROTULO_DO_ITEM: Record<ItemDoPacote, string> = {
  trilhaAvancada: "Trilha Avançada",
  reforcoBasico: "Reforço Básico",
  "duvidas.lucas": "Dúvida Simulada de Chat: Lucas",
  "duvidas.beatriz": "Dúvida Simulada de Chat: Beatriz",
  "duvidas.thiago1": "Dúvida Simulada de Chat: Thiago (1)",
  "duvidas.thiago2": "Dúvida Simulada de Chat: Thiago (2)",
  "duvidas.thiago3": "Dúvida Simulada de Chat: Thiago (3)",
  "respostas.lucas": "Resposta do Assistente: Lucas",
  "respostas.beatriz": "Resposta do Assistente: Beatriz",
  "respostas.thiago1": "Resposta do Assistente: Thiago (1)",
  "respostas.thiago2": "Resposta do Assistente: Thiago (2)",
  "respostas.thiago3": "Resposta do Assistente: Thiago (3)",
  leitura: "Leitura Recomendada",
};

/** Os três itens que têm título além do texto. */
export function itemTemTitulo(item: ItemDoPacote): item is "trilhaAvancada" | "reforcoBasico" | "leitura" {
  return item === "trilhaAvancada" || item === "reforcoBasico" || item === "leitura";
}

/** O teto de caracteres do texto de cada item (os mesmos `LIMITES` da régua da api). */
export function limiteDoItem(item: ItemDoPacote): number {
  if (item === "trilhaAvancada" || item === "reforcoBasico") return LIMITES.enunciado;
  if (item === "leitura") return LIMITES.resumo;
  return item.startsWith("duvidas.") ? LIMITES.duvida : LIMITES.resposta;
}

/** O título (se houver) e o texto de um item do pacote. */
export function textoDoItem(c: ConteudoDoPacote, item: ItemDoPacote): { titulo: string | null; texto: string } {
  switch (item) {
    case "trilhaAvancada":
      return { titulo: c.trilhaAvancada.titulo, texto: c.trilhaAvancada.enunciado };
    case "reforcoBasico":
      return { titulo: c.reforcoBasico.titulo, texto: c.reforcoBasico.enunciado };
    case "leitura":
      return { titulo: c.leitura.titulo, texto: c.leitura.resumo };
    default: {
      const [grupo, chave] = item.split(".") as ["duvidas" | "respostas", keyof ConteudoDoPacote["duvidas"]];
      return { titulo: null, texto: c[grupo][chave] };
    }
  }
}

/** O recorte é aceitável para a geração (o mesmo Zod da api: tema 3–60, 3 a 5 tópicos de 2 a 80, contexto até 120)? */
export function problemasDoRecorte(r: { disciplina: string; tema: string; topicos: string[]; contexto: string }): string[] {
  const p: string[] = [];
  if (!r.disciplina) p.push("Selecione a disciplina escolar.");
  const tema = r.tema.trim();
  if (tema.length < TEMA.min || tema.length > TEMA.max) p.push(`O tema precisa ter de ${TEMA.min} a ${TEMA.max} caracteres.`);
  if (r.topicos.length < TOPICOS.min || r.topicos.length > TOPICOS.max) {
    p.push(`Informe de ${TOPICOS.min} a ${TOPICOS.max} tópicos, separados por vírgula ou um por linha.`);
  }
  if (r.topicos.some((t) => t.length < 2 || t.length > TOPICOS.maxCaracteres)) {
    p.push(`Cada tópico precisa ter de 2 a ${TOPICOS.maxCaracteres} caracteres.`);
  }
  if (r.contexto.trim().length > CONTEXTO_MAX) p.push(`O contexto passa de ${CONTEXTO_MAX} caracteres.`);
  return p;
}

/** Os tópicos do campo: separados por vírgula ou linha, sem vazios (o exemplo do Figma usa vírgula). */
export function topicosDoTexto(texto: string): string[] {
  return texto
    .split(/[,\n;]+/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** A mensagem e a lista `erros` de uma recusa da api (a homologação devolve TODAS as frases da régua). */
export function erroDaApi(corpo: unknown, padrao: string): { mensagem: string; erros: string[] } {
  if (!corpo || typeof corpo !== "object") return { mensagem: padrao, erros: [] };
  const { mensagem, erros } = corpo as { mensagem?: unknown; erros?: unknown };
  return {
    mensagem: typeof mensagem === "string" && mensagem ? mensagem : padrao,
    erros: Array.isArray(erros) ? erros.filter((e): e is string => typeof e === "string") : [],
  };
}

/**
 * O rascunho numa resposta da curadoria: `{ rascunho }` (gerar, banco padrão,
 * regenerar) ou o próprio pacote. Aceitar as duas evita depender de qual forma
 * cada rota devolve — o rascunho é o mesmo.
 */
export function rascunhoDaResposta(corpo: unknown): PacoteDoProfessor | null {
  if (!corpo || typeof corpo !== "object") return null;
  if ("rascunho" in corpo) return (corpo as { rascunho: PacoteDoProfessor | null }).rascunho ?? null;
  return "conteudo" in corpo && "id" in corpo ? (corpo as PacoteDoProfessor) : null;
}

/** O id da atividade numa resposta: o pacote (`{ id }`) ou o em andamento (`{ atividade: { pacoteId } }`). */
export function idDaAtividade(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as { id?: unknown; atividade?: { pacoteId?: unknown } | null };
  if (typeof c.id === "string") return c.id;
  if (typeof c.atividade?.pacoteId === "string") return c.atividade.pacoteId;
  return null;
}

// ─────────────────────────────────────────────────────────────── a condução

export type VarianteDoBotao = "primary" | "secondary";

/**
 * Os botões da aula em cada fase da turma — as cinco liberações e as duas
 * pausas do Figma, com o mesmo `para` de `regras/passos.ts#PROXIMAS_FASES` da
 * api (o teste confere). A pausa é opcional: o botão secundário pula para ela,
 * o principal segue direto.
 */
export const ACOES_DA_FASE: Record<Fase, { para: Fase; rotulo: string; variante: VarianteDoBotao }[]> = {
  "aguardando-inicio": [{ para: "testes", rotulo: "Liberar Início dos Testes", variante: "primary" }],
  testes: [{ para: "simulacao", rotulo: "Liberar Início da Simulação", variante: "primary" }],
  simulacao: [
    { para: "debate-1", rotulo: "Travar Telas da Turma", variante: "secondary" },
    { para: "explicar", rotulo: "Liberar Bancada de Reconstrução", variante: "primary" },
  ],
  "debate-1": [{ para: "explicar", rotulo: "Liberar Bancada de Reconstrução", variante: "primary" }],
  explicar: [
    { para: "debate-2", rotulo: "Pausar para Comparação", variante: "secondary" },
    { para: "publicar", rotulo: "Liberar Publicação e Transparência", variante: "primary" },
  ],
  "debate-2": [{ para: "publicar", rotulo: "Liberar Publicação e Transparência", variante: "primary" }],
  publicar: [],
};

/**
 * O botão da PAUSA que já aconteceu (E4-PROF-01 e E5-PROF-01 "pausado"): o
 * Figma desenha os dois botões no estado pausado, e o painel os mantém — o da
 * pausa fica à vista e DESABILITADO, porque a turma já está nela. Ele nunca
 * envia nada: a transição `{para}` continua só para a frente e idempotente
 * (`ACOES_DA_FASE` segue espelhando `PROXIMAS_FASES` da api).
 */
export const PAUSA_FEITA: Partial<Record<Fase, { rotulo: string; variante: VarianteDoBotao }>> = {
  "debate-1": { rotulo: "Travar Telas da Turma", variante: "secondary" },
  "debate-2": { rotulo: "Pausar para Comparação", variante: "secondary" },
};

/**
 * O MOMENTO do painel dentro da fase, que decide o quadro do Figma que ele
 * desenha. A fase `explicar` cobre dois quadros: logo depois de liberar a
 * bancada é o E4-PROF-01 "liberado" (as apostas consolidadas, sem botão);
 * quando a turma já retestou, é o E5-PROF-01 (a projeção 1A × 1C e os botões
 * da E5). A fase `publicar` também: o E5-PROF-01 "liberado" até a primeira
 * publicação, e o relatório formativo final (E6-PROF-01) a partir dela.
 */
export type MomentoDoPainel =
  | "inicio"
  | "apostas"
  | "simulacao"
  | "telas-travadas"
  | "bancada-liberada"
  | "projecao"
  | "projecao-pausada"
  | "publicacao-liberada"
  | "relatorio";

export function momentoDoPainel(fase: Fase, resumo: Pick<PainelDaTurma["resumo"], "criterioExercicios" | "publicaram">): MomentoDoPainel {
  const retestaram = OPCOES_DE_CRITERIO.reduce((s, k) => s + resumo.criterioExercicios[k], 0) > 0;
  switch (fase) {
    case "aguardando-inicio":
      return "inicio";
    case "testes":
      return "apostas";
    case "simulacao":
      return "simulacao";
    case "debate-1":
      return "telas-travadas";
    case "explicar":
      return retestaram ? "projecao" : "bancada-liberada";
    case "debate-2":
      return "projecao-pausada";
    case "publicar":
      return resumo.publicaram > 0 ? "relatorio" : "publicacao-liberada";
  }
}

/**
 * A etiqueta do cabeçalho do painel em cada momento (o `[cabeçalho · tag]` do
 * Figma). O Figma escreve "Mediação Handoff 1: 8 Minutos" e "Mediação Handoff
 * 2: 5 Minutos"; "Handoff" é jargão de implementação em inglês (ADR-91) e fica
 * de fora: "Mediação 1: 8 minutos".
 */
export const ETIQUETA_DO_MOMENTO: Record<MomentoDoPainel, string> = {
  inicio: "Etapa 1: Desafiar",
  apostas: "Etapa 3: Apostas",
  simulacao: "Mediação 1: 8 minutos",
  "telas-travadas": "Mediação 1: 8 minutos",
  "bancada-liberada": "Etapa 5 Destravada",
  projecao: "Mediação 2: 5 minutos",
  "projecao-pausada": "Mediação 2: 5 minutos",
  "publicacao-liberada": "Etapa 6 Destravada",
  relatorio: "Etapa 6 Destravada",
};

/**
 * Os botões de cada momento: os da fase, menos os da E5 enquanto a bancada
 * acabou de ser liberada (o E4-PROF-01 "liberado" não tem botão).
 */
export function acoesDoMomento(fase: Fase, momento: MomentoDoPainel): { para: Fase; rotulo: string; variante: VarianteDoBotao }[] {
  if (momento === "bancada-liberada") return [];
  return ACOES_DA_FASE[fase];
}

/** Percentual inteiro, sem divisão por zero. */
export function percentual(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte * 100) / total);
}

/**
 * O "Aviso Discreto" de uma linha (E5-PROF-01): que critério restritivo ela
 * manteve ao avançar. `null` quando não avançou com viés.
 */
export function avisoDiscreto(linha: Pick<LinhaDoPainel, "avancouComVies" | "criterios">): string | null {
  if (!linha.avancouComVies) return null;
  const mantidos: string[] = [];
  if (linha.criterios?.exercicios === "b") mantidos.push("o critério 1B (horário de acesso)");
  if (linha.criterios?.duvidas === "b") mantidos.push("o critério 2B (estabilidade da conexão)");
  return mantidos.length > 0 ? `manteve ${mantidos.join(" e ")}` : "avançou com regra restritiva";
}

/**
 * O que a ficha registra mudou? O painel chama `router.refresh()` quando sim,
 * para o painel de habilidades acompanhar a aula sem F5 (ADR-146). Na
 * exp01em1b as quatro marcas vão no LATCH 2 (a publicação), então a
 * assinatura é quem publicou e com que níveis.
 */
export function mudouAEvidencia(antes: PainelDaTurma, depois: PainelDaTurma): boolean {
  const assinatura = (p: PainelDaTurma) =>
    p.linhas
      .map((l) => `${l.unidadeId}:${l.publicacao ? 1 : 0}:${l.niveis ? `${l.niveis.co20}${l.niveis.co01}${l.niveis.co18}${l.niveis.co03}` : "-"}`)
      .sort()
      .join("|");
  return assinatura(antes) !== assinatura(depois);
}
