/**
 * O CATÁLOGO da exp02em1b — O Efeito Amplificador 2.1.0 (ADR-191): vocabulários,
 * o banco curado padrão e os textos fixos da missão.
 *
 * Fonte: os artefatos da esteira revisados (`artefatos_exp02em1b`, 2026-10-27) —
 * o PRD 2.1.0 e o anexo do one-pager aprovado (§2, §9–§12a), o banco de conteúdo
 * `dev/01e` e a copy revisada `design/06` (a fonte dos TEXTOS de tela). Onde o
 * PRD e a copy divergem num texto, vale a copy; num comportamento, o PRD.
 * Fora desta versão, por decisão do dono do produto: o Canal B e a
 * transferência da Etapa 6 (o caso do streaming de áudio).
 *
 * Puro — sem Nest e sem Prisma. A experiência e o hub têm espelhos destas
 * listas; mudar a forma aqui sem avisar quebra os dois.
 */

export const EXP_ID = "exp02em1b";

/** Gravada em cada sessão: o histórico se reprocessa pela versão que o mediu. */
export const VERSAO_DO_INSTRUMENTO = "2.1.0";

// ──────────────────────────────────────────── vocabulários (CHECK na migration)

/**
 * O componente curricular do recorte do professor: TODA a Formação Geral Básica
 * da 2ª série (`curriculo/componentes.ts#componentesDoAno("2EM")`, na ordem do
 * catálogo), mais Computação e o projeto interdisciplinar no fim — migração
 * `20261026230000_componentes_bncc_nas_missoes`. Os slugs são os do catálogo
 * SEM o sufixo `-em`; só se ACRESCENTA — um CHECK mais estreito quebraria a
 * migração. `tests/efeito-amplificador-regras.spec.ts` confere slug e rótulo.
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

/** Os rótulos do catálogo de componentes, os do EM (LDB art. 35-D). */
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

/** Os três NÓS CRÍTICOS que todo rascunho carrega (PRD §12, `rascunho`). */
export const NOS = ["alucinacao", "plagio", "lgpd"] as const;
export type No = (typeof NOS)[number];

/** As três manchetes de capa (one-pager §4, Etapa 3). */
export const MANCHETES = ["neutra", "construtiva", "sensacionalista"] as const;
export type Manchete = (typeof MANCHETES)[number];

/**
 * A categoria de cada comentário da madrugada (PRD §12, `comentariosMadrugada`).
 * É GABARITO: não desce ao estudante. O pacote precisa de dois relatos de saúde
 * física, um de saúde mental e duas contas anônimas invasivas.
 */
export const TIPOS_DE_COMENTARIO = ["saude_fisica", "saude_mental", "anonimo_agressivo", "engajamento"] as const;
export type TipoDeComentario = (typeof TIPOS_DE_COMENTARIO)[number];

/** O gate da TURMA, que o professor move: só para a frente (PRD API-010). */
export const FASES = ["exploracao", "pausa", "explicar"] as const;
export type Fase = (typeof FASES)[number];

/** Os motivos do aviso de cuidado (TC-19), na ordem da folha. O de saúde é o da EM13CO24. */
export const MOTIVOS_DO_AVISO = ["saude_usuarios", "fonte_duvidosa", "ofensivo"] as const;
export type MotivoDoAviso = (typeof MOTIVOS_DO_AVISO)[number];

/** Para quem o relato da Central de Apoio vai (TC-18). */
export const DESTINOS_DO_RELATO = ["escola", "unoovista"] as const;
export type DestinoDoRelato = (typeof DESTINOS_DO_RELATO)[number];

// ──────────────────────────────────────────── tetos (PRD §4, §12 e a copy)

export const COMENTARIOS_POR_PACOTE = 6;
export const PARAGRAFOS = { min: 4, max: 6 } as const;
export const MENSAGENS_NO_CHAT = 5;
export const MAX_CARACTERES_DA_MENSAGEM = 300;
export const TEMA = { min: 3, max: 60 } as const;
export const MANCHETE_MAX_CARACTERES = 80;
export const PARAGRAFO_MAX_PALAVRAS = 45;
export const COMENTARIO_PALAVRAS = { min: 5, max: 45 } as const;
export const PAUTA = { titulo: 80, descricao: 250, orientacao: 120, orientacoes: { min: 2, max: 4 } } as const;

// ──────────────────────────────────────────── o pacote

