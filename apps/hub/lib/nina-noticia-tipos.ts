/**
 * O que o hub lê da exp03ef1b (Nina e a Notícia que Desapareceu, ADR-197) —
 * espelho do Zod de `apps/api/src/nina-noticia/contrato-de-rotas.ts`, que é a
 * fonte da verdade, e dos valores fechados de `vocabulario.ts`,
 * `invariantes.ts` e `conteudo.ts` do mesmo módulo.
 *
 * O espelho é DECLARADO, e `nina-noticia-tipos.test.ts` lê os arquivos da api
 * como texto e compara lista por lista: uma segunda lista de valores é a que
 * ninguém atualiza junto, e o hub não importa a api.
 *
 * O que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum acerto por computador.** A linha do painel é só progresso e os
 *   dois alertas (`PROIBIDO_NA_LINHA_DO_PAINEL`, na api): nem a escolha, nem o
 *   carimbo, nem o reparo. A escolha da Etapa 2 vive SÓ no agregado do resumo;
 *   o nível das habilidades, no painel de habilidades (`lib/evidencias.ts`).
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle da
 *   experiência; daqui o hub só prepara e conduz.
 * - **Nenhum conteúdo do banco padrão.** O banco (a Feira de Troca de Livros)
 *   mora SÓ na api: o hub pede `POST banco-padrao` e recebe a atividade pronta.
 * - **"aposta" é nome INTERNO** (o passo e a etapa). Na tela é "escolha"
 *   (ajuste do PO, spec §7.1), e o teste cobra que nenhum texto daqui diga
 *   "aposta".
 *
 * As funções daqui são PURAS: o painel ao vivo e a criação da atividade são
 * client components e importam deste arquivo, e o `vitest` do hub só varre
 * `lib/`.
 */

// ─────────────────────────────────────────────────────────────── o vocabulário

export const EXP_ID = "exp03ef1b";

/** Os passos do estudante, na ordem (`vocabulario.ts#PASSOS`). */
export const PASSOS = [
  "galeria",
  "aposta",
  "filtro",
  "omissao",
  "ficha",
  "carimbos",
  "reparo",
  "desfecho",
  "ponte",
  "rotina",
  "caso",
  "fim",
] as const;
export type PassoDoEstudante = (typeof PASSOS)[number];

/** As etapas da TURMA — o relógio que a professora move, só para a frente. */
export const ETAPAS = ["aposta", "filtro", "inspecao"] as const;
export type EtapaDaTurma = (typeof ETAPAS)[number];

/** O que o `POST gate` aceita (`vocabulario.ts#ACOES_DO_GATE`). */
export const ACOES_DO_GATE = ["liberar", "pausar", "retomar"] as const;
export type AcaoDoGate = (typeof ACOES_DO_GATE)[number];

/** Os três suportes da mesma feira, sempre nesta ordem. */
export const SUPORTES = ["mural", "portal", "telao"] as const;
export type Suporte = (typeof SUPORTES)[number];

/** O kicker do cartão (literal da api). */
export const ROTULO_DO_SUPORTE: Record<Suporte, string> = {
  mural: "Mural Impresso",
  portal: "Portal da Escola",
  telao: "Telão do Corredor",
};

/** O suporte cuja ficha tem o campo Onde VAZIO — a notícia que a busca deixa de fora. */
export const SUPORTE_OMITIDO: Suporte = "telao";

export const CAMPOS = ["quem", "onde", "quando"] as const;
export type Campo = (typeof CAMPOS)[number];

export const ROTULO_DO_CAMPO: Record<Campo, string> = { quem: "Quem", onde: "Onde", quando: "Quando" };

export const LUGARES = ["patio", "biblioteca", "quadra"] as const;
export const PESSOAS = ["estudantes", "professores", "familias", "visitantes"] as const;
export const DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
export type Lugar = (typeof LUGARES)[number];
export type Pessoa = (typeof PESSOAS)[number];
export type Dia = (typeof DIAS)[number];

/** O rótulo de cada valor de ficha (literal da api). */
export const ROTULO_DO_VALOR: Record<Lugar | Pessoa | Dia, string> = {
  patio: "Pátio",
  biblioteca: "Biblioteca",
  quadra: "Quadra",
  estudantes: "estudantes",
  professores: "professores",
  familias: "famílias",
  visitantes: "visitantes",
  segunda: "segunda",
  terca: "terça",
  quarta: "quarta",
  quinta: "quinta",
  sexta: "sexta",
  sabado: "sábado",
};

