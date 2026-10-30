import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO de O Porta-Voz dos Dados (ADR-150, ADR-198) —
 * "Por Trás do Gráfico: Quem Controla o Eixo?", Alex e Sam, cerca de 3 min 40 s.
 *
 * O texto é o do one-pager aprovado (§11) e do banco `01e`, LITERAL, com as
 * duas correções do PO de 2026-10-28: TC-32 "estatísticos renomados" (era
 * "renovados") e TC-33 "daquela ferramenta essencial que vocês montaram" (era
 * "que vocês tiveram que redigir": o compositor tem três interruptores e
 * ninguém redige texto). As rubricas de trilha não são fala: vão na DIREÇÃO.
 *
 * Na 1.0.1 (29/10, pedido do Lucas) saíram os termos em inglês ("bot",
 * "feed", "posts") e os meses: o período é do pacote (a IA escreve semanas,
 * bimestres…), e o podcast fixo que dizia "quarto mês" desmentia a tabela.
 * O nome do trecho é o hash do texto: o áudio novo é gerado na próxima vez.
 *
 * FIXO (sem vaga, sem IA, sem edição do professor) e SÓ DO PROFESSOR
 * (decisão 1 do Lucas, como a exp02em1b, ADR-194/196): a tela do estudante
 * não menciona o podcast; o episódio é tocado em aula.
 *
 * Puro — sem Nest e sem Prisma. Quem liga a missão ao módulo `podcast` é
 * `podcast-fonte.ts`.
 */

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;

const TITULOS: Record<(typeof BLOCOS_DO_PODCAST)[number], string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação da vivência",
  revelacao: "Revelação e formalização",
  provocacao: "Provocação de transferência",
  encerramento: "Encerramento",
};

const FALAS: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
  abertura: [
    {
      falante: "Alex",
      texto:
        "Fala, pessoal! Bem-vindos ao boletim de bastidores da Unooria. Hoje a gente precisa falar sobre uma das maiores crises de comunicação que o comitê comunitário já presenciou. Duas escolas da mesma cidade, com a mesma planilha na mão, conseguiram provocar duas reações completamente opostas nos moradores.",
    },
    {
      falante: "Sam",
      texto:
        "É isso, Alex. Uma turma postou o gráfico e a galera do grupo deu de ombros, achando que estava tudo lindo. A outra postou e parecia que a cidade estava entrando em colapso, com gente exigindo interdição imediata. Mas aqui está o detalhe mais perturbador: ninguém falsificou um único número da planilha da prefeitura.",
    },
  ],
  recapitulacao: [
    {
      falante: "Alex",
      texto:
        "Exatamente, Sam. Vocês assumiram a missão como Porta-Vozes de Dados da escola. No chat privado, o Assistente de Dados entregou aquela tabela: o indicador começou em noventa e cinco por cento no primeiro período e caiu para oitenta e oito por cento no quarto período. Sete pontos percentuais de queda.",
    },
    {
      falante: "Sam",
      texto:
        "E aí bateu a primeira grande escolha. O assistente te dava duas opções de visualização para gerar. Na primeira opção, o eixo vertical começava no zero. As colunas ficavam altas, quase idênticas, e aquela queda de sete pontos parecia um detalhe insignificante na tela. Na segunda opção, o eixo começava cortado lá em cima, nos oitenta por cento. E aí, de repente, a coluna encolheu quase pela metade!",
    },
    {
      falante: "Alex",
      texto:
        "E o mais louco foi ver o grupo da cidade pegando fogo depois que você apertou encaminhar. Só que logo em seguida veio o choque: a Escola Santos Dumont publicou no mesmo grupo o gráfico com a escala inversa à sua. Quem olhava as duas publicações ficava tonto: afinal, o serviço público estava seguro ou em crise terminal?",
    },
  ],
  revelacao: [
    {
      falante: "Sam",
      texto:
        "E foi aí que o jogo virou. Quando a tela congelou para o debate com o professor, ficou escancarado o segredo: gráficos não são espelhos neutros da realidade. Eles são escolhas de design.",
    },
    {
      falante: "Alex",
      texto:
        "Essa técnica tem nome na ciência de dados: chama-se truncamento de eixo. Quando você joga o início do gráfico de barras para oitenta por cento, uma queda factual de apenas sete pontos percentuais se transforma fisicamente numa perda visual de quase quarenta e sete por cento da barra desenhada!",
    },
    {
      falante: "Sam",
      texto:
        "É o clássico Fator de Mentira, formulado por estatísticos renomados. Quando o desenho exagera o número real em várias vezes, o olho humano é enganado antes mesmo que o cérebro consiga ler a legenda.",
    },
    {
      falante: "Alex",
      texto:
        "E é por isso que ser Porta-Voz de Dados é uma baita responsabilidade civil e técnica. O gráfico em si não é proibido de focar nos oitenta por cento, desde que venha acompanhado daquela ferramenta essencial que vocês montaram: a Nota de Intenção. Quem publica tem a obrigação ética de explicar por que escolheu aquele recorte e o que ele significa na prática.",
    },
  ],
  provocacao: [
    {
      falante: "Sam",
      texto:
        "Agora pensem comigo: isso acontece todo santo dia fora da escola. Em propaganda política, em relatórios financeiros de grandes empresas, em manchetes sensacionalistas de canais de notícias no celular.",
    },
    {
      falante: "Alex",
      texto: "O que você faz a partir de hoje quando abrir uma rede social e vir um gráfico mostrando uma curva subindo ou descendo como uma montanha-russa?",
    },
    {
      falante: "Sam",
      texto:
        "Primeiro: ignora o título alarmista e a cor vermelha. Segundo: olha direto para a origem do eixo vertical. Onde começa a régua? Houve corte? Cadê a Nota de Intenção explicando a amostra? Quem domina o eixo controla a narrativa.",
    },
  ],
  encerramento: [
    { falante: "Alex", texto: "Quem desenha o gráfico escolhe o que o mundo vai enxergar. Use sua autoria com rigor e ética. Até a próxima missão no Unooria!" },
    { falante: "Sam", texto: "Valeu, porta-vozes! Até mais!" },
  ],
};

/** A missão tem tema, mas o PODCAST é fixo: o roteiro não tem vaga. */
export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [];
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {};

export function roteiroDoPodcast(): TrechoDoRoteiro[] {
  return BLOCOS_DO_PODCAST.map((bloco) => ({ bloco, titulo: TITULOS[bloco], falas: FALAS[bloco].map((f) => ({ ...f })) }));
}

// ──────────────────────────────────────────── a voz

export const FALANTES_DO_PODCAST: AiFalante[] = [
  { nome: "Alex", timbre: "jovem-masculino" },
  { nome: "Sam", timbre: "jovem-feminino" },
];

/** A direção de atuação, com a trilha do one-pager §11 (a trilha não é fala). */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, gravado por dois jovens apresentadores de cerca de 17 anos: Alex, com tom investigativo e curioso, e Sam, técnica, perspicaz e direta, falando com estudantes da 3ª série do Ensino Médio que acabaram de publicar um gráfico num grupo público da cidade. " +
  "Trilha sonora na abertura: eletrônica institucional rápida, que desacelera suavemente. Trilha sonora no fim: sobe com ritmo contemporâneo. " +
  "Conversa natural, ritmo firme e próximo, sem tom de professor dando aula e sem infantilizar; as falas se emendam com pausas curtas.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem. */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};
