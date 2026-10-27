/**
 * O que o hub lê da exp02em1b (O Efeito Amplificador, ADR-181) — espelho do Zod
 * de `apps/api/src/efeito-amplificador/contrato-de-rotas.ts`, que é a fonte da
 * verdade, e dos vocabulários de `conteudo.ts` do mesmo módulo.
 *
 * O espelho é DECLARADO, e `efeito-amplificador-tipos.test.ts` lê os arquivos
 * da api como texto e compara lista por lista: o hub não importa a api.
 *
 * O que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum nível por estudante nem o chat dele.** A linha do painel é passo e
 *   manchete; o nível mora no painel de habilidades (`lib/evidencias.ts`), e o
 *   que o estudante escreveu ao UnooriaAI é texto de menor e não sai da api.
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle.
 *
 * O GABARITO (o nó de cada parágrafo, a categoria de cada comentário e o
 * `comprova` dos indicadores) aparece aqui porque só rota de PROFESSOR o
 * devolve: é o roteiro da curadoria e do guia.
 *
 * Puro: o painel ao vivo e a criação da atividade são client components.
 */

export const EXP_ID = "exp02em1b";

/** Espelho de `api/src/efeito-amplificador/conteudo.ts`: a FGB da 2ª série, Computação e o projeto. */
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
  "interdisciplinar",
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
  interdisciplinar: "Projeto Interdisciplinar",
};

export function rotuloDaDisciplina(slug: string): string {
  return (ROTULO_DA_DISCIPLINA as Record<string, string>)[slug] ?? slug;
}

export const ORIGENS = ["ia", "padrao"] as const;
export type Origem = (typeof ORIGENS)[number];

export const NOS = ["alucinacao", "plagio", "lgpd"] as const;
export type No = (typeof NOS)[number];

export const ROTULO_DO_NO: Record<No, string> = {
  alucinacao: "Dado inventado (EM13CO14)",
  plagio: "Trecho copiado sem crédito (EM13CO26)",
  lgpd: "Colega exposto — LGPD (EM13CO26)",
};

export const MANCHETES = ["neutra", "construtiva", "sensacionalista"] as const;
export type Manchete = (typeof MANCHETES)[number];

export const ROTULO_DA_MANCHETE: Record<Manchete, string> = {
  neutra: "Neutra",
  construtiva: "Construtiva",
  sensacionalista: "Sensacionalista",
};

export const TIPOS_DE_COMENTARIO = ["saude_fisica", "saude_mental", "risco_seguranca", "neutro"] as const;
export type TipoDeComentario = (typeof TIPOS_DE_COMENTARIO)[number];

export const ROTULO_DO_TIPO: Record<TipoDeComentario, string> = {
  saude_fisica: "Saúde física",
  saude_mental: "Saúde mental",
  risco_seguranca: "Conta invasiva",
  neutro: "Neutro",
};

export const FASES = ["aberta", "debate", "explicar"] as const;
export type Fase = (typeof FASES)[number];

export const PASSOS = ["abertura", "conversa", "feed", "explicar", "concluida"] as const;
export type Passo = (typeof PASSOS)[number];

export const ROTULO_DO_PASSO: Record<Passo, string> = {
  abertura: "Ainda não entrou",
  conversa: "No UnooriaAI",
  feed: "No feed da madrugada",
  explicar: "Nos bastidores (Etapa 5)",
  concluida: "Concluiu",
};

// ─────────────────────────────────────────────────────────────── o pacote

export interface ParagrafoDoRascunho {
  id: string;
  no: No | null;
  texto: string;
  corrigido?: string;
}

export interface ComentarioDoFeed {
  id: string;
  autor: string;
  handle: string;
  horario: string;
  tipo: TipoDeComentario;
  texto: string;
}

export interface ConteudoDoPacote {
  rascunho: ParagrafoDoRascunho[];
  fonteInventada: string;
  colega: string;
  veiculo: string;
  recorte: string;
  manchetes: Record<Manchete, string>;
  comentarios: ComentarioDoFeed[];
}

export interface PacoteDoProfessor {
  id: string;
  disciplina: Disciplina;
  tema: string;
  assuntos: string[];
  contexto: string | null;
  origem: Origem;
  conteudo: ConteudoDoPacote;
  aprovadoEm: string | null;
  ativo: boolean;
  rodadaAtual: number;
}

export interface PacoteDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  ativo: PacoteDoProfessor | null;
  rascunho: PacoteDoProfessor | null;
  padrao: { nome: string; disciplina: Disciplina; tema: string; assuntos: string[]; conteudo: ConteudoDoPacote };
  disciplinas: { slug: Disciplina; rotulo: string }[];
}

export interface RespostaDoGerar {
  rascunho: PacoteDoProfessor;
  usouIa: boolean;
  motivo: "sem-saldo" | "indisponivel" | null;
}

