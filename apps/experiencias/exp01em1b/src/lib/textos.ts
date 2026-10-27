import type { ApostaId, Funcao, Medidor, OpcaoDeCriterio } from "./tipos";

/**
 * A COPY da missão, literal do Figma `9QyrVdEBJZkOS64ZauPfmk` (63 telas) —
 * decisão do Lucas, 2026-10-26: o Figma vence o protótipo HTML e o copy sheet.
 * A suíte e2e casa por texto exato: mudou aqui, muda lá (e sobe a versão nos
 * três lugares).
 *
 * O que vem do SERVIDOR não está aqui: o pacote (as dúvidas, as respostas, as
 * trilhas), o material fixo (apostas, fichas, cartões, passos, critérios,
 * blocos) e o medidor. Aqui fica só o que a tela escreve em volta.
 */
export const TEXTOS = {
  geral: {
    unooria: "Unooria",
    zara: "Zara",
    /** E1 "primeira vez". */
    zaraDaComissao: "Zara (Comissão Estudantil)",
    zaraDaEquipe: "Zara (Equipe de Bancada)",
    bancada: "Unooria · Bancada",
    tagDaEquipe: (nome: string) => `Bancada da Comissão: ${nome}`,
    carregando: "Abrindo o módulo de homologação…",
    erroDeAbertura: "Não foi possível abrir o módulo de homologação agora. Feche e abra a missão de novo.",
  },
  /** A barra de etapas (Stepper do DS, só indica a posição). */
  etapas: {
    1: "Desafiar",
    2: "Funções",
    3: "Aposta",
    4: "Resultado",
    5: "Reconstruir",
    6: "Publicar",
  } as Record<number, string>,
  e1: {
    cabecalho: "Unooria · Comissão",
    tagPrimeiraVez: "1EM · Homologação",
    tagPadrao: "Módulo de Teste",
    fala: "\"Oi! A escola colocou o UnooriaAI em teste. Nossa missão na comissão é testar as três funções com colegas da turma e ver se ele cumpre o cadastro.\"",
    instrucao: "Abra o módulo de teste para iniciar a auditoria da comissão escolar.",
    abrir: "Abrir Módulo de Teste",
  },
  e2: {
    instrucao: "Inspecione as funções pedagógicas ativas no assistente antes de iniciar os testes da comissão.",
    titulos: {
      exercicios: "Função 1: Apresentar Exercícios",
      duvidas: "Função 2: Responder Dúvidas",
      sugestoes: "Função 3: Sugerir Conteúdos",
    } as Record<Funcao, string>,
    /**
     * O RESUMO sob o título da função já vista e recolhida (E2-ALU-01
     * "habilitado"). Só a função 1 encurta; as outras repetem a longa, como o
     * Figma desenha.
     */
    resumos: {
      exercicios: "Distribui trilhas nos níveis básico e avançado.",
      duvidas: "Atende estudantes em tempo real via chat inteligente para esclarecer conteúdos.",
      sugestoes: "Recomenda artigos, videoaulas e materiais de apoio no tema curricular trabalhado.",
    } as Record<Funcao, string>,
    /** A descrição LONGA (estado expandido) — briefing comum. */
    descricoes: {
      exercicios: "Distribui trilhas de estudos nos níveis básico e avançado para os estudantes.",
      duvidas: "Atende estudantes em tempo real via chat inteligente para esclarecer conteúdos.",
      sugestoes: "Recomenda artigos, videoaulas e materiais de apoio no tema curricular trabalhado.",
    } as Record<Funcao, string>,
    previa: {
      exercicios: "Prévia estática da interface de exercícios no UnooriaAI",
      duvidas: "Prévia estática da interface de dúvidas no UnooriaAI",
      sugestoes: "Prévia estática da interface de sugestões no UnooriaAI",
    } as Record<Funcao, string>,
    vista: "Função vista",
    ir: "Ir para Bateria de Testes",
  },
  e3: {
    instrucao: "Analise os formulários de preferências preenchidos voluntariamente pelos três estudantes da turma.",
    instrucaoDaEquipe: "Debatam em equipe e registrem a previsão consensual da estação.",
    idade: (nome: string, idade: number) => `${nome} (${idade} anos)`,
    fornecido: "[Fornecido no cadastro]",
    preferencia: "Preferência declarada: Trilha Avançada",
    pergunta: "Com base nas informações cadastradas pelos estudantes, qual será o nível liberado pelo assistente no teste?",
    dica: "Para iniciar a homologação, registre a previsão da comissão sobre o resultado dos estudantes.",
    disparar: "Disparar Simulação",
    latch: "Estado Latch Gravado",
    arquivada: (texto: string) => `Previsão arquivada: ${texto}`,
    definitiva: "A previsão foi registrada de forma definitiva no servidor da comissão.",
    iniciando: "Iniciando Simulação de Chat...",
    contingencia: "📡 Carregando versão de contingência da rede escolar",
    pacotePadrao: "Pacote Padrão",
    contingenciaFichas: "Fichas Cadastrais Carregadas (Banco Oficial)",
    contingenciaSegue: "A missão segue normalmente com o tema curricular oficial da rede.",
  },
  e4chat: {
    titulo: "UnooriaAI",
    sessao: (n: number, nome: string) => `Sessão de Teste ${n}/3: ${nome}`,
    concluidas: "Sessões 2/3 e 3/3 Concluídas",
    /** E4-ALU-01 "simulando": o card da Trilha Avançada do Lucas fecha com o acesso pleno (o Figma). */
    acessoPleno: "Acesso pleno concedido. Envie sua dúvida quando quiser.",
    tagDaEquipe: (nome: string) => `Bancada: ${nome}`,
    separadorBeatriz: "--- Sessão 2/3: Beatriz (23h45) ---",
    separadorThiago: "--- Sessão 3/3: Thiago (Sinal Instável) ---",
    boasVindasLucas: "Olá, Lucas! Seja bem-vindo à plataforma.",
    aviso: (texto: string) => `Aviso de Sistema: ${texto}`,
    bloqueada: "Entrada bloqueada durante a execução da bateria de testes...",
    concluida: "Sessões concluídas. Relatório de auditoria gerado...",
    enviar: "Enviar",
  },
  e4: {
    cabecalho: "Unooria · Auditoria",
    tag: "Flagrante da Triagem",
    /**
     * A citação de cada aposta no confronto, LITERAL do Figma (E4-ALU-02 A, B e
     * C): a A sai sem o "no cadastro" da opção; a B e a C são a opção inteira
     * sem o ponto final. `citacaoDaAposta` põe as aspas simples.
     */
    citacao: {
      a: "Todos receberão o nível Avançado conforme solicitado",
      b: "Apenas alguns receberão Avançado, pois o assistente fará triagem",
      c: "Todos receberão nível Básico até comprovarem proficiência",
    } as Record<ApostaId, string>,
    confronto: {
      a: (citacao: string) =>
        `Você previu: ${citacao}. No entanto, Beatriz e Thiago foram barrados. Por que o formulário que eles preencheram não foi respeitado?`,
      b: (citacao: string) =>
        `Você previu: ${citacao}. Você acertou que haveria corte, mas imagine que Beatriz e Lucas preencheram rigorosamente a mesma coisa. O que fez ela cair e ele não?`,
      c: (citacao: string) =>
        `Você previu: ${citacao}. Mas Lucas recebeu o Avançado imediatamente, enquanto Beatriz foi rebaixada. Se nenhum dos dois fez prova antes, o que o sistema usou para separá-los?`,
    } as Record<ApostaId, (citacao: string) => string>,
    fala: "\"Eles pediram avançado! De onde o assistente tirou que a Beatriz precisava de reforço básico? Precisamos abrir essas fichas.\"",
    abrirFichas: "Abrir Fichas de Auditoria de Acesso",
    tagFichas: "Relatório Comparativo",
    fichasTitulo: "Fichas de Auditoria de Acesso",
    compare: "Compare os dados fornecidos no formulário com os dados técnicos observados pela plataforma.",
    colunas: { estudante: "Estudante", formulario: "Formulário", observado: "Observado", acao: "Ação do Sistema" },
    fornecido: "[Fornecido]",
    inferencia: (texto: string) => `Inferência: ${texto}`,
    concluir: "Concluir Inspeção de Metadados",
  },
  espera: {
    tag: "Pausa para Mediação",
    texto: "Aguardando autorização da mediação docente para liberar a próxima fase da auditoria",
    debate1: "Roda de conversa coletiva em andamento com o professor (8 min).",
    debate2: "Comparação de soluções no quadro com o professor (5 min).",
    fundoE4: "Fichas de Auditoria Técnicas em segundo plano...",
    fundoE5: "Bancada de Critérios em segundo plano...",
    etapa: (n: number) => `Etapa ${n}`,
  },
  offline: {
    titulo: "Módulo de Homologação Offline",
    texto: "Conexão com o servidor da escola interrompida. Tentando restabelecer sinal...",
    botao: "Tentar Reconectar Agora",
  },
  expirada: {
    marca: "Unooria",
    titulo: "Sessão escolar pausada por segurança institucional",
    texto: "Seu acesso temporário expirou. Clique para revalidar sua credencial e continuar de onde parou.",
    botao: "Entrar Novamente",
  },
  e5: {
    instrucao: "Arraste ou toque nos cartões para separar os dados fornecidos pelo estudante dos dados técnicos observados pela plataforma.",
    instrucaoDaEquipe: "Arraste ou toque nos cartões para separar dados fornecidos de dados observados.",
    colunas: { fornecidos: "Dados Fornecidos", observados: "Dados Observados" } as const,
    colunaComTotal: (rotulo: string, n: number) => (n > 0 ? `${rotulo} (${n})` : rotulo),
    solte: "[Solte o cartão aqui]",
    cartoes: "Cartões da Sessão Técnica:",
    cartao1: "Cartão 1",
    /** (b) COMPENSAÇÃO de copy: o Figma não nomeia o alvo do toque nem o fechamento (ver AGENTS.md). */
    colocarEm: (rotulo: string) => `Colocar em ${rotulo}`,
    /** Etapa 5 da barra: "Reconstruir" nos cartões (E5-ALU-01), "Banco de Regras" nos critérios (E5-ALU-03). */
    etapaDosCriterios: "Banco de Regras",
    /* O cartão JÁ COLOCADO usa o rótulo curto do Figma (E5-ALU-01 "sem scaffolding"): na coluna estreita, o longo quebrava a palavra no meio. */
    rotuloCurto: {
      "trilha-avancada": "Trilha Avançada",
      "nome-turma": "Nome e Turma",
      horario: "Horário (23h45)",
      "sinal-de-rede": "Sinal de Rede",
      "endereco-ip": "Endereço IP",
      "modelo-aparelho": "Modelo Aparelho",
    } as Record<string, string>,
    /** E5-ALU-01 "por aparelho": o botão secundário no fim da tela, como o Figma. */
    selecione: "Toque para Selecionar e Alocar",
    incompleta: "A classificação dos dados da sessão ainda não foi concluída. Seus critérios serão registrados como estão.",
    /** E5-ALU-01 "sem scaffolding": a tabela causal, NA tela da classificação, quando ela fecha. */
    tabelaCausalTitulo: "Tabela Causal:",
    tabelaCausal: "Horário (Dado Observado) → Cansaço Presumido (Inferência) → Reforço Básico (Decisão Restritiva).",
    // E5-ALU-02
    etapaChip: "Etapa 5 · Explicar",
    opcional: "[Opcional / Aprofundamento] Ver etapas de processamento do assistente",
    /** E5-ALU-02 "marcado": o título do painel depois do primeiro passo marcado. */
    opcionalMarcado: "[Opcional / Aprofundamento] Decomposição EM13CO03",
    /** E5-ALU-02 "marcado": o rótulo CURTO de cada passo, ao lado do "(Essencial)"/"(Inferência dispensável)". */
    passoCurto: {
      1: "Ler mensagem enviada",
      2: "Checar relógio",
      3: "Calcular cansaço",
      4: "Alterar trilha",
      5: "Enviar resposta formatada",
    } as Record<number, string>,
    marqueAsInstrucoes: "Marque quais instruções do algoritmo realizam inferência comportamental desnecessária sobre o estudante.",
    passo: (n: number, rotulo: string) => `Passo ${n}: ${rotulo}`,
    dispensavel: "(Inferência dispensável)",
    enviesada: "(Ação enviesada)",
    essencial: "(Essencial)",
    pular: "Pular Etapa",
    iconesDosPassos: { 1: "💬", 2: "🕒", 3: "📊", 4: "🔀", 5: "📤" } as Record<number, string>,
    // E5-ALU-03
    instrucaoCriterios: "Selecione critérios no repositório da rede para reconfigurar as três funções do assistente escolar.",
    instrucaoCriteriosDaEquipe: "Debatam e escolham as regras de governança para as funções do assistente.",
    funcao: {
      exercicios: "Função 1 (Exercícios)",
      duvidas: "Função 2 (Dúvidas)",
      sugestoes: "Função 3 (Sugestões)",
    } as Record<Funcao, string>,
    ativo: "[Ativo]",
    /** E5-ALU-03 "critérios alterados": o botão que reabre as três opções da função resumida. */
    trocar: "Trocar critério",
    trocarCriterio: (funcao: string) => `Trocar o critério da ${funcao}`,
    executar: "Executar Novo Teste de Homologação",
    // E5-ALU-04
    reteste: "Unooria · Reteste",
    resultado: "Resultado da Bateria",
    atencao: "Atenção Técnica",
    homologada: "Equidade Homologada",
    aprovada: "Homologação Aprovada: critérios equitativos ativos. Beatriz acessou o nível Avançado e Thiago manteve dúvidas liberadas.",
    semRestricao: "Nenhum estudante foi restrito por horário ou oscilação técnica.",
    avancarAprovado: "Avançar para Homologação e Transparência",
    alerta: "Alerta de Viés Mantido",
    alertaTexto: "Atenção: as regras ativas continuam gerando restrições baseadas em dados observados. Revise os critérios no banco antes de aprovar.",
    revisar: "Revisar Critérios",
    avancarComAlerta: "Avançar para Publicação",
    efeitoNoChat: "Novo teste no UnooriaAI",
  },
  e6: {
    instrucao: "Ative a declaração de transparência e monte o comunicado oficial da comissão escolar articulando os quatro pontos lógicos.",
    instrucaoDaEquipe: "Revisem em equipe os 4 blocos da cadeia causal antes de publicar.",
    pagina: "Página Pública de Transparência do UnooriaAI",
    garantia:
      "Garantia de direito à explicação e canal de contestação com revisão humana para qualquer decisão automática de trilha ou limite",
    comunicado: "Comunicado Institucional da Comissão:",
    comeceAqui: "▶ Comece aqui",
    /** E6-ALU-01 "blocos preenchidos": a página e os quatro blocos se recolhem sob este título (o Figma só desenha o comunicado montado). */
    revisarBlocos: "Revisar página e blocos",
    /** O rótulo curto de cada bloco no texto montado ("blocos preenchidos"). */
    rotuloCurto: { problema: "1. Problema:", inferencia: "2. Inferência:", regra: "3. Regra Corrigida:", salvaguarda: "4. LGPD:" } as Record<string, string>,
    incompleto:
      "O comunicado da comissão precisa articular todos os quatro pontos: o problema, a inferência indevida, a regra corrigida e o canal de revisão humana.",
    publicar: "Publicar Transparência e Comunicado",
    // E6-ALU-02
    cabecalho: "Unooria · Homologação",
    tag: "Auditoria Concluída",
    tagDaEquipe: "Missão Concluída",
    fala: "\"Agora ninguém mais fica sem saber por que uma decisão foi tomada. E quem discordar tem por onde recorrer!\"",
    certificado: "Certificado de Homologação Ética Escolar",
    salvaguarda: "Salvaguarda Ativa: Direito à Explicação e Revisão Humana (LGPD)",
    estacaoHomologada: (nome: string) => `Bancada da Comissão: ${nome} Homologada`,
    congelada: "Interface congelada em modo leitura oficial.",
    sinteseTitulo: "Síntese Conceitual da Missão",
    sintese:
      "Você investigou como dados observados alimentam inferências algorítmicas enviesadas. Reconstruiu regras com critérios justos e garantiu transparência pública e direito à revisão humana, conforme assegurado pela LGPD.",
    desafioTitulo: "Desafio Extra de Homologação:",
    desafio:
      "Auditoria de Casos Extremos: Simule o acesso de um estudante que utiliza conexão via satélite de madrugada e analise quais salvaguardas adicionais a escola deveria adotar.",
    pularDesafio: "Pular Desafio Extra e Encerrar",
  },
} as const;

