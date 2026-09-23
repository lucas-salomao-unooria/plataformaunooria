/**
 * O conteúdo da exp05ef1b — e o GABARITO dela.
 *
 * Este arquivo nunca cruza a fronteira do cliente inteiro. O que sai é a
 * projeção `MensagemPublica`, construída por `Omit` de `veracidade`, `tom` e
 * `explicacao`: as três coisas que a missão mede o estudante por descobrir
 * sozinho (regra inviolável nº 3). O tipo público é construído pelo compilador,
 * não por "lembrar de apagar o campo" — a diferença é que o vazamento reprova
 * no `tsc`, não no DevTools de uma criança.
 *
 * O lote da turma NÃO é este por padrão. A professora prepara o grupo antes da
 * aula (`preparo.service.ts`, com ou sem IA) e HOMOLOGA; sem homologação a
 * missão do estudante fica numa tela de espera. O que está aqui é o BANCO
 * CURADO — o que a professora aprova com um clique quando não quer gerar nada,
 * e o que a IA recebe como MOLDE (tipo e veracidade por posição são fixos; o
 * modelo reescreve remetente, texto e explicação para o tema dela).
 *
 * A copy é a do sheet congelado da missão (passada 2 para a interface, passada
 * 1 para o banco). Alterar texto aqui sem alterar o sheet faz a tela contar
 * outra coisa que o documento aprovado.
 */

// ───────────────────────────────────────────────────────────── vocabulário

/** O que o servidor sabe de cada mensagem — e o estudante só descobre na revelação. */
export const VERACIDADES = ["verdadeira", "falsa", "ambigua"] as const;
export type Veracidade = (typeof VERACIDADES)[number];

/**
 * O tom emocional. É gabarito também: o card de síntese da Etapa 5 compara os
 * encaminhamentos de mensagens `alarmista`/`urgente` com os de
 * `neutro`/`ponderado`, e se o tom descesse ao bundle a criança leria "esta é a
 * que assusta" antes de decidir.
 */
export const TONS = ["neutro", "alarmista", "urgente", "ponderado"] as const;
export type Tom = (typeof TONS)[number];

/** Os tons que a síntese conta como "urgência e emoção forte". */
export const TONS_EMOCIONAIS: readonly Tom[] = ["alarmista", "urgente"];

/**
 * O formato do balão. Sem mídia binária: o `audio` carrega duração e
 * transcrição (o player é simulado), a `imagem` é a legenda com o rótulo da
 * foto, e o `link` é o card com manchete, fonte e data. Nenhum arquivo foi
 * produzido, e a missão roda igual — quando chegar, entra ao lado do texto.
 */
export const TIPOS_DE_MENSAGEM = ["texto", "audio", "imagem", "link"] as const;
export type TipoDeMensagem = (typeof TIPOS_DE_MENSAGEM)[number];

export const IDS_DE_MENSAGEM = [
  "msg-1",
  "msg-2",
  "msg-3",
  "msg-4",
  "msg-5",
  "msg-6",
  "msg-7",
  "msg-8",
] as const;
export type IdDeMensagem = (typeof IDS_DE_MENSAGEM)[number];

export const TOTAL_DE_MENSAGENS = IDS_DE_MENSAGEM.length;

/**
 * A paridade do lote: 3 verdadeiras, 3 falsas, 2 ambíguas. Não é preferência:
 * é o que impede a heurística "se está em maiúscula é mentira" de fechar a
 * conta sozinha, e é o que dá ao histograma uma barra longa para cada lado.
 */
export const PARIDADE: Readonly<Record<Veracidade, number>> = {
  verdadeira: 3,
  falsa: 3,
  ambigua: 2,
};

/** Quantas mensagens o estudante precisa encaminhar para o Mural poder fechar. */
export const PISO_DE_ENCAMINHAMENTOS = 3;

/** O foco emocional que a professora escolhe no preparo. */
export const GATILHOS = ["urgencia", "indignacao", "medo"] as const;
export type Gatilho = (typeof GATILHOS)[number];

/** De onde veio o lote homologado. `padrao` não é fallback de erro: é o banco curado. */
export const ORIGENS_DO_LOTE = ["ia", "padrao"] as const;
export type OrigemDoLote = (typeof ORIGENS_DO_LOTE)[number];

// ──────────────────────────────────────────────────────────────── mensagem

