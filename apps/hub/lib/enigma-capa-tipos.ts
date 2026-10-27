/**
 * O que o hub lê da exp02ef1b (O Enigma da Capa da Rádio, ADR-184; revisão
 * 2.0.0, ADR-186) — espelho do
 * Zod de `apps/api/src/enigma-capa/contrato-de-rotas.ts`, que é a fonte da
 * verdade, e dos vocabulários de `conteudo.ts` e `regras/passos.ts` do mesmo
 * módulo.
 *
 * O espelho é DECLARADO, e `enigma-capa-tipos.test.ts` lê os arquivos da api
 * como texto e compara lista por lista: o hub não importa a api.
 *
 * O que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum nível por estudante.** A linha do painel é o que a criança FEZ
 *   (lupa, capa, invariantes, o que marcou fora, par, segunda foto), pelo
 *   NOME; o nível mora no painel de habilidades (`lib/evidencias.ts`).
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle.
 *
 * O GABARITO (núcleo, fala da visitante, selo coerente, alvos dos invariantes,
 * marcáveis) aparece aqui porque só rota de PROFESSOR o devolve: é o roteiro da
 * curadoria e do guia.
 *
 * Puro: o painel ao vivo e a criação da atividade são client components.
 */

export const EXP_ID = "exp02ef1b";

// ─────────────────────────────────────────────────────────────── vocabulários

/**
 * O componente curricular do recorte. A LISTA que a tela oferece vem da api
 * (`disciplinas` do material e do pacote da turma: todos os do 2º ano, mais
 * Computação e "Outro componente"), e quem valida o slug é o Zod de lá — por
 * isso o tipo é `string`. O rótulo abaixo só serve para nomear o componente de
 * uma atividade JÁ gravada (o histórico, a página da atividade);
 * `enigma-capa-tipos.test.ts` confere as chaves contra o `DISCIPLINAS` da api.
 */
export type Disciplina = string;

export const ROTULO_DA_DISCIPLINA: Readonly<Record<string, string>> = {
  "lingua-portuguesa": "Língua Portuguesa",
  arte: "Arte",
  "educacao-fisica": "Educação Física",
  matematica: "Matemática",
  ciencias: "Ciências",
  geografia: "Geografia",
  historia: "História",
  "ensino-religioso": "Ensino Religioso",
  computacao: "Computação",
  outra: "Outro componente",
};

export function rotuloDaDisciplina(slug: string): string {
  return ROTULO_DA_DISCIPLINA[slug] ?? slug;
}

export const ORIGENS = ["padrao", "ia"] as const;
export type Origem = (typeof ORIGENS)[number];

export const CHAVES_DE_CENA = ["biblioteca", "horta", "museu", "ia"] as const;
export type ChaveDeCena = (typeof CHAVES_DE_CENA)[number];
export const CHAVES_PRONTAS = ["biblioteca", "horta", "museu"] as const;
export type ChavePronta = (typeof CHAVES_PRONTAS)[number];

export const FASES = ["aberta", "virada"] as const;
export type Fase = (typeof FASES)[number];

export const FOTOS = ["foto-1", "foto-2"] as const;
export type FotoId = (typeof FOTOS)[number];
export const SELOS = ["selo-1", "selo-2"] as const;
export type SeloId = (typeof SELOS)[number];
export const INVARIANTES = ["inv-1", "inv-2"] as const;
export type InvarianteId = (typeof INVARIANTES)[number];

export const MOTIVOS_DO_PAR = ["atividade", "roupa"] as const;
export type MotivoDoPar = (typeof MOTIVOS_DO_PAR)[number];
export const ROTULO_DO_MOTIVO: Record<MotivoDoPar, string> = { atividade: "A atividade", roupa: "A cor da roupa" };

export const ELEMENTOS_DA_SEGUNDA_FOTO = ["mochila", "parede", "crianca-lendo"] as const;
export type ElementoDaSegundaFoto = (typeof ELEMENTOS_DA_SEGUNDA_FOTO)[number];
export const ROTULO_DO_ELEMENTO: Record<ElementoDaSegundaFoto, string> = {
  mochila: "Mochila",
  parede: "Parede",
  "crianca-lendo": "Criança lendo",
};

export const PASSOS = [
  "inicio",
  "lupa",
  "decidir",
  "feed",
  "invariantes",
  "slider",
  "fora",
  "pares",
  "segunda-foto",
  "concluida",
] as const;
export type Passo = (typeof PASSOS)[number];

