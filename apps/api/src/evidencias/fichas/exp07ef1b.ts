import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA da exp07ef1b — A Seleção (7º ano EF, unidade 1) — versão 2, de
 * 2026-10-16 (ADR-170): o CANAL A OBRIGATÓRIO.
 *
 * Toda habilidade é medida por AÇÃO do estudante; as enquetes P1 e P2 da
 * versão 1 saíram da ficha e viraram INFORMAÇÃO para o professor
 * (`a-selecao/enquetes.ts`), a pedido do PO — nunca "vale o melhor dos dois",
 * que deixaria a pergunta subir o nível que a ação deu. Os níveis que elas
 * deram em atividades de antes ficam no histórico.
 *
 *   - **EF07CO11** (criar, documentar e publicar produtos digitais) pela
 *     LEGENDA dos Stories, lida pela IA depois do latch: ela devolve
 *     indicadores (razão, conteúdo, sem relação) e o servidor dá o nível. A IA
 *     falhando, a regra de palavras grava só uma SUGESTÃO, sem marca — a
 *     célula fica "Não avaliado" até o professor confirmar no ajuste.
 *   - **EF07CO08** (empatia sobre opiniões divergentes na web) pela MARCAÇÃO:
 *     entre o Mural e as fichas, o estudante aponta o post do colega que a
 *     publicação dele deixou de fora — ou "Nada que mude a história". O nível
 *     congela na abertura das fichas (`a-selecao/regras/marcacao.ts`).
 */
export const FICHA_EXP07EF1B: FichaPedagogica = {
  expId: "exp07ef1b",
  versao: 2,
  habilidades: [
    {
      codigo: "EF07CO11",
      marcadores: [{ id: "legenda-publicada", tipo: "acao", rotulo: "Legenda dos Stories — leitura da IA" }],
      criterios: {
        atingiu:
          "A legenda dos Stories diz POR QUE escolheu os posts (o critério, as fontes, o que quis mostrar à escola) e fala do conteúdo deles.",
        em_processo:
          "A legenda só descreve os posts, ou só diz que são os melhores, sem explicar a escolha.",
        nao_atingiu: "A legenda não tem relação com os posts publicados, ou não tem sentido.",
        observacao:
          "Quem lê a legenda é a IA, depois da publicação. Quando ela não consegue ler, a célula fica \"Não avaliado\" com uma sugestão: confira a legenda na lista da aula e ajuste. Sem publicação, a habilidade fica \"Não avaliado\". Ortografia, gíria e tamanho não contam.",
      },
    },
    {
      codigo: "EF07CO08",
      marcadores: [{ id: "marcacao-colega", tipo: "acao", rotulo: "Marcação do post do colega" }],
      criterios: {
        atingiu:
          "Na marcação, aponta um post do colega que mostra um lado que faltou na própria publicação.",
        em_processo:
          "Aponta um post do colega de um lado que a própria publicação já mostrava. (Quem publicou os três lados e responde \"Nada que mude a história\" também fica aqui.)",
        nao_atingiu:
          "Responde \"Nada que mude a história\", recusando o lado que o colega mostrou, ou aponta um post que ele mesmo publicou.",
        observacao:
          "A marcação mede se o estudante reconhece o ponto de vista do outro (tomada de perspectiva), não a empatia afetiva. É uma medida simples: leia o \"por quê?\" quando quiser confirmar, e ajuste. Sem marcação, a habilidade fica \"Não avaliado\".",
      },
    },
  ],
  perguntas: [],
};
