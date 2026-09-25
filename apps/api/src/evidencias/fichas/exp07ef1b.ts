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
 * O texto das perguntas é VERBATIM do PO (recebido em 2026-09-25): a mensagem
 * de contexto da Amara e a enquete, no mesmo enunciado, separadas por uma linha
 * em branco — a experiência as desenha como dois balões da DM. As alternativas
 * são EMBARALHADAS a cada exibição (`embaralhar: true`): numa enquete de toque
 * único, a primeira opção leva o toque de quem tem pressa, e o nível estaria
 * sempre na mesma posição.
 *
 * `validadaPor`/`validadaEm`: o dono do produto dispensou a validação
 * pedagógica em 2026-09-25, e a ficha diz isso por extenso — não finge uma
 * validação que não houve.
 */
export const FICHA_EXP07EF1B: FichaPedagogica = {
  expId: "exp07ef1b",
  versao: 1,
  validadaPor: "Lucas Salomão (dono do produto; validação pedagógica dispensada)",
  validadaEm: "2026-09-25",
  habilidades: [
    {
      codigo: "EF07CO11",
      marcadores: [
        { id: "legenda-publicada", tipo: "acao" },
        { id: "p1", tipo: "multipla_escolha", perguntaId: "p1" },
      ],
    },
    {
      codigo: "EF07CO08",
      marcadores: [{ id: "p2", tipo: "multipla_escolha", perguntaId: "p2" }],
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado:
        "Antes de fechar, uma curiosidade rápida! Imagina que alguém da escola viu os Stories que você publicou e mandou: 'Valeu pelo resumo! Agora já sei tudo sobre o que aconteceu.' O que você diria?\n\nSua resposta seria...",
      embaralhar: true,
      alternativas: [
        {
          id: "A1",
          texto:
            "Cuidado — eu só escolhi 3 posts de vários que tinham. O que eu publiquei mostra um lado, não a história toda.",
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
        "Última! Lembra quando você viu os Stories do colega no Mural e a história parecia outra? Os dois partiram do mesmo feed. O que faz mais sentido pensar sobre isso?\n\nO que você acha?",
      embaralhar: true,
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