export interface ParagrafoDoRascunho {
  /** `p1`…`p6`, na ordem do post. */
  id: string;
  /** O nó crítico que este parágrafo carrega, ou `null` (texto de ligação). */
  no: No | null;
  texto: string;
  /** Só nos três nós: a versão que o UnooriaAI escreve quando o estudante pede. */
  corrigido?: string;
}

export interface ComentarioDoFeed {
  /** `c1`…`c6`. */
  id: string;
  /** O nome que o feed mostra — de colega ("Clara") ou de conta ("user_89412"). */
  autor: string;
  /** "02h40" — sempre entre 01h00 e 03h30: o motor entrega de madrugada para TODOS. */
  horario: string;
  tipo: TipoDeComentario;
  texto: string;
}

export interface PautaDoGremio {
  titulo: string;
  descricao: string;
  orientacoes: string[];
}

/**
 * O conteúdo de um pacote — o que o professor aprova (PRD §12,
 * `PacoteConteudoExp02`). O rascunho vem em PARÁGRAFOS, cada nó com a versão que
 * o UnooriaAI entrega quando o estudante pede (ADR-191); os três campos dos nós
 * nomeiam o que a fala do assistente cita. O schema real é o Zod de
 * `contrato-de-rotas.ts#ConteudoDoPacoteSchema`, e a régua é
 * `regras/pacote.ts#problemasDoConteudo`.
 */
export interface ConteudoDoPacote {
  pauta: PautaDoGremio;
  rascunho: ParagrafoDoRascunho[];
  /** O instituto inventado da alucinação ("DataBrasil 2026") — a fala da fonte o nomeia. */
  fonteInventada: string;
  /** O dado pessoal exposto no nó de LGPD ("Gabriel Mendes do 2º C"). */
  colega: string;
  /** A autoria do trecho copiado sem crédito ("Dra. Helena Ramos, na Revista …"). */
  fonteOriginal: string;
  /**
   * A frase que o algoritmo PINÇA fora de contexto para o feed. Mora num
   * parágrafo que SOBREVIVE às correções (no original e, se for nó, no
   * corrigido): o cuidado do estudante não a tira do post — é a virada.
   */
  recorte: string;
  manchetes: Record<Manchete, string>;
  comentarios: ComentarioDoFeed[];
}

/** O banco curado padrão: "Convivência Escolar e Celular" (01e, literal). */
export const PACOTE_PADRAO = {
  nome: "Convivência Escolar e Celular",
  disciplina: "interdisciplinar" as Disciplina,
  tema: "Convivência Escolar e Celular",
  assuntos: ["Uso do celular no intervalo", "Notificações durante as aulas", "Regras coletivas de convivência"],
} as const;

