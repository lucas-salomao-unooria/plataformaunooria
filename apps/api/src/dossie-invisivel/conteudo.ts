import { componentePorSlug } from "../curriculo/componentes";

/**
 * O CATÁLOGO da exp09ef1b — O Dossiê Invisível (9º ano do EF, unidade 1,
 * ADR-202): vocabulários, o que é FIXO no servidor e o banco curado padrão.
 *
 * Fonte: os artefatos da esteira (`artefatos_exp09ef1b`, 2026-10-29) — o
 * one-pager v5, o banco de conteúdo `dev/01e` (o texto literal do banco
 * padrão) e a copy revisada `design/06` —, com as diretrizes do PO e as
 * decisões do Lucas de 2026-10-29 por cima (plano aprovado): sem a Etapa 6
 * (Lia e Davi) e sem Canal B (o "motivo estruturado" do 2º voto saiu), a IA
 * da aula só CLASSIFICA a pergunta (o texto é daqui), três travas do
 * professor (a revelação, o 2º voto depois do debate e a sistematização).
 *
 * **O que a IA pode variar** é a ROUPAGEM do pacote (`ConteudoDoPacote`): os
 * três projetos (nome, coordenação, vagas, custo, área, impacto, o card da
 * abertura e os documentos indexados) e a transcrição dos cadernos. **O que
 * NÃO varia** — e por isso mora aqui — é o mecanismo: a verba indivisível de
 * R$ 12.000, os PAPÉIS dos projetos (um só em papel, um com relatórios
 * parciais, um com acervo digital em nuvem), o volume documental de cada papel
 * (1 → 180 registros, 7, 12), as falas do assistente (moldes com o nome dos
 * projetos), os critérios do ranking, os blocos do protocolo e a régua.
 *
 * Puro — sem Nest e sem Prisma. A experiência e o hub têm espelhos destas
 * listas; mudar a forma aqui sem avisar quebra os dois.
 */

export const EXP_ID = "exp09ef1b";

/** Gravada em cada sessão: o histórico se reprocessa pela versão que o mediu. */
export const VERSAO_DO_INSTRUMENTO = "1.0.0";

// ──────────────────────────────────────────── vocabulários (CHECK na migration)

/**
 * O componente curricular do recorte: os do 9º ano na plataforma
 * (`curriculo/componentes.ts#componentesDoAno("9EF")`, na ordem do catálogo),
 * Computação e o projeto interdisciplinar no fim (one-pager §9a).
 * `tests/dossie-invisivel-regras.spec.ts` confere a lista e o CHECK.
 */
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

export const ROTULO_DA_DISCIPLINA: Readonly<Record<Disciplina, string>> = Object.fromEntries(
  DISCIPLINAS.map((slug) => [slug, slug === "interdisciplinar" ? "Projeto Interdisciplinar" : (componentePorSlug(slug)?.rotulo ?? slug)]),
) as Record<Disciplina, string>;

export const ORIGENS = ["ia", "padrao"] as const;
export type Origem = (typeof ORIGENS)[number];

/**
 * O GATE da turma, só para a frente — as TRÊS travas do professor (decisão do
 * Lucas, fiel ao PO): `exploracao` (a turma conversa e registra a escolha
 * inicial) → `revelacao` ("Liberar Próxima Pauta": os cadernos, a tabela e as
 * pílulas) → `revoto` ("Abrir Revisão da Decisão", depois do debate: o 2º
 * voto) → `explicar` ("Destravar Explicar e Protocolo": Amara e o editor).
 */
export const ETAPAS_DO_GATE = ["exploracao", "revelacao", "revoto", "explicar"] as const;
export type EtapaDoGate = (typeof ETAPAS_DO_GATE)[number];

/**
 * Os PAPÉIS dos projetos — o mecanismo da missão (one-pager §3, "camada
 * estrutural fixa"): um com registros só em papel (o que a IA não lê), um
 * com relatórios parciais e um com acervo digital padronizado em nuvem. O
 * nome visível é do pacote; o papel é o id que circula.
 */
