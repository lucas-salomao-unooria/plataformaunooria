/**
 * O que o hub lê da exp03em1b (O Porta-Voz dos Dados, ADR-198) — espelho do Zod
 * de `apps/api/src/porta-voz-dos-dados/contrato-de-rotas.ts`, que é a fonte da
 * verdade, e dos vocabulários de `conteudo.ts` e `regras/passos.ts` do mesmo
 * módulo.
 *
 * O espelho é DECLARADO, e `porta-voz-tipos.test.ts` lê os arquivos da api como
 * texto e compara lista por lista: o hub não importa a api.
 *
 * O que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhuma escala, camada nem parecer por estudante.** A linha do painel é
 *   passo e tempo parado; a lousa é só CONTAGEM. O nível de cada estudante mora
 *   no painel de habilidades (`lib/evidencias.ts`).
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle.
 * - **Nenhum podcast do estudante** (decisão 1 do Lucas): o podcast é só do
 *   professor, pela rota da plataforma (`lib/podcast-servidor.ts`).
 *
 * O GABARITO da perícia (o cartão distorcido e o motivo) aparece aqui porque
 * só rota de PROFESSOR o devolve (`GET professor/material`): é o roteiro do guia.
 *
 * Puro: o painel ao vivo e a criação da atividade são client components.
 */

export const EXP_ID = "exp03em1b";

/** Espelho de `api/src/porta-voz-dos-dados/conteudo.ts`: a FGB do EM, Computação e o projeto. */
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

/**
 * O GATE da turma, só para a frente: `exploracao` → `pausa` ("Pausar para o
 * debate") → `liberada` ("Liberar Retomada da Turma": a errata, o laudo e a
 * perícia).
 */
export const ETAPAS_DO_GATE = ["exploracao", "pausa", "liberada"] as const;
export type EtapaDoGate = (typeof ETAPAS_DO_GATE)[number];

export const PASSOS = ["abertura", "dados", "compositor", "feed", "errata", "laudo", "pericia", "concluida"] as const;
export type Passo = (typeof PASSOS)[number];

/** O passo em palavras de sala de aula — a etapa da missão entre parênteses, como o guia a chama. */
export const ROTULO_DO_PASSO: Record<Passo, string> = {
  abertura: "Ainda não abriu o chat",
  dados: "Lendo os dados (Navegar)",
  compositor: "Montando o boletim (Decidir)",
  feed: "No grupo da cidade (Resultado)",
  errata: "Decidindo a errata",
  laudo: "No laudo (Explicar)",
  pericia: "Na perícia técnica",
  concluida: "Concluiu",
};

/** O que o "Regenerar Item" da curadoria refaz (um de cada vez). */
export const ITENS_DO_PACOTE = ["grupo", "servico", "notaTecnica", "camadas", "reacoes", "posAha"] as const;
export type ItemDoPacote = (typeof ITENS_DO_PACOTE)[number];

/** Cada bloco da curadoria — o título do cartão e o que o "Regenerar Item" refaz. */
/**
 * A 4ª camada do compositor, INCORRETA de propósito (v2 do PO, ADR-203): o
 * texto é do servidor, fixo em toda turma, e não passa pela curadoria. Espelho
 * de `conteudo.ts#TEXTO_DA_PROJECAO` da api, conferido no teste.
 */
export const TEXTO_DA_PROJECAO = "Projeção: mantida a tendência, o índice fica abaixo de 80% no próximo período.";

export const ROTULO_DO_ITEM: Record<ItemDoPacote, string> = {
  grupo: "O grupo da cidade",
  servico: "A tabela do serviço público",
  notaTecnica: "A nota técnica anexa",
  camadas: "As três informações corretas do compositor",
  reacoes: "As reações dos moradores",
  posAha: "Depois da publicação da escola rival",
};

export const MOTIVOS_DA_PERICIA = ["escala", "fonte", "titulo"] as const;
export type MotivoDaPericia = (typeof MOTIVOS_DA_PERICIA)[number];

