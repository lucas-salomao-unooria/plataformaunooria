/**
 * O que o hub lê da exp09ef1b (O Dossiê Invisível, ADR-202) — espelho do Zod
 * de `apps/api/src/dossie-invisivel/contrato-de-rotas.ts`, que é a fonte da
 * verdade, e dos vocabulários de `conteudo.ts` e `regras/passos.ts` do mesmo
 * módulo.
 *
 * O espelho é DECLARADO, e `dossie-invisivel-tipos.test.ts` lê os arquivos da
 * api como texto e compara lista por lista: o hub não importa a api.
 *
 * O que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum voto nem caminho por estudante.** A linha do painel é passo e
 *   tempo parado; a lousa (os votos por projeto, os caminhos A1/A2/B, a
 *   migração) é só CONTAGEM. O nível de cada estudante mora no painel de
 *   habilidades (`lib/evidencias.ts`).
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle.
 * - **Nada da Etapa 6** (o caso Lia e Davi, o módulo bônus de transporte):
 *   saiu da missão (decisão do Lucas de 2026-10-29). A missão termina no
 *   Explicar e no Editor de Protocolo.
 *
 * O GABARITO do protocolo e a conta da virada aparecem aqui porque só rota de
 * PROFESSOR os devolve (`GET professor/material`): são o material do guia.
 *
 * Puro: o painel ao vivo e a criação da atividade são client components.
 */

export const EXP_ID = "exp09ef1b";

