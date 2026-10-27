import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de O ENIGMA DA CAPA DA RÁDIO (exp02ef1b, 2º ano EF, unidade 1,
 * ADR-184) — versão 2, de 2026-10-26 (a revisão 2.0.0 da missão, ADR-186):
 * 100% Canal A, sem pergunta (o one-pager §12a: "proibido questionário com
 * alternativas textuais" no 2º ano). Toda habilidade é medida pelo que a
 * criança FAZ (`enigma-capa/regras/evidencia.ts`):
 *
 *   - **EF02CO05** (o foco) no "Pronto" da cena inteira (E4, Momento 5): a lupa
 *     (E2), o selo (E3), a busca dos invariantes (E4) e o "o que ficou fora",
 *     juntos — marcar na cena inteira algo que ficou fora da própria foto é o
 *     reconhecimento de que a foto mostra só um pedaço do lugar.
 *   - **EF02CO01** (associada) quando os quatro achados dos invariantes
 *     completam (E4).
 *
 * Os pares, o motivo e a segunda foto (E5) vão só ao painel. Falha técnica =
 * sem marca ("Não avaliado").
 */
export const FICHA_EXP02EF1B: FichaPedagogica = {
  expId: "exp02ef1b",
  versao: 2,
  habilidades: [
    {
      codigo: "EF02CO05",
      marcadores: [{ id: "recorte-da-capa", tipo: "acao", rotulo: "A capa da rádio e o que ficou fora" }],
      criterios: {
        atingiu:
          "Acha com a lupa os dois objetos do fundo sem precisar do aviso, combina o selo com a foto que escolheu, acha os dois objetos iguais nas duas fotos sem a ajuda e marca, na cena inteira, algo que ficou fora da sua foto.",
        em_processo:
          "Mostra parte disso: precisou do aviso da lupa, precisou da ajuda para achar os objetos iguais ou não marcou nada fora da sua foto tendo feito o resto.",
        nao_atingiu:
          "Não marca nada fora da sua foto e, além disso, avançou duas vezes sem achar os objetos com a lupa, combinou um selo que não descreve a foto ou não achou os objetos iguais nem com a ajuda.",
        observacao:
          'Medida no "Pronto" da cena inteira: marcar o que ficou fora da própria foto mostra que a criança reconhece que a foto é só um pedaço do lugar (ADR-186). Quem não chega ao "Pronto" fica "Não avaliado", e você pode ajustar.',
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
