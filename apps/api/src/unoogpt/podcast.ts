import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO da Missão Tempestade (exp02em1b, ADR-156) — Lia e
 * Caio, cerca de 3 minutos e meio. É o primeiro podcast FIXO da plataforma:
 * a missão não tem customização (Serra do Sauá é a mesma para todas as
 * turmas), então o roteiro inteiro sai daqui, sem vaga, sem IA e sem edição do
 * professor (decisão do Lucas, 2026-10-10). O mesmo texto em toda turma faz o
 * áudio ser sintetizado UMA vez por contrato.
 *
 * O texto foi rascunhado a partir da ficha da cidade (`cenario.ts`) e do guia
 * da aula, e aguarda a leitura do PO. Ele respeita o que o guia manda:
 *
 * - **toca DEPOIS do debate**: ele cita três vieses (satélite, cadastro,
 *   telefonia), e o guia proíbe entregar qualquer viés antes da conversa. São
 *   os três que o guia sugere ao professor puxar — os outros cinco ficam só na
 *   tabela dele;
 * - **nenhuma fonte "mente"**: cada uma vê um pedaço; o erro está na distância
 *   entre o que ela mede e a pergunta que se faz a ela;
 * - **o Cientista não erra**: responde com rigor sobre um dado torto;
 * - **o resultado é faixa**, não profecia, e não há alocação certa;
 * - **o Morro Alto fala do instrumento**, nunca das pessoas (o dado é velho,
 *   não o lugar é invisível).
 *
 * Puro — sem Nest e sem Prisma. Quem liga a missão ao módulo `podcast` é
 * `podcast-fonte.ts`.
 */

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;

const TITULOS: Record<(typeof BLOCOS_DO_PODCAST)[number], string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação da missão",
  revelacao: "O que cada fonte enxergava",
  provocacao: "Provocação e transferência",
  encerramento: "Encerramento",
};

const FALAS: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
  abertura: [
    {
      falante: "Lia",
      texto: "Oi, gente! Bem-vindos ao podcast da sala de operações de Serra do Sauá. Eu sou a Lia.",
    },
    {
      falante: "Caio",
      texto:
        "E eu sou o Caio. Se você acabou de passar uma hora decidindo para onde mandar as equipes antes da tempestade, este episódio é pra você. E não, a gente não vai dizer qual era a resposta certa. Até porque ela não existe.",
    },
  ],
  recapitulacao: [
    {
      falante: "Lia",
      texto:
        "Vamos lembrar. Alerta laranja, chuva forte em uma hora. Quatro bairros: Ribeirinha, Vale Verde, Morro Alto e Industrial. E só duas equipes: a Alfa, que sai do norte, e a Bravo, que sai do sul. Não dava pra atender todo mundo.",
    },
    {
      falante: "Caio",
      texto:
        "E o mapa começou apagado. Pra acender um bairro, você precisava pedir uma fonte ao Cientista de Dados. Só que eram três perguntas e cinco minutos de relógio. Conversar era de graça. Investigar custava.",
    },
    {
      falante: "Lia",
      texto:
        "Aí veio a parte que mais pegou a turma: muita gente decidiu com algum bairro ainda em branco. E aqui vai a pergunta que importa. Branco queria dizer sem risco, ou queria dizer que ninguém tinha olhado?",
    },
    {
      falante: "Caio",
      texto:
        "Não sabemos nunca é zero. Esse é o erro que a missão foi feita pra provocar, e ele acontece fora da escola também: em política pública, em diagnóstico médico, em quem consegue um empréstimo no banco.",
    },
  ],
  revelacao: [
    {
      falante: "Lia",
      texto:
        "E tem mais. Nenhuma fonte mentiu. Cada uma mediu direito o que se propunha a medir. O satélite, por exemplo, mostrava o Industrial cheio de construção. Só que satélite vê telhado, não vê gente. Galpão vazio e prédio lotado têm o mesmo telhado.",
    },
    {
      falante: "Caio",
      texto:
        "O cadastro de moradores tinha anos de atraso. Quem chegou ao Morro Alto depois do último cadastro simplesmente não estava lá. O problema não era o lugar. Era o instrumento, que ficou velho.",
    },
    {
      falante: "Lia",
      texto:
        "E a telefonia contava aparelhos, não pessoas. Quem não tem celular, como muita criança e muito idoso, sumia da conta. Justamente quem mais precisa de ajuda numa enchente.",
    },
    {
      falante: "Caio",
      texto:
        "Então o Cientista de Dados não errou. Ele respondeu com rigor sobre o que recebeu. O limite não estava na inteligência artificial. Estava no dado que entrou nela, e na pergunta que a gente fez.",
    },
  ],
  provocacao: [
    {
      falante: "Lia",
      texto:
        "E o resultado veio como uma faixa, com vinte corridas da mesma decisão, e não como um número só. Muita gente achou que tinha decidido certo e mesmo assim viu gente exposta. É porque um modelo honesto mostra a incerteza do mundo, não uma profecia.",
    },
    {
      falante: "Caio",
      texto:
        "E fica a provocação: que decisões sobre a nossa cidade são tomadas com dados que não enxergam alguém? Onde passa o ônibus, onde abre o posto de saúde, onde a prefeitura acha que mora gente.",
    },
    {
      falante: "Lia",
      texto:
        "E quando um sistema decide sobre a vida de alguém, essa pessoa tem o direito de saber como foi decidido, quem é o responsável e como questionar. Dado sobre onde mora quem é vulnerável pede cuidado redobrado.",
    },
  ],
  encerramento: [
    {
      falante: "Caio",
      texto:
        "Então, da próxima vez que um dado parecer resolver tudo, pergunte: quem mediu isso, quando, e o que esse instrumento consegue enxergar?",
    },
    {
      falante: "Lia",
      texto:
        "E pense na quarta pergunta que você faria, se tivesse mais uma. Ela diz muito sobre o tipo de decisor que você quer ser. Valeu, gente. Até a próxima missão!",
    },
  ],
};

/** A missão não tem tema: o roteiro não tem vaga. */
export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [];
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {};

/** O roteiro inteiro — o mesmo em toda turma. */
export function roteiroDoPodcast(): TrechoDoRoteiro[] {
  return BLOCOS_DO_PODCAST.map((bloco) => ({
    bloco,
    titulo: TITULOS[bloco],
    falas: FALAS[bloco].map((f) => ({ ...f })),
  }));
}

// ──────────────────────────────────────────── a voz

export const FALANTES_DO_PODCAST: AiFalante[] = [
  { nome: "Lia", timbre: "jovem-feminino" },
  { nome: "Caio", timbre: "jovem-masculino" },
];

/** A direção de atuação: dois jovens apresentadores falando com a 2ª série do EM, depois do debate. */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, gravado por dois jovens apresentadores de 20 a 25 anos que conversam direto com estudantes de 16 e 17 anos da 2ª série do Ensino Médio, que acabaram de decidir, sob pressão de tempo, para onde mandar equipes de resgate antes de uma tempestade, usando dados que enxergavam só parte da cidade. " +
  "Conversa natural, ritmo firme e próximo, frases claras, sem tom de professor dando aula e sem infantilizar. " +
  "Lia é analítica e provocadora. Caio é espontâneo e traz exemplos do dia a dia. " +
  "As falas se emendam como numa conversa de verdade, com pausas curtas entre uma e outra.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem (o hash do arquivo muda junto). */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};