/** Espelho de `api/src/dossie-invisivel/conteudo.ts`: os componentes do 9º ano, Computação e o projeto. */
export const DISCIPLINAS = [
  "lingua-portuguesa",
  "arte",
  "educacao-fisica",
  "lingua-inglesa",
  "matematica",
  "ciencias",
  "geografia",
  "historia",
  "ensino-religioso",
  "computacao",
  "interdisciplinar",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

/**
 * O rótulo para o histórico. A api monta o dela a partir de
 * `curriculo/componentes.ts` (e a lista do `Selection` vem de `disciplinas` da
 * resposta); este `Record` exaustivo só nomeia o que já foi gravado.
 */
export const ROTULO_DA_DISCIPLINA: Record<Disciplina, string> = {
  "lingua-portuguesa": "Língua Portuguesa",
  arte: "Arte",
  "educacao-fisica": "Educação Física",
  "lingua-inglesa": "Língua Inglesa",
  matematica: "Matemática",
  ciencias: "Ciências",
  geografia: "Geografia",
  historia: "História",
  "ensino-religioso": "Ensino Religioso",
  computacao: "Computação",
  interdisciplinar: "Projeto Interdisciplinar",
};

export function rotuloDaDisciplina(slug: string): string {
  return (ROTULO_DA_DISCIPLINA as Record<string, string>)[slug] ?? slug;
}

export const ORIGENS = ["ia", "padrao"] as const;
export type Origem = (typeof ORIGENS)[number];

/**
 * O GATE da turma, só para a frente — as TRÊS travas do professor:
 * `exploracao` → `revelacao` ("Liberar Próxima Pauta") → `revoto` ("Abrir
 * Revisão da Decisão", depois do debate) → `explicar` ("Destravar Explicar e
 * Protocolo").
 */
export const ETAPAS_DO_GATE = ["exploracao", "revelacao", "revoto", "explicar"] as const;
export type EtapaDoGate = (typeof ETAPAS_DO_GATE)[number];
export type TravaDoGate = Exclude<EtapaDoGate, "exploracao">;

/** As três travas, na ordem em que o professor as aperta. */
export const TRAVAS: readonly TravaDoGate[] = ["revelacao", "revoto", "explicar"];

/**
 * Os rótulos dos três botões — espelho de `BOTOES_DO_GATE` da api. O painel
 * também os recebe em `roteiro.botoes`, que vence; este é o de reserva, e o
 * teste compara os dois.
 */
export const BOTOES_DO_GATE: Record<TravaDoGate, string> = {
  revelacao: "Liberar Próxima Pauta",
  revoto: "Abrir Revisão da Decisão",
  explicar: "Destravar Explicar e Protocolo",
};

export const PASSOS = ["abertura", "conversa", "espera1", "revelacao", "espera2", "explicar", "concluida"] as const;
export type Passo = (typeof PASSOS)[number];

/** O passo em palavras de sala de aula — a etapa da missão entre parênteses, como o guia a chama. */
export const ROTULO_DO_PASSO: Record<Passo, string> = {
  abertura: "Ainda não começou a análise",
  conversa: "Consultando o assistente e escolhendo",
  espera1: "Escolha registrada, aguardando a próxima pauta",
  revelacao: "Nos cadernos e na tabela de confronto",
  espera2: "Decisão final registrada, aguardando o Explicar",
  explicar: "No Explicar e no Editor de Protocolo",
  concluida: "Concluiu",
};

/** Os PAPÉIS dos projetos — o id que circula. O nome visível é do pacote. */
export const PROJETOS = ["papel", "parcial", "nuvem"] as const;
export type ProjetoId = (typeof PROJETOS)[number];

/** O papel de cada projeto em palavras de professor (o nome visível é do pacote). */
export const ROTULO_DO_PAPEL: Record<ProjetoId, string> = {
  papel: "Papel / Cadernos",
  parcial: "Intermediário",
  nuvem: "PDFs / Nuvem",
};

/** O volume documental de cada papel no repositório digital — fixo no servidor. */
export const DOCUMENTOS_INDEXADOS: Record<ProjetoId, number> = { papel: 1, parcial: 7, nuvem: 12 };

export const CAMINHOS = ["A1", "A2", "B"] as const;
export type Caminho = (typeof CAMINHOS)[number];

/** O caminho da investigação (EF09CO08) em palavras de professor. */
export const ROTULO_DO_CAMINHO: Record<Caminho, string> = {
  A1: "A1 · Perguntou pela lacuna e digitalizou os cadernos",
  A2: "A2 · Perguntou pela lacuna, sem digitalizar",
  B: "B · Não investigou a lacuna",
};

/** O que o "Regenerar item pontual" da curadoria refaz (um de cada vez). */
export const ITENS_DO_PACOTE = ["papel", "parcial", "nuvem", "cadernos"] as const;
export type ItemDoPacote = (typeof ITENS_DO_PACOTE)[number];

export const ROTULO_DO_ITEM: Record<ItemDoPacote, string> = {
  papel: "Projeto em papel · 1 documento indexado",
  parcial: "Projeto com relatórios parciais · 7 documentos",
  nuvem: "Projeto com acervo em nuvem · 12 documentos",
  cadernos: "Os cadernos de campo do projeto em papel",
};

export const BLOCOS = ["auditar-fontes", "normalizar-impacto", "sinalizar-pendencias", "desclassificar-sem-pdf"] as const;
export type BlocoId = (typeof BLOCOS)[number];

/** Os tetos do recorte (espelho de `conteudo.ts` e do Zod de `contrato-de-rotas.ts`). */
export const TEMA = { min: 3, max: 60 } as const;
export const ASSUNTOS = { min: 3, max: 6, caracteres: 120, total: 600 } as const;
export const CONTEXTO_MAX = 120;
/** A verba única e indivisível. */
export const VERBA = 12_000;

/** Os tetos de cada campo do projeto e dos cadernos (o Zod de `ProjetoSchema` e de `cadernos`). */
export const LIMITES_DO_PROJETO = {
  nome: 40,
  coordenador: 30,
  idade: { min: 13, max: 16 },
  vagas: { min: 10, max: 50 },
  custoPorVaga: { min: 100, max: 2_000 },
  card: 120,
  area: 80,
  impacto: 140,
  arquivo: 60,
  resumoDoDocumento: 180,
} as const;
export const LIMITES_DOS_CADERNOS = { amostra: 200, resumo: 240, amostras: 3 } as const;

// ─────────────────────────────────────────────────────────────── o pacote

export interface DocumentoIndexado {
  arquivo: string;
  resumo: string;
}

export interface Projeto {
  nome: string;
  coordenador: string;
  idade: number;
  vagas: number;
  /** R$ por vaga/mês. */
  custoPorVaga: number;
  card: string;
  area: string;
  impacto: string;
  documentos: DocumentoIndexado[];
}

/** A ROUPAGEM do pacote (o que a IA escreve e o professor edita). O mecanismo é fixo no servidor. */
export interface ConteudoDoPacote {
  projetos: Record<ProjetoId, Projeto>;
  cadernos: { arquivo: string; amostras: string[]; resumo: string };
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

/** `GET pacotes`: o rascunho (no máximo um) e os homologados, o em andamento, o banco padrão e os componentes. */
export interface PacotesDaTurmaDossie {
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

/** `gerar-conteudo` e o "Regenerar item pontual": o rascunho gravado, e se a IA escreveu. */
export interface RespostaDoGerar {
  pacote: PacoteDoProfessor;
  usouIa: boolean;
  motivo: "sem-saldo" | "indisponivel" | null;
}

/** `homologar` ("Aprovar Pacote"): o pacote homologado (não está no ar: isso é o `em-andamento`). */
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

export type PorProjeto = Record<ProjetoId, number>;

export interface PainelDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  /** `projetos`: o nome visível de cada papel no pacote em andamento. */
  atividade: { pacoteId: string; rodada: number; tema: string; projetos: Record<ProjetoId, string> } | null;
  etapa: EtapaDoGate | null;
  /** A lousa: só CONTAGENS — sem ranking, sem nível, sem nota individual. */
  resumo: {
    estudantes: number;
    entraram: number;
    porPasso: Record<Passo, number>;
    caminhos: Record<Caminho, number>;
    escolhaInicial: PorProjeto;
    escolhaFinal: PorProjeto;
    /** Quem trocou foi PARA ONDE (o "migraram para" do protótipo E5-PROF-01). */
    migracao: { mantiveram: number; trocaram: number; para: PorProjeto };
    protocolosEnviados: number;
  };
  /** O ritmo, nominal: só o passo e o tempo parado — nunca o voto nem o caminho de alguém. */
  linhas: { estudanteId: string; nome: string; passo: Passo; segundosInativo: number | null }[];
  roteiro: { perguntas: string[]; botoes: Record<TravaDoGate, string> };
}

/** `GET professor/material`: o banco padrão, o roteiro, a conta da virada, o gabarito do protocolo e as réguas. */
export interface Material {
  missaoId: "exp09ef1b";
  titulo: string;
  padrao: PadraoDoPacote;
  roteiro: PainelDaTurma["roteiro"];
  virada: {
    antes: { projeto: ProjetoId; indice: number }[];
    depois: { projeto: ProjetoId; indice: number }[];
  };
  protocolo: { gabarito: BlocoId[]; danoso: BlocoId; rotulos: Record<BlocoId, string> };
  habilidades: { codigo: string; rotulo: string; criterios: { atingiu: string; em_processo: string; nao_atingiu: string } }[];
}

// ─────────────────────────────────────────────────────────────── os caminhos

const RAIZ = "/dossie-invisivel";

export function caminhoDaTurma(turmaId: string): string {
  return `${RAIZ}/turmas/${encodeURIComponent(turmaId)}`;
}

/**
 * As rotas da turma que o hub chama, depois de `caminhoDaTurma` — num lugar
 * só, e o teste confere cada uma no controller da api. `em-andamento` é da
 * TURMA (o pacote vai no corpo), como na exp03em1b.
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
  if (etapa === "revelacao") return "Próxima pauta liberada: cadernos e tabela de confronto";
  if (etapa === "revoto") return "Revisão da decisão aberta: o segundo voto";
  if (etapa === "explicar") return "Explicar e Editor de Protocolo destravados";
  return "Turma consultando o assistente e registrando a escolha";
}

/**
 * A próxima trava que o professor pode apertar — só para a frente, uma de
 * cada vez. `null` quando as três já foram.
 */
export function proximaTrava(etapa: EtapaDoGate | null): TravaDoGate | null {
  const i = ETAPAS_DO_GATE.indexOf(etapa ?? "exploracao");
  return (ETAPAS_DO_GATE[i + 1] as TravaDoGate | undefined) ?? null;
}

/** A trava já foi apertada? */
export function travaFeita(etapa: EtapaDoGate | null, trava: TravaDoGate): boolean {
  return ETAPAS_DO_GATE.indexOf(etapa ?? "exploracao") >= ETAPAS_DO_GATE.indexOf(trava);
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

export function somaPorProjeto(p: PorProjeto): number {
  return PROJETOS.reduce((s, projeto) => s + p[projeto], 0);
}

/**
 * Por que a geração caiu no banco padrão — a frase da tela (copy
 * `feedback_geracao.status_fallback_429` e `status_falha_503`, literais).
 */
export const AVISO_SEM_IA: Record<"sem-saldo" | "indisponivel", string> = {
  "sem-saldo":
    "Cota de processamento temporariamente indisponível. O sistema ativou automaticamente o banco curado padrão para não interromper a aula.",
  indisponivel: "Instabilidade no provedor de inteligência artificial. Clique para tentar novamente ou utilize o banco padrão.",
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

/** Os assuntos da aula: um por linha ou separados por vírgula, sem item vazio. */
export function assuntosDoTexto(texto: string): string[] {
  return texto
    .split(/[\n,;]+/)
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
    p.push(`Insira de ${ASSUNTOS.min} a ${ASSUNTOS.max} assuntos.`);
  }
  if (r.assuntos.some((a) => a.length < 2 || a.length > ASSUNTOS.caracteres)) {
    p.push(`Cada assunto precisa ter de 2 a ${ASSUNTOS.caracteres} caracteres.`);
  }
  if (r.assuntos.reduce((s, a) => s + a.length, 0) > ASSUNTOS.total) p.push(`Os assuntos somados passam de ${ASSUNTOS.total} caracteres.`);
  if (r.contexto.trim().length > CONTEXTO_MAX) p.push(`O contexto comunitário passa de ${CONTEXTO_MAX} caracteres.`);
  return p;
}

/**
 * O "Regenerar item pontual" devolve o rascunho INTEIRO do servidor, que não
 * tem as edições que o professor fez nos outros itens (elas só sobem no
 * "Aprovar Pacote"). Fica o item novo do servidor e o resto da tela, como estava.
 */
export function comItemRegenerado(local: ConteudoDoPacote, servidor: ConteudoDoPacote, item: ItemDoPacote): ConteudoDoPacote {
  if (item === "cadernos") return { ...local, cadernos: servidor.cadernos };
  return { ...local, projetos: { ...local.projetos, [item]: servidor.projetos[item] } };
}

function parteDoItem(c: ConteudoDoPacote, item: ItemDoPacote): unknown {
  return item === "cadernos" ? c.cadernos : c.projetos[item];
}

/**
 * Os itens que o professor mexeu desde que o servidor os entregou — a etiqueta
 * "Modificado pelo docente" da curadoria (copy `curadoria_pacote.tag_modificado`).
 */
export function itensModificados(original: ConteudoDoPacote, atual: ConteudoDoPacote): ItemDoPacote[] {
  return ITENS_DO_PACOTE.filter((item) => JSON.stringify(parteDoItem(original, item)) !== JSON.stringify(parteDoItem(atual, item)));
}

/**
 * Mudou o que a ficha registra? As marcas saem em três gestos — o "Registrar
 * Decisão" e o "Confirmar Decisão Final" (EF09CO08) e o "Enviar Proposta"
 * (EF09CO07) —, e o painel da aula chama `router.refresh()` quando esta
 * assinatura muda: o painel de habilidades acompanha a aula sem F5 (ADR-146).
 */
export function assinaturaDaEvidencia(p: Pick<PainelDaTurma, "atividade" | "resumo">): string {
  const r = p.resumo;
  return [
    p.atividade?.pacoteId ?? "",
    p.atividade?.rodada ?? 0,
    somaPorProjeto(r.escolhaInicial),
    somaPorProjeto(r.escolhaFinal),
    r.protocolosEnviados,
  ].join("|");
}

export function mudouAEvidencia(antes: Pick<PainelDaTurma, "atividade" | "resumo">, depois: Pick<PainelDaTurma, "atividade" | "resumo">): boolean {
  return assinaturaDaEvidencia(antes) !== assinaturaDaEvidencia(depois);
}