export const ROTULO_DO_MOTIVO: Record<MotivoDaPericia, string> = {
  escala: "Escala",
  fonte: "Fonte",
  titulo: "Título",
};

/** Os tetos do recorte e do pacote (espelho de `conteudo.ts` e do Zod de `contrato-de-rotas.ts`). */
export const TEMA = { min: 3, max: 60 } as const;
export const ASSUNTOS = { min: 3, max: 6, caracteres: 120, total: 600 } as const;
export const CONTEXTO_MAX = 120;
export const MORADORES = 3;
/**
 * Os valores da tabela — FIXOS no servidor (`SERIE_HISTORICA`), nunca da IA. A
 * curadoria os mostra ao lado do período e da situação que o professor edita.
 */
export const VALORES_DA_SERIE = [95, 94, 92, 88] as const;
/** O nome do canal público (TC-02): "Comitê Municipal de Políticas Públicas — {grupo}". */
export const NOME_DO_GRUPO = "Comitê Municipal de Políticas Públicas";

// ─────────────────────────────────────────────────────────────── o pacote

export interface FalaDoGrupo {
  autor: string;
  perfil: string;
  texto: string;
}

/** A ROUPAGEM do pacote (o que a IA escreve e o professor edita). Os números são fixos no servidor. */
export interface ConteudoDoPacote {
  grupo: string;
  servico: {
    orgao: string;
    indicador: string;
    unidade: string;
    abrangencia: string;
    periodicidade: string;
    periodos: string[];
    situacoes: string[];
  };
  notaTecnica: {
    arquivo: string;
    titulo: string;
    orgao: string;
    resumo: string;
    secoes: Array<{ titulo: string; texto: string }>;
  };
  camadas: {
    explicacao: { zero: string; oitenta: string };
    fonte: string;
    contexto: string;
  };
  reacoes: { zero: FalaDoGrupo[]; oitenta: FalaDoGrupo[] };
  posAha: { conflito: FalaDoGrupo; coordenador: FalaDoGrupo };
}

export interface PacoteDoProfessor {
  id: string;
  disciplina: Disciplina;
  tema: string;
  assuntos: string[];
  contexto: string | null;
  origem: Origem;
  conteudo: ConteudoDoPacote;
  /** `null` = rascunho (ainda na curadoria). */
  aprovadoEm: string | null;
  ativo: boolean;
  rodadaAtual: number;
  criadoEm: string;
}

export interface PacoteDetalhe extends PacoteDoProfessor {
  rodadas: number;
}

export interface PadraoDoPacote {
  nome: string;
  disciplina: Disciplina;
  tema: string;
  assuntos: string[];
  conteudo: ConteudoDoPacote;
}

/** API-001 (`GET pacotes`): o rascunho (no máximo um) e os homologados, o em andamento, o banco padrão e os componentes. */
export interface PacotesDaTurmaPortaVoz {
  turma: { id: string; nome: string; serie: string | null };
  emAndamento: { pacoteId: string; rodada: number } | null;
  pacotes: {
    id: string;
    turmaId: string;
    origem: Origem;
    disciplina: Disciplina;
    tema: string;
    ativo: boolean;
    aprovadoEm: string | null;
    criadoEm: string;
    rodadas: number;
  }[];
  padrao: PadraoDoPacote;
  disciplinas: { slug: Disciplina; rotulo: string }[];
}

/** API-002 e o "Regenerar Item": o rascunho gravado, e se a IA escreveu (sem ela, o banco curado ou o item como estava). */
export interface RespostaDoGerar {
  pacote: PacoteDoProfessor;
  usouIa: boolean;
  motivo: "sem-saldo" | "indisponivel" | null;
}

/** API-004: o pacote homologado (não está no ar: isso é o `em-andamento`). */
export interface RespostaDoHomologar {
  pacoteId: string;
  homologadoEm: string;
  pacote: PacoteDoProfessor;
}

/** A resposta de `pacotes/padrao` e de `em-andamento`. */
export interface EmAndamento {
  atividade: { pacoteId: string; rodada: number };
  etapa: EtapaDoGate;
  mudou: boolean;
}

