import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de NINA E A NOTÍCIA QUE DESAPARECEU (exp03ef1b, 3º ano EF, unidade 1,
 * ADR-197) — versão 1, de 2026-10-28: 100% Canal A, sem pergunta e sem
 * resolvedor. Toda habilidade é medida pelo que a criança FAZ, cada uma na
 * transação da própria jogada (`nina-noticia/regras/evidencia.ts`):
 *
 *   - **EF15CO08** (o foco) na ficha do telão aberta (`POST ficha`): o filtro
 *     certo de primeira e a ficha aberta sem o pulso de 15 s;
 *   - **EF03CO01** nos seis carimbos, no `POST carimbos` do caso novo (E6) —
 *     a uniformidade vence;
 *   - **EF03CO02** na rotina válida (`POST rotina`);
 *   - **EF03CO03** e **EF15CO01** no reparo da ficha (`POST reparo`).
 *
 * Sem o Canal B (spec §0.1). Quem não faz a tarefa fica "Não avaliado" — a
 * AUSÊNCIA de marca —, nunca "não atingiu". Toda rodada mede de novo (ADR-145).
 * A EF15CO01 repete, na prática, a régua da EF03CO03 (a escolha travada
 * confrontada com o reparo): pendência levada ao PO (spec §2).
 */
export const FICHA_EXP03EF1B: FichaPedagogica = {
  expId: "exp03ef1b",
  versao: 1,
  habilidades: [
    {
      codigo: "EF15CO08",
      marcadores: [{ id: "inspecao", tipo: "acao", rotulo: "O filtro e a ficha do telão" }],
      criterios: {
        atingiu: 'Busca "Onde: Pátio" na primeira tentativa e abre a ficha do telão sem precisar do aviso piscando.',
        em_processo: "Erra o filtro antes de buscar pelo pátio, ou só abre a ficha do telão depois do aviso piscando.",
        nao_atingiu: "A missão não dá este nível sozinha: quem abre a ficha do telão já encontrou a notícia que faltava. Você pode ajustar.",
        observacao:
          'Medida quando a criança abre a ficha do telão. É o momento em que ela descobre que o filtro consulta o campo da ficha, e não a foto. Quem não chega a abrir a ficha fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EF03CO01",
      marcadores: [{ id: "carimbos", tipo: "acao", rotulo: "Os carimbos das fichas" }],
      criterios: {
        atingiu:
          'Acerta ao menos 5 dos 6 carimbos, com "É verdade" em "A ficha NÃO diz pátio?" e "Não dá para saber" em "O Festival foi na sexta-feira?".',
        em_processo: "Varia os carimbos, mas erra a negação da ficha do telão, o caso sem informação ou mais de um cartão.",
        nao_atingiu: "Carimba os três cartões de uma etapa com o mesmo carimbo, sem diferenciar as afirmações.",
        observacao:
          'Medida quando a criança envia os carimbos do caso novo, com os da ficha do telão já gravados. Carimbar tudo igual pesa mais que o número de acertos. Sem os dois conjuntos, a habilidade fica "Não avaliado".',
      },
    },
    {
      codigo: "EF03CO02",
      marcadores: [{ id: "rotina", tipo: "acao", rotulo: "A rotina da pilha de fichas" }],
      criterios: {
        atingiu: "Monta a rotina que para na hora certa em até 2 testes.",
        em_processo: "Monta a rotina que para na hora certa depois de 3 testes ou mais.",
        nao_atingiu: "A missão não dá este nível sozinha: a marca só existe quando a rotina fica certa. Você pode ajustar.",
        observacao:
          'Medida no teste que acerta a rotina. Quem não chega à rotina certa fica "Não avaliado"; o painel avisa a repetição sem parada, e você pode ajustar.',
      },
    },
    {
      codigo: "EF03CO03",
      marcadores: [{ id: "reparo", tipo: "acao", rotulo: "O conserto da ficha do telão" }],
      criterios: {
        atingiu: "Coloca a etiqueta Pátio no campo Onde da ficha do telão.",
        em_processo: "Monta a ficha do telão com a etiqueta Pátio fora do campo Onde.",
        nao_atingiu: "A missão não dá este nível sozinha: toda ficha concluída tem as três etiquetas. Você pode ajustar.",
        observacao:
          'Medida no "Concluir" da ficha. Só a posição da etiqueta Pátio conta; onde vão as outras duas fica registrado. Quem não conclui a ficha fica "Não avaliado".',
      },
    },
    {
      codigo: "EF15CO01",
      marcadores: [{ id: "previsao", tipo: "acao", rotulo: "A escolha confrontada com o conserto" }],
      criterios: {
        atingiu: "Travou a escolha das notícias e, depois de ver a que faltou, conserta a ficha com o Pátio no campo Onde.",
        em_processo: "Travou a escolha, mas conserta a ficha com o Pátio fora do campo Onde.",
        nao_atingiu: "A missão não dá este nível sozinha: a marca só existe com a escolha travada e a ficha concluída. Você pode ajustar.",
        observacao:
          'Medida no "Concluir" da ficha, junto com a EF03CO03. Na prática segue a mesma régua; a diferença está em confrontar a escolha inicial com o que a busca mostrou, na conversa da turma.',
      },
    },
  ],
  perguntas: [],
};
