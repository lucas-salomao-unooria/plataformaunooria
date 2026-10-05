/**
 * O conteúdo da exp05ef1b v2.2 — Quem Mandou Isso? — e o GABARITO dela.
 *
 * Este arquivo nunca cruza a fronteira do cliente inteiro. O que o estudante
 * recebe é `MensagemPublica`, um `Omit` de `veracidade` e `tom`: o vazamento
 * pelo pacote reprova no `tsc`, e não no DevTools de uma criança (regra 3).
 *
 * A copy vem de `design/06-copy-strings-revisada.md` (a canônica) e das
 * decisões do Lucas de 2026-09-25 (a fala da Nina com `{tema}` e o tio fixo).
 * O banco curado vem do PRD §24 com o texto integral de `design/04`. Mudar
 * texto aqui sem mudar o sheet faz a tela contar outra coisa que o documento
 * aprovado.
 */

/** O id que a guarda da sala (ADR-69), o manifesto, a ficha e as equipes compartilham. */
export const EXP_ID = "exp05ef1b";

/**
 * Vai gravado em cada sessão, para reprocessar o histórico se o instrumento
 * mudar. 2.3.0: sem a regra Se/Então, as perguntas são a reflexão (ADR-145).
 */
export const VERSAO_DO_INSTRUMENTO = "2.3.0";

// ───────────────────────────────────────────────────────────── vocabulário

/**
 * Os DOIS eixos da mensagem. São independentes de propósito — é a descoberta
 * da missão (EF05CO03): uma mensagem pode ser falsa e calma, verdadeira e
 * alarmada. Não há CHECK para eles: vivem DENTRO do JSONB do pacote, e quem
 * os cobra é o Zod e `regras/pacote.ts`.
 */
export const VERACIDADES = ["verdadeira", "falsa"] as const;
export type Veracidade = (typeof VERACIDADES)[number];

export const TONS = ["emocional", "neutra"] as const;
export type Tom = (typeof TONS)[number];

/** Os quatro quadrantes da matriz 2x2, na ordem da curadoria do professor. */
export const QUADRANTES = ["VE", "VN", "FE", "FN"] as const;
export type Quadrante = (typeof QUADRANTES)[number];

/**
 * O formato do balão. **Sem mídia binária**: a imagem é o comunicado DESENHADO
 * a partir do texto (`MessageBubble.Media` sem `src`) e o link é a prévia
 * (`MessageBubble.LinkPreview`) montada da `legenda`.
 */
export const TIPOS_DE_MENSAGEM = ["texto", "imagem", "link"] as const;
export type TipoDeMensagem = (typeof TIPOS_DE_MENSAGEM)[number];

export const IDS_DE_MENSAGEM = [
  "msg_1",
  "msg_2",
  "msg_3",
  "msg_4",
  "msg_5",
  "msg_6",
  "msg_7",
  "msg_8",
] as const;
export type IdDeMensagem = (typeof IDS_DE_MENSAGEM)[number];

export const TOTAL_DE_MENSAGENS = IDS_DE_MENSAGEM.length;

/** Duas por quadrante: 2 VE, 2 VN, 2 FE, 2 FN (travado pelo briefing). */
export const POR_QUADRANTE = 2;

/** 4 textos, 2 imagens, 2 links. */
export const TIPOS_NO_PACOTE: Readonly<Record<TipoDeMensagem, number>> = { texto: 4, imagem: 2, link: 2 };

/**
 * Os formatos que NÃO podem predizer a veracidade: cada um tem exatamente uma
 * verdadeira e uma falsa. É o GAP do preset (default aplicado até o Lucas
 * responder): nas duas versões dos artefatos os dois links eram falsos, e a
 * turma aprenderia "link = mentira" — a heurística que a missão existe para
 * desmontar.
 */
export const FORMATOS_BALANCEADOS = ["imagem", "link"] as const satisfies readonly TipoDeMensagem[];

/** Quantas mensagens vão ao Mural. Exatamente três (travado pelo briefing). */
export const ENCAMINHAMENTOS = 3;