export function conteudoDoPadrao(): ConteudoDoPacote {
  return {
    pauta: {
      titulo: "Campanha Convivência Escolar e Celular",
      descricao: "Mobilização do grêmio para incentivar hábitos digitais conscientes e diálogo respeitoso na comunidade escolar.",
      orientacoes: [
        "Produza uma mensagem informativa e acolhedora para os estudantes.",
        "Audite fontes e remova menções diretas à vida privada de colegas.",
        "Garanta que o conteúdo promova a integração e o bem-estar coletivo.",
      ],
    },
    rascunho: [
      { id: "p1", no: null, texto: "A dependência de telas está destruindo as relações no colégio." },
      {
        id: "p2",
        no: "alucinacao",
        texto: "Segundo o DataBrasil 2026, 92% dos alunos sofrem de ansiedade severa pelo uso indevido do celular em sala de aula.",
        corrigido: "Estudos educacionais apontam desafios na concentração e no descanso causados pelo uso excessivo de celulares.",
      },
      {
        id: "p3",
        no: "plagio",
        texto: "A conexão constante desconecta os jovens da empatia básica no convívio presencial.",
        corrigido:
          "Como destaca a Dra. Helena Ramos na Revista Educação & Contemporaneidade (2025): “A conexão constante desconecta os jovens da empatia básica no convívio presencial.”",
      },
      {
        id: "p4",
        no: "lgpd",
        texto:
          "O estudante Gabriel Mendes do 2º C inclusive tomou advertência ontem após brigar no grupo da sala por causa de mensagens noturnas.",
        corrigido: "Situações de atrito em grupos virtuais têm gerado desgastes na convivência escolar de diversos estudantes.",
      },
    ],
    fonteInventada: "DataBrasil 2026",
    colega: "Gabriel Mendes do 2º C",
    fonteOriginal: "Dra. Helena Ramos na Revista Educação & Contemporaneidade (2025)",
    recorte: "A dependência de telas está destruindo as relações no colégio.",
    manchetes: {
      neutra: "Convivência e rotina digital: caminhos para o equilíbrio na escola",
      construtiva: "Celular e descanso: orientações práticas para a saúde dos estudantes",
      sensacionalista: "Alerta geral: o uso de aparelhos está destruindo o rendimento escolar",
    },
    // 01e, na ordem cronológica reversa do feed.
    comentarios: [
      {
        id: "c1",
        autor: "Marcos",
        horario: "03h10",
        tipo: "saude_fisica",
        texto: "Tô aqui rolando essa conversa faz quatro horas direto... olho ardendo e amanhã tem prova na primeira aula.",
      },
      {
        id: "c2",
        autor: "radar_escola_off",
        horario: "02h50",
        tipo: "anonimo_agressivo",
        texto: "Mais um post hipócrita do grêmio. Enquanto vocês fingem virtude aqui, o colégio tá um caos real.",
      },
      {
        id: "c3",
        autor: "Clara",
        horario: "02h40",
        tipo: "saude_fisica",
        texto: "Não consigo pregar o olho com essa discussão... minha cabeça tá explodindo de dor e a tela não para de apitar",
      },
      {
        id: "c4",
        autor: "user_89412",
        horario: "02h22",
        tipo: "anonimo_agressivo",
        texto: "Todo mundo sabe quem foi que começou isso no 2º ano... a lista de nomes já tá rolando nos grupos de fora.",
      },
      {
        id: "c5",
        autor: "Tomás",
        horario: "02h15",
        tipo: "saude_mental",
        texto: "Depois de ler esses ataques me sinto um lixo, nem coragem de ir pra aula amanhã eu tenho",
      },
      {
        id: "c6",
        autor: "Bia",
        horario: "01h45",
        tipo: "engajamento",
        texto: "Vocês falam de equilíbrio mas vivem online vigiando a vida de todo mundo. Quero ver quem larga o celular primeiro!",
      },
    ],
  };
}

// ──────────────────────────────────────────── o UnooriaAI (Etapa 2)

/** A boas-vindas do chat (copy `e2.narrativa.boas_vindas`, literal). */
export const BOAS_VINDAS =
  "Olá! Como posso apoiar a redação da campanha do grêmio hoje? Selecione uma sugestão abaixo ou descreva o objetivo da postagem.";

/** As três sugestões de prompt (copy `e2.rotulo.prompt_sugestao_1..3`; TC-02 e TC-03 literais). */
export const SUGESTOES_DE_PROMPT = [
  "Criar rascunho informativo sobre o tema",
  "Qual a fonte dessa pesquisa?",
  "Reescreva removendo os nomes pessoais e citando o autor original",
] as const;

/**
 * As intenções do chat — a ÁRVORE DE INTENÇÕES do 01e, no servidor e sem IA
 * (PRD RNF-012 e §17.4: nenhuma chamada de IA durante a aula). A lista é
 * FECHADA e decide o que muda na prévia:
 *
 * - `auditar_fontes` só PERGUNTA (a fala termina em "Deseja que eu atualize a
 *   prévia?"); quem corrige a estatística é o "sim" (`substituir_dado`) ou a
 *   revisão ampla — a EM13CO14 mede as duas coisas separadas.
 * - `auditar_direito_digital` corrige autoria E LGPD (o TC-03); o pedido que só
 *   toca uma delas (`auditar_autoral`, `auditar_lgpd`) corrige só aquela — é o
 *   "em processo" da EM13CO26.
 */
export const INTENCOES = [
  "gerar_rascunho_inicial",
  "auditar_fontes",
  "substituir_dado",
  "auditar_direito_digital",
  "auditar_autoral",
  "auditar_lgpd",
  "revisao_ampla",
  "aprovar_previa",
  "fora_do_tema",
] as const;
export type Intencao = (typeof INTENCOES)[number];

/** As falas que não respondem a uma intenção, mas ao estado da prévia. */
export type FalaDeEstado = "sem_rascunho" | "ja_corrigido" | "limite";

/** As primeiras `n` palavras de um texto, com reticências se cortou. */
function primeirasPalavras(texto: string, n: number): string {
  const p = texto.trim().split(/\s+/);
  return p.length <= n ? texto.trim() : `${p.slice(0, n).join(" ")}...`;
}