/** O passo em palavras do professor (E1…E5), para a folha. */
export const ROTULO_DO_PASSO: Record<Passo, string> = {
  inicio: "No card da missão (E1)",
  lupa: "Na lupa (E2)",
  decidir: "Montando a capa (E3)",
  feed: "Capa publicada",
  invariantes: "Procurando as 2 coisas iguais (E4)",
  slider: "Comparando com a cena inteira (E4)",
  fora: "Marcando o que ficou fora (E4)",
  pares: "Juntando os pares (E5)",
  "segunda-foto": "Na segunda foto (E5)",
  concluida: "Concluiu",
};

/** Os tetos do recorte (o mesmo Zod da api: `TEMA`, `PALAVRAS`, `NOTA_MAX`). */
export const TEMA = { min: 3, max: 60 } as const;
export const PALAVRAS = { min: 3, max: 6, maxCaracteres: 20 } as const;
export const NOTA_MAX = 200;

// ─────────────────────────────────────────────────────────────── a geometria

/** Retângulo em 0–100 da PANORÂMICA 16:9 (x em % da largura, y em % da altura). */
export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Alvo circular: centro na panorâmica, raio em % da LARGURA. */
export interface Alvo {
  x: number;
  y: number;
  r: number;
}

/**
 * As duas molduras da panorâmica — as fotos são recortes FIXOS dela, em todo
 * pacote (espelho de `RECORTE_DA_FOTO` da api). A faixa comum é onde os dois
 * objetos iguais precisam morar.
 */
export const RECORTE_DA_FOTO: Record<FotoId, Retangulo> = {
  "foto-1": { x: 0, y: 0, w: 68, h: 100 },
  "foto-2": { x: 32, y: 0, w: 68, h: 100 },
};
export const FAIXA_COMUM = { de: 32, ate: 68 } as const;
export const PROPORCAO_DA_PANORAMICA = 16 / 9;
export const RAIO_PADRAO = 7;

// ─────────────────────────────────────────────────────────────── o pacote

export type ImagemDaCena = { tipo: "bundle"; nome: string } | { tipo: "url"; url: string };

export interface FotoDaCena {
  id: FotoId;
  recorte: Retangulo;
  nucleo: Retangulo;
  acao: string;
  visitante: string;
  seloCoerente: SeloId;
}

export interface SeloDaCena {
  id: SeloId;
  texto: string;
  emoji: string;
}

export interface InvarianteDaCena {
  id: InvarianteId;
  nome: string;
  alvo: Alvo | null;
}

export interface ConteudoDoPacote {
  versao: 1;
  cena: {
    chave: ChaveDeCena;
    espaco: string;
    espacoCurto: string;
    hora: string;
    imagem: ImagemDaCena;
    alt: string;
    fotos: FotoDaCena[];
    selos: SeloDaCena[];
    invariantes: InvarianteDaCena[];
    fundo: Retangulo;
    marcaveis: { id: string; nome: string; area: Retangulo }[];
  };
}

export interface PacoteDoProfessor {
  id: string;
  disciplina: Disciplina;
  tema: string;
  palavras: string[];
  nota: string | null;
  chaveDaCena: ChaveDeCena;
  origem: Origem;
  conteudo: ConteudoDoPacote;
  aprovadoEm: string | null;
  ativo: boolean;
  rodadaAtual: number;
  /** Para o rascunho: o que ainda falta para aprovar (vazio = pode aprovar). */
  pendencias: string[];
}

export interface PacotePronto {
  chave: ChavePronta;
  nome: string;
  disciplina: Disciplina;
  tema: string;
  conteudo: ConteudoDoPacote;
}

/** `GET …/turmas/:turmaId/pacote`. */
export interface PacoteDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  ativo: PacoteDoProfessor | null;
  rascunho: PacoteDoProfessor | null;
  prontos: PacotePronto[];
  disciplinas: { slug: Disciplina; rotulo: string }[];
}

/** `GET …/turmas/:turmaId/rascunho`. */
export interface RascunhoDaTurma {
  rascunho: PacoteDoProfessor | null;
}

/** `POST …/turmas/:turmaId/gerar-conteudo`. */
export interface RespostaDoGerar {
  rascunho: PacoteDoProfessor;
  usouIa: boolean;
  motivo: "sem-saldo" | "indisponivel" | null;
}

export interface AtividadeDaTurma {
  pacoteId: string;
  rodada: number;
}

/** `POST …/banco-padrao` e `POST …/pacotes/:pacoteId/em-andamento`. */
export interface EmAndamento {
  atividade: AtividadeDaTurma;
  fase: Fase;
  mudou: boolean;
}

/** `GET …/turmas/:turmaId/pacotes`. */
export interface PacotesDaTurmaEnigma {
  emAndamento: AtividadeDaTurma | null;
  historico: {
    id: string;
    disciplina: Disciplina;
    tema: string;
    chaveDaCena: ChaveDeCena;
    origem: Origem;
    ativo: boolean;
    aprovadoEm: string;
    rodadas: number;
  }[];
}