export const PROJETOS = ["papel", "parcial", "nuvem"] as const;
export type ProjetoId = (typeof PROJETOS)[number];

/** O volume documental de cada papel no repositório digital — fixo (one-pager §1.3). */
export const DOCUMENTOS_INDEXADOS: Readonly<Record<ProjetoId, number>> = { papel: 1, parcial: 7, nuvem: 12 };
/** Os cadernos do projeto em papel: 3 cadernos, 180 registros diários (OCR). */
export const CADERNOS = { quantidade: 3, registros: 180 } as const;

/** A verba única e indivisível. */
export const VERBA = 12_000;

/** Os critérios do ranking arrastável (E3 e 2º voto). */
export const CRITERIOS = ["regularidade", "urgencia", "capacidade"] as const;
export type Criterio = (typeof CRITERIOS)[number];

/**
 * Os blocos do Editor de Protocolo (E5). O gabarito (qual bloco vai em qual
 * verificação, e qual é a prática danosa) fica no servidor
 * (`regras/protocolo.ts`); a ordem do banco desce embaralhada por sessão.
 */
export const BLOCOS = ["auditar-fontes", "normalizar-impacto", "sinalizar-pendencias", "desclassificar-sem-pdf"] as const;
export type BlocoId = (typeof BLOCOS)[number];
export const SLOTS_DO_PROTOCOLO = 3;

/** As duas pílulas dirigidas da E4. */
export const PILULAS = ["custo", "assinaturas"] as const;
export type PilulaId = (typeof PILULAS)[number];

/** As mensagens da thread que o estudante pode marcar na E5 (âncoras). */
export const ANCORAS = ["contraste", "parecer-inicial", "inversao"] as const;
export type AncoraId = (typeof ANCORAS)[number];

/** A investigação da E2 (EF09CO08): A1 perguntou e digitalizou; A2 perguntou e não digitalizou; B não perguntou. */
export const CAMINHOS = ["A1", "A2", "B"] as const;
export type Caminho = (typeof CAMINHOS)[number];

/**
 * As intenções do chat (`dev/01e`, "Árvore de intenções"). O teto de 5
 * mensagens não é intenção: é a regra da sessão. A IA da aula devolve uma
 * desta lista; a fala sai sempre do catálogo.
 */
export const INTENCOES = ["custo_atendimento", "regularidade_documental", "impacto_social", "investigar_lacuna_cadernos", "solicitar_recomendacao", "fora_do_tema"] as const;
export type Intencao = (typeof INTENCOES)[number];

/** O que o "Regenerar Item" da curadoria refaz (um de cada vez). */
export const ITENS_DO_PACOTE = ["papel", "parcial", "nuvem", "cadernos"] as const;
export type ItemDoPacote = (typeof ITENS_DO_PACOTE)[number];

export const TEMA = { min: 3, max: 60 } as const;
export const ASSUNTOS = { min: 3, max: 6, caracteres: 120, total: 600 } as const;
/** O chat: a escolha libera na 3ª mensagem; na 5ª o composer trava (o regimento da comissão). */
export const CHAT = { minimoParaEscolher: 3, maximo: 5, caracteres: 280 } as const;

// ──────────────────────────────────────────── o pacote (a roupagem)

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
  /** O card da abertura (depois de "<nome>: "). */
  card: string;
  /** A área de atuação, curta. */
  area: string;
  /** O impacto que o repositório digital mostra (completa a frase "<nome> …" da resposta de impacto). */
  impacto: string;
  /** Os documentos indexados (1, 7 ou 12, pelo papel). */
  documentos: DocumentoIndexado[];
}

export interface ConteudoDoPacote {
  projetos: Record<ProjetoId, Projeto>;
  /** Os cadernos do projeto em papel, como o OCR os lê. */
  cadernos: {
    arquivo: string;
    /** Uma amostra por caderno (3). */
    amostras: string[];
    resumo: string;
  };
}

