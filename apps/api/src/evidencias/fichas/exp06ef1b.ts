import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DO JÚRI ESTADUAL DE PROJETOS (exp06ef1b, 6º ano, unidade 1). Três
 * habilidades — as do briefing (decisão de 2026-10-02: a EF06CO10 que a esteira
 * pôs no lugar da EF06CO07 saiu; o texto oficial dela é consumo de tecnologia
 * e obsolescência, não algoritmo). Seis marcadores, uma AÇÃO e uma PERGUNTA
 * por habilidade, e **vale o MELHOR dos dois** (`regras.ts#statusProprio`):
 *
 * - **EF06CO01** (classificar informações em coleções / tipos de dados) —
 *   `auditoria`, AÇÃO, marcada no LATCH da revisão do voto sobre o que a
 *   criança fez na Galeria Oculta: abriu estandes ocultos de ao menos duas
 *   áreas que não a do voto, ou buscou outra área E abriu um oculto = atingiu;
 *   abriu ou buscou alguma coisa = em processo; nada = não atingiu
 *   (`juri-estadual/regras/evidencia.ts`). E a `p2`.
 * - **EF06CO03** (descrever com precisão a solução, o programa) — `cadeia`,
 *   AÇÃO, marcada quando a cadeia de quatro blocos se monta: uma tentativa =
 *   atingiu; duas ou três = em processo; mais = não atingiu. E a `p3` (a regra
 *   SE…ENTÃO que o motor executou).
 * - **EF06CO07** (transmissão de dados em pacotes) — `pacotes`, AÇÃO, marcada
 *   quando a curtida se remonta no destino, com a mesma régua de tentativas. E
 *   a `p1`.
 *
 * Toda rodada mede as ações de novo, também na mesma atividade (ADR-145): o
 * resultado é a melhor rodada de cada habilidade.
 *
 * Texto da copy revisada (`e6.instrucao.item2_*`, `item3_*`); a `p1` é nova,
 * escrita para a EF06CO07 (o item 1 da copy media a EF06CO10). A plataforma
 * EMBARALHA as alternativas a cada leitura (ADR-118), e o estudante recebe
 * `{ enviada: true }` — a criança nunca sabe o nível.
 */
export const FICHA_EXP06EF1B: FichaPedagogica = {
  expId: "exp06ef1b",
  versao: 1,
  habilidades: [
    {
      codigo: "EF06CO01",
      marcadores: [
        { id: "auditoria", tipo: "acao" },
        { id: "p2", tipo: "multipla_escolha", perguntaId: "p2" },
      ],
      criterios: {
        atingiu:
          "Antes de revisar o voto, abre estandes ocultos de pelo menos duas áreas que não a do voto (ou busca outra área e abre um oculto); ou, na pergunta, diz que o sistema agrupou as curtidas pela categoria do estande.",
        em_processo: "Abre ou busca alguma coisa na Galeria Oculta; ou, na pergunta, diz que o sistema só contou os toques.",
        nao_atingiu: "Revisa o voto sem abrir nem buscar nada na galeria, e erra a pergunta.",
        observacao: "Vale o melhor entre a Galeria Oculta e a pergunta sobre como o aplicativo organizou as curtidas.",
      },
    },
    {
      codigo: "EF06CO03",
      marcadores: [
        { id: "cadeia", tipo: "acao" },
        { id: "p3", tipo: "multipla_escolha", perguntaId: "p3" },
      ],
      criterios: {
        atingiu: "Monta a cadeia dos quatro blocos na 1ª tentativa; ou, na pergunta, escolhe a regra SE…ENTÃO que o programa executou.",
        em_processo: "Monta a cadeia na 2ª ou na 3ª tentativa; ou escolhe uma regra que não descreve o feed.",
        nao_atingiu: "Precisa de mais de 3 tentativas para montar a cadeia, e escolhe uma regra sem relação com o feed.",
        observacao: "Vale o melhor entre a montagem da cadeia e a pergunta sobre a regra do programa.",
      },
    },
    {
      codigo: "EF06CO07",
      marcadores: [
        { id: "pacotes", tipo: "acao" },
        { id: "p1", tipo: "multipla_escolha", perguntaId: "p1" },
      ],
      criterios: {
        atingiu: "Remonta a curtida nos pacotes na 1ª tentativa; ou, na pergunta, diz que ela foi dividida em pacotes e remontada no servidor.",
        em_processo: "Remonta na 2ª ou na 3ª tentativa; ou diz que a curtida viajou inteira, de uma vez.",
        nao_atingiu: "Precisa de mais de 3 tentativas para remontar, e diz que a curtida nem saiu do celular.",
        observacao: "Vale o melhor entre a remontagem dos pacotes e a pergunta sobre o caminho da curtida.",
      },
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado:
        "Quando você votou, sua curtida saiu do celular e chegou ao servidor da Mostra, longe da escola. Como ela fez esse caminho?",
      alternativas: [
        {
          id: "A1",
          texto:
            "Foi dividida em pacotes numerados, que passaram por equipamentos diferentes e foram remontados no servidor.",
          status: "atingiu",
        },
        {
          id: "A2",
          texto: "Viajou inteira, de uma vez só, direto do celular para o servidor, sem passar por nenhum equipamento.",
          status: "em_processo",
        },
        {
          id: "A3",
          texto: "Ficou guardada só no celular, e o servidor adivinhou em qual projeto você votou.",
          status: "nao_atingiu",
        },
      ],
    },
    {
      id: "p2",
      enunciado:
        "Para decidir quais novos posts colocar na sua tela, o sistema precisou agrupar o que você fazia. Como o aplicativo organizou as informações das suas curtidas?",
      alternativas: [
        {
          id: "B1",
          texto:
            "O sistema associou cada curtida à categoria do estande, agrupando os dados para identificar o assunto favorito.",
          status: "atingiu",
        },
        {
          id: "B2",
          texto:
            "O sistema contou apenas a quantidade total de toques na tela, sem classificar o assunto de cada foto.",
          status: "em_processo",
        },
        {
          id: "B3",
          texto: "O aplicativo adivinhou a matéria escolar preferida observando a foto do perfil da sua conta.",
          status: "nao_atingiu",
        },
      ],
    },
    {
      id: "p3",
      enunciado:
        "Qual regra lógica descreve com exatidão a instrução que o programa do aplicativo executou para montar o seu feed?",
      alternativas: [
        {
          id: "C1",
          texto:
            "SE o jurado curtir duas publicações da mesma área, ENTÃO selecione apenas projetos dessa área para as próximas posições.",
          status: "atingiu",
        },
        {
          id: "C2",
          texto:
            "SE o tempo de uso do aplicativo for longo, ENTÃO exiba qualquer estande disponível de forma sorteada.",
          status: "em_processo",
        },
        {
          id: "C3",
          texto:
            "SE o jurado entrar no aplicativo, ENTÃO impeça os estudantes de outras escolas de votar no mesmo dia.",
          status: "nao_atingiu",
        },
      ],
    },
  ],
};
