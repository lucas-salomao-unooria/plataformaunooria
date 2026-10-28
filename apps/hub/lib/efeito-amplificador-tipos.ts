/**
 * O que o hub lê da exp02em1b (O Efeito Amplificador 2.1.0, ADR-191) — espelho do Zod
 * de `apps/api/src/efeito-amplificador/contrato-de-rotas.ts`, que é a fonte da
 * verdade, e dos vocabulários de `conteudo.ts` do mesmo módulo.
 *
 * O espelho é DECLARADO, e `efeito-amplificador-tipos.test.ts` lê os arquivos
 * da api como texto e compara lista por lista: o hub não importa a api.
 *
 * O que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum nível por estudante nem o chat dele.** A linha do painel é passo,
 *   manchete e tempo parado; a matriz do painel é só CONTAGEM por nível; o
 *   nível de cada estudante mora no painel de habilidades (`lib/evidencias.ts`),
 *   e o que o estudante escreveu ao UnooriaAI é texto de menor e não sai da api.
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle.
 *
 * O GABARITO (o nó de cada parágrafo e a categoria de cada comentário)
 * aparece aqui porque só rota de PROFESSOR o devolve: é o roteiro da curadoria
 * e do guia.
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

/** As etiquetas dos três nós na curadoria (copy `prof.curadoria.tag_*`, literal). */
export const ROTULO_DO_NO: Record<No, string> = {
  alucinacao: "Nó 1: Fato x Alucinação",
  plagio: "Nó 2: Direito Autoral",
  lgpd: "Nó 3: Privacidade / LGPD",
};

/** A habilidade que cada nó mede — o que o professor procura no rascunho. */
export const HABILIDADE_DO_NO: Record<No, string> = {
  alucinacao: "EM13CO14",
  plagio: "EM13CO26",
  lgpd: "EM13CO26",
};

export const MANCHETES = ["neutra", "construtiva", "sensacionalista"] as const;
export type Manchete = (typeof MANCHETES)[number];

export const ROTULO_DA_MANCHETE: Record<Manchete, string> = {
  neutra: "Neutra",
  construtiva: "Construtiva",
  sensacionalista: "Sensacionalista",
};

/**
 * A categoria de cada comentário da madrugada — GABARITO (não desce ao
 * estudante). O pacote precisa de dois de saúde física, um de saúde mental e
 * duas contas anônimas agressivas (`MINIMOS_DOS_COMENTARIOS`).
 */
export const TIPOS_DE_COMENTARIO = ["saude_fisica", "saude_mental", "anonimo_agressivo", "engajamento"] as const;
export type TipoDeComentario = (typeof TIPOS_DE_COMENTARIO)[number];

export const ROTULO_DO_TIPO: Record<TipoDeComentario, string> = {
  saude_fisica: "Saúde física",
  saude_mental: "Saúde mental",
  anonimo_agressivo: "Conta anônima agressiva",
  engajamento: "Engajamento",
};

/** O mínimo de cada categoria que a régua da api cobra (espelho de `regras/pacote.ts`). */
export const MINIMOS_DOS_COMENTARIOS: Readonly<Partial<Record<TipoDeComentario, number>>> = {
  saude_fisica: 2,
  saude_mental: 1,
  anonimo_agressivo: 2,
};

/**
 * O GATE da turma (o `etapa` do contrato), que só anda para a frente:
 * `exploracao` → `pausa` ("Pausar Telas para Debate") → `explicar` ("Avançar
 * Turma para Explicar"). O nome da lista é o da api (`FASES` em `conteudo.ts`).
 */
export const FASES = ["exploracao", "pausa", "explicar"] as const;
export type Fase = (typeof FASES)[number];

export const PASSOS = ["abertura", "conversa", "feed", "explicar", "concluida"] as const;
export type Passo = (typeof PASSOS)[number];

export const ROTULO_DO_PASSO: Record<Passo, string> = {
  abertura: "Ainda não entrou",
  conversa: "No UnooriaAI",
  feed: "No feed da madrugada",
  explicar: "Nos bastidores (Explicar)",
  concluida: "Concluiu",
};

/** Os tetos do pacote (espelho de `conteudo.ts`). */
export const PAUTA = { titulo: 80, descricao: 250, orientacao: 120, orientacoes: { min: 2, max: 4 } } as const;
export const COMENTARIOS_POR_PACOTE = 6;
export const MANCHETE_MAX_CARACTERES = 80;

/** As faixas da madrugada (01h00–03h59): o pico que a Distribuição Horária Coletiva destaca. */
export const FAIXAS_DA_MADRUGADA: readonly string[] = ["01h–02h", "02h–03h", "03h–04h"];

/** As quatro habilidades da Matriz Consolidada de Evidências, na ordem da copy (`prof.painel.matriz_bncc`). */
export const HABILIDADES_DA_MATRIZ = ["EM13CO24", "EM13CO14", "EM13CO26", "EM13CO08"] as const;
export type HabilidadeDaMatriz = (typeof HABILIDADES_DA_MATRIZ)[number];