// ──────────────────────────────────────────── o banco padrão (`dev/01e`)

export const PACOTE_PADRAO = {
  nome: "Banco curado padrão",
  disciplina: "interdisciplinar" as Disciplina,
  tema: "Políticas públicas e combate à desigualdade urbana",
  assuntos: ["Orçamento comunitário", "Vulnerabilidade social", "Triagem algorítmica"],
} as const;

export function conteudoDoPadrao(): ConteudoDoPacote {
  return {
    projetos: {
      papel: {
        nome: "Mesa Aberta",
        coordenador: "João",
        idade: 14,
        vagas: 24,
        custoPorVaga: 500,
        card: "João (14 anos). 24 vagas de almoço no contraturno, 2 dias por semana.",
        area: "Segurança alimentar e permanência escolar",
        impacto: "não possui métricas tabuladas no repositório digital institucional.",
        documentos: [
          {
            arquivo: "ficha_cadastral_mesa_aberta.pdf",
            resumo: "Ficha cadastral simplificada (protocolo 2026/F-0104): 24 vagas, terças e quintas, R$ 500 por vaga. Sem relatórios mensais nem planilhas.",
          },
        ],
      },
      parcial: {
        nome: "Ponto de Apoio",
        coordenador: "Ana",
        idade: 14,
        vagas: 18,
        custoPorVaga: 666,
        card: "Ana (14 anos). 18 vagas de acolhimento emocional e mediação escolar.",
        area: "Acolhimento, convivência e mediação contra o bullying",
        impacto: "relata redução de faltas.",
        documentos: [
          { arquivo: "ata_fundacao_2025.pdf", resumo: "Ata de fundação do coletivo de apoio entre pares." },
          { arquivo: "relatorio_semestral_1.pdf", resumo: "12 reuniões de acolhimento e 14 estudantes acompanhados." },
          { arquivo: "ata_roda_conversa_mar2026.pdf", resumo: "Roda sobre violência verbal e bullying, com 16 estudantes." },
          { arquivo: "relatorio_semestral_2.pdf", resumo: "Ampliação para 18 vagas ativas e acompanhamento individual de 8 jovens." },
          { arquivo: "oficina_mediacao_jun2026.pdf", resumo: "Certificados de 18 jovens em comunicação não violenta." },
          { arquivo: "declaracao_parceria_escola.pdf", resumo: "Carta da direção cedendo sala para os círculos." },
          { arquivo: "balanco_preliminar_ano1.pdf", resumo: "Prestação de contas de cartilhas e materiais dos círculos." },
        ],
      },
      nuvem: {
        nome: "Conexão para Continuar",
        coordenador: "Luana",
        idade: 14,
        vagas: 20,
        custoPorVaga: 600,
        card: "Luana (14 anos). 20 vagas de informática e inclusão digital.",
        area: "Inclusão digital e reforço escolar conectado",
        impacto: "apresenta dashboards com 95% de retenção digital.",
        documentos: [
          { arquivo: "rel_mensal_01_jan.pdf", resumo: "10 terminais recondicionados e 20 inscritos; tempo médio de tela de 2h/dia." },
          { arquivo: "rel_mensal_02_fev.pdf", resumo: "Oficinas de digitação; frequência digital de 94,5%." },
          { arquivo: "rel_mensal_03_mar.pdf", resumo: "Softwares de matemática e ciências; retenção de 95%." },
          { arquivo: "rel_mensal_04_abr.pdf", resumo: "Manutenção preventiva; frequência digital de 95,2%." },
          { arquivo: "rel_mensal_05_mai.pdf", resumo: "Currículos no editor de texto; 20 relatórios automáticos." },
          { arquivo: "rel_mensal_06_jun.pdf", resumo: "Fechamento semestral com balancete automatizado." },
          { arquivo: "rel_mensal_07_jul.pdf", resumo: "Plantão de reforço digital; acesso por crachá eletrônico." },
          { arquivo: "rel_mensal_08_ago.pdf", resumo: "Lógica de programação em blocos; exercícios enviados pela nuvem." },
          { arquivo: "rel_mensal_09_set.pdf", resumo: "Matriz de competências digitais por usuário." },
          { arquivo: "rel_mensal_10_out.pdf", resumo: "Dashboard de 480 horas mensais de uso." },
          { arquivo: "rel_mensal_11_nov.pdf", resumo: "Portfólios digitais dos 20 bolsistas em site local." },
          { arquivo: "rel_mensal_12_dez.pdf", resumo: "Relatório executivo anual com taxa final de retenção de 95%." },
        ],
      },
    },
    cadernos: {
      arquivo: "cadernos_campo_joao.dat",
      amostras: [
        "Caderno 1 (dias 001 a 060): 24 refeições completas servidas por dia, com 24 assinaturas de recebimento.",
        "Caderno 2 (dias 061 a 120): 24 refeições por dia e controle de estoque comunitário sem desperdício.",
        "Caderno 3 (dias 121 a 180): 24 refeições por dia e fichas de presença rubricadas pelo coordenador João.",
      ],
      resumo: "180 registros diários de campo: 4.320 refeições servidas a 24 jovens ao longo de 180 dias de contraturno.",
    },
  };
}

