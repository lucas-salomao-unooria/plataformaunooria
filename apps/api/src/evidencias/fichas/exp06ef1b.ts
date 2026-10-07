import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DO JÚRI ESTADUAL DE PROJETOS (exp06ef1b, 6º ano, unidade 1). Três
 * habilidades, as da spec v1.5.2 (a decisão de 2026-10-02 de medir a EF06CO07
 * foi revertida pelo PO em 2026-10-06: a missão mede a EF06CO10 como foco
 * primário, e os pacotes saíram). Seis marcadores, uma AÇÃO e uma PERGUNTA por
 * habilidade, e **vale o MELHOR dos dois** (`regras.ts#statusProprio`):
 *
 * - **EF06CO10** (analisar criticamente o consumo de tecnologia) — `auditoria`,
 *   AÇÃO, marcada no LATCH da revisão do voto sobre o que a criança fez na
 *   Galeria Oculta: abriu ao menos dois estandes que o feed escondeu = atingiu;
 *   entrou superficialmente (um oculto, só vistos, ou buscou sem abrir) = em
 *   processo; revisou sem abrir nem buscar nada = SEM marca de ação, e a `p1`
 *   decide (`juri-estadual/regras/evidencia.ts#nivelDaAuditoria`). É a matriz da spec
 *   ("inspeciona ≥ 2 projetos ocultos e valida ou revisa o voto"). E a `p1`.
 *   A ancoragem é o livro didático (Rodrigo Assis, Entre Redes, cap. 1): o
 *   consumo crítico das plataformas, a mediação algorítmica e o afunilamento
 *   informacional — o recorte da EF06CO10 que a missão faz viver.
 * - **EF06CO01** (classificar informações em coleções / tipos de dados) —
 *   `classificacao`, AÇÃO, no MESMO latch, mas medindo OUTRA coisa: buscou
 *   pela hashtag de uma área que não a do voto E abriu um oculto daquela área
 *   = atingiu (usou a categoria como chave da coleção); buscou alguma coisa =
 *   em processo; não buscou = SEM marca de ação, e a `p2` decide
 *   (`#nivelDaClassificacao`). Separar
 *   as duas réguas é o ponto: abrir ocultos ao acaso é investigar (CO10) sem
 *   classificar (CO01). E a `p2`.
 * - **EF06CO03** (descrever com precisão a solução, o programa) — `cadeia`,
 *   AÇÃO, marcada quando a cadeia de quatro blocos se monta: uma tentativa =
 *   atingiu; duas ou três = em processo; mais = não atingiu. E a `p3` (a regra
 *   SE…ENTÃO que o motor executou).
 *
 * **Versão 3 (2026-10-07):** quem revisa o voto sem explorar a galeria não
 * ganha mais "não atingiu" nas duas ações dela — é AUSÊNCIA de comportamento
 * (a spec se contradizia entre "em processo" e "não atingiu"), e o nível sai da
 * pergunta. A ficha não muda de forma; muda a régua, e a versão gravada em cada
 * evidência diz qual valeu.
 *
 * Toda rodada mede as ações de novo, também na mesma atividade (ADR-145): o
 * resultado é a melhor rodada de cada habilidade.
 *
 * As três perguntas são VERBATIM da spec (seção 9.6, itens 1, 2 e 3). A `p1`
 * tem alternativas com ids NOVOS (`D1`–`D3`): até a versão 1 ela media a
 * EF06CO07 com `A1`–`A3`, e uma resposta antiga não pode ser lida como desta
 * pergunta. A plataforma EMBARALHA as alternativas a cada leitura (ADR-118), e
 * o estudante recebe `{ enviada: true }` — a criança nunca sabe o nível.
 */
