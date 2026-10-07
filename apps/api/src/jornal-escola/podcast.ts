import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO do Jornal da Escola (ADR-150) — o roteiro do
 * one-pager aprovado (seção 11, "Podcast de recapitulação": Lucas e Clara,
 * locutores da rádio escolar, cerca de 3m30s), com UMA troca: a notícia antiga
 * se chama "oficina de robótica", e não "gincana". Os artefatos davam os dois
 * nomes à mesma notícia (o título e a imagem diziam oficina; a reação dos
 * leitores, gincana), e o banco padrão ficou com o primeiro.
 *
 * É do PROFESSOR, como o da A Seleção: o texto fala com a turma, e quem decide
 * tocar é quem conduz. As três falas que contam o que a turma viu — a notícia
 * antiga, a reação a ela e o aviso sem assinatura — são as VAGAS: no banco
 * padrão, as do sheet; num tema da IA, a IA as reescreve e o professor revisa
 * na customização, antes de criar a atividade.
 *
 * Puro — sem Nest e sem Prisma —, porque o contrato da homologação lê as
 * vagas daqui. Quem liga a missão ao módulo `podcast` é `podcast-fonte.ts`.
 */

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;

const TITULOS: Record<(typeof BLOCOS_DO_PODCAST)[number], string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação da vivência",
  revelacao: "A grande revelação",
  provocacao: "Provocação e transferência",
  encerramento: "Encerramento",
};

// ──────────────────────────────────────────── o texto aprovado

const ABERTURA: readonly FalaDoPodcast[] = [
  { falante: "Lucas", texto: "Fala, pessoal! Bem-vindos ao boletim da redação do Jornal da Escola! Aqui é o Lucas." },
  {
    falante: "Clara",
    texto:
      "E aqui é a Clara! Hoje a gente acompanhou a missão de vocês na mesa de trabalho com o Bento. E olha... colocar um jornal nas ruas não é nada fácil quando tem notícia de todo lado chegando na redação!",
  },
  {
    falante: "Lucas",
    texto:
      "É verdade, Clara! Quem olhou a mesa de primeira viu fotos coloridas, chamadas urgentes e notícias que pareciam imperdíveis. Mas vocês logo perceberam que aparência não é tudo.",
  },
];

const RECAPITULACAO_ENTRADA: FalaDoPodcast = {
  falante: "Clara",
  texto:
    "Na primeira rodada, todo mundo queria preencher os três espaços da capa bem rápido. Tinha matéria de rádio, post de rede social, recorte de jornal impresso e até mensagem encaminhada em aplicativo.",
};

const RECAPITULACAO_SUSTO: FalaDoPodcast = {
  falante: "Clara",
  texto: "Só que aí veio o susto quando o jornal foi distribuído! A escola inteira começou a reagir!",
};

const REVELACAO: readonly FalaDoPodcast[] = [
  {
    falante: "Lucas",
    texto:
      "Foi aí que a ficha caiu para todos nós da redação: uma notícia pode ser super colorida, emocionante e parecer urgente, mas se a data já passou ou se ninguém assina, ela vira um engano perigoso.",
  },
  {
    falante: "Clara",
    texto:
      "Exatamente! O bom jornalista não se deixa levar pela foto mais bonita. Ele desmonta a matéria em três partes antes de publicar: primeiro a FONTE — de onde veio esse informe? É oficial?",
  },
  {
    falante: "Lucas",
    texto: "Segundo, a DATA — quando exatamente isso aconteceu? É de hoje ou foi requentado do passado?",
  },
  {
    falante: "Clara",
    texto: "E terceiro, a AUTORIA — quem é a pessoa ou órgão que se responsabiliza por essas palavras?",
  },
  {
    falante: "Lucas",
    texto: "Quando a gente aplica esse algoritmo de julgamento, nenhuma notícia furada passa pela nossa mesa!",
  },
];

const PROVOCACAO: readonly FalaDoPodcast[] = [
  {
    falante: "Clara",
    texto:
      'E o mais importante: isso não serve só para quem escreve em jornal. No celular de cada um de nós, chegam avisos todo dia em grupos de família e de amigos dizendo: "URGENTE, repasse para todos!".',
  },
  {
    falante: "Lucas",
    texto:
      "Agora vocês já sabem a regra de ouro: antes de repassar qualquer aviso no grupo da escola, façam as três perguntas do Bento. Tem fonte conhecida? Tem data de hoje? Tem alguém de verdade assinando? Se faltar uma dessas coisas, pare e não passe adiante.",
  },
];