export interface PacoteDetalhe extends PacoteDoProfessor {
  rodadas: number;
}

/** `POST …/gate`. */
export interface GateDaTurma {
  fase: Fase;
  atividade: AtividadeDaTurma;
  atualizadoEm: string;
}

export interface LinhaDoPainel {
  estudanteId: string;
  nome: string;
  equipe: { id: string; nome: string; membros: { id: string; nome: string }[] } | null;
  passo: Passo;
  aguardandoVirada: boolean;
  /** Ms com o centro da lente sobre cada objeto do fundo (`inv-1`, `inv-2`); o piso é 3 s em cada. */
  lupa: { alvo1Ms: number; alvo2Ms: number; alertas: number; liberada: boolean } | null;
  capa: { fotoId: FotoId; seloId: SeloId; seloCoerente: boolean; visitante: string; nucleoVisivel: boolean } | null;
  invariantes: { encontrados: number; erros: number; ajuda: boolean; errosPosAjuda: number; completo: boolean } | null;
  fora: { itens: { id: string; nome: string }[]; possiveis: number } | null;
  par: { cartas: string[]; motivo: MotivoDoPar; correto: boolean } | null;
  segundaFoto: { elemento: ElementoDaSegundaFoto; essencialVisivel: boolean } | null;
}

export interface RoteiroDaAula {
  introducao: string;
  regraDoArraste: string;
  pausa: string;
  cartoes: string[];
  perguntas: string[];
  liberar: string;
}

/** `GET …/turmas/:turmaId/painel`. */
export interface PainelDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  atividade: { pacoteId: string; rodada: number; tema: string; espaco: string } | null;
  fase: Fase | null;
  porComputador: boolean;
  resumo: {
    unidades: number;
    entraram: number;
    publicaram: number;
    aguardandoVirada: number;
    concluiram: number;
    /** Quantos marcaram ao menos UMA coisa que ficou fora da capa. */
    marcaramFora: number;
  };
  linhas: LinhaDoPainel[];
  roteiro: RoteiroDaAula;
}

/** `GET /enigma-capa/professor/material` — o bloco vivo do guia. */
export interface Material {
  prontos: PacotePronto[];
  /** Os componentes do recorte, na ordem da api (o 2º ano, Computação e "Outro componente" no fim). */
  disciplinas: { slug: Disciplina; rotulo: string }[];
  roteiro: RoteiroDaAula;
  cartas: { id: string; descricao: string; atividade: string; cor: string }[];
  habilidades: { codigo: string; rotulo: string; criterios: { atingiu: string; em_processo: string; nao_atingiu: string } }[];
}

// ─────────────────────────────────────────────────────────────── os caminhos

export function caminhoDaTurma(turmaId: string): string {
  return `/enigma-capa/turmas/${encodeURIComponent(turmaId)}`;
}
export const CAMINHO_DO_MATERIAL = "/enigma-capa/professor/material";

// ─────────────────────────────────────────────────────────────── puro

/**
 * A URL de uma imagem da cena. `bundle` é um arquivo do `public/` da
 * experiência (`cenas/biblioteca.webp`): o hub não o serve, então quem chama
 * passa a BASE do bundle (`lib/bundle-da-experiencia.ts`, resolvida no
 * servidor). `url` é absoluta (a cena da IA, no bucket de mídia) e vai como veio.
 */
export function urlDaImagem(imagem: ImagemDaCena, baseDoBundle: string | null): string | null {
  if (imagem.tipo === "url") return imagem.url;
  if (!baseDoBundle) return null;
  return `${baseDoBundle.replace(/\/$/, "")}/${imagem.nome.replace(/^\//, "")}`;
}

/**
 * O toque do professor na imagem, em pixels do elemento, → coordenadas 0–100 da
 * panorâmica, com uma casa decimal (o mesmo sistema dos alvos). Fora da imagem
 * satura na borda.
 */
export function pontoNaPanoramica(
  toque: { x: number; y: number },
  caixa: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const lim = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
  if (caixa.width <= 0 || caixa.height <= 0) return { x: 0, y: 0 };
  return {
    x: lim(((toque.x - caixa.left) / caixa.width) * 100),
    y: lim(((toque.y - caixa.top) / caixa.height) * 100),
  };
}

/**
 * O alvo cabe na faixa comum (aparece nas DUAS fotos)? A régua da api é a que
 * decide (`regras/pacote.ts`); isto só avisa na hora do toque.
 */
export function alvoNaFaixaComum(x: number, r: number = RAIO_PADRAO): boolean {
  return x - r >= FAIXA_COMUM.de && x + r <= FAIXA_COMUM.ate;
}