/** `ia` (gerado e conferido pela professora) ou `padrao` (o banco padrão, sem IA). */
export const ORIGENS_DO_PACOTE = ["padrao", "ia"] as const;
export type OrigemDoPacote = (typeof ORIGENS_DO_PACOTE)[number];

/** As disciplinas do preparo, na ordem da api: todo o 3º ano, Computação e o projeto. */
export const DISCIPLINAS = [
  "lingua-portuguesa",
  "arte",
  "educacao-fisica",
  "matematica",
  "ciencias",
  "geografia",
  "historia",
  "ensino-religioso",
  "computacao",
  "projeto-interdisciplinar",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

/** `Record` exaustivo: disciplina nova na api sem rótulo aqui é erro de compilação (e o teste compara). */
export const ROTULO_DA_DISCIPLINA: Record<Disciplina, string> = {
  "lingua-portuguesa": "Língua Portuguesa",
  arte: "Arte",
  "educacao-fisica": "Educação Física",
  matematica: "Matemática",
  ciencias: "Ciências",
  geografia: "Geografia",
  historia: "História",
  "ensino-religioso": "Ensino Religioso",
  computacao: "Computação",
  "projeto-interdisciplinar": "Projeto Interdisciplinar",
};

/** O rótulo de um slug que veio da api — e o próprio slug, se o hub ainda não o conhece. */
export function rotuloDaDisciplina(slug: string): string {
  return (ROTULO_DA_DISCIPLINA as Record<string, string>)[slug] ?? slug;
}

/** As imagens de um pacote: uma por reportagem e a do cartaz comum da feira. */
export const CHAVES_DAS_IMAGENS = ["mural", "portal", "telao", "cartaz"] as const;
export type ChaveDaImagem = (typeof CHAVES_DAS_IMAGENS)[number];

export const ROTULO_DA_IMAGEM: Record<ChaveDaImagem, string> = {
  mural: "Foto do mural impresso",
  portal: "Foto do portal da escola",
  telao: "Foto do telão do corredor",
  cartaz: "Cartaz da feira",
};

/**
 * As CENAS FIXAS do banco (o caso novo e o Desafio Extra): iguais para todas
 * as turmas, geradas na conta da plataforma — na tela do `admin`
 * (`/unooria/recursos/imagens-da-nina`) ou, a que faltar, no preparo da
 * primeira professora (ADR-199). A professora não as vê nem as refaz.
 */
export const CHAVES_DAS_CENAS_FIXAS = ["caso-a", "caso-b", "extra-1", "extra-2"] as const;
export type ChaveDaCenaFixa = (typeof CHAVES_DAS_CENAS_FIXAS)[number];

/** O rótulo de cada cena fixa — pela POSIÇÃO na missão, sem o conteúdo do banco (que mora só na api). */
export const ROTULO_DA_CENA_FIXA: Record<ChaveDaCenaFixa, string> = {
  "caso-a": "Caso novo · 1ª matéria",
  "caso-b": "Caso novo · 2ª matéria",
  "extra-1": "Desafio Extra · 1ª ficha",
  "extra-2": "Desafio Extra · 2ª ficha",
};

/** As oito do banco padrão, na ordem da api (`banco-padrao-imagens.service.ts#itensDoBanco`). */
export const CHAVES_DO_BANCO = [...CHAVES_DAS_IMAGENS, ...CHAVES_DAS_CENAS_FIXAS] as const;
export type ChaveDoBanco = (typeof CHAVES_DO_BANCO)[number];

export function rotuloDaImagemDoBanco(chave: ChaveDoBanco): string {
  return (CHAVES_DAS_IMAGENS as readonly string[]).includes(chave)
    ? ROTULO_DA_IMAGEM[chave as ChaveDaImagem]
    : ROTULO_DA_CENA_FIXA[chave as ChaveDaCenaFixa];
}

/** A manchete tem no máximo quatro palavras (`invariantes.ts`). */
export const MAX_PALAVRAS_DA_MANCHETE = 4;
/** Os tetos de caractere da manchete (`ReportagemDoPacoteSchema`). */
export const MANCHETE = { min: 2, max: 40 } as const;
/** Os tetos de `ParametrosDoPreparoSchema`. */
export const PARAMETROS = { tema: { min: 3, max: 60 }, assuntos: { min: 3, max: 300 } } as const;

/** O painel se relê a cada 5 s (`vocabulario.ts#POLLING_DO_PAINEL_MS`). */
export const POLLING_DO_PAINEL_MS = 5_000;

// ───────────────────────────────────────────────── a mediação (a professora)

/**
 * O roteiro de debate na íntegra (sheet, "Strings do professor" §3), com o
 * cuidado de cada pergunta — o mesmo texto de `conteudo.ts#ROTEIRO_DE_MEDIACAO`,
 * e o teste confere frase por frase.
 */
export const ROTEIRO_DE_MEDIACAO: readonly { pergunta: string; cuidado: string }[] = [
  {
    pergunta: "Nesta busca do jornal, o computador olhou a foto como nós olhamos ou consultou os campos da ficha?",
    cuidado:
      "Destacar que este filtro consulta campos cadastrados e que a máquina não adivinhou a imagem; não generalizar dizendo que o computador nunca reconhece imagens, pois outros sistemas possuem visão computacional.",
  },
  {
    pergunta:
      "Se a ficha do computador não tem o dia de um evento anotado, podemos dizer que aquele evento nunca aconteceu ou que a reportagem é mentirosa? Qual é a diferença entre uma mentira e uma informação que está faltando?",
    cuidado: "Consolidar que ausência de dado em um cadastro é uma lacuna que exige investigação, e não falsidade.",
  },
  {
    pergunta:
      "Por que é importante criar passos automáticos (algoritmos) com uma condição de parada clara quando temos muitas informações para conferir?",
    cuidado:
      "Evidenciar que rotinas automáticas poupam esforço humano em grandes acervos, mas precisam saber a hora exata de parar.",
  },
];

/** Os gatilhos de condução, um por momento (sheet §2, com "escolha" no lugar de "aposta"). */
export const GATILHOS_DE_CONDUCAO = [
  "Verifique se todas as duplas clicaram no cadeado 'Travar Escolha' antes de autorizar o uso do filtro.",
  "A notícia do telão desapareceu: congele a sala no botão 'Pausar Turma' e faça a provocação coletiva antes de liberar a Etapa 4.",
  "Clique em 'Liberar Inspeção' para abrir as fichas técnicas nas telas dos estudantes.",
] as const;

/** Os gatilhos do momento da turma: antes do filtro, o primeiro; com o filtro liberado, os dois seguintes. */
export function gatilhosDaEtapa(etapa: EtapaDaTurma): string[] {
  if (etapa === "aposta") return [GATILHOS_DE_CONDUCAO[0]];
  if (etapa === "filtro") return [GATILHOS_DE_CONDUCAO[1], GATILHOS_DE_CONDUCAO[2]];
  return [];
}

// ─────────────────────────────────────────────────────────────── o pacote

/** Uma ficha: `null` = campo VAZIO. */
export interface Ficha {
  quem: Pessoa | null;
  onde: Lugar | null;
  quando: Dia | null;
}

export interface ImagemDescrita {
  descricao: string;
  alt: string;
}

/** Uma reportagem do pacote como ela é ESCRITA (`ReportagemDoPacoteSchema`). */
export interface ReportagemDoPacote {
  suporte: Suporte;
  manchete: string;
  legenda: string;
  lugar: Lugar;
  ficha: Ficha;
  imagem: ImagemDescrita;
}

export interface ConteudoDoPacote {
  tema: string;
  cartaz: { texto: string; imagem: ImagemDescrita };
  reportagens: ReportagemDoPacote[];
}

/** O corpo de `gerar-conteudo` (`ParametrosDoPreparoSchema`). `contexto` é opcional, não anulável. */
export interface ParametrosDoPreparo {
  disciplina: Disciplina;
  tema: string;
  assuntos: string;
  contexto?: string;
}

/** Por que a geração caiu no banco padrão. */
export type MotivoDoBancoPadrao = "sem-saldo-de-ia" | "ia-indisponivel";

/**
 * `POST gerar-conteudo` — RASCUNHO, não persiste. `usouIa: false` é o
 * FALLBACK: sem cota ou com a IA fora do ar, o conteúdo é o banco padrão e
 * `motivo` diz por quê (a resposta é 200).
 */
export interface RascunhoDoPacote {
  parametros: ParametrosDoPreparo;
  conteudo: ConteudoDoPacote;
  usouIa: boolean;
  origem: OrigemDoPacote;
  motivo: MotivoDoBancoPadrao | null;
  imagens: Partial<Record<ChaveDaImagem, string>>;
}

/** `POST regenerar-reportagem`. `usouIa: false` = a reportagem voltou como estava. */
export interface ReportagemRegenerada {
  reportagem: ReportagemDoPacote;
  usouIa: boolean;
}

export interface ResumoDaMidia {
  total: number;
  prontas: number;
}

export interface PacoteResumo {
  id: string;
  disciplina: Disciplina;
  tema: string;
  origem: OrigemDoPacote;
}

/** `POST homologar` e `POST banco-padrao` — a atividade criada, PRONTA (ADR-130). */
export interface PacoteHomologado extends PacoteResumo {
  ativo: boolean;
}

export interface PacoteNaTela extends PacoteResumo {
  assuntos: string;
  conteudo: ConteudoDoPacote;
  midia: ResumoDaMidia;
  imagens: Partial<Record<ChaveDaImagem, string>>;
}

/** `GET turmas/:turmaId/pacotes`. */
export interface PacotesDaTurmaNina {
  ativo: (PacoteNaTela & { rodada: number; etapa: EtapaDaTurma }) | null;
  historico: Array<
    PacoteResumo & { ativo: boolean; criadoEm: string; rodadas: number; imagensAprovadas: boolean }
  >;
}

/** `GET turmas/:turmaId/pacotes/:pacoteId` — UMA atividade, em andamento ou pronta. */
export interface PacoteDetalhe extends PacoteNaTela {
  ativo: boolean;
  rodada: number | null;
  etapa: EtapaDaTurma | null;
  criadoEm: string;
  rodadas: number;
  /** `null` = a segunda fase não passou, e a atividade não vai ao ar. */
  imagensAprovadasEm: string | null;
}

export interface ImagensAprovadas {
  pacoteId: string;
  imagensAprovadasEm: string;
}

/** "Refazer imagem" de UMA chave. */
export interface ImagemRefeita {
  pacoteId: string;
  chave: ChaveDaImagem;
  url: string;
}

/** `POST …/pacotes/:pacoteId/gerar-midia` — o progresso de UMA chamada. */
export interface ProgressoDaMidia {
  pacoteId: string;
  total: number;
  prontas: number;
  faltam: number;
  geradas: ChaveDaImagem[];
  falharam: ChaveDaImagem[];
  completo: boolean;
  imagens: Partial<Record<ChaveDaImagem, string>>;
}

export interface EmAndamento {
  pacoteId: string;
  rodada: number;
  etapa: EtapaDaTurma;
  mudou: boolean;
}

// ─────────────────────────────────────────────────────────────── o painel

export interface TurmaResumo {
  id: string;
  nome: string;
  serie: string | null;
}

/** Uma linha do painel — um COMPUTADOR com equipes, uma criança sem. **Só progresso e alerta.** */
export interface LinhaDoPainel {
  estudanteId: string;
  nome: string;
  usuario: string;
  equipe: { id: string; nome: string } | null;
  entrou: boolean;
  passo: PassoDoEstudante;
  etapaVisivel: number;
  aguardando: boolean;
  concluiu: boolean;
  alertas: { semParada: boolean; uniformes: boolean };
}

export const ETAPAS_VISIVEIS = ["1", "2", "3", "4", "5", "6"] as const;
export type EtapaVisivel = (typeof ETAPAS_VISIVEIS)[number];

/** `GET turmas/:turmaId/painel`. */
export interface PainelDaTurma {
  turma: TurmaResumo;
  pacote: PacoteResumo & { midia: ResumoDaMidia };
  rodada: number;
  etapa: EtapaDaTurma;
  pausada: boolean;
  proximaEtapa: EtapaDaTurma | null;
  linhas: LinhaDoPainel[];
  resumo: {
    total: number;
    entraram: number;
    concluiram: number;
    porComputador: boolean;
    porEtapa: Record<EtapaVisivel, number>;
    escolhas: {
      travadas: number;
      uma: number;
      duas: number;
      tres: number;
      deFora: Partial<Record<Suporte, number>>;
    };
    alertas: { semParada: number; uniformes: number };
  };
}

/** `POST turmas/:turmaId/gate`. */
export interface GateDaTurma {
  turma: TurmaResumo;
  pacoteId: string;
  rodada: number;
  etapa: EtapaDaTurma;
  pausada: boolean;
  proximaEtapa: EtapaDaTurma | null;
  mudou: boolean;
  atualizadoEm: string;
}

/** `POST turmas/:turmaId/zerar`. */
export interface TurmaZerada {
  pacoteId: string;
  rodada: number;
  etapa: EtapaDaTurma;
}

// ─────────────────────────────────────────────────────────────── os caminhos

/** O prefixo de toda rota da turma, sem o `/api/plataforma` do BFF. */
export function caminhoDaTurma(turmaId: string): string {
  return `/nina-noticia/turmas/${encodeURIComponent(turmaId)}`;
}

/** "Usar Banco Padrão" e "Carregar Banco Padrão": a atividade pronta, sem IA. */
export function caminhoDoBancoPadrao(turmaId: string): string {
  return `${caminhoDaTurma(turmaId)}/banco-padrao`;
}

export function caminhoDoPacote(turmaId: string, pacoteId: string): string {
  return `${caminhoDaTurma(turmaId)}/pacotes/${encodeURIComponent(pacoteId)}`;
}

// ─────────────────────────────────────────────────────────────── os erros

/** O corpo de erro da api: `{codigo, mensagem}`, e `erros[]` no `pacote-invalido`. */
export function erroDaResposta(corpo: unknown, padrao: string): { codigo: string | null; mensagem: string; erros: string[] } {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as { codigo?: unknown; mensagem?: unknown; erros?: unknown };
  return {
    codigo: typeof c.codigo === "string" ? c.codigo : null,
    mensagem: typeof c.mensagem === "string" && c.mensagem.trim() ? c.mensagem : padrao,
    erros: Array.isArray(c.erros) ? c.erros.filter((e): e is string => typeof e === "string") : [],
  };
}

/** A falha da IA pelo status OU pelo código (o BFF repassa os dois). */
export function falhaDaIa(status: number, codigo: string | null): MotivoDoBancoPadrao | null {
  if (status === 429 || codigo === "sem-saldo-de-ia") return "sem-saldo-de-ia";
  if (status === 503 || codigo === "ia-indisponivel") return "ia-indisponivel";
  return null;
}

/** E0-PROF-03: o título e o texto de cada falha (copy `e0.erro.*` e as mensagens 429/503 do sheet). */
export const FALHA_DA_GERACAO: Record<MotivoDoBancoPadrao, { titulo: string; texto: string }> = {
  "sem-saldo-de-ia": {
    titulo: "Limite de geração atingido temporariamente.",
    texto:
      "Limite de geração com IA atingido para este período. Você pode ativar o banco padrão curado com um clique para aplicar a aula normalmente.",
  },
  "ia-indisponivel": {
    titulo: "Instabilidade no gerador de conteúdo.",
    texto:
      "Não foi possível conectar ao serviço de geração neste momento. Utilize o pacote padrão curado para manter sua aula sem interrupções.",
  },
};

// ─────────────────────────────────────────────────────────────── o preparo

/** Os rótulos do preparo (E0-PROF-02 a 05, copy do sheet com os ajustes do PO). A suíte e2e casa por texto exato. */
export const COPY_DO_PREPARO = {
  tituloDoRecorte: "Recorte Pedagógico da Aula",
  explicacaoDoRecorte:
    "Selecione o componente e defina o tema do evento escolar para personalizar as notícias da simulação, ou utilize o pacote padrão já validado.",
  caminhoCurto: "Caminho Curto: Pacote Curado Padrão",
  descricaoDoCaminhoCurto: "Feira de Troca de Livros da Escola (Língua Portuguesa) — os textos prontos, sem IA.",
  /* ADR-199: as imagens passam pela aprovação, e a que o banco ainda não tem é
     gerada com a cota da professora — "sem consumo de créditos" deixou de ser verdade. */
  apoioDoBancoPadrao:
    "Carrega o pacote curado da Feira de Livros da Escola. Os textos não consomem créditos de IA; só as imagens que o banco ainda não tiver, que você confere e aprova em seguida.",
  botaoPadrao: "Usar Banco Padrão",
  personalizar: "Ou personalize com Inteligência Artificial",
  rotuloDaDisciplina: "Componente Curricular",
  rotuloDoTema: "Tema do Evento",
  ajudaDoTema: "Nome do acontecimento escolar (máximo de 60 caracteres). Ex.: Feira de Troca de Livros.",
  /* Spec §7.2: o rótulo é "Assunto da matéria" (não "Tópicos Abordados"). */
  rotuloDosAssuntos: "Assunto da matéria",
  ajudaDosAssuntos: "3 a 5 tópicos conceituais que contextualizam a investigação no jornal.",
  botaoGerar: "Gerar Notícias com IA",
  gerando: "Criando as notícias da escola...",
  espera: "A inteligência artificial está redigindo as manchetes e montando as fichas técnicas. Aguarde alguns instantes.",
  botaoContingencia: "Carregar Banco Padrão",
  tituloDaConferencia: "Conferência do Pacote de Notícias",
  instrucaoCurta: "Revise as reportagens e fichas.",
  instrucaoDaConferencia:
    "Verifique as manchetes e confirme que a terceira foto-reportagem está com o campo Onde em branco na ficha. Você pode editar os títulos ou regenerar matérias antes de aprovar.",
  editarManchete: "Editar Manchete",
  regenerarNoticia: "Regenerar Notícia",
  refazerImagem: "Refazer imagem",
  homologar: "Homologar Pacote",
  aprovarImagens: "Aprovar imagens",
  destaqueDoTelao: "Confira se o pátio aparece nesta foto: é ela que a busca deixa de fora.",
  tituloDaAtivacao: "Ativação da Atividade na Sala",
  pacotePronto: "Pacote homologado e pronto.",
  liberar: "Liberar Atividade para a Turma",
  instrucaoDaAtivacao:
    "Atividade pronta para aplicação. Ao clicar em 'Liberar Atividade para a Turma', os computadores dos estudantes terão acesso imediato à redação do Unoojornal.",
} as const;

/** As dicas do carrossel de espera (E0-PROF-03), com "escolha" no lugar de "aposta". */
export const DICAS_DA_ESPERA = [
  "No 3º ano, a mediação oral é fundamental: leia em voz alta as instruções e acompanhe o momento da omissão no filtro.",
  "Atenção ao momento da descoberta: certifique-se de que as equipes travaram o cadeado antes de verem a barra de busca.",
  "Na etapa da rotina, incentive as duplas a pensarem em quando o computador deve parar de conferir as fichas.",
] as const;

/** Os parâmetros como a tela os segura: tudo texto, `disciplina` vazia até escolher. */
export interface ParametrosNaTela {
  disciplina: string;
  tema: string;
  assuntos: string;
}

export const PARAMETROS_VAZIOS: ParametrosNaTela = { disciplina: "", tema: "", assuntos: "" };

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
  return erros;
}

