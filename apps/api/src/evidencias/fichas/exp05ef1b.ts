import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DE "QUEM MANDOU ISSO?" v2.2 (exp05ef1b, 5º ano, unidade 1).
 *
 * A régua é a decisão do Lucas de 2026-09-25, que não se reabre:
 *
 *   - **EF05CO08** pela SELEÇÃO do Mural — um marcador de AÇÃO que o módulo
 *     `quem-mandou-isso` grava no `POST /mural`, na mesma transação do latch
 *     (a régua é `quem-mandou-isso/regras/evidencia.ts#nivelCO08`);
 *   - **EF05CO03** pela pergunta P1 (tom × veracidade);
 *   - **EF05CO04** SÓ pela P2 (a regra condicional que funciona). O Se/Então da
 *     Etapa 6 NÃO é corrigido: o professor o lê e ajusta pelo painel.
 *
 * Enunciados e alternativas são LITERAIS do PO (as perguntas de evidência,
 * Canal B). As falas da Nina que antecedem cada enquete são texto da
 * EXPERIÊNCIA e moram em `quem-mandou-isso/catalogo.ts#FALAS_ANTES_DAS_PERGUNTAS`.
 * A ordem das alternativas aqui é a do PO; o estudante as recebe EMBARALHADAS
 * a cada leitura (`EvidenciasService.pergunta`), e nunca o `status`.
 *
 * Quem sai antes das perguntas fica "Não avaliado" em CO03/CO04 — a AUSÊNCIA
 * de marca —, nunca "não atingiu".
 */
export const FICHA_EXP05EF1B: FichaPedagogica = {
  expId: "exp05ef1b",
  versao: 1,
  habilidades: [
    { codigo: "EF05CO08", marcadores: [{ id: "selecao-do-mural", tipo: "acao" }] },
    {
      codigo: "EF05CO03",
      marcadores: [{ id: "pergunta-tom-e-veracidade", tipo: "multipla_escolha", perguntaId: "p1" }],
    },
    {
      codigo: "EF05CO04",
      marcadores: [{ id: "pergunta-regra-condicional", tipo: "multipla_escolha", perguntaId: "p2" }],
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado: "O que você diria pra ela?",
      alternativas: [
        {
          id: "A1",
          texto:
            "Não dá pra saber só pelo tom. Uma mensagem pode ser falsa mesmo parecendo séria, ou verdadeira mesmo sendo exagerada.",
          status: "atingiu",
        },
        {
          id: "A2",
          texto: "Ela tem razão de desconfiar menos, mas ainda assim é bom checar.",
          status: "em_processo",
        },
        {
          id: "A3",
          texto: "Se a mensagem é séria e organizada, é porque quem escreveu pesquisou. Pode confiar.",
          status: "nao_atingiu",
        },
      ],
    },
    {
      id: "p2",
      enunciado: "Qual regra funciona melhor?",
      alternativas: [
        {
          id: "B1",
          texto:
            "Se a mensagem pedir pra repassar rápido, então eu primeiro procuro a mesma notícia em outro lugar antes de encaminhar.",
          status: "atingiu",
        },
        {
          id: "B2",
          texto: "Se a mensagem parecer estranha, então eu tomo mais cuidado.",
          status: "em_processo",
        },
        {
          id: "B3",
          texto: "Eu sempre mando pro grupo porque é melhor avisar do que deixar de avisar.",
          status: "nao_atingiu",
        },
      ],
    },
  ],
};
