import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DE "QUEM MANDOU ISSO?" v2.2 (exp05ef1b, 5º ano, unidade 1) — versão
 * 3, de 2026-10-01 (ADR-131): as perguntas voltam a ser as do PO, LITERAIS.
 *
 *   - **EF05CO08** pela SELEÇÃO do Mural — marcador de AÇÃO gravado no
 *     `POST /mural`, na mesma transação do latch. Só três verdadeiras atingem
 *     (`quem-mandou-isso/regras/evidencia.ts#nivelCO08`), e a marca só entra na
 *     primeira vez que a criança fecha o Mural com aquele pacote (ADR-120).
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