/** O corpo de `gerar-conteudo`, sem espaço nas pontas. Só chame com os parâmetros válidos. */
export function corpoDosParametros(p: ParametrosNaTela): ParametrosDoPreparo {
  return { disciplina: p.disciplina as Disciplina, tema: p.tema.trim(), assuntos: p.assuntos.trim() };
}

export function parametrosNaTela(p: ParametrosDoPreparo): ParametrosNaTela {
  return { disciplina: p.disciplina, tema: p.tema, assuntos: p.assuntos };
}

export function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** O problema de uma manchete editada, em frase; `null` quando ela serve. A api confere de novo. */
export function problemaDaManchete(texto: string): string | null {
  const t = texto.trim();
  if (t.length < MANCHETE.min) return "Escreva a manchete.";
  if (t.length > MANCHETE.max) return `Encurte para até ${MANCHETE.max} caracteres.`;
  if (contarPalavras(t) > MAX_PALAVRAS_DA_MANCHETE) return `Use no máximo ${MAX_PALAVRAS_DA_MANCHETE} palavras.`;
  return null;
}

/** As manchetes se repetem? (sem acento e sem caixa, como a api confere) */
export function manchetesRepetidas(conteudo: ConteudoDoPacote): boolean {
  const chave = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const manchetes = conteudo.reportagens.map((r) => chave(r.manchete));
  return new Set(manchetes).size !== manchetes.length;
}

