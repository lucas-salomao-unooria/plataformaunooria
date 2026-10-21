import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DO JORNAL DA ESCOLA (exp04ef1b, 4º ano, unidade 1), VERSÃO 2 — Canal
 * A PURO (3.0.0, ADR-168): as três habilidades medidas só por AÇÃO, sem
 * pergunta de múltipla escolha. As réguas estão em
 * `jornal-escola/regras/evidencia.ts`; o plenário pedagógico (três avaliadores,
 * 2026-10-16) as aprovou depois de três rodadas.
 *
 * - **EF15CO04** (decomposição) — `julgamentos`, marcada no latch da 1ª edição:
 *   o "confio / não confio" que a criança marca em cada pista, logo depois de
 *   abri-la e antes de decidir a capa, e a coerência da capa publicada.
 * - **EF15CO02** (construir e simular algoritmos) — `montagem` (a Chave do
 *   Editor montada, com teto em "em processo") e `simulacao` (a Chave dela
 *   aplicada a duas matérias novas: a fidelidade à regra, combinada com a
 *   montagem).
 * - **EF04CO08** (reconhecer a importância de verificar as fontes) —
 *   `edicao-2` (com teto em "em processo") e `transferencia` (o boato com
 *   "Repassar" à mão, combinado com a 2ª edição).
 *
 * **Vale o MELHOR dos marcadores de uma habilidade** (`regras.ts#statusProprio`),
 * e é por isso que os marcadores PARCIAIS têm teto: o "atingiu" só sai do
 * marcador final, que grava o COMBINADO. Quem não chega ao fim fica com o
 * parcial. Toda rodada mede de novo, também no mesmo pacote (ADR-145).
 *
 * A versão 1 (2.x) tinha `pistas`, `chave` (tentativas) e as perguntas `p1`/`p2`
 * do Desafio Final; as marcas dela continuam no histórico, com `versao_ficha = 1`.
 */
export const FICHA_EXP04EF1B: FichaPedagogica = {
  expId: "exp04ef1b",
  versao: 2,
  habilidades: [
    {
      codigo: "EF15CO04",
      marcadores: [{ id: "julgamentos", tipo: "acao" }],
      criterios: {
        atingiu:
          "Antes da 1ª edição, diz se confia em cada tipo de pista em pelo menos duas notícias, acerta a maior parte, percebe a pista que falha nas notícias com problema que abriu e não põe na capa a notícia em que ela mesma não confiou.",
        em_processo:
          "Julga as pistas, mas sem cobrir os três tipos, sem perceber as pistas que falham ou pondo na capa uma notícia em que não confiou.",
        nao_atingiu: "Publica a 1ª edição sem julgar nenhuma pista, ou erra a maior parte dos julgamentos.",
      },
    },
    {
      codigo: "EF15CO02",
      marcadores: [
        { id: "montagem", tipo: "acao" },
        { id: "simulacao", tipo: "acao" },
      ],
      criterios: {
        atingiu:
          "Monta a Chave do Editor com fonte, data e autoria, as condições certas, \"Não publico\" quando uma pista falha e \"em todas as notícias\" — e a aplica às duas matérias novas sem se contradizer.",
        em_processo:
          "Monta a Chave com algum erro, mas a aplica sem se contradizer; ou monta a Chave certa e não a segue nas matérias novas.",
        nao_atingiu: "Monta a Chave com as armadilhas (foto, urgência, compartilhamento) e não a segue nas matérias novas.",
        observacao: "Vale o melhor entre a montagem (sozinha, no máximo em processo) e a simulação.",
      },
    },
    {
      codigo: "EF04CO08",
      marcadores: [
        { id: "edicao-2", tipo: "acao" },
        { id: "transferencia", tipo: "acao" },
      ],
      criterios: {
        atingiu:
          "Publica a 2ª edição com as 3 notícias verificadas, conferindo as três pistas de cada uma — e, diante de uma mensagem nova e urgente, abre as pistas antes de decidir e não a repassa.",
        em_processo: "Verifica bem em uma das duas situações, mas não na outra.",
        nao_atingiu: "Publica a 2ª edição sem conferir as notícias e repassa a mensagem urgente sem abrir nenhuma pista.",
        observacao: "Vale o melhor entre a 2ª edição (sozinha, no máximo em processo) e a mensagem nova.",
      },
    },
  ],
  perguntas: [],
};