/** O recorte é aceitável para a geração (o mesmo Zod da api: tema 3–60, 3 a 6 palavras de 2 a 20, nota até 200)? */
export function problemasDoRecorte(r: { disciplina: string; tema: string; palavras: string[]; nota: string }): string[] {
  const p: string[] = [];
  if (!r.disciplina) p.push("Selecione o componente curricular.");
  const tema = r.tema.trim();
  if (tema.length < TEMA.min || tema.length > TEMA.max) p.push(`O tema precisa ter de ${TEMA.min} a ${TEMA.max} caracteres.`);
  if (r.palavras.length < PALAVRAS.min || r.palavras.length > PALAVRAS.max) {
    p.push(`Informe de ${PALAVRAS.min} a ${PALAVRAS.max} palavras-chave, separadas por vírgula.`);
  }
  if (r.palavras.some((t) => t.length < 2 || t.length > PALAVRAS.maxCaracteres)) {
    p.push(`Cada palavra-chave precisa ter de 2 a ${PALAVRAS.maxCaracteres} caracteres.`);
  }
  if (r.nota.trim().length > NOTA_MAX) p.push(`A nota passa de ${NOTA_MAX} caracteres.`);
  return p;
}

/** As palavras-chave do campo: separadas por vírgula ou linha, sem vazias. */
export function palavrasDoTexto(texto: string): string[] {
  return texto
    .split(/[,\n]+/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Por que o rascunho saiu do pacote pronto — a frase da tela (one-pager §9a: "aviso claro"). */
export const AVISO_SEM_IA: Record<"sem-saldo" | "indisponivel", { titulo: string; descricao: string }> = {
  "sem-saldo": {
    titulo: "Sem saldo de inteligência artificial hoje",
    descricao:
      "A personalização ficou desligada e a atividade foi montada com o pacote pronto da disciplina. Confira e aprove, ou use um dos pacotes prontos acima.",
  },
  indisponivel: {
    titulo: "Geração com IA indisponível agora",
    descricao:
      "O serviço de geração não respondeu. Para não atrasar a aula, a atividade foi montada com o pacote pronto da disciplina. Confira e aprove, ou tente gerar de novo mais tarde.",
  },
};

/** A barra lúdica da geração (one-pager §9a, literal). */
export const TEXTO_DA_GERACAO = "A Rádio Escola está preparando as fotos...";

/** A mensagem e a lista `erros` de uma recusa da api (a homologação devolve TODAS as frases da régua). */
export function erroDaApi(corpo: unknown, padrao: string): { mensagem: string; erros: string[] } {
  if (!corpo || typeof corpo !== "object") return { mensagem: padrao, erros: [] };
  const { mensagem, erros } = corpo as { mensagem?: unknown; erros?: unknown };
  return {
    mensagem: typeof mensagem === "string" && mensagem ? mensagem : padrao,
    erros: Array.isArray(erros) ? erros.filter((e): e is string => typeof e === "string") : [],
  };
}

/** A fase em palavras, para o painel. */
export function rotuloDaFase(fase: Fase | null): string {
  if (fase === "virada") return "Virada liberada";
  if (fase === "aberta") return "Antes da virada";
  return "Sem atividade no ar";
}

/** Segundos de lupa, com uma casa ("3,4 s"). */
export function segundosDaLupa(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toLocaleString("pt-BR")} s`;
}

/**
 * O que a ficha registra mudou? O painel chama `router.refresh()` quando sim,
 * para o painel de habilidades acompanhar a aula sem F5 (ADR-146). Na
 * exp02ef1b a marca vai na transação de duas jogadas: os invariantes completos
 * (EF02CO01) e o "Pronto" do que ficou fora da foto (EF02CO05).
 */
export function mudouAEvidencia(antes: PainelDaTurma, depois: PainelDaTurma): boolean {
  const assinatura = (p: PainelDaTurma) =>
    p.linhas
      .map((l) => `${l.estudanteId}:${l.invariantes?.completo ? 1 : 0}:${l.fora ? 1 : 0}`)
      .sort()
      .join("|");
  return assinatura(antes) !== assinatura(depois);
}

/** Um círculo na panorâmica: o alvo de um invariante, com o nome dele. */
export interface MarcaNaCena {
  id: InvarianteId;
  nome: string;
  alvo: Alvo;
}

/**
 * Os alvos do conteúdo como marcas (os `null` ficam de fora). Mora aqui, e não
 * em `cena-do-enigma.tsx` ("use client"), porque o guia e a página da
 * atividade a chamam no SERVIDOR.
 */
export function marcasDoConteudo(conteudo: ConteudoDoPacote): MarcaNaCena[] {
  return conteudo.cena.invariantes.flatMap((inv) => (inv.alvo ? [{ id: inv.id, nome: inv.nome, alvo: inv.alvo }] : []));
}