export interface MensagemDoLote {
  id: IdDeMensagem;
  remetente: string;
  /** "HH:MM" — o histórico recente da manhã. */
  hora: string;
  tipo: TipoDeMensagem;
  /**
   * O texto do balão. No `audio` é a transcrição (SEMPRE presente: é
   * acessibilidade, não fallback); na `imagem` é a legenda; no `link` é a
   * descrição sob a manchete.
   */
  corpo: string;
  /** Só em `audio`. Teto de 20 s (RNF-USAB-002). */
  duracaoSeg?: number;
  /** `imagem`: o rótulo do que a foto mostra. `link`: a manchete. */
  titulo?: string;
  /** Só em `link`: o nome do veículo. */
  fonte?: string;
  /** Só em `link`: a data visível no card — é o detalhe que a mensagem ambígua esconde. */
  data?: string;
  /** GABARITO. */
  veracidade: Veracidade;
  /** GABARITO. */
  tom: Tom;
  /** GABARITO — a justificativa que aparece sob o selo na revelação (≤ 120 caracteres). */
  explicacao: string;
}

/** O que o estudante recebe. Sem os três campos, por construção. */
export type MensagemPublica = Omit<MensagemDoLote, "veracidade" | "tom" | "explicacao">;

export function mensagensPublicas(lote: readonly MensagemDoLote[]): MensagemPublica[] {
  return lote.map(({ veracidade: _v, tom: _t, explicacao: _e, ...publica }) => publica);
}

export function acharMensagem(
  lote: readonly MensagemDoLote[],
  id: string,
): MensagemDoLote | undefined {
  return lote.find((m) => m.id === id);
}

/** O rótulo curto de cada barra do histograma e da síntese. */
export function resumoDaMensagem(m: MensagemDoLote): string {
  const inicio = (m.titulo ?? m.corpo).trim();
  const palavras = inicio.split(/\s+/).slice(0, 6).join(" ");
  return palavras.length < inicio.length ? `${palavras}…` : palavras;
}

// ──────────────────────────────────────────────────────── o grupo e o mural

export const GRUPO = {
  nome: "Turma 5ºB",
  subtitulo: "você, Camila, Lucas, Pedro e mais 20",
} as const;

export const MURAL = { nome: "Mural da Turma" } as const;

// ─────────────────────────────────────────────────────────── banco curado

export const TEMA_DEFAULT = "Mudança nas regras do intervalo e cantina da escola";

/**
 * O MOLDE do lote: a posição fixa o tipo e a veracidade. É o que a IA recebe e
 * o que `validarLote` confere — um lote com paridade certa mas o áudio na
 * posição do comunicado quebraria a simetria formal que o brief de assets exige
 * (áudio só nas falsas ensinaria "áudio é sempre mentira").
 */
export const MOLDE_DO_LOTE: ReadonlyArray<{
  id: IdDeMensagem;
  tipo: TipoDeMensagem;
  veracidade: Veracidade;
  tom: Tom;
  /** O que a IA precisa escrever nesta posição — em português, para o prompt. */
  papel: string;
}> = [
  {
    id: "msg-1",
    tipo: "texto",
    veracidade: "verdadeira",
    tom: "neutro",
    papel:
      "comunicado formal LONGO (40 a 70 palavras) de um órgão da escola, confirmando o fato verdadeiro com calma",
  },
  {
    id: "msg-2",
    tipo: "texto",
    veracidade: "falsa",
    tom: "alarmista",
    papel:
      "boato CURTO (até 25 palavras) de um estudante, em CAIXA ALTA, com exclamações, pedindo que repassem",
  },
  {
    id: "msg-3",
    tipo: "audio",
    veracidade: "falsa",
    tom: "urgente",
    papel:
      "transcrição de um ÁUDIO de até 18 segundos (30 a 50 palavras) de um estudante ofegante relatando algo que 'ouviu no corredor' e pedindo urgência",
  },
  {
    id: "msg-4",
    tipo: "imagem",
    veracidade: "verdadeira",
    tom: "neutro",
    papel:
      "legenda CURTA (até 25 palavras) de uma FOTO de um aviso físico oficial da escola, com o rótulo do que a foto mostra em `titulo`",
  },
  {
    id: "msg-5",
    tipo: "link",
    veracidade: "ambigua",
    tom: "ponderado",
    papel:
      "card de LINK de um blog regional: manchete em `titulo`, nome do veículo em `fonte`, e uma DATA ANTIGA (dois a quatro anos atrás) em `data`; a notícia é real mas velha e não se aplica ao caso de hoje",
  },
  {
    id: "msg-6",
    tipo: "texto",
    veracidade: "falsa",
    tom: "alarmista",
    papel:
      "mensagem CURTA (até 25 palavras) de indignação, acusando a escola de esconder algo e chamando de cúmplice quem não repassar",
  },
  {
    id: "msg-7",
    tipo: "texto",
    veracidade: "verdadeira",
    tom: "neutro",
    papel:
      "mensagem CURTA (até 25 palavras) de um professor esclarecendo, sem sermão, o que de fato vai acontecer",
  },
  {
    id: "msg-8",
    tipo: "texto",
    veracidade: "ambigua",
    tom: "ponderado",
    papel:
      "comentário CURTO (até 25 palavras) de um estudante repetindo algo que ouviu de passagem e admitindo não saber se é verdade",
  },
];