export const ROTULO_DA_HABILIDADE: Record<HabilidadeDaMatriz, string> = {
  EM13CO24: "EM13CO24 (Saúde)",
  EM13CO14: "EM13CO14 (Fontes)",
  EM13CO26: "EM13CO26 (Direito digital)",
  EM13CO08: "EM13CO08 (Segurança)",
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
  /** O nome que o feed mostra — de colega ("Clara") ou de conta ("user_89412"). */
  autor: string;
  /** "02h40", entre 01h00 e 03h30. */
  horario: string;
  tipo: TipoDeComentario;
  texto: string;
}

export interface PautaDoGremio {
  titulo: string;
  descricao: string;
  orientacoes: string[];
}

export interface ConteudoDoPacote {
  pauta: PautaDoGremio;
  rascunho: ParagrafoDoRascunho[];
  fonteInventada: string;
  colega: string;
  /** A autoria do trecho copiado sem crédito. */
  fonteOriginal: string;
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

/** A resposta de `banco-padrao` e de `pacotes/:id/em-andamento`. */
export interface EmAndamento {
  atividade: { pacoteId: string; rodada: number };
  etapa: Fase;
  mudou: boolean;
}

/** A resposta de `POST gate`. */
export interface GateDaTurma {
  etapa: Fase;
  atividade: { pacoteId: string; rodada: number };
  atualizadoEm: string;
}

export interface ContagemDeNiveis {
  atingiu: number;
  em_processo: number;
  nao_atingiu: number;
}

export interface PainelDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  atividade: { pacoteId: string; rodada: number; tema: string } | null;
  etapa: Fase | null;
  porComputador: boolean;
  /** A lousa: só AGREGADOS, nenhum nome. */
  resumo: {
    unidades: number;
    publicaram: number;
    manchetes: Record<Manchete, number>;
    entrega: { faixa: string; impressoes: number }[];
    percentualNoturno: number;
    matriz: Record<HabilidadeDaMatriz, ContagemDeNiveis>;
  };
  /** Monitor de Ritmo e Inatividade: nominal, só o passo, a manchete e o tempo parado. */
  linhas: {
    estudanteId: string;
    nome: string;
    equipe: { id: string; nome: string; membros: { id: string; nome: string }[] } | null;
    passo: Passo;
    manchete: Manchete | null;
    /** Segundos desde a última jogada (`null` antes de entrar). */
    segundosInativo: number | null;
  }[];
  roteiro: { perguntas: string[]; instrucoes: { pausar: string; liberar: string } };
}

export interface Material {
  padrao: PacoteDaTurma["padrao"];
  roteiro: PainelDaTurma["roteiro"];
  /** Os dois cartões dos bastidores — os dois revelam o critério da rede (sem distrator). */
  indicadores: { id: string; rotulo: string; texto: string }[];
  habilidades: { codigo: string; rotulo: string; criterios: { atingiu: string; em_processo: string; nao_atingiu: string } }[];
}

// ─────────────────────────────────────────────────────────────── os caminhos

export function caminhoDaTurma(turmaId: string): string {
  return `/efeito-amplificador/turmas/${encodeURIComponent(turmaId)}`;
}
export const CAMINHO_DO_MATERIAL = "/efeito-amplificador/professor/material";

// ─────────────────────────────────────────────────────────────── puro

/** A etapa da turma em palavras, para o painel. */
export function rotuloDaEtapa(etapa: Fase | null): string {
  if (etapa === "pausa") return "Telas pausadas para o debate";
  if (etapa === "explicar") return "Turma no Explicar";
  return "Turma em exploração";
}

/** O tempo parado do Monitor de Ritmo: "—" antes de entrar, "45 s", "3 min", "1 h 05 min". */
export function tempoParado(segundos: number | null): string {
  if (segundos === null || segundos < 0) return "—";
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min`;
}

/** A partir de quanto tempo sem jogada a linha ganha a etiqueta de inatividade (o mesmo minuto da dica da tela). */
export const INATIVO_A_PARTIR_DE_SEGUNDOS = 60;

/** "02h40" — entre 01h00 e 03h30 (a mesma conta de `regras/pacote.ts#horarioDeMadrugada`). */
export function horarioDeMadrugada(h: string): boolean {
  const m = /^(\d{2})h(\d{2})$/.exec(h.trim());
  if (!m) return false;
  const minutos = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) <= 59 && minutos >= 60 && minutos <= 210;
}

/** Quantos por cento do total, inteiro (0 quando o total é 0). */
export function percentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/**
 * Por que o rascunho saiu do banco curado — a frase da tela (copy
 * `prof.gerando.erro_cota` e `prof.gerando.falha_generica`, literais).
 */
export const AVISO_SEM_IA: Record<"sem-saldo" | "indisponivel", string> = {
  "sem-saldo": "Cota de IA em espera. Atividade liberada imediatamente utilizando o pacote curado oficial.",
  indisponivel: "Falha temporária na geração. Carregando pacote curado padrão para não interromper a aula.",
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
