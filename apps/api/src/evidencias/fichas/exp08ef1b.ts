import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de "O Conteúdo que não chegou" (exp08ef1b, Unoovista, 8º ano EF,
 * unidade 1) — versão 4, de 2026-10-22 (ADR-180: as respostas do PO às
 * perguntas da versão 3 — a EF08CO11 só pelo Raio-x, a régua dele 5–6/4/0–3,
 * e ridicularizar no envio dá "não atingiu"). A versão 3 é de 2026-10-21
 * (ADR-179, as réguas do PO validadas com a pedagogia); a 2, de 2026-10-16
 * (ADR-167).
 *
 * Toda habilidade é medida por AÇÃO (o Canal A); as três perguntas de
 * múltipla escolha da versão 1 (ADR-153) saíram. Os níveis que elas deram em
 * atividades encerradas ficam no histórico.
 *
 *   - **EF08CO11** (vieses e abrangência de fontes eletrônicas) só pelo 6a
 *     Raio-x do feed. A reflexão lida pela IA saiu na versão 4: as marcas
 *     `reflexao` já gravadas ficam no banco e não contam.
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
  versao: 4,
  habilidades: [
    {
      codigo: "EF08CO11",
      marcadores: [
        { id: "raio-x", tipo: "acao", rotulo: "Raio-x do feed" },
      ],
      criterios: {
        atingiu:
          "No Raio-x, classifica certo 5 ou 6 dos 6 posts.",
        em_processo: "No Raio-x, classifica certo 4 posts.",
        nao_atingiu: "No Raio-x, classifica certo 3 posts ou menos.",
        observacao:
          "Medida só pelo Raio-x, que mede os vieses das fontes. Os 3 acertos ficam em \"Não atingiu\" porque nenhuma resposta certa aparece mais de 3 vezes nos 6 posts: quem marca a mesma opção em todos, sem ler, acerta até 3. A reflexão continua na missão, para você ler, mas não conta para o nível. Precisão e relevância das fontes não são medidas nesta missão. Sem o Raio-x feito, a habilidade fica \"Não avaliado\", e você pode ajustar.",
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
        em_processo: "Cumpre 1 ou 2 dos 3 critérios, sem escolher a mensagem que ridiculariza o outro lado.",
        nao_atingiu: "Não cumpre nenhum dos 3 critérios, ou escolhe a mensagem que ridiculariza o outro lado (mesmo cumprindo os outros dois).",
        observacao:
          "Medida no 6c, depois da revelação: até 3 de 9 posts, 1 de 4 mensagens e uma frase opcional. Numa atividade sem página de fofoca ou de humor nos dois lados, o 2º critério não tem como falhar, então o envio vai no máximo a \"Em processo\" — a célula diz isso. Para medir, crie uma atividade nova com a mesma pergunta. Sem a tarefa feita, a habilidade fica \"Não avaliado\", e você pode ajustar.",
      },
    },
  ],
  perguntas: [],
};