export const FICHA_EXP06EF1B: FichaPedagogica = {
  expId: "exp06ef1b",
  versao: 3,
  habilidades: [
    {
      codigo: "EF06CO10",
      marcadores: [
        { id: "auditoria", tipo: "acao" },
        { id: "p1", tipo: "multipla_escolha", perguntaId: "p1" },
      ],
      criterios: {
        atingiu:
          "Antes de manter ou trocar o voto, abre na Galeria Oculta pelo menos dois estandes que o feed escondeu; ou, na pergunta, reconhece que as próprias curtidas fizeram o algoritmo filtrar o feed.",
        em_processo:
          "Entra na Galeria Oculta só por cima (abre um estande oculto, abre só os que já tinha visto, ou busca sem abrir); ou, na pergunta, atribui o feed a outra causa técnica.",
        nao_atingiu: "Na pergunta, diz que os outros projetos foram apagados, sem uma auditoria da galeria que mostre outra coisa.",
        observacao:
          "Vale o melhor entre a auditoria da Galeria Oculta e a pergunta sobre a frase do jurado. Quem revisa o voto sem abrir nem buscar nada não tem a auditoria contada: decide a pergunta.",
      },
    },
    {
      codigo: "EF06CO01",
      marcadores: [
        { id: "classificacao", tipo: "acao" },
        { id: "p2", tipo: "multipla_escolha", perguntaId: "p2" },
      ],
      criterios: {
        atingiu:
          "Na Galeria Oculta, busca pela hashtag de uma área que não a do voto e abre um estande oculto dessa área; ou, na pergunta, diz que cada curtida foi associada à categoria do projeto.",
        em_processo:
          "Busca alguma coisa na galeria (por texto, pela própria área, ou pela hashtag sem abrir o resultado); ou, na pergunta, diz que o sistema só contou os cliques.",
        nao_atingiu: "Na pergunta, diz que o aplicativo adivinhou pela foto de perfil, sem uma busca na galeria que mostre outra coisa.",
        observacao:
          "Vale o melhor entre a busca por categoria na galeria e a pergunta sobre como o aplicativo organizou as curtidas. Quem revisa o voto sem usar a busca não tem a busca contada: decide a pergunta.",
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
  ],
  perguntas: [
    {
      id: "p1",
      enunciado:
        "Ao final da mostra, um jurado disse: 'Eu só vi projetos de robótica no meu feed porque eram os únicos de verdade que participaram da feira'. O que essa afirmação revela sobre como a tecnologia funcionou?",
      alternativas: [
        {
          id: "D1",
          texto:
            "Revela um engano: o jurado não percebeu que suas próprias interações fizeram o algoritmo filtrar o feed, confundindo o que foi recomendado com a totalidade dos projetos existentes.",
          status: "atingiu",
        },
        {
          id: "D2",
          texto:
            "Revela que o aplicativo prefere mostrar robótica porque é um tema que gasta mais internet e tecnologia na escola.",
          status: "em_processo",
        },
        {
          id: "D3",
          texto:
            "Revela que os organizadores da feira apagaram os projetos de outras matérias para deixar a mostra mais rápida.",
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
            "O sistema associou cada curtida a um tipo de dado temático (categoria do projeto), agrupando os cliques para descobrir qual assunto você preferia.",
          status: "atingiu",
        },
        {
          id: "B2",
          texto: "O sistema contou a quantidade total de cliques, sem se importar com o tema das fotos que foram curtidas.",
          status: "em_processo",
        },
        {
          id: "B3",
          texto: "O sistema adivinhou a matéria escolar que você estuda olhando a foto de perfil da sua conta.",
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
            "SE o jurado curtir dois ou mais posts do mesmo tema, ENTÃO selecione apenas projetos desse mesmo tema para as próximas posições da tela.",
          status: "atingiu",
        },
        {
          id: "C2",
          texto: "SE o tempo de uso do aplicativo for longo, ENTÃO mostre qualquer publicação disponível na feira.",
          status: "em_processo",
        },
        {
          id: "C3",
          texto: "SE o jurado abrir o aplicativo, ENTÃO bloqueie as outras turmas de votar no mesmo horário.",
          status: "nao_atingiu",
        },
      ],
    },
  ],
};
