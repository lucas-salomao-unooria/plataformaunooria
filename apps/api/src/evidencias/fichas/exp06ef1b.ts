import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DO JÚRI ESTADUAL DE PROJETOS (exp06ef1b, 6º ano, unidade 1) —
 * **versão 4 (2026-10-10, PRD v2 §14.2 com as melhorias 3 e 4)**. Três
 * habilidades, seis marcadores, uma AÇÃO e uma PERGUNTA por habilidade, e
 * **vale o MELHOR dos dois** (`regras.ts#statusProprio`):
 *
 * - **EF06CO10** (o foco primário) — `auditoria`, AÇÃO, no LATCH da revisão do
 *   voto, sobre o que a criança fez na Galeria Oculta
 *   (`juri-estadual/regras/evidencia.ts#nivelDaAuditoria`): abriu ao menos DOIS
 *   estandes que o feed escondeu E buscou ao menos uma vez = atingiu; abriu
 *   algum = em processo; não abriu nada = SEM marca de ação (a `p1` decide).
 * - **EF06CO01** — `classificacao`, AÇÃO, no MESMO latch, a régua da melhoria
 *   3 (`#nivelDaClassificacao`): buscou pela HASHTAG de uma categoria que ficou
 *   fora da bolha (não a que dominou o feed) E abriu um projeto dela = atingiu;
 *   buscou qualquer coisa ou abriu um oculto = em processo; nada = SEM marca.
 *   A lista do professor mostra qual categoria a criança buscou.
 * - **EF06CO03** — `cadeia`, AÇÃO, quando a cadeia de quatro blocos se monta:
 *   uma tentativa = atingiu; duas ou três = em processo; mais = não atingiu. A
 *   ordem errada é 422 `ordem-incorreta`, e a tentativa conta.
 *
 * As perguntas são VERBATIM do banco de conteúdo (doc-exp06ef1b-02). As
 * alternativas descem EMBARALHADAS de forma DETERMINÍSTICA por estudante
 * (`ordemDasAlternativas: "por-estudante"`, melhoria 4): a mesma ordem ao
 * recarregar; ids e gabarito ficam no servidor, e o estudante recebe
 * `{ enviada: true }`.
 *
 * Toda rodada mede as ações de novo, também na mesma atividade (ADR-145): o
 * resultado é a melhor rodada de cada habilidade. A versão gravada em cada
 * evidência diz qual régua valeu (a 3 contava só os ocultos abertos na CO10, e
 * a CO01 pedia a hashtag de área ≠ do voto).
 */
export const FICHA_EXP06EF1B: FichaPedagogica = {
  expId: "exp06ef1b",
  versao: 4,
  ordemDasAlternativas: "por-estudante",
  habilidades: [
    {
      codigo: "EF06CO10",
      marcadores: [
        { id: "auditoria", tipo: "acao" },
        { id: "p1", tipo: "multipla_escolha", perguntaId: "p1" },
      ],
      criterios: {
        atingiu:
          "Antes de manter ou trocar o voto, faz busca ativa na Galeria Oculta e inspeciona pelo menos dois projetos que o feed escondeu; ou, na pergunta, reconhece que as próprias interações fizeram o algoritmo filtrar o feed.",
        em_processo:
          "Abre a Galeria Oculta superficialmente: inspeciona algum projeto, mas sem a busca ativa e os dois ocultos; ou, na pergunta, atribui o feed a outra causa técnica.",
        nao_atingiu: "Na pergunta, diz que os outros projetos foram apagados, sem uma auditoria da galeria que mostre outra coisa.",
        observacao:
          "Vale o melhor entre a auditoria da Galeria Oculta e a pergunta sobre a frase do jurado. Quem revisa o voto sem inspecionar nenhum projeto não tem a auditoria contada: decide a pergunta.",
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
          "Na Galeria Oculta, busca pela hashtag de uma categoria que ficou fora do seu feed e abre um projeto dessa categoria; ou, na pergunta, diz que cada curtida foi associada à categoria do projeto.",
        em_processo:
          "Busca alguma coisa na galeria, ou abre um projeto oculto, sem usar a categoria como chave; ou, na pergunta, diz que o sistema só contou os cliques.",
        nao_atingiu: "Na pergunta, diz que o aplicativo adivinhou pela foto de perfil, sem uma busca na galeria que mostre outra coisa.",
        observacao:
          "Vale o melhor entre a busca por categoria na galeria e a pergunta sobre como o aplicativo organizou as curtidas. Quem revisa o voto sem buscar nem abrir nada não tem a ação contada: decide a pergunta. A lista do painel mostra qual categoria a criança buscou.",
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