/**
 * A fala do UnooriaAI para cada intenção — o 01e e a copy, com os nomes do
 * pacote (o instituto, a autoria, o colega) e o TEMA do professor no lugar dos
 * do banco padrão: a fala que dizia "celular e convivência" mentiria em
 * qualquer outro tema.
 */
export function falaDoAssistente(
  fala: Intencao | FalaDeEstado,
  c: Pick<ConteudoDoPacote, "fonteInventada" | "colega" | "fonteOriginal" | "rascunho">,
  tema: string,
): string {
  switch (fala) {
    case "gerar_rascunho_inicial": {
      // copy `e2.narrativa.resposta_rascunho` (contém o TC-01 no banco padrão).
      const inicio = c.rascunho.slice(0, 2).map((p) => p.texto).join(" ");
      return `Aqui está uma primeira proposta: ${primeirasPalavras(inicio, 18)} Veja a íntegra na prévia lateral.`;
    }
    case "auditar_fontes":
      return `Verifiquei minha base de dados: o instituto '${c.fonteInventada}' não possui registro oficial e a estatística foi gerada por estimativa sintética não verificada. Recomendo substituir por referências consolidadas, sem dados alarmistas inventados. Deseja que eu atualize a prévia?`;
    case "substituir_dado":
      return `Atualizei a prévia: removi a estatística atribuída ao ${c.fonteInventada} e usei uma referência consolidada, sem números inventados.`;
    case "auditar_direito_digital":
      return `Entendido. Um trecho do rascunho foi extraído literalmente de ${c.fonteOriginal}. Além disso, a menção a ${c.colega} expõe dados privados sem consentimento. Já removi os dados pessoais e atribuí o crédito correto na prévia lateral.`;
    case "auditar_autoral":
      return `Entendido. Um trecho do rascunho foi extraído literalmente de ${c.fonteOriginal}. Já coloquei o trecho entre aspas e atribuí o crédito correto na prévia lateral.`;
    case "auditar_lgpd":
      return `Entendido. A menção a ${c.colega} expõe dados privados sem consentimento. Já removi os dados pessoais na prévia lateral.`;
    case "revisao_ampla":
      return `Revisei o texto por completo. Removi a estatística não verificada, dei o crédito autoral a ${c.fonteOriginal} e substituí o caso individual por uma reflexão coletiva sobre o convívio saudável. O rascunho atualizado já está refletido na prévia lateral.`;
    case "aprovar_previa":
      return "Prévia aprovada com sucesso! O texto está consolidado e pronto para o fechamento editorial. Clique em 'Exportar para o Unoovista' para definir a manchete de capa e concluir o envio.";
    case "fora_do_tema":
      return `Como assistente editorial do grêmio, meu foco é redigir e revisar o texto da campanha escolar sobre ${tema}. Use as sugestões de prompt ou me diga quais ajustes deseja fazer no rascunho da postagem.`;
    case "sem_rascunho":
      return "Ainda não montei o rascunho. Peça para eu criar o rascunho informativo sobre o tema e começamos por ele.";
    case "ja_corrigido":
      return "Esse trecho já foi ajustado na prévia lateral. Quer verificar outro ponto do rascunho?";
    case "limite":
      return "Atingimos o limite de iterações editoriais para este rascunho. O texto da prévia lateral já reúne os ajustes solicitados. Por favor, confira a versão final e clique em 'Exportar para o Unoovista' para prosseguir.";
  }
}

// ──────────────────────────────────────────── o Unoovista (Etapa 4)

/** O marcador do TC-10 que o tema do professor preenche. */
export const MARCADOR_DO_RECORTE = "[recorte da aula: parâmetro do professor]";

/**
 * O TC-10 (`e4.instrucao.overlay_gremio`), LITERAL, com o tema do pacote no
 * lugar do marcador. Vem em três partes para o hub destacar o tema como o
 * protótipo destaca o marcador. É desenhado FORA do aparelho (ADR-191).
 */
export function instrucaoDoModerador(tema: string): { antes: string; destaque: string; depois: string } {
  const tc10 =
    "Você é moderador do perfil do grêmio estudantil no Unoovista. O post sobre [recorte da aula: parâmetro do professor] viralizou e saiu da bolha da escola. Pessoas de fora estão chegando, perfis desconhecidos estão aparecendo nos comentários e alguns colegas estão compartilhando relatos sobre como foram afetados. O perfil é responsabilidade de vocês: decida o que precisa ser feito com a publicação, com quem está interagindo e com a situação como um todo. O grêmio não tem preparo pra resolver isso sozinho, busque soluções de apoio dentro do Unoovista";
  const [antes, depois] = tc10.split(MARCADOR_DO_RECORTE) as [string, string];
  return { antes, destaque: tema, depois };
}