/** "Quem (estudantes) · Onde (Pátio) · Quando (sexta)"; o campo vazio diz que está vazio. */
export function textoDaFicha(ficha: Ficha): string {
  return CAMPOS.map((campo) => {
    const valor = ficha[campo];
    return `${ROTULO_DO_CAMPO[campo]} (${valor ? ROTULO_DO_VALOR[valor] : "vazio"})`;
  }).join(" · ");
}

/** Os campos vazios da ficha — no telão, o Onde, de propósito. */
export function camposVazios(ficha: Ficha): Campo[] {
  return CAMPOS.filter((c) => ficha[c] === null);
}

/** Continuar o laço das imagens? Para em `completo` ou quando uma volta não gera nada. */
export function continuarGerando(p: { completo: boolean; geradas: readonly string[] }): boolean {
  return !p.completo && p.geradas.length > 0;
}

// ───────────────────────────────────── admin: as imagens do banco padrão

/** `GET`/`POST /nina-noticia/banco-padrao/imagens` — só `admin` (a tela `/unooria/recursos/imagens-da-nina`). */
export const CAMINHO_DAS_IMAGENS_DO_BANCO = "/nina-noticia/banco-padrao/imagens";

/** As oito imagens do banco: quantas existem, quais faltam e as URLs. O storage é o registro. */
export interface ImagensDoBancoPadrao {
  total: number;
  prontas: number;
  faltam: ChaveDoBanco[];
  completo: boolean;
  imagens: Partial<Record<ChaveDoBanco, string>>;
}

