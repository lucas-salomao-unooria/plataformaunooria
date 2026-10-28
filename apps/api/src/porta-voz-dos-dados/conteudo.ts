/**
 * O CATÁLOGO da exp03em1b — O Porta-Voz dos Dados (3ª série do EM, unidade 1,
 * ADR-198): vocabulários, o que é FIXO no servidor e o banco curado padrão.
 *
 * Fonte: os artefatos da esteira (`artefatos_exp03em1b`, 2026-10-28) — o PRD
 * §11 a §14, o banco de conteúdo `dev/01e` (o texto literal do banco padrão) e
 * a copy revisada `design/06`, com as diretrizes do PO e as decisões do Lucas
 * do plano aprovado por cima (onde divergem, vale o plano). Correções de texto
 * do PO aplicadas: o Fator de Mentira é "≈ 6,3" (nunca 6,37), a variação
 * visual ~46,7%; TC-32 "renomados"; TC-33 "que vocês montaram".
 *
 * **O que a IA pode variar** é a ROUPAGEM do pacote (`ConteudoDoPacote`): o
 * recorte do grupo (TC-02), os textos da tabela e do serviço, a nota técnica,
 * os textos das três camadas do compositor, as reações dos três moradores nos
 * ramos 0 e 80, a fala do conflito (TC-17) e a do Coordenador. **O que NÃO
 * varia** — e por isso mora aqui, e não no pacote — são os números (95, 94,
 * 92 e 88), a escola rival, os cartões eleitorais da perícia e a régua: o
 * dilema e a medida são os mesmos em toda turma.
 *
 * Puro — sem Nest e sem Prisma. A experiência e o hub têm espelhos destas
 * listas; mudar a forma aqui sem avisar quebra os dois.
 */

export const EXP_ID = "exp03em1b";

/** Gravada em cada sessão: o histórico se reprocessa pela versão que o mediu. */
export const VERSAO_DO_INSTRUMENTO = "1.0.0";

// ──────────────────────────────────────────── vocabulários (CHECK na migration)

/**
 * O componente curricular do recorte: a Formação Geral Básica da 3ª série
 * (`curriculo/componentes.ts#componentesDoAno("3EM")`, na ordem do catálogo,
 * sem o sufixo `-em`), Computação e o projeto interdisciplinar no fim — a
 * mesma lista das missões do EM. `tests/porta-voz-dos-dados-regras.spec.ts`
 * confere slug, rótulo e o CHECK.
 */
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