// ──────────────────────────────────────────── números derivados do pacote

/** Refeições comprovadas pelos cadernos: uma por vaga em cada registro diário. */
export function refeicoesDosCadernos(c: ConteudoDoPacote): number {
  return c.projetos.papel.vagas * CADERNOS.registros;
}

/** Custo por refeição (R$, duas casas, vírgula): a verba dividida pelas refeições comprovadas. */
export function custoPorRefeicao(c: ConteudoDoPacote): string {
  return (VERBA / refeicoesDosCadernos(c)).toFixed(2).replace(".", ",");
}

// ──────────────────────────────────────────── os TEXTOS fixos (copy `design/06`, banco `01e`)

/**
 * As falas do assistente, em molde: `{papel}`, `{parcial}`, `{nuvem}` (os
 * nomes do pacote) e outros marcadores pontuais (`valoresDoPacote`).
 */
export const FALAS_DO_ASSISTENTE = {
  boasVindas:
    "Bem-vindo à sala de triagem da Comissão de Recursos Comunitários. O saldo disponível é de R$ 12.000,00 indivisíveis. Como relator da pauta, envie perguntas para auditar os projetos inscritos.",
  abertura:
    "Sessão deliberativa aberta. Sou o assistente técnico da Comissão de Recursos Comunitários. Tenho acesso ao repositório digital de propostas concorrentes à verba de R$ 12.000. Consulte-me sobre métricas, regularidade e atendimento.",
  custo:
    "{papel} estima R$ {custoPapel} por vaga para {vagasPapel} estudantes. {nuvem} projeta R$ {custoNuvem} por vaga para {vagasNuvem} estudantes. {parcial} projeta R$ {custoParcial} por vaga para {vagasParcial} estudantes.",
  regularidade: "{nuvem} possui 12 relatórios mensais homologados em PDF. {parcial} tem 7 atas semestrais. {papel} possui apenas a ficha cadastral de abertura no sistema digital.",
  contraste:
    "Os registros disponíveis no sistema para o {papel} são limitados à ficha cadastral básica (1 documento indexado). Os demais projetos possuem entre 6 e 12 documentos indexados.",
  impacto: "{nuvem} {impactoNuvem} {parcial} {impactoParcial} {papel} {impactoPapel}",
  ofertaDosCadernos:
    "O inventário do conselho registra 3 cadernos de campo do {papel} em arquivo físico. O sistema não consegue processar registros em papel. Deseja solicitar a digitalização?",
  ocrConcluido:
    "Leitura óptica dos 3 cadernos concluída com sucesso. 180 registros diários de refeições e presenças foram indexados à base de dados. As métricas do {papel} agora estão integradas ao cálculo.",
  parecerInicial: "Com base nas métricas digitais, recomendo o {nuvem} por menor risco documental e maior governança técnica. Os autos estão prontos para sua deliberação formal.",
  parecerInvertido:
    "Após leitura óptica de 180 registros diários de campo, o projeto {papel} atinge a pontuação máxima de mérito por custo-efetividade e urgência comunitária comprovada. Compare os dados na tabela.",
  limiar: "Limiar de 3 consultas atingido. Você já pode deliberar sobre os R$ 12.000 da comissão.",
  foraDoTema:
    "Esta consulta não corresponde às diretrizes orçamentárias da Comissão de Recursos Comunitários. Por favor, formule perguntas sobre as metas, custos, relatórios ou comprovações dos projetos sociais sob auditoria.",
  limite:
    "Você atingiu o número limite de consultas preliminares previsto no regimento da comissão. As informações essenciais já foram processadas. Avance clicando em 'Ver Projetos' para abrir o painel de deliberação.",
  /** [PROPOSTA] — a resposta de "Ver Projetos" não tem copy. */
  verProjetos: "[PROPOSTA] Projetos inscritos para a verba de R$ 12.000: {papel} ({vagasPapel} vagas), {parcial} ({vagasParcial} vagas) e {nuvem} ({vagasNuvem} vagas).",
  contrafactual:
    "Você registrou sua escolha em {votado} após auditar os cadernos físicos. Se você não tivesse investigado as lacunas na Etapa 2, o sistema teria comparado apenas os rastros digitais.",
  /** [PROPOSTA] — a copy não escreveu as respostas das duas pílulas dirigidas (plano G6). */
  pilulaCusto:
    "[PROPOSTA] Com os cadernos digitalizados, o {papel} comprova {refeicoes} refeições servidas a {vagasPapel} jovens em 180 dias: R$ {custoRefeicao} por refeição e R$ {custoPapel} por vaga. O {comparado} projeta R$ {custoComparado} por vaga.",
  pilulaAssinaturas:
    "[PROPOSTA] Os 3 cadernos somam 180 registros diários, cada um com a lista de presença assinada pelos responsáveis. O trabalho registrado é o mesmo que um relatório digital descreveria: só o formato era papel.",
} as const;
export type FalaDoAssistente = keyof typeof FALAS_DO_ASSISTENTE;