/** De onde veio o pacote aprovado. `padrao` não é fallback de erro: é o banco curado. */
export const ORIGENS = ["ia", "padrao"] as const;
export type Origem = (typeof ORIGENS)[number];

/**
 * A enquete do Mural (Etapa 3): o motivo declarado. Vocabulário em DOIS
 * lugares — aqui e no CHECK `exp05ef1b_sessoes_motivo_check`; a suíte de
 * Postgres compara os dois.
 */
export const MOTIVOS = ["urgencia", "confianca_remetente", "medo_indignacao", "imagem_link_real"] as const;
export type Motivo = (typeof MOTIVOS)[number];

export const ROTULO_DO_MOTIVO: Readonly<Record<Motivo, string>> = {
  urgencia: "Urgência (precisava avisar logo)",
  confianca_remetente: "Confiança em quem mandou",
  medo_indignacao: "Medo ou indignação com o acontecimento",
  imagem_link_real: "A imagem ou link parecia muito real",
};

/**
 * O callback do bimestre na revelação, por motivo (`e4.feedback.callback_*`).
 * Mora aqui porque é o servidor que sabe o motivo gravado — a tela não
 * precisa de uma segunda tabela motivo → frase.
 */
export const CALLBACK_DO_MOTIVO: Readonly<Record<Motivo, string>> = {
  urgencia: "Vocês já aprenderam essa: não deixar a pressa decidir por você.",
  confianca_remetente: "Vocês já aprenderam essa: checar a mensagem, não só quem mandou.",
  medo_indignacao: "Vocês já aprenderam essa: não deixar a emoção conduzir a decisão.",
  imagem_link_real: "Vocês já aprenderam essa: comparar com uma fonte confiável antes de encaminhar.",
};

/**
 * O `Se` do construtor que a Etapa 6 TINHA. A regra Se/Então saiu (ADR-145):
 * as perguntas de múltipla escolha são a reflexão. O vocabulário fica só
 * porque a tabela `exp05ef1b_reflexoes` guarda o que já foi escrito, e o CHECK
 * `exp05ef1b_reflexoes_condicional_check` continua lá — a suíte de Postgres
 * compara os dois.
 */
export const CONDICOES = ["urgente_alarmante", "parente_proximo", "link_nao_checado", "promessa_incrivel"] as const;

/**
 * O componente curricular do recorte (`e0.professor.campo_disciplina_label`).
 * Os slugs são os de `planos/catalogo.ts`, restritos ao que existe no 5º ano;
 * a lista fica AQUI, e não importada de lá, porque é o vocabulário do CHECK
 * `exp05ef1b_pacotes_disciplina_check` — e acrescentar uma disciplina aos
 * planos de aula não pode mudar o que esta tabela aceita sem migração.
 */
