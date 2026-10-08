import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de "O Conteúdo que não chegou" (exp08ef1b, Unoovista, 8º ano EF,
 * unidade 1) — versão 1, de 2026-10-07.
 *
 * Três habilidades, três perguntas de múltipla escolha (o Canal B), na tela
 * escura do fim, DEPOIS da reflexão escrita salva — a reflexão fica (decisão do
 * Lucas em 2026-10-02: o PO falava em trocá-la), e perguntar antes sugeriria a
 * resposta que ela pede:
 *
 *   - **EF08CO11** (vieses em fontes eletrônicas) pela p1: o que montou o feed.
 *   - **EF08CO09** (termos de uso das plataformas) pela p2: a regra invisível.
 *   - **EF08CO07** (compartilhar entendendo a dinâmica da rede) pela p3: o que
 *     muda quando alguém compartilha o que viu.
 *
 * Enunciado e alternativas são o texto do PO, LITERAL. Os critérios são o "Por
 * que essa calibragem" dele, contado para o professor. A rodada é sempre 1
 * (`motor/contexto-da-evidencia.ts`): uma nova aplicação é uma atividade nova.
 * Quem não chega às perguntas fica "Não avaliado" — a AUSÊNCIA de marca.
 */
export const FICHA_EXP08EF1B: FichaPedagogica = {
  expId: "exp08ef1b",
  versao: 1,
  habilidades: [
    {
      codigo: "EF08CO11",
      marcadores: [{ id: "p1", tipo: "multipla_escolha", perguntaId: "p1" }],
      criterios: {
        atingiu:
          "Na 1ª pergunta, aponta os sinais que a plataforma usou (o que curtiu, salvou e onde parou mais tempo), o ranqueamento por esse padrão e a consequência: o resto ficou de fora.",
        em_processo:
          "Na 1ª pergunta, reconhece que o feed foi personalizado, mas não diz quais sinais alimentaram a ordenação.",
        nao_atingiu: "Na 1ª pergunta, não reconhece que houve filtragem: trata o feed como se já viesse pronto.",
      },
    },
    {
      codigo: "EF08CO09",
      marcadores: [{ id: "p2", tipo: "multipla_escolha", perguntaId: "p2" }],
      criterios: {
        atingiu:
          "Na 2ª pergunta, liga a coleta e o uso das interações às regras da plataforma (os termos de uso) e percebe que essas regras não estavam visíveis enquanto navegava.",
        em_processo:
          "Na 2ª pergunta, explica como funcionamento automático do algoritmo, sem questionar a regra por trás.",
        nao_atingiu: "Na 2ª pergunta, não vê problema: aceita o resultado sem questionar as regras que o produziram.",
      },
    },
    {
      codigo: "EF08CO07",
      marcadores: [{ id: "p3", tipo: "multipla_escolha", perguntaId: "p3" }],
      criterios: {
        atingiu:
          "Na 3ª pergunta, liga a visão parcial do feed ao ato de compartilhar: quem compartilha e quem recebe não sabem o que ficou de fora, e a informação circula incompleta.",
        em_processo:
          "Na 3ª pergunta, nota que cada um vê coisas diferentes, mas não tira consequência para o compartilhamento.",
        nao_atingiu: "Na 3ª pergunta, trata o que apareceu no feed como confiável só por ter aparecido.",
      },
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado: "Seu feed só mostrou posts de um lado da questão. O que fez a plataforma montar esse feed pra você?",
      alternativas: [
        {
          id: "A1",
          texto:
            "Ela usou o que eu fiz no feed: o que curti, salvei e onde parei mais tempo. Com isso, ranqueou os posts e me mostrou só os que combinavam com esse padrão. O resto ficou de fora.",
          status: "atingiu",
        },
        {
          id: "A2",
          texto: "Ela percebeu que eu preferia um lado e me mandou mais posts daquele tipo.",
          status: "em_processo",
        },
        { id: "A3", texto: "O feed já veio assim. Só tinha aqueles posts pra mostrar.", status: "nao_atingiu" },
      ],
    },
    {
      id: "p2",
      enunciado:
        "Enquanto você navegava, a plataforma não avisou que estava usando suas interações pra decidir o que mostrar. O que isso tem a ver com as regras da plataforma?",
      alternativas: [
        {
          id: "B1",
          texto:
            "Tem a ver com os termos de uso: a plataforma coletou o que eu fiz e usou pra filtrar meu feed, mas essas regras não estavam visíveis pra mim enquanto eu navegava.",
          status: "atingiu",
        },
        {
          id: "B2",
          texto:
            "A plataforma fez isso porque é assim que o algoritmo funciona. Ele filtra automaticamente pra cada pessoa.",
          status: "em_processo",
        },
        { id: "B3", texto: "Não precisava avisar. O feed ficou organizado e funcionou bem.", status: "nao_atingiu" },
      ],
    },
    {
      id: "p3",
      enunciado:
        "Seus colegas receberam feeds opostos ao seu sobre a mesma questão. Se isso acontece nas redes sociais de verdade, o que muda quando alguém compartilha o que viu?",
      alternativas: [
        {
          id: "C1",
          texto:
            "A pessoa compartilha achando que viu o assunto inteiro, mas só viu o que a rede mostrou pra ela. Quem recebe também não sabe o que ficou de fora, então a informação circula incompleta sem ninguém perceber.",
          status: "atingiu",
        },
        {
          id: "C2",
          texto: "É estranho que cada um veja coisas diferentes, mas cada pessoa compartilha o que interessa pra ela.",
          status: "em_processo",
        },
        {
          id: "C3",
          texto: "Não muda nada. Se a informação estava lá, é porque era confiável.",
          status: "nao_atingiu",
        },
      ],
    },
  ],
};
