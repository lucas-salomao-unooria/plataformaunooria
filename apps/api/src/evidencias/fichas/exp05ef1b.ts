import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DE "QUEM MANDOU ISSO?" v2.2 (exp05ef1b, 5º ano, unidade 1) — versão
 * 3, de 2026-10-01 (ADR-131): as perguntas voltam a ser as do PO, LITERAIS.
 *
 *   - **EF05CO08** pela SELEÇÃO do Mural — marcador de AÇÃO gravado no
 *     `POST /mural`, na mesma transação do latch. Só três verdadeiras atingem
 *     (`quem-mandou-isso/regras/evidencia.ts#nivelCO08`), e toda rodada a mede
 *     de novo, também no mesmo pacote (ADR-145).
 *   - **EF05CO03** pela P1 do PO: tom não é veracidade — separar os dois eixos.
 *   - **EF05CO04** pela P2 do PO: reconhecer a regra completa (condição
 *     verificável, ação concreta e sequência). O CRIAR é o Se/Então da Etapa 6,
 *     que a máquina não corrige: o professor o classifica na rubrica da folha
 *     da turma, e o ajuste dele vale sobre a pergunta (ADR-120).
 *
 * Enunciado e alternativas são o texto do PO. A pergunta do PO chega em duas
 * partes: o contexto é a fala da Nina que antecede a enquete
 * (`quem-mandou-isso/catalogo.ts#FALAS_ANTES_DAS_PERGUNTAS`), e a última frase
 * é o título da enquete — juntas, o texto do PO sem uma palavra a mais. O
 * estudante recebe as alternativas EMBARALHADAS a cada leitura
 * (`EvidenciasService.pergunta`), e nunca o `status`.
 *
 * Quem sai antes das perguntas fica "Não avaliado" em CO03/CO04 — a AUSÊNCIA
 * de marca —, nunca "não atingiu". Os registros das versões 1 e 2 guardam a
 * versão deles.
 */
export const FICHA_EXP05EF1B: FichaPedagogica = {
  expId: "exp05ef1b",
  versao: 3,
  habilidades: [
    {
      codigo: "EF05CO08",
      marcadores: [{ id: "selecao-do-mural", tipo: "acao" }],
      criterios: {
        atingiu: "Encaminha ao Mural da Turma as 3 mensagens verdadeiras.",
        em_processo: "Encaminha 2 mensagens verdadeiras e 1 falsa.",
        nao_atingiu: "Encaminha 2 ou 3 mensagens falsas.",
        observacao: "Medida em toda rodada; o resultado é a melhor rodada.",
      },
    },
    {
      codigo: "EF05CO03",
      marcadores: [{ id: "pergunta-tom-e-veracidade", tipo: "multipla_escolha", perguntaId: "p1" }],
      criterios: {
        atingiu: "Na 1ª pergunta, responde que o tom não diz se a mensagem é verdadeira: ela pode ser séria e falsa, ou exagerada e verdadeira.",
        em_processo: "Na 1ª pergunta, desconfia menos da mensagem séria, mas ainda acha bom checar.",
        nao_atingiu: "Na 1ª pergunta, confia na mensagem porque ela parece séria e organizada.",
      },
    },
    {
      codigo: "EF05CO04",
      marcadores: [{ id: "pergunta-regra-condicional", tipo: "multipla_escolha", perguntaId: "p2" }],
      criterios: {
        atingiu: "Na 2ª pergunta, escolhe a regra completa: uma condição que dá para conferir e uma ação concreta antes de encaminhar.",
        em_processo: "Na 2ª pergunta, escolhe uma regra vaga, sem ação concreta (\"tomo mais cuidado\").",
        nao_atingiu: "Na 2ª pergunta, escolhe encaminhar sempre, sem regra nenhuma.",
      },
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado: "Você concorda?",
      alternativas: [
        {
          id: "A1",
          texto:
            "Não dá pra saber só pelo tom. Uma mensagem pode ser falsa mesmo parecendo séria, ou verdadeira mesmo sendo exagerada.",
          status: "atingiu",
        },
        { id: "A2", texto: "Ela tem razão de desconfiar menos, mas ainda assim é bom checar.", status: "em_processo" },
        {
          id: "A3",
          texto: "Se a mensagem é séria e organizada, é porque quem escreveu pesquisou. Pode confiar.",
          status: "nao_atingiu",
        },
      ],
    },
    {
      id: "p2",
      enunciado: "Qual dessas funciona de verdade?",
      alternativas: [
        {
          id: "B1",
          texto:
            "Se a mensagem pedir pra repassar rápido, então eu primeiro procuro a mesma notícia em outro lugar antes de encaminhar.",
          status: "atingiu",
        },
        { id: "B2", texto: "Se a mensagem parecer estranha, então eu tomo mais cuidado.", status: "em_processo" },
        {
          id: "B3",
          texto: "Eu sempre mando pro grupo porque é melhor avisar do que deixar de avisar.",
          status: "nao_atingiu",
        },
      ],
    },
  ],
};