/** A métrica do card (copy `e4.rotulo.metricas_noturnas`): é a soma das faixas 01h–03h59 abaixo. */
export const METRICA_NOTURNA = "4.820 impressões entre 01h00 e 03h30";

/**
 * As impressões do post por faixa de horário — a MESMA curva para TODOS: o
 * incentivo é da rede, não do texto (01e, `tab-exp02em1b-01`).
 */
export const ENTREGA_POR_HORARIO = [
  { faixa: "08h–12h", impressoes: 110, minutos: 1.4 },
  { faixa: "12h–16h", impressoes: 145, minutos: 1.8 },
  { faixa: "16h–19h", impressoes: 180, minutos: 2.1 },
  { faixa: "19h–22h", impressoes: 225, minutos: 2.9 },
  { faixa: "22h–00h", impressoes: 430, minutos: 5.4 },
  { faixa: "00h–01h", impressoes: 890, minutos: 12.0 },
  { faixa: "01h–02h", impressoes: 1840, minutos: 38.5 },
  { faixa: "02h–03h", impressoes: 2120, minutos: 44.2 },
  { faixa: "03h–04h", impressoes: 860, minutos: 28.0 },
  { faixa: "04h–08h", impressoes: 90, minutos: 2.0 },
] as const;

/** As faixas da madrugada (01h00–03h59): o pico que a lousa e o Explicar apontam. */
export const FAIXAS_DA_MADRUGADA: readonly string[] = ["01h–02h", "02h–03h", "03h–04h"];

// ──────────────────────────────────────────── o Explicar (Etapa 5)

/**
 * Os dois cartões dos bastidores (copy `e5.rotulo.card_*`, literal: `rotulo` +
 * ": " + `texto`). Os dois revelam o critério da rede — sem distrator: o PRD
 * (RF-007) não trava o avanço e não mede o clique como habilidade.
 */
export const INDICADORES = [
  { id: "pico-madrugada", rotulo: "Horário de Pico", texto: "Concentração de entrega entre 01h00 e 03h30" },
  { id: "retencao", rotulo: "Métrica de Retenção", texto: "42 minutos médios por usuário ativo" },
] as const;
export type IdDoIndicador = (typeof INDICADORES)[number]["id"];
export const IDS_DOS_INDICADORES: readonly string[] = INDICADORES.map((i) => i.id);

export const TEXTOS_DO_EXPLICAR = {
  titulo: "Bastidores da Distribuição: Relatório Analítico",
  instrucao: "Selecione os dois indicadores que revelam o critério de entrega do algoritmo:",
  // TC-20, literal.
  citacao: "O objetivo não é a qualidade da informação, mas o engajamento... calcular a probabilidade de o aluno continuar navegando",
  conceitos: [
    { id: "economia", titulo: "Economia da Atenção", texto: "o tempo de permanência na tela é o produto comercializado com anunciantes." },
    { id: "metadados", titulo: "Metadados", texto: "sinais invisíveis de comportamento lidos para antecipar reações emocionais." },
  ],
  esperaAtiva: "Enquanto a turma conclui, explore o gráfico comparativo de engajamento por faixa de horário.",
} as const;

// ──────────────────────────────────────────── o professor

/** O roteiro do debate (TC-22 a TC-24, literais) e as instruções de condução. */
export const ROTEIRO_DO_DEBATE = [
  "Por que uma postagem informativa e bem cuidada acabou gerando discussões agressivas às duas da manhã no Unoovista?",
  "A plataforma entregou esse conteúdo de madrugada porque ele era útil para o descanso dos estudantes ou porque brigas mantêm as pessoas rolando a tela?",
  "Se o algoritmo lucra com o tempo de tela que passamos acordados, quem é o verdadeiro cliente da rede social e o que está sendo vendido?",
] as const;

export const INSTRUCOES_DO_GATILHO = {
  pausar:
    "Quando a turma estiver no feed da madrugada, pressione 'Pausar Telas para Debate': as telas congelam e você conduz a roda. Peça que estudantes com manchetes opostas leiam os comentários que receberam.",
  liberar:
    "Depois do debate, pressione 'Avançar Turma para Explicar': os estudantes abrem os bastidores da publicação e apontam o pico da madrugada e a retenção na tela.",
} as const;