/** A constatação embaixo da tabela (protótipo `E4-ALU-02`). */
export const CONSTATACAO_DA_TABELA = "Constatação de Auditoria: Os critérios de peso e atendimento não mudaram. O que mudou foi o que o robô conseguia ler.";

export const AMARA = {
  abertura: "Doze mil reais. Um projeto fica, dois ficam sem nada. A decisão é sua, conselheiro.",
  sistematizacao:
    "Você escolheu o repasse para o projeto {votado}, enquanto parte significativa da turma foi induzida pelos relatórios da nuvem a votar em outro. Eu estava avaliando o resultado do projeto ou apenas os rastros digitais que a inteligência artificial tinha para ler?",
  /** [PROPOSTA] (plano G9): quando a turma NÃO concentrou o voto no projeto da nuvem, a fala não afirma uma indução que não houve. */
  sistematizacaoNeutra:
    "[PROPOSTA] Você escolheu o repasse para o projeto {votado}. Eu estava avaliando o resultado do projeto ou apenas os rastros digitais que a inteligência artificial tinha para ler?",
  conceitos:
    "Viés algorítmico ocorre quando dados do passado reproduzem desigualdades. Decisões automatizadas identificam padrões naquilo que foi digitalizado, ignorando realidades que ficaram de fora.",
} as const;

/** A fração da turma no projeto da nuvem a partir da qual a fala de Amara afirma a indução (G9). */
export const LIMIAR_DA_INDUCAO = 0.5;