/** A resposta de `POST gate`. */
export interface GateDaTurma {
  etapa: EtapaDoGate;
  atividade: { pacoteId: string; rodada: number };
  atualizadoEm: string;
}

export interface PainelDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  atividade: { pacoteId: string; rodada: number; tema: string; grupo: string } | null;
  etapa: EtapaDoGate | null;
  /** A lousa: só CONTAGENS — sem ranking, sem nível, sem nota individual. */
  resumo: {
    estudantes: number;
    entraram: number;
    porPasso: Record<Passo, number>;
    pausados: number;
    primeiraPublicacao: { escala0: number; escala80: number };
    abriramAnexo: number;
    errata: { publicaram: number; pularam: number };
    pericia: { emitiram: number; pularam: number };
  };
  /** O ritmo, nominal: só o passo e o tempo parado — nunca a escala, a camada nem o parecer de alguém. */
  linhas: { estudanteId: string; nome: string; passo: Passo; segundosInativo: number | null }[];
  roteiro: { perguntas: string[]; instrucoes: { pausar: string; liberar: string } };
}

export interface CartaoDaPericia {
  id: "A" | "B";
  titulo: string;
  partido: string;
  tituloDoGrafico: string;
  eixo: { origem: number; teto: number };
  fonte: string;
}

/** API-005 (`GET professor/material`): o banco padrão, o roteiro, a perícia COM o gabarito e as réguas. */
export interface Material {
  missaoId: "exp03em1b";
  titulo: string;
  padrao: PadraoDoPacote;
  roteiro: PainelDaTurma["roteiro"];
  serie: { valor: number; coletadas: number; conformes: number; inconformes: number }[];
  laudo: { fator: string; variacaoVisual: string; variacaoReal: string; desmontagem: string; fatorDeMentira: string };
  pericia: { cartaoDistorcido: "A" | "B"; motivo: MotivoDaPericia; cartoes: CartaoDaPericia[] };
  habilidades: { codigo: string; rotulo: string; criterios: { atingiu: string; em_processo: string; nao_atingiu: string } }[];
}

// ─────────────────────────────────────────────────────────────── os caminhos

const RAIZ = "/porta-voz-dos-dados";

export function caminhoDaTurma(turmaId: string): string {
  return `${RAIZ}/turmas/${encodeURIComponent(turmaId)}`;
}

/**
 * As rotas da turma que o hub chama, depois de `caminhoDaTurma` — num lugar
 * só, e o teste confere cada uma no controller da api. `em-andamento` é da
 * TURMA (o pacote vai no corpo), não do pacote como nas irmãs.
 */
export const ROTAS_DA_TURMA = {
  pacotes: "/pacotes",
  pacote: (pacoteId: string) => `/pacotes/${encodeURIComponent(pacoteId)}`,
  gerar: "/pacotes/gerar-conteudo",
  padrao: "/pacotes/padrao",
  regenerar: (pacoteId: string) => `/pacotes/${encodeURIComponent(pacoteId)}/regenerar`,
  homologar: (pacoteId: string) => `/pacotes/${encodeURIComponent(pacoteId)}/homologar`,
  emAndamento: "/em-andamento",
  gate: "/gate",
  zerar: "/zerar",
  painel: "/painel",
} as const;

export const CAMINHO_DO_MATERIAL = `${RAIZ}/professor/material`;

// ─────────────────────────────────────────────────────────────── puro

/** A etapa da turma em palavras, para o painel. */
export function rotuloDaEtapa(etapa: EtapaDoGate | null): string {
  if (etapa === "pausa") return "Telas pausadas para o debate";
  if (etapa === "liberada") return "Retomada liberada: errata, laudo e perícia";
  return "Turma explorando os dados";
}

