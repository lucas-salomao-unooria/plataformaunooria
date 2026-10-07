import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO do Júri Estadual de Projetos (ADR-150, ADR-151) —
 * o episódio do one-pager aprovado (seção 11, "A Mostra que Ninguém Viu
 * Inteira": Bia e Rafa, cerca de 3m45s), com as correções que o roteiro pediu
 * para não contradizer a missão:
 *
 * - **nenhum número cravado**: "escondeu os outros 12 projetos" e "três quartos
 *   de uma feira" contradiziam a taxa REAL, que é de cada computador (com duas
 *   curtidas na mesma área, 9 de 16 ficam ocultos). O texto diz "os projetos
 *   das outras áreas" e "mais da metade de uma feira";
 * - **o app é o Unoovista**, e não o `instanooria`; e "da Unooria" sai de dentro
 *   da ficção: é o podcast da Mostra Estadual de Projetos;
 * - **as áreas que o Rafa curtiu não estão no texto fixo** ("plantas e
 *   natureza", "o Rafa gosta de meio ambiente"): a mostra é da IA, sobre o tema
 *   do professor, e o fixo serve a qualquer tema;
 * - **menos exclamações** que o sheet, no tom da missão (os estandes já saem
 *   sem elas, `regras/preparo.ts#semExclamacao`): ficam as da abertura e do
 *   tchau, e as de surpresa.
 *
 * O foco é a EF06CO10 (ver o que aparece não é ver tudo): o fecho da "lupa" e do
 * "pesquisar fontes variadas" fica como o sheet o escreveu.
 *
 * É do PROFESSOR, e o one-pager avisa: ele revela a virada, então toca
 * **depois da Galeria Oculta**, nunca antes da aula. O módulo do podcast não
 * tem trava por etapa; quem diz isso é o cartão da aula e o guia.
 *
 * As três falas que citam projetos da mostra são as VAGAS: a missão não tem
 * banco padrão (a mostra é sempre da IA), então a IA as reescreve com os
 * estandes e as áreas que o professor gerou, e ele as revisa na criação. As do
 * sheet (o robô dos bueiros, a composteira da merenda) só voltam quando a IA
 * não responde — e a tela avisa que precisam ser reescritas.
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

// ──────────────────────────────────────────── o texto aprovado, corrigido

const ABERTURA: readonly FalaDoPodcast[] = [
  {
    falante: "Bia",
    texto: "Fala, jurados e juradas! Sejam bem-vindos ao podcast da Mostra Estadual de Projetos. Eu sou a Bia.",
  },
  {
    falante: "Rafa",
    texto:
      "E eu sou o Rafa. Se você acabou de participar da avaliação da 10ª Mostra de Projetos Escolares no Unoovista, aposto que saiu com a certeza absoluta de que escolheu o projeto mais incrível da feira. Acertei, Bia?",
  },
];

const RECAPITULACAO_POR_QUE: FalaDoPodcast = {
  falante: "Bia",
  texto:
    "E sabe por quê? Ninguém aqui foi vítima de um erro do aplicativo... fomos vítimas da nossa própria primeira impressão.",
};

const RECAPITULACAO_CURTIDAS: FalaDoPodcast = {
  falante: "Rafa",
  texto:
    "Caramba, é verdade. Quando a gente entrou na mostra, o feed mostrou quatro projetos bem diferentes no começo. Mas aí, na empolgação, eu curti duas fotos seguidas da mesma área.",
};

const REVELACAO: readonly FalaDoPodcast[] = [
  {
    falante: "Bia",
    texto:
      'E o que o aplicativo fez? Ele não lê a sua mente, Rafa. Ele leu os seus cliques. O sistema registrou essas curtidas como dados e identificou um padrão imediato: "O Rafa gosta disso aqui". A partir desse segundo, a regra do algoritmo começou a trabalhar para prender a sua atenção: foi escondendo os projetos das outras áreas e entregando só mais do que você tinha acabado de curtir.',
  },
  {
    falante: "Rafa",
    texto:
      "Ou seja, o aplicativo criou uma bolha na minha tela. Eu achei que estava avaliando a feira inteira, mas estava trancado numa sala de espelhos, vendo apenas o reflexo do meu primeiro clique. Isso lembra demais a história do Léo, lá do nosso livro didático, quando ele descobriu por que o feed dele parecia saber tanto sobre ele.",
  },
];

const PROVOCACAO: readonly FalaDoPodcast[] = [
  {
    falante: "Bia",
    texto:
      "Exatamente. E aí vem a provocação para o nosso dia a dia fora da escola: se um algoritmo conseguiu esconder mais da metade de uma feira escolar só porque a gente curtiu duas postagens, o que será que as redes sociais estão escondendo de nós todos os dias?",
  },
  {
    falante: "Rafa",
    texto:
      "Vídeos engraçados, notícias de jornal, opiniões de amigos... Quando a gente só vê pessoas que pensam exatamente igual a nós, será que todo mundo no mundo realmente concorda, ou será que o nosso feed simplesmente escondeu quem pensa diferente?",
  },
];

const ENCERRAMENTO: readonly FalaDoPodcast[] = [
  {
    falante: "Bia",
    texto:
      "Para furar a bolha, jurados, a gente precisa aprender a usar a lupa: pesquisar fontes variadas, conversar fora do feed e jamais achar que o que aparece na nossa tela é tudo o que existe no mundo.",
  },
  { falante: "Rafa", texto: "É isso aí, jurados. Nos vemos na próxima missão. Até mais!" },
];

// ──────────────────────────────────────────── as vagas do tema

export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [
  {
    id: "dois",
    falante: "Bia",
    sobre: "os dois estandes de áreas diferentes",
    instrucao:
      'Bia pergunta ao Rafa em qual de DOIS estandes da mostra ele votou: dois estandes de ÁREAS DIFERENTES do material, que pareçam bem distantes um do outro, cada um dito pelo que ele é (não precisa ser o título exato). Comece por "Com certeza, Rafa. Mas me responde uma coisa: você votou naquele".',
  },
  {
    id: "rafa",
    falante: "Rafa",
    sobre: "o que o feed dele mostrou",
    instrucao:
      'Rafa estranha o PRIMEIRO estande que a Bia citou (ele nunca o viu) e diz que a tela dele só tinha projetos da ÁREA DO SEGUNDO estande, citando dois ou três assuntos de estandes dessa área. Comece por "Ué, Bia..." e termine dizendo que o primeiro nunca apareceu para ele.',
  },
  {
    id: "mesa",
    falante: "Bia",
    sobre: "o que o feed da mesa ao lado mostrou",
    instrucao:
      'Bia conta que, para os jurados da mesa ao lado, não apareceu nenhum projeto da área do Rafa, e que a tela deles só tinha a ÁREA DO PRIMEIRO estande, citando dois ou três assuntos de estandes dessa área. Comece por "Pois é! E para os jurados da mesa ao lado".',
  },
];

/**
 * As três falas do sheet — o robô dos bueiros (tecnologia) e a composteira da
 * merenda (meio ambiente). Não há banco padrão nesta missão: elas só chegam à
 * tela quando a IA não responde, com o aviso para reescrever.
 */
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {
  dois: "Com certeza, Rafa. Mas me responde uma coisa: você votou naquele robô que recolhe plástico nos bueiros, ou votou no projeto da composteira orgânica da merenda?",
  rafa: "Ué, Bia... que robô? Na minha tela só tinha projetos de meio ambiente, hortas inteligentes e reflorestamento. Não apareceu nenhum robô pra mim!",
  mesa: "Pois é! E para os jurados da mesa ao lado, não apareceu nenhuma horta. A tela deles só tinha tecnologia, drones e circuitos.",
};

/** O roteiro inteiro, com as três falas do tema no lugar delas. */
export function roteiroDoPodcast(tema: FalasDoTema): TrechoDoRoteiro[] {
  const fala = (id: string, falante: string): FalaDoPodcast => ({ falante, texto: (tema[id] ?? "").trim() });
  const falasDe: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
    abertura: ABERTURA,
    recapitulacao: [
      fala("dois", "Bia"),
      fala("rafa", "Rafa"),
      fala("mesa", "Bia"),
      RECAPITULACAO_POR_QUE,
      RECAPITULACAO_CURTIDAS,
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
  { nome: "Bia", timbre: "jovem-feminino" },
  { nome: "Rafa", timbre: "jovem-masculino" },
];

/** A direção de atuação: dois jovens apresentadores falando com o 6º ano, depois da Galeria Oculta. */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, gravado por dois jovens apresentadores de 20 a 25 anos que conversam direto com pré-adolescentes de 11 e 12 anos do 6º ano, que acabaram de ser jurados de uma mostra estadual de projetos escolares numa rede social e descobriram que o feed escondeu parte da mostra. " +
  "Conversa natural, ritmo dinâmico e próximo, frases claras, sem tom de professor dando aula e sem voz infantilizada. " +
  "Bia é provocadora e bem-humorada. Rafa é espontâneo e se surpreende de verdade. " +
  "As falas se emendam como numa conversa de verdade, com pausas curtas entre uma e outra.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem (o hash do arquivo muda junto). */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};