/** A letra do critério na tela ("Critério 1A"), pela posição da função. */
export function rotuloDoCriterio(funcao: Funcao, opcao: OpcaoDeCriterio, rotulo: string): string {
  const n = ["exercicios", "duvidas", "sugestoes"].indexOf(funcao) + 1;
  return `Critério ${n}${opcao.toUpperCase()}: ${rotulo}`;
}

/** Um texto entre aspas simples, sem o ponto final (a forma da citação no confronto). */
export function citarAposta(texto: string): string {
  return `'${texto.trim().replace(/\.+$/, "")}'`;
}

/** A citação do confronto pela aposta (literal do Figma, E4-ALU-02), entre aspas simples. */
export function citacaoDaAposta(aposta: ApostaId): string {
  return citarAposta(TEXTOS.e4.citacao[aposta]);
}

/**
 * "Otimização: de 5 para N passos essenciais" (E5-ALU-02). N = 5 − marcados:
 * é a conta DO ESTUDANTE, não o gabarito — a tela não sabe quais passos são
 * dispensáveis (`PASSOS_DISPENSAVEIS` mora só na api).
 */
export function otimizacao(marcados: number, total = 5): string {
  const n = Math.max(0, total - Math.max(0, Math.min(total, marcados)));
  return `Otimização: de ${total} para ${n} ${n === 1 ? "passo essencial" : "passos essenciais"}`;
}

/** O medidor da turma em texto (E4-ALU-02). Sem medidor (menos de 3 apostas), nada. */
export function textoDoMedidor(m: Medidor): string | null {
  if (!m) return null;
  return `Na sua turma: ${m.a}% apostou que o cadastro seria cumprido integralmente (A), ${m.b}% previu triagem parcial (B) e ${m.c}% previu básico para todos (C)`;
}

/**
 * Uma linha do comunicado montado (E6-ALU-01, "blocos preenchidos"): o começo
 * do bloco sem as reticências finais, a opção escolhida e o fecho — o
 * primeiro bloco termina em reticências (a frase continua no segundo); os
 * outros, em ponto.
 */
export function linhaDoBloco(inicio: string, opcao: string, indice: number): { antes: string; trecho: string; fecho: string } {
  const antes = inicio.replace(/\s*\.\.\.$/, "").replace(/\s*…$/, "");
  return { antes: antes ? `${antes} ` : "", trecho: opcao, fecho: indice === 0 ? "..." : "." };
}