/** O progresso, e o que ESTA chamada gerou ou não conseguiu. */
export interface GeracaoDoBancoPadrao extends ImagensDoBancoPadrao {
  geradas: ChaveDoBanco[];
  falharam: ChaveDoBanco[];
}

export function textoDoProgressoDoBanco(b: Pick<ImagensDoBancoPadrao, "total" | "prontas">): string {
  if (b.total === 0) return "O banco padrão não tem imagens.";
  if (b.prontas >= b.total) return `As ${b.total} imagens do banco estão prontas.`;
  return `${b.prontas} de ${b.total} imagens do banco prontas.`;
}

/** As que falharam nesta sessão e AINDA não têm imagem (a que saiu depois deixa a lista). */
export function falhasAcumuladas(
  anteriores: readonly ChaveDoBanco[],
  p: Pick<GeracaoDoBancoPadrao, "falharam" | "imagens">,
): ChaveDoBanco[] {
  const todas = new Set([...anteriores, ...p.falharam]);
  return CHAVES_DO_BANCO.filter((c) => todas.has(c) && !p.imagens[c]);
}

// ─────────────────────────────────────────────────────────────── os rótulos

/** O rótulo do botão do portão, pela etapa de DESTINO (copy `e4.botao.*`). A suíte e2e casa por texto exato. */
export const ROTULO_DO_BOTAO: Record<Exclude<EtapaDaTurma, "aposta">, string> = {
  filtro: "Liberar Filtro",
  inspecao: "Liberar Inspeção",
};