/** O tempo parado da folha: "—" antes de entrar, "45 s", "3 min", "1 h 05 min". */
export function tempoParado(segundos: number | null): string {
  if (segundos === null || segundos < 0) return "—";
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min`;
}

/** A partir de quanto tempo sem jogada a linha ganha a etiqueta de inatividade. */
export const INATIVO_A_PARTIR_DE_SEGUNDOS = 90;

/** Quantos por cento do total, inteiro (0 quando o total é 0). */
export function percentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/**
 * Por que a geração caiu no banco curado — a frase da tela (copy
 * `prof.erro.quota_429` e `prof.erro.falha_503`, literais).
 */
export const AVISO_SEM_IA: Record<"sem-saldo" | "indisponivel", string> = {
  "sem-saldo":
    "Saldo de inteligência artificial esgotado para o período escolar. Selecionamos o banco curado padrão para você liberar a aula imediatamente sem interrupção.",
  indisponivel:
    "O serviço de geração personalizada encontrou instabilidade temporária. Você pode tentar uma nova requisição ou adotar o banco padrão homologado.",
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

/** Os assuntos da aula: um por linha, sem linha vazia. */
export function assuntosDoTexto(texto: string): string[] {
  return texto
    .split(/\n+/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** O recorte é aceitável para a geração (o mesmo Zod da api: tema 3–60, 3 a 6 assuntos, até 600 somados)? */
export function problemasDoRecorte(r: { disciplina: string; tema: string; assuntos: string[]; contexto: string }): string[] {
  const p: string[] = [];
  if (!r.disciplina) p.push("Selecione o componente curricular.");
  const tema = r.tema.trim();
  if (tema.length < TEMA.min || tema.length > TEMA.max) p.push(`O tema precisa ter de ${TEMA.min} a ${TEMA.max} caracteres.`);
  if (r.assuntos.length < ASSUNTOS.min || r.assuntos.length > ASSUNTOS.max) {
    p.push(`Informe entre ${ASSUNTOS.min} e ${ASSUNTOS.max} assuntos, um por linha.`);
  }
  if (r.assuntos.some((a) => a.length < 2 || a.length > ASSUNTOS.caracteres)) {
    p.push(`Cada assunto precisa ter de 2 a ${ASSUNTOS.caracteres} caracteres.`);
  }
  if (r.assuntos.reduce((s, a) => s + a.length, 0) > ASSUNTOS.total) p.push(`Os assuntos somados passam de ${ASSUNTOS.total} caracteres.`);
  if (r.contexto.trim().length > CONTEXTO_MAX) p.push(`O bairro ou território passa de ${CONTEXTO_MAX} caracteres.`);
  return p;
}

/**
 * O "Regenerar Item" devolve o rascunho INTEIRO do servidor, que não tem as
 * edições que o professor fez nos outros blocos (elas só sobem no
 * "Homologar"). Fica o item novo do servidor e o resto da tela, como estava.
 */
export function comItemRegenerado(local: ConteudoDoPacote, servidor: ConteudoDoPacote, item: ItemDoPacote): ConteudoDoPacote {
  return { ...local, [item]: servidor[item] };
}

/**
 * Mudou o que a ficha registra? As marcas saem em três gestos — o publicar
 * (CO13), a decisão da errata (CO12, CO21, CO22, CO26) e a perícia (CO14) —, e
 * o painel da aula chama `router.refresh()` quando esta assinatura muda: o
 * painel de habilidades acompanha a aula sem F5 (ADR-146).
 */
export function assinaturaDaEvidencia(p: Pick<PainelDaTurma, "atividade" | "resumo">): string {
  const r = p.resumo;
  return [
    p.atividade?.pacoteId ?? "",
    p.atividade?.rodada ?? 0,
    r.primeiraPublicacao.escala0 + r.primeiraPublicacao.escala80,
    r.errata.publicaram + r.errata.pularam,
    r.pericia.emitiram + r.pericia.pularam,
  ].join("|");
}

export function mudouAEvidencia(antes: Pick<PainelDaTurma, "atividade" | "resumo">, depois: Pick<PainelDaTurma, "atividade" | "resumo">): boolean {
  return assinaturaDaEvidencia(antes) !== assinaturaDaEvidencia(depois);
}