/** Os quatro conceitos do Explicar (one-pager §4, Etapa 5), nomeados em tela. */
export const CONCEITOS: ReadonlyArray<{ termo: string; definicao: string }> = [
  { termo: "Viés algorítmico", definicao: "distorção sistemática decorrente de assimetrias nos dados de entrada." },
  { termo: "Dados do passado", definicao: "registros históricos que refletem desigualdades de infraestrutura." },
  { termo: "Identificação de padrões", definicao: "a IA calcula correlações nos dados presentes, ignorando o que não foi registrado." },
  { termo: "Decisões automatizadas", definicao: "riscos de delegar julgamentos humanos a métricas frias de sistemas computacionais." },
];

export const ROTULO_DO_CRITERIO: Readonly<Record<Criterio, string>> = {
  regularidade: "Regularidade documental",
  urgencia: "Urgência social",
  capacidade: "Capacidade técnica",
};

export const ROTULO_DO_BLOCO: Readonly<Record<BlocoId, string>> = {
  "auditar-fontes": "Auditar fontes físicas e verificar dados não digitalizados antes de ranquear",
  "normalizar-impacto": "Normalizar indicadores priorizando impacto social sobre formato de arquivo",
  "sinalizar-pendencias": "Sinalizar pendências técnicas com oferta obrigatória de digitalização assistida",
  "desclassificar-sem-pdf": "Desclassificar imediatamente projetos que não possuam relatórios em PDF na nuvem",
};

export const ROTULO_DA_PILULA: Readonly<Record<PilulaId, string>> = {
  custo: "Comparar custo real por refeição diária",
  assinaturas: "Verificar 180 registros de presença física",
};

/** As três sugestões da abertura (TC-03 a TC-05), 1:1 com as três primeiras intenções. */
export const SUGESTOES: ReadonlyArray<{ texto: string; intencao: Intencao }> = [
  { texto: "Qual projeto atende mais pessoas pelo menor custo por vaga?", intencao: "custo_atendimento" },
  { texto: "Compare a regularidade e os relatórios enviados pelos três projetos.", intencao: "regularidade_documental" },
  { texto: "Quais são as evidências de impacto de cada iniciativa?", intencao: "impacto_social" },
];

/** Os textos fixos da tela do estudante (copy `design/06`). Os `[PROPOSTA]` são lacunas da copy (plano §3). */
export const TEXTOS_DA_TELA = {
  workspace: "Conselho Municipal de Apoio Social",
  cracha: "Conselheiro Relator — Comissão de Recursos Comunitários",
  base: "base_dados_conselho.json",
  comecar: "Começar Análise",
  placeholderInativo: "Aguardando início da análise...",
  placeholderAtivo: "Consulte o assistente sobre os projetos...",
  digitando: "Assistente consultando a base de dados do conselho...",
  verProjetos: "Ver Projetos",
  escolherProjeto: "Escolher Projeto",
  digitalizar: "Digitalizar cadernos",
  ocr1: "Indexando 180 registros manuscritos...",
  ocr2: "Concluindo leitura óptica e cruzamento calórico...",
  ocrSucesso: "Dados incorporados com sucesso à base de cálculo.",
  modalTitulo: "Metadados do Arquivo Indexado",
  modalCorpo: "Documento protocolado sob assinatura formal. Formato digital auditado nos repositórios municipais.",
  fechar: "Fechar",
  painelTitulo: "R$ 12.000 — Selecione o projeto e ordene seus critérios.",
  deliberacao: "Deliberação Orçamentária — R$ 12.000",
  filaDeEspera: "Fila de espera (sem abertura de vagas)",
  selecionado: "Projeto selecionado",
  ordeneCriterios: "Ordene suas prioridades de análise:",
  subirCriterio: "Subir critério",
  descerCriterio: "Descer critério",
  registrar: "Registrar Decisão",
  espera: "Parecer registrado. Aguardando autorização da presidência da mesa para abrir o próximo ponto de pauta.",
  colProjeto: "Projeto Auditado",
  colDocumentos: "Documentos Verificados",
  colVagas: "Vagas Comprovadas",
  colCusto: "Custo Estimado por Vaga",
  escolhaAnterior: "Escolha Anterior (Etapa 3)",
  manter: "Manter Decisão Original",
  revisar: "Revisar Decisão",
  confirmarFinal: "Confirmar Decisão Final",
  esperaDoDebate: "[PROPOSTA] Debate da plenária em andamento. A revisão da decisão abre quando a presidência da mesa autorizar.",
  instrucaoAncoras: "Selecione no histórico onde o assistente alegou falta de consistência e onde ocorreu a inversão.",
  abrirEditor: "Abrir Editor de Protocolo",
  editorTitulo: "Editor de Protocolo da IA do Conselho",
  editorOrientacao: "Organize as diretrizes na esteira de protocolo para orientar a análise do assistente.",
  slot1: "1ª Verificação: Auditoria de Fontes",
  slot2: "2ª Verificação: Normalização de Impacto",
  slot3: "3ª Verificação: Salvaguarda Ativa",
  descarte: "Área de Descarte",
  subir: "Subir",
  descer: "Descer",
  moverParaLixeira: "Mover para Lixeira",
  enviarProposta: "Enviar Proposta",
  enviada: "Protocolo Institucional Enviado!",
  concluida: "Auditoria orçamentária homologada e arquivada nos anais do conselho",
  revisarAutos: "Revisar histórico dos autos",
  quedaDeSinal: "Conexão com o servidor da comissão interrompida. Reconectando aos registros...",
  reconectar: "Tentar reconectar agora",
  sessaoExpirada: "Por segurança dos autos deliberativos, revalide seu crachá de conselheiro para retomar a sessão exatamente de onde parou.",
  reautenticar: "Reautenticar crachá digital",
  midiaFalhou: "Visualização gráfica indisponível. Carregando extrato textual transcrito dos arquivos.",
} as const;