export function rotuloDoBotao(proxima: EtapaDaTurma | null): string | null {
  if (proxima === null || proxima === "aposta") return null;
  return ROTULO_DO_BOTAO[proxima];
}

/** Onde a turma está, em uma linha. Nenhum diz "aposta". */
export const ROTULO_DA_ETAPA: Record<EtapaDaTurma, string> = {
  aposta: "Etapas 1 e 2 — cada equipe olha as fotos da feira e trava a sua escolha",
  filtro: "Filtro liberado — a busca da Etapa 3 e a notícia que desaparece",
  inspecao: "Inspeção liberada — da ficha ao fim, cada equipe no próprio ritmo",
};

/** O que o computador está vendo agora, em uma linha. Nunca diz se acertou. */
export const ROTULO_DO_PASSO: Record<PassoDoEstudante, string> = {
  galeria: "Olhando as fotos da feira",
  aposta: "Escolhendo as notícias",
  filtro: "Usando o filtro",
  omissao: "Viu a notícia sumir",
  ficha: "Inspecionando a ficha",
  carimbos: "Carimbando os cartões",
  reparo: "Montando a ficha do telão",
  desfecho: "Viu a busca refeita",
  ponte: "Diante da pilha de fichas",
  rotina: "Montando a rotina",
  caso: "No caso do Festival de Ciências",
  fim: "Concluiu",
};