export const ROTULO_DA_DISCIPLINA: Readonly<Record<Disciplina, string>> = {
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

export const ORIGENS = ["ia", "padrao"] as const;
export type Origem = (typeof ORIGENS)[number];

/**
 * O GATE da turma, só para a frente: `exploracao` (a turma navega, decide e
 * publica) → `pausa` ("Pausar Telas", o debate do Aha) → `liberada` ("Liberar
 * Retomada da Turma": a errata, o laudo e a perícia). Quem publica depois da
 * liberação não pausa: vê o conflito e segue para a errata (decisão 7).
 */
export const ETAPAS_DO_GATE = ["exploracao", "pausa", "liberada"] as const;
export type EtapaDoGate = (typeof ETAPAS_DO_GATE)[number];

/** A origem do eixo Y: o dilema inteiro da missão (TC-06.1 e TC-06.2). */
export const ESCALAS = [0, 80] as const;
export type Escala = (typeof ESCALAS)[number];

/** As três camadas do compositor (interruptores, decisão 3). */
export const CAMADAS = ["explicacao", "fonte", "contexto"] as const;
export type Camada = (typeof CAMADAS)[number];

/** As duas publicações do V1: a 1ª (slot 1) e a errata (slot 2). Não há 3ª publicação. */
export const TIPOS_DE_PUBLICACAO = ["inicial", "errata"] as const;
export type TipoDePublicacao = (typeof TIPOS_DE_PUBLICACAO)[number];

/** O motivo de um cartão sinalizado na perícia (E6). */
export const MOTIVOS_DA_PERICIA = ["escala", "fonte", "titulo"] as const;
export type MotivoDaPericia = (typeof MOTIVOS_DA_PERICIA)[number];

/** Os marcos que a TELA informa e o SERVIDOR carimba (a primeira vez vale). */
export const MARCOS = ["chat_aberto", "anexo_aberto", "nudge_e2", "compositor_aberto", "pericia_aberta"] as const;
export type Marco = (typeof MARCOS)[number];

/** O que o "Regenerar Item" da curadoria refaz (um de cada vez). */
export const ITENS_DO_PACOTE = ["grupo", "servico", "notaTecnica", "camadas", "reacoes", "posAha"] as const;
export type ItemDoPacote = (typeof ITENS_DO_PACOTE)[number];

export const SLOTS_DE_PUBLICACAO = 3;
export const TEMA = { min: 3, max: 60 } as const;
export const ASSUNTOS = { min: 3, max: 6, caracteres: 120, total: 600 } as const;
/** Teto de uma mensagem simulada no grupo (PRD §12.3: 180 caracteres). */
export const MENSAGEM_MAX_CARACTERES = 180;
export const MORADORES = 3;

// ──────────────────────────────────────────── o que é FIXO (nunca vem da IA)

/** A série histórica (tab-exp03em1b-01): 95% → 88%, 120 pontos de coleta. */
export const SERIE_HISTORICA = [
  { valor: 95, coletadas: 120, conformes: 114, inconformes: 6 },
  { valor: 94, coletadas: 120, conformes: 113, inconformes: 7 },
  { valor: 92, coletadas: 120, conformes: 110, inconformes: 10 },
  { valor: 88, coletadas: 120, conformes: 106, inconformes: 14 },
] as const;

/** O laudo (E5): os números da desmontagem, com as correções do PO ("≈ 6,3"; ~46,7%). */
export const LAUDO = {
  titulo: "Laudo de Auditoria de Dados da Escola",
  desmontagem:
    "O indicador caiu de 95% para 88%, uma diferença de 7 pontos percentuais. Como o eixo começa em 80%, a altura da coluna diminui aproximadamente 47%, fazendo a queda parecer visualmente muito maior.",
  fatorDeMentira:
    "Fator de Mentira: variação visual (~46,7%) dividida pela variação real (~7,37%) ≈ 6,3. Um gráfico sem distorção mantém o fator próximo a 1. Valores distantes revelam exagero visual.",
  fator: "≈ 6,3",
  variacaoVisual: "~46,7%",
  variacaoReal: "~7,37%",
  quedaEmPontos: 7,
  alturas: { origem0: { primeiro: 95, ultimo: 88 }, origem80: { primeiro: 15, ultimo: 8 } },
  regua: { instrucao: "Arraste para calibrar a origem do eixo Y:", minimo: "Eixo em 0% (proporcional)", maximo: "Eixo em 80% (truncado)" },
  acao: "Avançar para Perícia Técnica",
} as const;

/** A escola que publica a mesma planilha com a escala OPOSTA, 10 s depois (E4-ALU-02). */
export const RIVAL = {
  escola: "Escola Estadual Santos Dumont",
  chip: "Planilha Municipal Oficial · Autenticação Criptográfica Idêntica",
} as const;

/** Os textos do Assistente de Dados (bot determinístico, 01e "Falas da IA simulada") e do compositor. */
export const TEXTOS_DO_CHAT = {
  bot: "Assistente de Dados — Programa Municipal",
  previaDoBot: "Credenciamento oficial emitido. Inicie a estruturação.",
  statusDoGrupo: "Somente administradores e porta-vozes credenciados podem publicar.",
  posse:
    "Olá, estudante. Você foi nomeado Porta-Voz Oficial de Dados da sua escola perante a administração municipal. Sua missão é analisar os indicadores recebidos, estruturar o boletim técnico e encaminhá-lo com transparência ao grupo da cidade. Use suas publicações com responsabilidade técnica.",
  iniciar: "Iniciar Estruturação de Dados",
  nudgeE1: "Ainda por aí? Clique abaixo para iniciar a estruturação dos dados.",
  introDaTabela:
    "Recebemos os registros consolidados da subprefeitura referentes aos últimos quatro meses. Inspecione os percentuais tabulados e consulte os anexos metodológicos antes de selecionar a representação gráfica do boletim.",
  perguntaDaPrevia: "Qual visualização você deseja gerar para o relatório?",
  nudgeE2: "Porta-Voz, o Comitê Municipal aguarda seu boletim. Toque na escala acima para gerar o preview.",
  escalas: { zero: "Escala Absoluta (Origem 0)", oitenta: "Escala com Recorte de Variação (Origem 80%)" },
  errata:
    "Atenção, Porta-Voz: Diante do debate gerado no comitê público, o regulamento do programa permite que você publique uma ERRATA TÉCNICA CORRETIVA utilizando o seu 2º slot de publicação (restando 1/3). O post anterior permanecerá no histórico.",
  publicarErrata: "Publicar Errata Corretiva",
  pularErrata: "Avançar sem publicar errata",
  cotaEsgotada:
    "Atenção, Porta-Voz: Sua cota de 3 publicações oficiais no Comitê Municipal foi integralmente utilizada. O protocolo governamental encerra novas emissões para esta sessão. Prossiga para a emissão do parecer e laudo técnico final.",
  foraDoTema:
    "Como Assistente de Dados governamental, opero exclusivamente por comandos estruturados de monitoramento. Por favor, utilize os botões e opções disponíveis no painel para prosseguir com a estruturação técnica do seu boletim.",
  pausa: "Sessão pausada pela Coordenação para mediação técnica em sala.",
} as const;

/** O nome FIXO do grupo público; o recorte do professor entra depois dele (TC-02). */
/**
 * O moderador do grupo é FIXO: o PO decidiu (refazer de design, 28/10) que o
 * papel do Coordenador Silva não muda. A IA escreve a fala dele no tema da
 * aula; o nome e o perfil o servidor impõe ao entregar a sessão.
 */
export const COORDENADOR = { autor: "Coordenador Silva", perfil: "Gestor do Comitê de Políticas Públicas" } as const;

export const NOME_DO_GRUPO = "Comitê Municipal de Políticas Públicas";

export function nomeDoGrupo(recorte: string): string {
  return `${NOME_DO_GRUPO} — ${recorte}`;
}

/**
 * A PERÍCIA (E6, tab-exp03em1b-02): os dados da Secretaria e os dois cartões.
 * Fixos em toda turma. O GABARITO (`CARTAO_DISTORCIDO`, `MOTIVO_DA_DISTORCAO`)
 * não desce ao estudante: a tela recebe os cartões como peças, sem rótulo.
 * O título do cartão B fica como a régua do PO o escreveu (decisão 6).
 */
export const PERICIA = {
  canal: "Notícias da Cidade — Eleições Municipais",
  chamado:
    "Você foi convocado como perito independente de dados. Use a ferramenta de perícia abaixo para inspecionar os gráficos e emitir seu parecer técnico oficial.",
  dados: {
    titulo: "Relatório Técnico Oficial de Ocorrências Policiais",
    origem: "Origem: Secretaria de Segurança Pública · Base Consolidada Anual",
    indicador: "Taxa Anual de Homicídios Dolosos por 100 mil habitantes",
    periodos: [
      { rotulo: "Ano Anterior (Período 1)", ocorrencias: 145, populacao: "601.660 hab.", taxa: 24.1 },
      { rotulo: "Ano Atual (Período 2)", ocorrencias: 143, populacao: "600.840 hab.", taxa: 23.8 },
    ],
  },
  cartoes: [
    {
      id: "A",
      titulo: "Cartão Eleitoral A — Coligação Avança Cidade",
      partido: "Coligação Avança Cidade (Situação)",
      tituloDoGrafico: "Segurança Pública em Estabilidade — Índices Oficiais Mantidos",
      eixo: { origem: 0, teto: 30 },
      fonte: "Secretaria de Segurança Pública · Base Consolidada Anual",
    },
    {
      id: "B",
      titulo: "Cartão Eleitoral B — Frente Renovadora Popular",
      partido: "Frente Renovadora Popular (Oposição)",
      tituloDoGrafico: "Queda Histórica da Violência: Nova Gestão Promove Despencamento dos Índices Criminais!",
      eixo: { origem: 23.5, teto: 24.5 },
      fonte: "Secretaria de Segurança Pública · Base Consolidada Anual",
    },
  ],
  sinalizar: "Sinalizar para revisão",
  motivoTitulo: "Motivo principal da inconformidade:",
  motivos: { escala: "escala", fonte: "fonte", titulo: "título" },
  emitir: "Emitir parecer",
  pular: "Avançar sem emitir parecer",
} as const;

/** O gabarito da perícia — SÓ no servidor (regra 3). */
export const CARTAO_DISTORCIDO = "B" as const;
export const MOTIVO_DA_DISTORCAO: MotivoDaPericia = "escala";

/** A conclusão (E6-ALU-03). Sem podcast na tela do estudante (decisão 1). */
export const CONCLUSAO = { selo: "Missão Oficial Concluída — Protocolo Homologado", somenteLeitura: "Modo somente leitura" } as const;

/** O roteiro do debate do Aha (one-pager §9, mediação plenária) e os dois botões. */
export const ROTEIRO_DO_DEBATE = [
  "Ambas as escolas usaram a mesma planilha oficial com 95% e 88% de conformidade. Por que os dois desenhos parecem dizer coisas totalmente opostas?",
  "Se você fosse um morador da rua onde a tubulação quebrou, qual gráfico defenderia seus direitos? E se você fosse o diretor do hospital geral, qual gráfico evitaria histeria desnecessária?",
  "Por que apenas postar a imagem do gráfico sem a Nota de Intenção causou tanto caos no grupo comunitário?",
] as const;

export const INSTRUCOES_DO_GATE = {
  pausar: "Pausar Telas para Debate",
  liberar: "Liberar Retomada da Turma",
} as const;

// ──────────────────────────────────────────── o pacote (o que a IA varia)

export interface FalaDoGrupo {
  autor: string;
  perfil: string;
  texto: string;
}

export interface ConteudoDoPacote {
  /** O recorte que entra no nome do grupo (TC-02): "Comitê Municipal de Políticas Públicas — {grupo}". */
  grupo: string;
  /** A roupagem da tabela (E2-ALU-01). Os números são fixos (`SERIE_HISTORICA`). */
  servico: {
    orgao: string;
    indicador: string;
    unidade: string;
    abrangencia: string;
    periodicidade: string;
    periodos: string[];
    situacoes: string[];
  };
  /** O anexo (E2-ALU-02): o PDF da subprefeitura. `resumo` é o texto da folha. */
  notaTecnica: {
    arquivo: string;
    titulo: string;
    orgao: string;
    resumo: string;
    secoes: Array<{ titulo: string; texto: string }>;
  };
  /** Os textos FIXOS de cada interruptor do compositor. A explicação da escala acompanha 0 ou 80. */
  camadas: {
    explicacao: { zero: string; oitenta: string };
    fonte: string;
    contexto: string;
  };
  /** As reações dos MESMOS três moradores, por ramo da escala publicada (TC-11..16). */
  reacoes: { zero: FalaDoGrupo[]; oitenta: FalaDoGrupo[] };
  /** Depois do post espelho: o morador confuso (TC-17) e o Coordenador que suspende a deliberação. */
  posAha: { conflito: FalaDoGrupo; coordenador: FalaDoGrupo };
}

/** O banco padrão (one-pager §9a): Vigilância Sanitária da Água. */
export const PACOTE_PADRAO = {
  nome: "Vigilância Sanitária da Água",
  disciplina: "biologia" as Disciplina,
  tema: "Vigilância Sanitária da Água",
  assuntos: ["Conformidade bacteriológica da água tratada", "Manutenção da rede de distribuição", "Comunicação pública de indicadores"],
} as const;

/** O banco padrão: o 01e LITERAL (cópia nova a cada chamada — o chamador pode mexer). */
export function conteudoDoPadrao(): ConteudoDoPacote {
  return {
    grupo: "Vigilância Sanitária da Água",
    servico: {
      orgao: "Vigilância Sanitária Municipal",
      indicador: "Índice de Conformidade Bacteriológica da Água Tratada",
      unidade: "% de amostras conformes às normas sanitárias vigentes",
      abrangencia: "Rede Pública de Abastecimento Urbano (120 pontos de coleta sistemática)",
      periodicidade: "Mensal (Último Quadrimestre Consolidado)",
      periodos: ["Mês 1", "Mês 2", "Mês 3", "Mês 4"],
      situacoes: [
        "Parâmetro em faixa de conformidade excelente",
        "Parâmetro estável dentro do limite de controle",
        "Oscilação preliminar; monitoramento intensificado",
        "Variação atípica com intervenção técnica em andamento",
      ],
    },
    notaTecnica: {
      arquivo: "Nota_Metodologica_Subprefeitura.pdf",
      titulo: "Nota Metodológica Oficial — Subprefeitura",
      orgao: "Departamento Técnico de Monitoramento Urbano",
      resumo:
        "A variação percentual de conformidade registrada entre o Mês 1 e o Mês 4 concentrou-se pontualmente em duas ruas centrais devido a obras emergenciais na tubulação antiga. A rede que atende os demais bairros manteve estabilidade operacional de 98%.",
      secoes: [
        {
          titulo: "1. Objeto e critérios de amostragem",
          texto:
            "A apuração quadrimestral do Índice de Conformidade Bacteriológica da Água Tratada obedece aos padrões estabelecidos na legislação sanitária federal e municipal. O índice reflete a ausência de coliformes totais e Escherichia coli em amostras coletadas diretamente nas torneiras de entrada de imóveis atendidos pela rede pública. A amostragem contempla 120 pontos fixos georreferenciados distribuídos em todos os distritos urbanos, assegurando representatividade estatística uniforme.",
        },
        {
          titulo: "2. Série histórica consolidada (quadrimestre vigente)",
          texto:
            "Mês 1: 95% de conformidade técnica (114 amostras regulares / 6 com turbidez pontual). Mês 2: 94% de conformidade técnica (113 amostras regulares / 7 com turbidez pontual). Mês 3: 92% de conformidade técnica (110 amostras regulares / 10 com inconformidade leve). Mês 4: 88% de conformidade técnica (106 amostras regulares / 14 com inconformidade).",
        },
        {
          titulo: "3. Ressalva técnica e contexto operacional localizado",
          texto:
            "A variação percentual de conformidade registrada entre o Mês 1 e o Mês 4 (queda de 7 pontos percentuais) concentrou-se pontualmente em duas vias centrais — a Rua das Flores e a Rua do Comércio —, devido a obras emergenciais para substituição de antigas tubulações de ferro fundido instaladas na década de 1960. Durante as intervenções físicas, houve infiltração localizada de sedimentos particulados nas redes secundárias dessas duas vias. Ressalta-se que a malha de distribuição de água que abastece os demais 98% da malha urbana municipal permaneceu com estabilidade operacional plena e indicadores de potabilidade rigorosamente seguros durante todo o período.",
        },
        {
          titulo: "4. Medidas adotadas e conclusão",
          texto:
            "As obras nas duas vias afetadas foram concluídas no encerramento do Mês 4, tendo sido executada a higienização química e descargas sucessivas de rede. A subprefeitura reitera que os números municipais agregados não representam colapso sistêmico do abastecimento, tratando-se de contingência de manutenção circunscrita e controlada.",
        },
      ],
    },
    camadas: {
      explicacao: {
        zero: "Eixo vertical iniciando em 0% (intervalo total de 0 a 100%).",
        oitenta: "Eixo vertical recortado a partir de 80% (intervalo de 80 a 100%).",
      },
      fonte: "Fonte oficial: Relatório Mensal Técnico da Subprefeitura Municipal.",
      contexto: "Nota: Redução concentrada em duas vias durante manutenção emergencial de dutos.",
    },
    reacoes: {
      zero: [
        { autor: "Mariana Costa", perfil: "Líder Comunitária", texto: "Ah, tudo tranquilo, oscilação normal de rotina" },
        { autor: "Conselheiro Beto", perfil: "Membro do Conselho Tutelar", texto: "Não precisamos aprovar verba emergencial nenhuma para a escola" },
        { autor: "Dr. Arnaldo Mendes", perfil: "Médico Sanitarista", texto: "Deixa como está" },
      ],
      oitenta: [
        { autor: "Mariana Costa", perfil: "Líder Comunitária", texto: "Meu Deus, a água da cidade está contaminada!" },
        { autor: "Conselheiro Beto", perfil: "Membro do Conselho Tutelar", texto: "Exijo fechamento imediato das escolas e interdição do reservatório!" },
        { autor: "Dr. Arnaldo Mendes", perfil: "Médico Sanitarista", texto: "Que absurdo essa prefeitura!" },
      ],
    },
    posAha: {
      conflito: {
        autor: "Mariana Costa",
        perfil: "Líder Comunitária",
        texto: "Ué, afinal de contas, a situação está normal ou em colapso? Qual escola está mentindo?",
      },
      coordenador: {
        autor: "Coordenador Silva",
        perfil: "Gestor do Comitê de Políticas Públicas",
        texto:
          "Atenção aos membros do comitê: ambos os boletins utilizam os mesmos índices da subprefeitura. Suspendo as deliberações para conferência técnica das representações visuais.",
      },
    },
  };
}