export const LOTE_DEFAULT: readonly MensagemDoLote[] = [
  {
    id: "msg-1",
    remetente: "Coordenação Pedagógica",
    hora: "09:40",
    tipo: "texto",
    corpo:
      "Informamos a todos os estudantes que, a partir da próxima segunda-feira, o horário do intervalo passará por um reordenamento de turmas para organizar melhor as filas da cantina e o uso da quadra de esportes. Cada ciclo terá 20 minutos regulares de recreio, sem qualquer redução do tempo de descanso previsto no calendário escolar.",
    veracidade: "verdadeira",
    tom: "neutro",
    explicacao:
      "Comunicado oficial da coordenação confirmando a manutenção dos 20 minutos de recreio.",
  },
  {
    id: "msg-2",
    remetente: "Lucas 5ºB",
    hora: "09:42",
    tipo: "texto",
    corpo:
      "URGENTE GENTE!! A DIRETORA PROIBIU A CANTINA PRA SEMPRE A PARTIR DE AMANHÃ!! MANDEM PRO MURAL AGORA PRA TODO MUNDO PROTESTAR ANTES QUE ACABE!!",
    veracidade: "falsa",
    tom: "alarmista",
    explicacao: "Boato em caixa alta sem fonte oficial. A cantina continuará funcionando normalmente.",
  },
  {
    id: "msg-3",
    remetente: "Pedro Henrique",
    hora: "09:43",
    tipo: "audio",
    duracaoSeg: 18,
    corpo:
      "Gente, vocês não sabem do pior! Eu acabei de passar na sala dos professores e ouvi uma coordenadora falando que o nosso recreio vai ter só 5 minutos a partir de amanhã pra dar tempo de passar lição extra! Passa pro mural logo, não deixa isso acontecer!",
    veracidade: "falsa",
    tom: "urgente",
    explicacao:
      "Relato inventado de corredor com apelo de alarme. O recreio mantém os 20 minutos regulares.",
  },
  {
    id: "msg-4",
    remetente: "Grêmio Estudantil",
    hora: "09:45",
    tipo: "imagem",
    titulo: "Cardápio da Semana — mural da secretaria",
    corpo:
      "Foto do cardápio semanal e horários de lanche afixados hoje cedo no mural da secretaria. Tudo normal com as refeições desta semana.",
    veracidade: "verdadeira",
    tom: "neutro",
    explicacao: "Registro visual do informe físico original afixado na secretaria da escola.",
  },
  {
    id: "msg-5",
    remetente: "Manuela 5ºB",
    hora: "09:47",
    tipo: "link",
    titulo: "Prefeitura anuncia obras de reforma estrutural nas cozinhas das escolas municipais",
    fonte: "Blog Notícias do Bairro",
    data: "14 de março de 2022",
    corpo: "Matéria publicada em março de 2022.",
    veracidade: "ambigua",
    tom: "ponderado",
    explicacao:
      "Notícia real porém antiga (2022) que não se aplica às regras de intervalo deste ano letivo.",
  },
  {
    id: "msg-6",
    remetente: "Camila Turma B",
    hora: "09:49",
    tipo: "texto",
    corpo:
      "Quem não repassar essa mensagem pro mural é cúmplice da direção!! Eles querem tirar nossa liberdade no recreio e tão escondendo de todo mundo!!",
    veracidade: "falsa",
    tom: "alarmista",
    explicacao:
      "Chantagem emocional com apelo conspiratório sem qualquer comprovação com a escola.",
  },
  {
    id: "msg-7",
    remetente: "Prof. Marcelo",
    hora: "09:50",
    tipo: "texto",
    corpo:
      "Pessoal do quinto ano, não acreditem em boatos. Os professores apenas organizaram duas filas separadas na cantina pra evitar empurrões na hora do lanche.",
    veracidade: "verdadeira",
    tom: "neutro",
    explicacao:
      "Esclarecimento fático de docente explicando o objetivo organizacional da nova fila.",
  },
  {
    id: "msg-8",
    remetente: "Thiago 5ºB",
    hora: "09:51",
    tipo: "texto",
    corpo:
      "Eu ouvi alguém no ônibus escolar comentando que talvez o preço do salgado na cantina subisse esse mês, mas não sei se é verdade.",
    veracidade: "ambigua",
    tom: "ponderado",
    explicacao:
      "Comentário incerto baseado em conversa de transporte escolar, sem caráter de informação confirmada.",
  },
];

// ──────────────────────────────────────────────────────────────── reflexão