export const DISCIPLINAS = [
  "letramento-digital",
  "lingua-portuguesa",
  "matematica",
  "ciencias",
  "historia",
  "geografia",
  "arte",
  "educacao-fisica",
  "lingua-inglesa",
  "ensino-religioso",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

export const ROTULO_DA_DISCIPLINA: Readonly<Record<Disciplina, string>> = {
  "letramento-digital": "Letramento Digital",
  "lingua-portuguesa": "Língua Portuguesa",
  matematica: "Matemática",
  ciencias: "Ciências",
  historia: "História",
  geografia: "Geografia",
  arte: "Arte",
  "educacao-fisica": "Educação Física",
  "lingua-inglesa": "Língua Inglesa",
  "ensino-religioso": "Ensino Religioso",
};

// ─────────────────────────────────────────────────────────────── os tetos

/** O tema entra na fala da Nina: ≤ 60 caracteres (RF-001) e ≤ 8 palavras (balão ≤ 45). */
export const TEMA_MIN_CARACTERES = 3;
export const TEMA_MAX_CARACTERES = 60;
export const TEMA_MAX_PALAVRAS = 8;

/** Os tetos de leitura da faixa (RNF-USAB-001): bolha ≤ 45, legenda/prévia ≤ 25. */
export const BOLHA_MAX_PALAVRAS = 45;
export const LEGENDA_MAX_PALAVRAS = 25;
export const TEXTO_MAX_CARACTERES = 400;
export const LEGENDA_MAX_CARACTERES = 200;
export const REMETENTE_MIN_CARACTERES = 2;
export const REMETENTE_MAX_CARACTERES = 30;

/** "Fatos balizadores da aula (3 a 6 tópicos)", ≤ 600 caracteres somados (RF-001). */
export const ASSUNTOS_MIN = 3;
export const ASSUNTOS_MAX = 6;
export const ASSUNTO_MIN_CARACTERES = 2;
export const ASSUNTO_MAX_CARACTERES = 120;
export const ASSUNTOS_MAX_CARACTERES = 600;
export const CONTEXTO_MAX_CARACTERES = 300;

// ──────────────────────────────────────────────────────────────── mensagem

export interface MensagemDoPacote {
  id: IdDeMensagem;
  /** Nome fictício de quem mandou no grupo (2 a 30 caracteres). */
  remetente: string;
  tipo: TipoDeMensagem;
  /** O texto do balão. ≤ 45 palavras. */
  texto: string;
  /**
   * Só na `imagem` e no `link`, e obrigatória nos dois: na imagem é o texto do
   * comunicado DESENHADO; no link, a manchete da prévia. ≤ 25 palavras.
   */
  legenda?: string;
  /** GABARITO. */
  veracidade: Veracidade;
  /** GABARITO. */
  tom: Tom;
}

/** O que o estudante recebe antes da revelação. Sem os dois eixos, por construção. */
export type MensagemPublica = Omit<MensagemDoPacote, "veracidade" | "tom">;

export function mensagensPublicas(mensagens: readonly MensagemDoPacote[]): MensagemPublica[] {
  return mensagens.map(({ veracidade: _v, tom: _t, ...publica }) => publica);
}

export function quadranteDe(m: Pick<MensagemDoPacote, "veracidade" | "tom">): Quadrante {
  const v = m.veracidade === "verdadeira" ? "V" : "F";
  const t = m.tom === "emocional" ? "E" : "N";
  return `${v}${t}` as Quadrante;
}

/** O conteúdo que o professor aprova. É o corpo do `POST /aprovar` e o que o pacote grava. */
export interface ConteudoDoPacote {
  disciplina: Disciplina;
  tema: string;
  assuntos: string[];
  contexto: string | null;
  mensagens: MensagemDoPacote[];
}

// ─────────────────────────────────────────── o banco curado (preset padrão)

/**
 * "O Mistério do Passeio ao Museu" — o pacote curado da Unooria (PRD §24,
 * texto integral de `design/04`), COM o ajuste do GAP: `msg_5` (VE) vira LINK e
 * `msg_7` (FE) vira TEXTO, para imagem e link terem cada um uma verdadeira e
 * uma falsa. Os textos das mensagens não mudam; a prévia do link da `msg_5` é
 * nova (não existia link nela) e vai à revisão do PO junto com o GAP.
 *
 * `tema` é a frase que entra na fala da Nina — "Rolou uma confusão sobre o
 * passeio ao museu." —, e é por isso que ela está em minúscula: com o preset,
 * a fala reproduz LITERALMENTE a `e1.narrativa.briefing_nina`. O nome de
 * vitrine é `nome`.
 *
 * `assuntos` não existe nos artefatos (o preset não passou por IA); os cinco
 * abaixo descrevem os fatos do próprio banco, para a tela da curadoria não
 * mostrar um recorte vazio. Também vão à revisão do PO.
 */
export const PACOTE_PADRAO: {
  readonly nome: string;
  readonly tema: string;
  readonly assuntos: readonly string[];
  readonly mensagens: readonly MensagemDoPacote[];
} = {
  nome: "O Mistério do Passeio ao Museu",
  tema: "o passeio ao museu",
  assuntos: [
    "ônibus do passeio com pneu furado",
    "lanche coletivo antecipado no pátio",
    "orientações da coordenação para a bilheteria",
    "boato de cancelamento do passeio",
    "falso ofício exigindo firma em cartório",
  ],
  mensagens: [
    {
      id: "msg_1",
      remetente: "Pedro Henrique",
      tipo: "texto",
      texto:
        "Gente, vocês viram isso?! O ônibus do nosso passeio furou o pneu perto da praça central agora cedo! O motorista já chamou o socorro mecânico, mas vai atrasar tudo se a gente não avisar logo na secretaria! Que sufoco!",
      veracidade: "verdadeira",
      tom: "emocional",
    },
    {
      id: "msg_2",
      remetente: "Camila Duarte",
      tipo: "link",
      texto:
        "Compartilho com a turma a manchete que acabou de sair no portal de notícias do município sobre o nosso itinerário cultural.",
      legenda:
        "Portal Notícias Locais: Prefeitura suspende visitas escolares a todos os museus no mês de outubro devido a reformas estruturais.",
      veracidade: "falsa",
      tom: "neutra",
    },
    {
      id: "msg_3",
      remetente: "Coordenação Pedagógica",
      tipo: "imagem",
      texto:
        "Segue comunicado informativo da coordenação com as orientações aos estudantes sobre a organização dos grupos na bilheteria do museu.",
      legenda:
        "Comunicado Oficial 14: Entrada das turmas do 5º ano pelo portão lateral com apresentação do crachá escolar.",
      veracidade: "verdadeira",
      tom: "neutra",
    },
    {
      id: "msg_4",
      remetente: "Lucas Gabriel",
      tipo: "texto",
      texto:
        "É UM ABSURDO! CANCELARAM O PASSEIO INTEIRO E NÃO VÃO DEVOLVER NOSSA AUTORIZAÇÃO! MEU IRMÃO DISSE QUE A ESCOLA VENDEU OS INGRESSOS PRA OUTRA TURMA! REPASSEM PRA TODO MUNDO PROTESTAR NO RECREIO AGORA MESMO!",
      veracidade: "falsa",
      tom: "emocional",
    },
    {
      id: "msg_5",
      remetente: "Mariana Souza",
      tipo: "link",
      texto:
        "Turma, corre aqui! A professora acabou de avisar no pátio que o lanche coletivo vai ser antecipado pra gente não pegar fila grande no museu! Quem não pegou a maçã passa lá correndo antes que feche a cantina!",
      legenda: "Site da Escola: Lanche coletivo antecipado no pátio para evitar filas na bilheteria.",
      veracidade: "verdadeira",
      tom: "emocional",
    },
    {
      id: "msg_6",
      remetente: "Representante da Turma",
      tipo: "imagem",
      texto:
        "Aviso aos colegas sobre as normas sanitárias e de segurança enviadas pela diretoria regional para cumprimento no transporte.",
      legenda:
        "Ofício Circular nº 88: Proibido o embarque de alunos que não apresentarem autorização com firma reconhecida em cartório.",
      veracidade: "falsa",
      tom: "neutra",
    },
    {
      id: "msg_7",
      remetente: "Gabriel Torres",
      tipo: "texto",
      texto:
        "MEU DEUS DO CÉU! Olhem esse link que mandaram no outro grupo! O museu pegou fogo de madrugada e tá tudo destruído! Não vai sobrar nada pra gente ver!",
      veracidade: "falsa",
      tom: "emocional",
    },
    {
      id: "msg_8",
      remetente: "Professora Helena",
      tipo: "texto",
      texto:
        "Informo aos estudantes do 5º ano que os monitores da exposição já estão nos aguardando no saguão principal para a visita guiada das dez horas.",
      veracidade: "verdadeira",
      tom: "neutra",
    },
  ],
};

/** O banco curado como objetos NOVOS: quem edita o rascunho não pode mudar o preset em memória. */
export function mensagensDoPadrao(): MensagemDoPacote[] {
  return PACOTE_PADRAO.mensagens.map((m) => ({ ...m }));
}

// ──────────────────────────────────────────────── as falas da experiência

/** O grupo simulado e o destino dos encaminhamentos (`e2.rotulo.grupo_titulo`, `e2.rotulo.sheet_destino`). */
export const GRUPO = { nome: "Turma 5ºB" } as const;
export const MURAL = { nome: "Mural da Turma" } as const;

/**
 * A fala da Nina (Etapa 1): a estrutura da copy com `{tema}` — 37 palavras
 * fixas, e o tema de até 8 deixa o balão em ≤ 45 (decisão do Lucas).
 */
export const NINA_ANTES_DO_TEMA = "Preciso da sua ajuda! Rolou uma confusão sobre";
export const NINA_DEPOIS_DO_TEMA =
  "Entra no grupo da turma, vê o que estão falando e me ajuda: encaminha pro Mural da Turma as 3 mensagens que vão explicar o que aconteceu de verdade.";

/**
 * O tema como ele entra na frase: sem espaço sobrando e sem pontuação no fim
 * (a frase já termina em ponto). A caixa NÃO muda — "sobre a Feira do Livro"
 * perderia o nome próprio se a primeira letra fosse rebaixada à força.
 */
export function temaNaFrase(tema: string): string {
  return tema
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.!?;:,…]+$/u, "");
}