/** O roteiro do debate mediado (one-pager §9a; TC-16 a TC-18). */
export const ROTEIRO_DO_DEBATE: readonly string[] = [
  "A qualidade real do trabalho do projeto Mesa Aberta aumentou quando descobrimos os cadernos de campo, ou o trabalho já existia e era a máquina que não conseguia enxergar?",
  "Por que um projeto comunitário que lida diretamente com urgência de alimentação tem muito mais dificuldade de gerar planilhas e relatórios em PDF do que uma oficina de informática?",
  "Se a prefeitura cortar uma verba ou suspender o passe de um estudante com base exclusiva na nota que a IA calculou, a culpa da injustiça é do algoritmo ou de quem aceitou a recomendação sem auditar os dados?",
];

/** Os botões das três travas, no painel do professor. */
export const BOTOES_DO_GATE: Readonly<Record<Exclude<EtapaDoGate, "exploracao">, string>> = {
  revelacao: "Liberar Próxima Pauta",
  /** [PROPOSTA] — a 3ª trava não tem copy (decisão do Lucas de 29/10). */
  revoto: "Abrir Revisão da Decisão",
  explicar: "Destravar Explicar e Protocolo",
};

/** Molde simples: troca `{chave}` pelo valor. Chave sem valor fica como está (a suíte cobra). */
export function preencher(molde: string, valores: Readonly<Record<string, string | number>>): string {
  return molde.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}

/** Os valores dos moldes que saem do pacote. */
export function valoresDoPacote(c: ConteudoDoPacote): Record<string, string | number> {
  const p = c.projetos;
  return {
    papel: p.papel.nome,
    parcial: p.parcial.nome,
    nuvem: p.nuvem.nome,
    vagasPapel: p.papel.vagas,
    vagasParcial: p.parcial.vagas,
    vagasNuvem: p.nuvem.vagas,
    custoPapel: p.papel.custoPorVaga,
    custoParcial: p.parcial.custoPorVaga,
    custoNuvem: p.nuvem.custoPorVaga,
    impactoPapel: p.papel.impacto,
    impactoParcial: p.parcial.impacto,
    impactoNuvem: p.nuvem.impacto,
    refeicoes: refeicoesDosCadernos(c).toLocaleString("pt-BR"),
    custoRefeicao: custoPorRefeicao(c),
  };
}
