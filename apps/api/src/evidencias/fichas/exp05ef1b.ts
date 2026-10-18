import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DE "QUEM MANDOU ISSO?" (exp05ef1b, 5º ano, unidade 1) — versão 4,
 * de 2026-10-16: só o Canal A. Toda habilidade é medida pelo que a criança
 * FAZ; as perguntas P1 e P2 do PO (ficha v3, ADR-131) saíram, como no 8º ano
 * (ADR-167). Os níveis que elas deram em atividades já jogadas ficam no
 * histórico, gravados com a versão 3.
 *
 *   - **EF05CO08** pela SELEÇÃO do Mural, marcada no `POST /mural`, na mesma
 *     transação do latch. Só três verdadeiras atingem
 *     (`quem-mandou-isso/regras/evidencia.ts#nivelCO08`).
 *   - **EF05CO03** pelo CARTÃO DE FRASES com E, OU e NÃO sobre as três
 *     mensagens que a criança encaminhou, depois dos crachás
 *     (`regras/operacoes.ts#nivelCO03`).
 *   - **EF05CO04** pela REGRA DO TIO montada com peças, com a previsão antes
 *     de cada teste (`regras/regra.ts#nivelCO04`).
 *
 * Toda rodada mede as três de novo (ADR-145). Quem não fez a ação fica "Não
 * avaliado" — a AUSÊNCIA de marca —, nunca "não atingiu", e o professor ajusta.
 */
export const FICHA_EXP05EF1B: FichaPedagogica = {
  expId: "exp05ef1b",
  versao: 4,
  habilidades: [
    {
      codigo: "EF05CO08",
      marcadores: [{ id: "selecao-do-mural", tipo: "acao", rotulo: "Seleção do Mural" }],
      criterios: {
        atingiu: "Encaminha ao Mural da Turma as 3 mensagens verdadeiras.",
        em_processo: "Encaminha 2 mensagens verdadeiras e 1 falsa.",
        nao_atingiu: "Encaminha 2 ou 3 mensagens falsas.",
        observacao:
          'Medida em toda rodada; o resultado é a melhor rodada. Sem o envio ao Mural, a habilidade fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EF05CO03",
      marcadores: [{ id: "cartao-de-frases", tipo: "acao", rotulo: "Cartão de frases" }],
      criterios: {
        atingiu: "No cartão de frases, acerta 5 ou 6 das 6 frases com E, OU e NÃO sobre as mensagens que encaminhou.",
        em_processo: "No cartão de frases, acerta 3 ou 4 das 6 frases.",
        nao_atingiu: "No cartão de frases, acerta 2 frases ou menos.",
        observacao:
          'O cartão vem depois dos crachás: a criança já sabe se cada mensagem é verdadeira e se é emocional ou neutra, e precisa combinar esses valores. Responder tudo igual acerta só 3. Sem o cartão enviado, a habilidade fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EF05CO04",
      marcadores: [{ id: "regra-do-tio", tipo: "acao", rotulo: "Regra do tio" }],
      criterios: {
        atingiu:
          "Monta, já na primeira tentativa, uma regra que pega o áudio do tio e manda checar antes de encaminhar, e prevê certo o que ela vai fazer.",
        em_processo:
          "Chega à regra que checa antes de encaminhar só depois de testar, ou erra a previsão, ou monta uma regra que só manda esperar, que não pega o áudio ou que checa e encaminha de qualquer jeito.",
        nao_atingiu: "Envia uma regra que encaminha a mensagem antes de checar.",
        observacao:
          'A previsão antes do teste é a simulação que a habilidade pede: a criança diz o que a regra vai fazer antes de ver. A missão cobre a seleção condicional e a sequência de duas ações; repetição e colaboração ficam fora. Sem a regra enviada, a habilidade fica "Não avaliado", e você pode ajustar.',
      },
    },
  ],
  perguntas: [],
};
