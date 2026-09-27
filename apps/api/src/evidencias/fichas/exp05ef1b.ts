import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DE "QUEM MANDOU ISSO?" v2.2 (exp05ef1b, 5º ano, unidade 1) — a
 * RÉGUA v2, de 2026-09-26 (ADR-120), que substitui a de 25/09. Cada
 * habilidade é medida por um momento que exige o VERBO dela na BNCC:
 *
 *   - **EF05CO08** (distinguir o confiável) pela SELEÇÃO do Mural — marcador
 *     de AÇÃO gravado no `POST /mural`, na mesma transação do latch. Só três
 *     verdadeiras atingem (`quem-mandou-isso/regras/evidencia.ts#nivelCO08`), e
 *     a marca só entra na primeira vez que a criança fecha o Mural com aquele
 *     pacote: na rodada seguinte ela já viu a resposta.
 *   - **EF05CO03** (negação, conjunção e disjunção sobre verdadeiro e falso)
 *     pela P1: avaliar frases com NÃO, E e OU sobre os dois selos de uma
 *     mensagem. O exemplo é da própria pergunta, e não do pacote — serve ao
 *     pacote pronto e ao gerado.
 *   - **EF05CO04** (criar e SIMULAR algoritmos com seleção condicional) pela
 *     P2: executar uma regra Se/Então no áudio do tio. O CRIAR é o Se/Então da
 *     Etapa 6, que não é corrigido pela máquina: o professor o classifica na
 *     rubrica da folha da turma, e o ajuste dele vale sobre a pergunta.
 *
 * As três alternativas de cada pergunta têm o MESMO tamanho e a mesma forma —
 * a mais longa não pode ser a certa, e embaralhar não esconde o tamanho. Na
 * P1, "em processo" acerta uma das duas partes da frase; na P2, trava o
 * repasse mas não confere nada. Os textos são da equipe (a v1 usava os do
 * PO, Canal B) e entram na revisão do PO.
 *
 * As falas da Nina que antecedem cada enquete são texto da EXPERIÊNCIA e moram
 * em `quem-mandou-isso/catalogo.ts#FALAS_ANTES_DAS_PERGUNTAS`. O estudante
 * recebe as alternativas EMBARALHADAS a cada leitura
 * (`EvidenciasService.pergunta`), e nunca o `status`.
 *
 * Quem sai antes das perguntas fica "Não avaliado" em CO03/CO04 — a AUSÊNCIA
 * de marca —, nunca "não atingiu". Os registros da v1 guardam a versão 1.
 */
export const FICHA_EXP05EF1B: FichaPedagogica = {
  expId: "exp05ef1b",
  versao: 2,
  habilidades: [
    { codigo: "EF05CO08", marcadores: [{ id: "selecao-do-mural", tipo: "acao" }] },
    {
      codigo: "EF05CO03",
      marcadores: [{ id: "pergunta-dos-selos", tipo: "multipla_escolha", perguntaId: "p1" }],
    },
    {
      codigo: "EF05CO04",
      marcadores: [{ id: "pergunta-simular-a-regra", tipo: "multipla_escolha", perguntaId: "p2" }],
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado: "Qual frase está certa sobre ela?",
      alternativas: [
        { id: "A1", texto: "Ela não era verdadeira e era emocional.", status: "atingiu" },
        { id: "A2", texto: "Ela era falsa e não era nada emocional.", status: "em_processo" },
        { id: "A3", texto: "Ela não era falsa ou então era neutra.", status: "nao_atingiu" },
      ],
    },
    {
      id: "p2",
      enunciado: "Seguindo a minha regra, o que eu faço com o áudio do tio?",
      alternativas: [
        { id: "B1", texto: "Procuro o aviso no site da escola antes de repassar pro grupo.", status: "atingiu" },
        { id: "B2", texto: "Não repasso agora e espero alguém do grupo confirmar o aviso.", status: "em_processo" },
        { id: "B3", texto: "Repasso agora mesmo, porque o tio pediu para mandar bem rápido.", status: "nao_atingiu" },
      ],
    },
  ],
};
