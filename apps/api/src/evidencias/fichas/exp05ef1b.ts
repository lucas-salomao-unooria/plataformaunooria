import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DE "QUEM MANDOU ISSO?" (exp05ef1b, 5º ano, unidade 1) — versão 5,
 * de 2026-10-20: só o Canal A, com as duas ações da 2.5.0. Toda habilidade é
 * medida pelo que a criança FAZ (as perguntas P1 e P2 saíram na v4, como no
 * 8º ano, ADR-167). Os níveis das versões anteriores ficam no histórico,
 * gravados com a versão delas.
 *
 *   - **EF05CO08** pela SELEÇÃO do Mural, marcada no `POST /mural`, na mesma
 *     transação do latch. Só três verdadeiras atingem
 *     (`quem-mandou-isso/regras/evidencia.ts#nivelCO08`).
 *   - **EF05CO03** pelo ALERTA DO GRUPO: quatro filtros com E, OU e NÃO sobre
 *     o quadro das oito mensagens, depois dos crachás, marcado no quarto envio
 *     (`regras/alerta.ts#nivelCO03`). Substitui o cartão de frases da v4.
 *   - **EF05CO04** pelo ROBÔ DO GRUPO montado com blocos (laço, SE, ENTÃO e
 *     E DEPOIS), ligado nas quatro mensagens e enviado
 *     (`regras/robo.ts#nivelCO04`). Substitui a regra do tio com previsão.
 *
 * Toda rodada mede as três de novo (ADR-145). Quem não fez a ação fica "Não
 * avaliado" — a AUSÊNCIA de marca —, nunca "não atingiu", e o professor ajusta.
 */
export const FICHA_EXP05EF1B: FichaPedagogica = {
  expId: "exp05ef1b",
  versao: 5,
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
      marcadores: [{ id: "alerta-do-grupo", tipo: "acao", rotulo: "Alerta do grupo" }],
      criterios: {
        atingiu:
          "Nos 4 alertas do grupo, monta filtros com E, OU e NÃO que destacam as mensagens pedidas, quase sempre já no primeiro teste (6 a 8 pontos de 8).",
        em_processo:
          "Chega aos filtros certos depois de ver o resultado, ou acerta só parte dos 4 alertas (3 a 5 pontos de 8).",
        nao_atingiu: "Envia alertas com filtros que não destacam as mensagens pedidas (0 a 2 pontos de 8).",
        observacao:
          'Cada alerta vale 2 pontos se o primeiro "Ver resultado" já tinha o filtro certo, 1 se só o enviado está certo, e 0 se o enviado está errado. O alerta abre depois dos crachás e fecha quando você apresenta a síntese. Sem os 4 alertas enviados, a habilidade fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EF05CO04",
      marcadores: [{ id: "robo-do-grupo", tipo: "acao", rotulo: "Robô do grupo" }],
      criterios: {
        atingiu:
          "Monta, já na primeira vez que liga o robô, um robô que repete para cada mensagem nova, olha as mensagens urgentes e alarmantes (o sinal que as três mensagens de risco têm) e checa antes de encaminhar — e envia esse robô.",
        em_processo:
          "Chega a esse robô só depois de ligá-lo, ou envia um robô sem a repetição, com uma condição que pega só uma das mensagens de risco (parente próximo, link ou promessa), que só espera ou que checa e encaminha de qualquer jeito, ou envia sem ligar.",
        nao_atingiu: "Envia um robô que encaminha a mensagem antes de checar.",
        observacao:
          'Ligar o robô é a simulação que a habilidade pede: a criança vê o que ele faz com 4 mensagens, uma a uma. O robô cobre repetição (o laço), seleção condicional (o SE) e sequência (as duas ações em ordem); a colaboração fica fora. Sem o robô enviado, a habilidade fica "Não avaliado", e você pode ajustar.',
      },
    },
  ],
  perguntas: [],
};