const ENCERRAMENTO: readonly FalaDoPodcast[] = [
  {
    falante: "Clara",
    texto: "Parabéns a todos os editores da turma! Vocês salvaram o jornal da escola e aprenderam a checar como profissionais.",
  },
  { falante: "Lucas", texto: "Até a próxima missão do Entre Redes! Tchau, pessoal!" },
  { falante: "Clara", texto: "Tchau, tchau!" },
];

// ──────────────────────────────────────────── as vagas do tema

export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [
  {
    id: "isca",
    falante: "Lucas",
    sobre: "a notícia antiga",
    instrucao:
      'A notícia ANTIGA apresentada como se fosse de hoje (pilar em falta: data) que mais chamava a atenção, de preferência a com imagem: diga do que ela falava e que muita gente a escolheu pela foto ou pela chamada. Comece por "E muita gente escolheu aquela matéria".',
  },
  {
    id: "reacao",
    falante: "Lucas",
    sobre: "a reação à notícia antiga",
    instrucao:
      'A reação dos leitores quando essa notícia antiga circulou (a consequência dela no material): quem apareceu, o que aconteceu e alguém avisando quando o fato aconteceu de verdade, numa fala entre aspas. Comece por "Tinha".',
  },
  {
    id: "boato",
    falante: "Clara",
    sobre: "o aviso sem assinatura",
    instrucao:
      'O aviso SEM CONFIRMAÇÃO ou SEM AUTORIA (pilar em falta: fonte ou autoria) e a confusão que ele causou na escola, como uma pergunta seguida da consequência. Comece por "E aquela outra".',
  },
];

/** As três falas do banco padrão — as do sheet, com a "oficina de robótica" no lugar da "gincana". */
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {
  isca: "E muita gente escolheu aquela matéria da oficina de robótica incrível com uma foto linda e chamativa...",
  reacao:
    'Tinha aluno chegando no portão no sábado com roupa de festa, pai ligando bravo pra diretoria e o guarda da escola avisando: "Gente, essa oficina de robótica aconteceu há oito anos atrás, em 2018!".',
  boato:
    "E aquela outra mensagem urgente em letras maiúsculas? Não tinha nome de ninguém e fez a secretaria inteira parar pra desmentir um boato!",
};

/** O roteiro inteiro, com as três falas do tema no lugar delas. */
export function roteiroDoPodcast(tema: FalasDoTema): TrechoDoRoteiro[] {
  const fala = (id: string, falante: string): FalaDoPodcast => ({ falante, texto: (tema[id] ?? "").trim() });
  const falasDe: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
    abertura: ABERTURA,
    recapitulacao: [
      RECAPITULACAO_ENTRADA,
      fala("isca", "Lucas"),
      RECAPITULACAO_SUSTO,
      fala("reacao", "Lucas"),
      fala("boato", "Clara"),
    ],
    revelacao: REVELACAO,
    provocacao: PROVOCACAO,
    encerramento: ENCERRAMENTO,
  };
  return BLOCOS_DO_PODCAST.map((bloco) => ({
    bloco,
    titulo: TITULOS[bloco],
    falas: falasDe[bloco].map((f) => ({ ...f })),
  }));
}

// ──────────────────────────────────────────── a voz

export const FALANTES_DO_PODCAST: AiFalante[] = [
  { nome: "Lucas", timbre: "jovem-masculino" },
  { nome: "Clara", timbre: "jovem-feminino" },
];

/** A direção de atuação: os locutores jovens da rádio escolar, falando com o 4º ano. */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, no formato de um boletim da rádio da escola, gravado por dois jovens locutores de 20 a 25 anos que conversam direto com crianças de 9 e 10 anos do 4º ano que acabaram de fazer uma missão de letramento digital sobre um jornal escolar. " +
  "Conversa natural, ritmo animado e caloroso, frases claras, sem tom de professor dando aula e sem voz infantilizada. " +
  "Lucas é animado e ágil. Clara é curiosa e investigativa. " +
  "As falas se emendam como numa conversa de verdade, com pausas curtas entre uma e outra.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem (o hash do arquivo muda junto). */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};