/** Copy do painel (E4-PROF-01), literal. */
export const COPY_DO_PAINEL = {
  titulo: "Painel da Sala em Tempo Real",
  pausar: "Pausar Turma",
  retomar: "Retomar Turma",
  zerar: "Zerar Turma",
  salaPausada: "Sala pausada",
  congeladas: "Todas as telas dos estudantes estão congeladas.",
  aproveite: "Aproveite este momento para conduzir o debate oral e ouvir as hipóteses das crianças.",
  escolhas: "Escolhas da Etapa 2",
  alertas: "Alertas da sala",
  alertaSemParada: "Alerta: equipe em repetição sem parada.",
  alertaUniformes: "Alerta: carimbos uniformes na equipe.",
  semAlertas: "Nenhum alerta crítico ativo",
  roteiro: "Roteiro de Mediação Oral da Professora",
  semConexao:
    "Sem conexão com o servidor da Unooria. As telas dos estudantes continuam funcionando localmente. Tentando reconectar...",
  falhaDoPortao: "Não foi possível sincronizar o avanço da turma. Verifique o sinal da rede e tente novamente.",
} as const;

// ─────────────────────────────────────────────────── as leituras do painel

/** "equipe"/"equipes" ou "estudante"/"estudantes": com equipes, quem joga é o computador. */
export function sujeito(porComputador: boolean, n: number): string {
  if (porComputador) return n === 1 ? "equipe" : "equipes";
  return n === 1 ? "estudante" : "estudantes";
}

