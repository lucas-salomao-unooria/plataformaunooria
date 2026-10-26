import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de O ENIGMA DA CAPA DA RÁDIO (exp02ef1b, 2º ano EF, unidade 1,
 * ADR-184) — versão 1, de 2026-10-26: 100% Canal A, sem pergunta (o one-pager
 * §12a: "proibido questionário com alternativas textuais" no 2º ano). Toda
 * habilidade é medida pelo que a criança FAZ
 * (`enigma-capa/regras/evidencia.ts`):
 *
 *   - **EF02CO05** (o foco) no voto da transferência (E6), que conclui: a lupa
 *     (E2), o selo (E3), a busca dos invariantes (E4) e o voto, juntos.
 *   - **EF02CO01** (associada) quando os quatro achados dos invariantes
 *     completam (E4).
 *
 * A marcação "fora da foto", os pares, o motivo e a segunda foto (E5) vão só
 * ao painel. Falha técnica = sem marca ("Não avaliado").
 */
export const FICHA_EXP02EF1B: FichaPedagogica = {
  expId: "exp02ef1b",
  versao: 1,
  habilidades: [
    {
      codigo: "EF02CO05",
      marcadores: [{ id: "recorte-da-capa", tipo: "acao", rotulo: "A capa da rádio e a horta" }],
      criterios: {
        atingiu:
          "Explora o fundo das duas fotos com a lupa sem precisar do aviso, combina o selo com a foto que escolheu, acha os dois objetos iguais do fundo sem a ajuda e, na horta, responde SÓ UM PEDAÇO.",
        em_processo:
          "Mostra parte disso: precisou do aviso da lupa, precisou da ajuda para achar os objetos ou respondeu MOSTRA TUDO tendo feito o resto.",
        nao_atingiu:
          "Responde MOSTRA TUDO na horta e, além disso, ignorou o fundo mesmo com os avisos da lupa, combinou um selo que não descreve a foto ou não achou os objetos nem com a ajuda.",
        observacao:
          'Medida no voto da horta, o fim da missão. O PO pedia as quatro faltas juntas para "não atingiu"; a régua pede MOSTRA TUDO e mais uma (ADR-184). Quem não chega ao voto fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EF02CO01",
      marcadores: [{ id: "invariantes-do-fundo", tipo: "acao", rotulo: "Os objetos iguais do fundo" }],
      criterios: {
        atingiu: "Acha os dois objetos iguais do fundo nas duas fotos com menos de 3 toques errados.",
        em_processo: "Acha os objetos depois de 3 toques errados, com a ajuda do pulso amarelo, errando pouco depois dela.",
        nao_atingiu: "Mesmo com o pulso amarelo, erra 3 toques ou mais: precisou que você apontasse na tela.",
        observacao: 'Medida quando os quatro achados completam. Quem não termina a busca fica "Não avaliado".',
      },
    },
  ],
  perguntas: [],
};