export interface PacotesDaTurmaEfeito {
  emAndamento: { pacoteId: string; rodada: number } | null;
  historico: { id: string; disciplina: Disciplina; tema: string; origem: Origem; ativo: boolean; aprovadoEm: string; rodadas: number }[];
}

export interface PacoteDetalhe extends PacoteDoProfessor {
  rodadas: number;
}

export interface EmAndamento {
  atividade: { pacoteId: string; rodada: number };
  fase: Fase;
  mudou: boolean;
}

export interface PainelDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  atividade: { pacoteId: string; rodada: number; tema: string } | null;
  fase: Fase | null;
  porComputador: boolean;
  resumo: {
    unidades: number;
    publicaram: number;
    picoNaMadrugada: number;
    manchetes: Record<Manchete, number>;
    entrega: { faixa: string; percentual: number }[];
  };
  linhas: {
    estudanteId: string;
    nome: string;
    equipe: { id: string; nome: string; membros: { id: string; nome: string }[] } | null;
    passo: Passo;
    manchete: Manchete | null;
  }[];
  roteiro: { perguntas: string[]; instrucoes: { pausar: string; liberar: string } };
}

export interface Material {
  padrao: PacoteDaTurma["padrao"];
  roteiro: PainelDaTurma["roteiro"];
  indicadores: { id: string; rotulo: string; comprova: boolean }[];
  habilidades: { codigo: string; rotulo: string; criterios: { atingiu: string; em_processo: string; nao_atingiu: string } }[];
}

// ─────────────────────────────────────────────────────────────── os caminhos

export function caminhoDaTurma(turmaId: string): string {
  return `/efeito-amplificador/turmas/${encodeURIComponent(turmaId)}`;
}
export const CAMINHO_DO_MATERIAL = "/efeito-amplificador/professor/material";

// ─────────────────────────────────────────────────────────────── puro

/** A fase em palavras, para o painel. */
export function rotuloDaFase(fase: Fase | null): string {
  if (fase === "debate") return "Telas pausadas para o debate";
  if (fase === "explicar") return "Etapa 5 liberada";
  return "Em andamento";
}

/** O percentual das publicações com pico de madrugada — 100% sempre que alguém publicou (é a lousa do desmonte da culpa). */
export function percentualNaMadrugada(r: PainelDaTurma["resumo"]): number | null {
  return r.publicaram > 0 ? Math.round((r.picoNaMadrugada / r.publicaram) * 100) : null;
}

/** Por que o rascunho saiu do banco curado — a frase da tela (copy `e0.erro.quota_429`). */
export const AVISO_SEM_IA: Record<"sem-saldo" | "indisponivel", { titulo: string; descricao: string }> = {
  "sem-saldo": {
    titulo: "Limite de cota de inteligência artificial atingido",
    descricao: "Limite de cota de inteligência artificial atingido para sua escola. Use o Banco Curado Padrão para aplicar a missão agora sem custos.",
  },
  indisponivel: {
    titulo: "Geração com IA indisponível agora",
    descricao: "O serviço de geração está instável. O Banco Curado Padrão foi carregado para não atrasar a aula.",
  },
};

/** A mensagem e a lista `erros` de uma recusa da api (a homologação devolve TODAS as frases da régua). */
export function erroDaApi(corpo: unknown, padrao: string): { mensagem: string; erros: string[] } {
  if (!corpo || typeof corpo !== "object") return { mensagem: padrao, erros: [] };
  const { mensagem, erros } = corpo as { mensagem?: unknown; erros?: unknown };
  return {
    mensagem: typeof mensagem === "string" && mensagem ? mensagem : padrao,
    erros: Array.isArray(erros) ? erros.filter((e): e is string => typeof e === "string") : [],
  };
}

/** Os tópicos da aula: um por linha, sem linha vazia. */
export function topicosDoTexto(texto: string): string[] {
  return texto
    .split(/\n+/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** O recorte é aceitável para a geração (o mesmo Zod da api: tema 3–60, 3 a 6 tópicos, até 600 somados)? */
export function problemasDoRecorte(r: { disciplina: string; tema: string; topicos: string[]; contexto: string }): string[] {
  const p: string[] = [];
  if (!r.disciplina) p.push("Selecione o componente curricular.");
  const tema = r.tema.trim();
  if (tema.length < 3 || tema.length > 60) p.push("O tema precisa ter de 3 a 60 caracteres.");
  if (r.topicos.length < 3 || r.topicos.length > 6) p.push("Informe entre 3 e 6 tópicos, um por linha.");
  if (r.topicos.some((t) => t.length < 2 || t.length > 120)) p.push("Cada tópico precisa ter de 2 a 120 caracteres.");
  if (r.topicos.join("").length > 600) p.push("Os tópicos somados passam de 600 caracteres.");
  if (r.contexto.trim().length > 120) p.push("O contexto local passa de 120 caracteres.");
  return p;
}