export function falaDaNina(tema: string): string {
  return `${NINA_ANTES_DO_TEMA} ${temaNaFrase(tema)}. ${NINA_DEPOIS_DO_TEMA}`;
}

/**
 * O encerramento da Nina, depois da P2 — texto da equipe, à espera da revisão
 * do PO. Até a ADR-145 dizia "eu vou lembrar da sua regra", a Se/Então que
 * saiu.
 */
export const ENCERRAMENTO_DA_NINA =
  "Muito obrigada pela ajuda! Antes de repassar qualquer coisa, eu vou conferir de onde veio. Até a próxima!";

/**
 * As falas da Nina ANTES de cada pergunta de evidência (Canal B). São texto
 * da EXPERIÊNCIA, não da ficha: o enunciado e as alternativas (e o nível de
 * cada uma, que nunca desce) são de `evidencias/fichas/exp05ef1b.ts`. Os ids
 * são os da ficha — a suíte de regras cobra que existam lá.
 */
export const FALAS_ANTES_DAS_PERGUNTAS = [
  {
    perguntaId: "p1",
    fala: "Uma colega sua recebeu uma mensagem com tom calmo e formal, cheia de dados e números. Ela diz: 'Pode confiar, essa é verdadeira, olha como é séria.'",
  },
  {
    perguntaId: "p2",
    fala: "Três colegas escreveram regras pra decidir o que fazer antes de repassar uma mensagem.",
  },
] as const;

// ──────────────────────────────────────────────────── a voz do professor

/** O roteiro da roda de conversa (Etapa 5, `e5.professor.pergunta_1..3`), literal. */
export const ROTEIRO_DA_RODA = [
  "1. Quem compartilhou uma mensagem que tinha certeza de que era verdade, mas descobriu que era falsa? O que nela te convenceu?",
  "2. Alguém deixou de compartilhar uma notícia verdadeira porque ela parecia exagerada demais?",
  "3. Quem pensou em comparar com outra fonte antes de encaminhar? O que teria mudado se tivesse comparado?",
] as const;

/** As instruções fixas dos gatilhos docentes (D0-5), literais. */
export const INSTRUCOES_DO_CONSOLE = {
  revelacao:
    "Aguarde a conclusão da maioria dos estudantes. Chame a atenção da turma para o telão e clique em Liberar Revelação para projetar o Termômetro da Turma.",
  reflexao:
    "Conduza a roda de conversa com as 3 perguntas sugeridas. Ao concluir o debate, clique em Liberar Reflexão para enviar as duas perguntas finais da Nina aos aparelhos.",
} as const;
