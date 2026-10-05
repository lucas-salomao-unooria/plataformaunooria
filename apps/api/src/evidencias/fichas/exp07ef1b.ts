import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA da exp07ef1b — A Seleção (7º ano EF, unidade 1). A primeira missão
 * com ficha pedagógica (E14).
 *
 * Duas habilidades de Computação, três marcadores:
 *
 * - **EF07CO11** (criar, documentar e publicar produtos digitais):
 *   - `legenda-publicada` — AÇÃO. É o Canal A: a legenda dos Stories graduada
 *     pela IA depois do latch (`a-selecao/classificacao.service.ts`). Falhando
 *     a IA, não há marca — e a enquete P1 continua medindo a habilidade;
 *   - `p1` — a enquete P1 da DM da Amara. Vale a melhor das duas (a regra de
 *     dois marcadores da mesma habilidade, `regras.ts#statusProprio`).
 * - **EF07CO08** (empatia sobre opiniões divergentes na web):
 *   - `p2` — a enquete P2, sobre o Mural.
 *
 * O texto das perguntas é VERBATIM do PO, na versão de 2026-10-01: uma frase
 * só, sem a abertura da Amara ("Antes de fechar…", "Última!") nem o rótulo da
 * enquete, que a versão de 2026-09-25 tinha. Sem linha em branco no enunciado,
 * a experiência mostra a enquete sem balão de contexto antes. A plataforma
 * EMBARALHA as alternativas a cada leitura, para toda ficha
 * (`regras.ts#embaralhar`, ADR-118): numa enquete de toque único, a primeira
 * opção levaria o toque de quem tem pressa.
 */
export const FICHA_EXP07EF1B: FichaPedagogica = {
  expId: "exp07ef1b",
  versao: 1,
  habilidades: [
    {
      codigo: "EF07CO11",
      marcadores: [
        { id: "legenda-publicada", tipo: "acao" },
        { id: "p1", tipo: "multipla_escolha", perguntaId: "p1" },
      ],
      criterios: {
        atingiu:
          "A legenda dos Stories diz o critério da escolha (por que esses posts, de quais fontes); ou, na 1ª pergunta, avisa que os 3 posts mostram um lado, não a história toda.",
        em_processo: "A legenda só descreve os posts ou é genérica; ou, na 1ª pergunta, admite que pode ter faltado algum detalhe.",
        nao_atingiu: "A legenda não tem relação com os posts, e na 1ª pergunta garante que a seleção é completa.",
        observacao: "Vale o melhor entre a legenda (avaliada pela IA) e a 1ª pergunta.",
      },
    },
    {
      codigo: "EF07CO08",
      marcadores: [{ id: "p2", tipo: "multipla_escolha", perguntaId: "p2" }],
      criterios: {
        atingiu: "Na 2ª pergunta, reconhece que o colega priorizou outras fontes e que os dois lados são reais.",
        em_processo: "Na 2ª pergunta, explica a diferença só como gosto pessoal.",
        nao_atingiu: "Na 2ª pergunta, diz que o colega não leu direito e que a própria seleção é a mais completa.",
      },
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado:
        "Imagina que alguém da escola viu os Stories que você publicou e mandou: 'Valeu pelo resumo! Agora já sei tudo sobre o que aconteceu.' O que você diria?",
      alternativas: [
        {
          id: "A1",
          texto:
            "Cuidado, eu só escolhi 3 posts de vários que tinham. O que eu publiquei mostra um lado, não a história toda.",
          status: "atingiu",
        },
        {
          id: "A2",
          texto: "De nada! Tentei pegar os melhores, mas pode ser que tenha faltado algum detalhe.",
          status: "em_processo",
        },
        {
          id: "A3",
          texto: "Pode confiar! Eu li tudo com atenção e selecionei os mais completos.",
          status: "nao_atingiu",
        },
      ],
    },
    {
      id: "p2",
      enunciado:
        "Lembra quando você viu os Stories do colega no Mural e a história parecia outra? Os dois partiram do mesmo feed. O que faz mais sentido pensar sobre isso?",
      alternativas: [
        {
          id: "B1",
          texto:
            "A gente priorizou fontes diferentes. A seleção dele conta outro lado da mesma história, e os dois lados são reais.",
          status: "atingiu",
        },
        {
          id: "B2",
          texto: "Cada um tem seu gosto, então é normal que a gente escolha posts diferentes.",
          status: "em_processo",
        },
        {
          id: "B3",
          texto: "Acho que ele não leu os posts direito, porque os meus estavam mais completos.",
          status: "nao_atingiu",
        },
      ],
    },
  ],
};
