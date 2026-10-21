import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de "O Conteúdo que não chegou" (exp08ef1b, Unoovista, 8º ano EF,
 * unidade 1) — versão 3, de 2026-10-21 (ADR-179: as réguas do PO, validadas
 * com a pedagogia; a versão 2 é de 2026-10-16, ADR-167).
 *
 * Toda habilidade é medida por AÇÃO (o Canal A); as três perguntas de
 * múltipla escolha da versão 1 (ADR-153) saíram. Os níveis que elas deram em
 * atividades encerradas ficam no histórico.
 *
 *   - **EF08CO11** (vieses e abrangência de fontes eletrônicas) pelo 6a Raio-x
 *     do feed (vieses) e pela reflexão lida pela IA (mecanismo e abrangência).
 *     Vale a melhor das duas; o painel diz de qual veio (ADR-166).
 *   - **EF08CO09** (termos de uso) pelo 6b: os termos aceitos na entrada,
 *     revisitados depois da revelação — marcar as regras que explicam o feed.
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
  versao: 3,
  habilidades: [
    {
      codigo: "EF08CO11",
      marcadores: [
        { id: "raio-x", tipo: "acao", rotulo: "Raio-x do feed" },
        { id: "reflexao", tipo: "acao", rotulo: "Reflexão — sugestão da IA" },
      ],
      criterios: {
        atingiu:
          "No Raio-x, classifica certo 5 ou 6 dos 6 posts. Ou, na reflexão, explica como o feed escolheu os posts e diz o que ficou de fora por causa de algo que ele mesmo fez.",
        em_processo:
          "No Raio-x, classifica certo 3 ou 4 posts. Ou, na reflexão, explica como o feed escolheu os posts, sem dizer o que ficou de fora por causa de algo que ele fez.",
        nao_atingiu:
          "No Raio-x, classifica certo 2 posts ou menos. Ou, na reflexão, atribui o feed inteiro ao acaso ou nega que houve escolha.",
        observacao:
          "Vale o melhor entre o Raio-x e a reflexão. O Raio-x mede os vieses das fontes; a reflexão mede o mecanismo e a abrangência (o que ficou de fora). Precisão e relevância das fontes não são medidas nesta missão. O nível da reflexão é uma sugestão da IA: confira e ajuste se discordar. Sem nenhuma das duas, a habilidade fica \"Não avaliado\", e você pode ajustar.",
      },
    },
    {
      codigo: "EF08CO09",
      marcadores: [{ id: "termos", tipo: "acao", rotulo: "Os termos de uso" }],
      criterios: {
        atingiu:
          "Revisitando os termos que aceitou na entrada, marca exatamente as 3 regras que explicam o feed e nenhuma das 2 que não explicam (nenhum erro).",
        em_processo: "Comete 1 ou 2 erros: marca uma regra que não explica o feed, ou deixa sem marcar uma que explica.",
        nao_atingiu: "Comete 3 erros ou mais. Não marcar nenhuma regra conta 3 erros.",
        observacao:
          "Os termos aparecem na entrada, como texto longo com o botão \"Aceitar e continuar\", e voltam no 6b, depois da revelação. Erro = regra que explica deixada sem marca + regra que não explica marcada. Sem a tarefa feita, a habilidade fica \"Não avaliado\", e você pode ajustar.",
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
          "Cumpre os 3 critérios: os posts cobrem os dois lados, nenhum é de página de fofoca ou de humor, e a mensagem é a que avisa que aquilo é só um pedaço.",
        em_processo: "Cumpre 1 ou 2 dos 3 critérios.",
        nao_atingiu: "Não cumpre nenhum dos 3 critérios.",
        observacao:
          "Medida no 6c, depois da revelação: até 3 de 9 posts, 1 de 4 mensagens e uma frase opcional. Numa atividade sem página de fofoca ou de humor nos dois lados, o 2º critério não tem como falhar, então o envio vai no máximo a \"Em processo\" — a célula diz isso. Para medir, crie uma atividade nova com a mesma pergunta. Sem a tarefa feita, a habilidade fica \"Não avaliado\", e você pode ajustar.",
      },
    },
  ],
  perguntas: [],
};