/** O dilema de transferência da Etapa 6 (`e6.pergunta.dilema_tio`, 40 palavras). */
export const PERGUNTA_DA_REFLEXAO =
  "Seu tio mandou um áudio no grupo da família dizendo que a prefeitura vai fechar a escola do bairro na semana que vem. Ele pede pra todo mundo encaminhar pra mais gente ficar sabendo. O que você faz antes de encaminhar?";

export const PISO_DA_REFLEXAO = 5;
export const TETO_DA_REFLEXAO = 500;

// ────────────────────────────────────────────────────────────────── podcast

/**
 * O episódio de recapitulação, em TEXTO. A locução de 3m40 do brief não foi
 * gravada, e a missão roda igual: a transcrição é acessibilidade de sala sem
 * fone, não remendo. Quando o áudio chegar, entra ao lado — nunca no lugar.
 */
export const PODCAST = {
  titulo: "Pausa Digital — Quem mandou isso no seu grupo?",
  blocos: [
    {
      rotulo: "Abertura",
      falas: [
        "Léo: E aí, turma! Tudo bem com vocês? Léo por aqui pra mais uma Pausa Digital.",
        "Bia: E eu sou a Bia! E a pergunta que não quer calar hoje é uma só: quem mandou isso aí no seu grupo?",
        "Léo: Eita! Se você acabou de passar pela missão do WhatsApp da turma, sabe muito bem do que a gente tá falando. Caixa alta, emoji de sirene, áudio com voz desesperada... quem nunca viu isso pipocar na tela do celular?",
        "Bia: A gente vê todo dia, Léo. Mas a questão principal é: o que você faz no segundo seguinte depois que essa notificação apita?",
      ],
    },
    {
      rotulo: "A vivência",
      falas: [
        "Léo: Na missão de hoje, a diretora pediu aquela força pra organizar as informações sobre o que ia rolar na escola. A tarefa parecia simples: ler o que tava no grupo da turma e mandar pro Mural só o que fosse importante de verdade.",
        "Bia: Só que quando você entrou no chat... que confusão, né? Tinha mensagem dizendo que o intervalo ia mudar, áudio de colega indignado, foto com aviso, notícia antiga da internet...",
        "Léo: E aquelas mensagens com frases que fazem o coração acelerar na mesma hora: \"URGENTE! A diretora proibiu a cantina! Repassa pra todo mundo antes que seja tarde!\".",
        "Bia: Dá aquele impulso imediato de repassar logo, né? E aí você selecionou com o dedo, jogou pro Mural e tocou em \"Confirmar envio\". Você e a sala inteira!",
      ],
    },
    {
      rotulo: "A revelação do mecanismo",
      falas: [
        "Léo: Mas aí veio a virada de chave no telão com o professor...",
        "Bia: O famoso momento da revelação! Quando o professor liberou as etiquetas de checagem... adivinha qual foi a mensagem que quase todo mundo da sala encaminhou pro mural?",
        "Léo: Justamente a que era cem por cento mentira!",
        "Bia: E aquele comunicado sério, calmo, explicando o horário certinho do recreio? Quase ninguém encaminhou.",
        "Léo: Caramba, Bia... por que a gente faz isso? A gente quer espalhar mentira de propósito?",
        "Bia: Claro que não, Léo! É o mecanismo de rede funcionando em cima da nossa emoção. As notícias falsas não são feitas pra te informar; elas são desenhadas pra assustar ou deixar as pessoas com raiva. Quando a gente toma um susto, a mão coça pra agir na hora. E no aplicativo de conversa, reagir significa tocar na setinha de encaminhar. A mentira não corre sozinha pelo celular: é o nosso dedo apressado que faz ela voar longe.",
      ],
    },
    {
      rotulo: "Provocação e transferência",
      falas: [
        "Léo: Caraca... então quando um boato se espalha, a responsabilidade não é só de quem inventou. É de cada um que passou pra frente sem ter certeza.",
        "Bia: Exatamente! E agora fica o nosso desafio pra vida real. Imagina que hoje à noite, no grupo da família ou dos amigos do bairro, seu tio manda aquele áudio bombástico: \"Atenção! Vão fechar a escola do bairro semana que vem, repassa pra todo mundo protestar!\".",
        "Léo: O polegar já treme em cima do botão de encaminhar, né?",
        "Bia: Pois é! Mas agora você tem o superpoder da pausa. Respira fundo, desconfia da urgência exagerada e confere na fonte oficial antes de repassar.",
      ],
    },
    {
      rotulo: "Encerramento",
      falas: [
        "Léo: É isso aí! Na dúvida, segure o dedo e não passe pra frente. Proteja você e o seu grupo.",
        "Bia: Antes de encaminhar, a gente checa. Valeu, estudante, e até a próxima missão!",
        "Léo: Valeu, fui!",
      ],
    },
  ],
} as const;

/** A versão do instrumento gravada em cada snapshot (DAD-06). */
export const VERSAO_DO_INSTRUMENTO = "1.0.0";