/** Inteiro de 0 a 100. Todo vazio: 0, nunca `NaN`. */
export function percentual(parte: number, todo: number): number {
  if (todo <= 0) return 0;
  return Math.round((parte / todo) * 100);
}

/**
 * As frases das "Escolhas da Etapa 2", só do agregado: quantos escolheram 3, 2
 * e 1 notícia e qual ficou de fora. Sem nome nenhum: pode ir para o projetor.
 */
export function textosDasEscolhas(
  e: PainelDaTurma["resumo"]["escolhas"],
  porComputador: boolean,
): { valor: string; linhas: string[] } {
  if (e.travadas === 0) {
    return { valor: "Nenhuma escolha travada", linhas: [] };
  }
  const quantos = (n: number) => `${n} ${sujeito(porComputador, n)}`;
  const noticia = (n: number) => (n === 1 ? "1 notícia" : `${n} notícias`);
  const linhas = [
    `${quantos(e.tres)} ${e.tres === 1 ? "escolheu" : "escolheram"} ${noticia(3)}; ${quantos(e.duas)}, ${noticia(2)}; ${quantos(e.uma)}, ${noticia(1)}.`,
  ];
  const fora = SUPORTES.filter((s) => (e.deFora[s] ?? 0) > 0).map((s) => `${ROTULO_DO_SUPORTE[s]} (${e.deFora[s]})`);
  if (fora.length > 0) linhas.push(`Ficou de fora da caixa: ${fora.join(", ")}.`);
  return { valor: `${percentual(e.tres, e.travadas)}% escolheram as 3 (${e.travadas} travadas)`, linhas };
}

/** Os alertas da sala, já em frase; vazio = "Nenhum alerta crítico ativo". */
export function alertasDaSala(a: PainelDaTurma["resumo"]["alertas"]): string[] {
  const alertas: string[] = [];
  if (a.semParada > 0) alertas.push(`${COPY_DO_PAINEL.alertaSemParada} (${a.semParada})`);
  if (a.uniformes > 0) alertas.push(`${COPY_DO_PAINEL.alertaUniformes} (${a.uniformes})`);
  return alertas;
}

/** Todos os computadores concluíram? Aí o painel para de se reler. */
export function todosConcluiram(p: Pick<PainelDaTurma, "resumo">): boolean {
  return p.resumo.total > 0 && p.resumo.concluiram >= p.resumo.total;
}

/** Quantas linhas já passaram de `passo` — a forma de ver, pelo painel, que uma marca da ficha aconteceu. */
function passaramDe(linhas: readonly Pick<LinhaDoPainel, "passo">[], passo: PassoDoEstudante): number {
  const marco = PASSOS.indexOf(passo);
  return linhas.filter((l) => PASSOS.indexOf(l.passo) > marco).length;
}

/**
 * Mudou algo que a EVIDÊNCIA registra (ADR-146)? A ficha da missão marca na
 * MESMA transação da jogada que move o passo: a inspeção (`ficha` → `carimbos`),
 * o reparo e a escolha (`reparo` → `desfecho`), a rotina válida (`rotina` →
 * `caso`) e os carimbos da Etapa 6 (`caso` → `fim`). Pelo passo de cada linha
 * o painel sabe quando reler a página, para o painel de habilidades
 * acompanhar a aula sem F5. Pacote ou rodada nova também.
 */
export function mudouAEvidencia(
  antes: Pick<PainelDaTurma, "pacote" | "rodada" | "linhas">,
  depois: Pick<PainelDaTurma, "pacote" | "rodada" | "linhas">,
): boolean {
  if (antes.pacote.id !== depois.pacote.id || antes.rodada !== depois.rodada) return true;
  return (["ficha", "reparo", "rotina", "caso"] as const).some(
    (marco) => passaramDe(antes.linhas, marco) !== passaramDe(depois.linhas, marco),
  );
}

/**
 * Alfabética pelo que a primeira célula MOSTRA — o nome da equipe, quando há —,
 * com número como número ("Equipe 2" antes de "Equipe 10"). Nunca por
 * progresso: listagem ordenável vira ranking.
 */
export function ordenarLinhas(linhas: readonly LinhaDoPainel[]): LinhaDoPainel[] {
  const rotulo = (l: LinhaDoPainel) => l.equipe?.nome ?? l.nome;
  return [...linhas].sort((a, b) => rotulo(a).localeCompare(rotulo(b), "pt-BR", { sensitivity: "base", numeric: true }));
}
