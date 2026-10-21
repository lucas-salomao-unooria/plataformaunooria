import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de "O Conteúdo que não chegou" (exp08ef1b, Unoovista, 8º ano EF,
 * unidade 1) — versão 2, de 2026-10-16 (ADR-167).
 *
 * Toda habilidade é medida por AÇÃO (o Canal A); as três perguntas de
 * múltipla escolha da versão 1 (ADR-153) saíram. Os níveis que elas deram em
 * atividades encerradas ficam no histórico.
 *
 *   - **EF08CO11** (vieses e abrangência de fontes eletrônicas) pelo 6a Raio-x
 *     do feed (vieses) e pela reflexão lida pela IA (mecanismo e abrangência).
 *     Vale a melhor das duas; o painel diz de qual veio (ADR-166).
 *   - **EF08CO09** (termos de uso) pelo 6b: localizar, explicar o efeito e
 *     julgar as regras.
 *   - **EF08CO07** (compartilhar com responsabilidade) pelo 6c, o envio. Na
 *     atividade sem página de fofoca ou de humor nos dois lados, a única casa
 *     que a trava muda grava `envio-sem-confiabilidade`, limitado pela
 *     atividade: o consolidado o conta à parte.
 *
 * As réguas moram em `motor/canal-a/` (puras, testadas sem banco); os
 * critérios abaixo são elas contadas para o professor. A rodada é sempre 1
 * (`motor/contexto-da-evidencia.ts`); vale o PRIMEIRO envio de cada tarefa,
 * mesmo depois de um reinício.
 */
export const FICHA_EXP08EF1B: FichaPedagogica = {
  expId: "exp08ef1b",
  versao: 2,
  habilidades: [
    {
      codigo: "EF08CO11",
      marcadores: [
        { id: "raio-x", tipo: "acao", rotulo: "Raio-x do feed" },
        { id: "reflexao", tipo: "acao", rotulo: "Reflexão — sugestão da IA" },
      ],
      criterios: {
        atingiu:
          "No Raio-x, acerta de onde vieram 5 ou 6 dos 6 posts, incluindo o do lado dele em que mais parou. Ou, na reflexão, explica como o feed escolheu os posts e diz o que ficou de fora por causa de algo que ele mesmo fez.",
        em_processo:
          "No Raio-x, acerta 4 posts, ou 5 errando o post em que mais parou. Ou, na reflexão, explica como o feed escolheu os posts, sem dizer o que ficou de fora por causa de algo que ele fez.",
        nao_atingiu:
          "No Raio-x, acerta 3 posts ou menos. Ou, na reflexão, atribui o feed inteiro ao acaso ou nega que houve escolha.",
        observacao:
          "Vale o melhor entre o Raio-x e a reflexão. O Raio-x mede os vieses das fontes; a reflexão mede o mecanismo e a abrangência (o que ficou de fora). Precisão e relevância das fontes não são medidas nesta missão. O nível da reflexão é uma sugestão da IA: confira e ajuste se discordar. Sem nenhuma das duas, a habilidade fica \"Não avaliado\", e você pode ajustar.",
      },
    },
    {
      codigo: "EF08CO09",
      marcadores: [{ id: "termos", tipo: "acao", rotulo: "Os termos de uso" }],
      criterios: {
        atingiu:
          "Marca as regras que explicam o feed com no máximo um engano, liga pelo menos duas delas ao efeito certo e escolhe a mudança que dá controle ao usuário.",
        em_processo:
          "Marca as regras que explicam o feed com no máximo um engano e liga pelo menos uma ao efeito certo, mas não escolhe a mudança que dá controle.",
        nao_atingiu:
          "Erra duas regras ou mais (marcar todas também conta), ou não liga nenhuma regra ao efeito certo.",
        observacao:
          "Medida no 6b, depois da revelação. Sem a tarefa feita, a habilidade fica \"Não avaliado\", e você pode ajustar.",
      },
    },
    {
      codigo: "EF08CO07",
      marcadores: [
        { id: "envio", tipo: "acao", rotulo: "Envio para quem não viu" },
        {
          id: "envio-sem-confiabilidade",
          tipo: "acao",
          rotulo: "Envio — confiabilidade não medida nesta atividade",
          limitadoPelaAtividade: true,
        },
      ],
      criterios: {
        atingiu:
          "Manda posts dos dois lados, nenhum de página de fofoca ou de humor, com a mensagem que avisa que aquilo é só um pedaço.",
        em_processo:
          "Manda os dois lados com outra mensagem que não ridiculariza, ou manda fofoca ou humor junto, ou manda um lado só (ou só neutros) avisando que é só um pedaço.",
        nao_atingiu:
          "Ridiculariza o outro lado, ou passa um lado só como se fosse o todo, ou encerra a questão com um recorte.",
        observacao:
          "Medida no 6c, depois da revelação. Numa atividade sem página de fofoca ou de humor nos dois lados, a confiabilidade não é medida e o envio vai no máximo a \"Em processo\" — a célula diz isso. Para medir, crie uma atividade nova com a mesma pergunta. Sem a tarefa feita, a habilidade fica \"Não avaliado\", e você pode ajustar.",
      },
    },
  ],
  perguntas: [],
};
