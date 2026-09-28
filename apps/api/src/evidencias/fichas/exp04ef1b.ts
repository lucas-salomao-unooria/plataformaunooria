import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DO JORNAL DA ESCOLA (exp04ef1b, 4º ano, unidade 1) — a terceira
 * missão com ficha pedagógica (E14). Três habilidades, cinco marcadores:
 *
 * - **EF15CO04** (decomposição) — `pistas`, AÇÃO, marcada no LATCH da 1ª
 *   edição sobre as pistas que a criança abriu antes de publicar (fase 1):
 *   os três tipos em pelo menos duas notícias = atingiu; alguma pista = em
 *   processo; nenhuma = não atingiu (`jornal-escola/regras/evidencia.ts`).
 * - **EF15CO02** (algoritmo) — `chave`, AÇÃO, marcada quando a Chave do Editor
 *   se forma: uma tentativa = atingiu; duas ou três = em processo; mais de três
 *   = não atingiu. A isca conta tentativa.
 * - **EF04CO08** (verificar a confiabilidade das fontes) — `edicao-2`, AÇÃO,
 *   marcada no LATCH da 2ª edição (pares notícia × tipo abertos nas duas fases
 *   e as verificadas da 2ª), e as perguntas `p1` e `p2` do Desafio Final.
 *   **Vale o MELHOR dos três** (a regra de dois marcadores da mesma
 *   habilidade, `regras.ts#statusProprio`). O PRD pedia, para "atingiu", as
 *   pistas E a 2ª edição 3/3 E a P1 certa, num marcador só; aqui cada um é um
 *   marcador, e a política da E14 AFROUXA esse "E" — decisão registrada.
 *
 * As três ações não medem duas vezes a mesma criança no mesmo pacote: na
 * rodada nova, quem já foi avaliada numa anterior não é marcada de novo
 * (`jaAvaliadaAntes`, ADR-120), porque já viu o resultado, a Chave e o
 * comparativo.
 *
 * O texto das perguntas é VERBATIM da copy revisada (`e6.p1.*`, `e6.p2.*`). O
 * enunciado da P1 leva antes o boato (`e6.cenario.boato_chat`) e o detalhe
 * (`e6.cenario.detalhe_chat`), separados por linha em branco — a experiência os
 * desenha como a mensagem encaminhada e a legenda dela. O boato é o de "todas
 * as escolas do bairro", DIFERENTE do da mesa: aqui é transferência. A
 * plataforma EMBARALHA as alternativas a cada leitura (ADR-118), e o estudante
 * recebe `{ enviada: true }` — a síntese final é a mesma para todos
 * (`e6.feedback.sintese_inicial`): a criança nunca sabe o nível.
 */
export const FICHA_EXP04EF1B: FichaPedagogica = {
  expId: "exp04ef1b",
  versao: 1,
  habilidades: [
    { codigo: "EF15CO04", marcadores: [{ id: "pistas", tipo: "acao" }] },
    { codigo: "EF15CO02", marcadores: [{ id: "chave", tipo: "acao" }] },
    {
      codigo: "EF04CO08",
      marcadores: [
        { id: "edicao-2", tipo: "acao" },
        { id: "p1", tipo: "multipla_escolha", perguntaId: "p1" },
        { id: "p2", tipo: "multipla_escolha", perguntaId: "p2" },
      ],
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado:
        "URGENTE: A prefeitura avisou que a água de todas as escolas do bairro vai ser cortada amanhã e ninguém deve ir para a aula! Repassem para todo mundo!\n\nMensagem sem link oficial, sem carimbo de data e sem nome de autoridade responsável.\n\nVocê recebeu esse aviso no celular. Antes de comemorar que não vai ter aula e repassar para os colegas, o que você precisa conferir para saber se essa mensagem é confiável?",
      alternativas: [
        {
          id: "A1",
          texto: "Se o aviso foi publicado em um canal oficial da prefeitura com data de hoje e assinatura responsável.",
          status: "atingiu",
        },
        {
          id: "A2",
          texto: "Quantos colegas da sala já receberam a mesma mensagem e comentaram no grupo.",
          status: "em_processo",
        },
        {
          id: "A3",
          texto: "Se a mensagem foi escrita com a palavra URGENTE em letras maiúsculas.",
          status: "nao_atingiu",
        },
      ],
    },
    {
      id: "p2",
      enunciado: "O que acontece quando as pessoas repassam um aviso desses sem conferir a fonte e a data?",
      alternativas: [
        {
          id: "B1",
          texto: "Pode fazer a escola inteira parar e criar pânico nas famílias por um problema que talvez nem exista.",
          status: "atingiu",
        },
        {
          id: "B2",
          texto: "A prefeitura é obrigada a cortar a água de verdade só porque o boato se espalhou.",
          status: "em_processo",
        },
        {
          id: "B3",
          texto: "O celular de quem repassou apaga automaticamente todas as mensagens do grupo.",
          status: "nao_atingiu",
        },
      ],
    },
  ],
};
