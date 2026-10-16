import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA da Missão Tempestade (exp02em1b, UnooriaAI, 2ª série EM, unidade 1) —
 * versão 2, de 2026-10-16 (ADR-169, que substitui a régua de perguntas da
 * ADR-154).
 *
 * Toda habilidade por AÇÃO (o Canal A), nenhuma pergunta: o Canal B saiu por
 * inteiro, e quem não faz a tarefa de uma habilidade fica "não avaliado" nela —
 * o professor ajusta no painel. As réguas estão nas regras puras de
 * `unoogpt/regras/` (uma por tarefa), e a agregação em `regras/agregacao.ts`:
 *
 *   - **EM13CO12** pela leitura dos dados (`leitura`, registro da operação);
 *   - **EM13CO14** pelo que precisaria saber de cada fonte (`fontes`, registro);
 *   - **EM13CO11** pelas duas comparações do "E se…" (`e-se`, resultado);
 *   - **EM13CO08** pelo pedido pelo WhatsApp (`whatsapp`, fechamento);
 *   - **EM13CO24** pelo alerta aos bairros sem equipe (`alerta`, registro);
 *   - **EM13CO26** pela ligação da Saúde (`saude`, investigação, teto em "em
 *     desenvolvimento") e pela resposta à moradora (`moradora`, fechamento):
 *     vale o melhor dos dois.
 *
 * A EM13CO10 fica fora: é trabalhada no debate, e nenhuma ação a mede.
 *
 * Continua contando SÓ quando o professor encerra a missão na Sala de Aula
 * (`contaAoEncerrarAMissao`). E o encerramento só transforma em nível as marcas
 * de marcador que ESTÁ nesta ficha: uma turma com a missão aberta no dia da
 * troca tem marcas `p1` a `p4` da versão 1, e elas não viram nível.
 */
const OBSERVACAO =
  "Sem a tarefa feita, a habilidade fica \"não avaliado\"; o professor pode ajustar no painel. Só conta depois que a missão é encerrada na Sala de Aula.";

export const FICHA_EXP02EM1B: FichaPedagogica = {
  expId: "exp02em1b",
  versao: 2,
  contaAoEncerrarAMissao: true,
  habilidades: [
    {
      codigo: "EM13CO12",
      marcadores: [{ id: "leitura", tipo: "acao", rotulo: "Leitura dos dados" }],
      criterios: {
        atingiu:
          "Pediu duas fontes ou mais ao Cientista e, na tabela que voltou no registro, leu certo os dois pares de bairros: o que tem mais gente quando as faixas se separam, e que as faixas se cruzam quando se cruzam.",
        em_processo:
          "Pediu dados ao Cientista antes de mandar as equipes, mas não leu certo os dois pares (ou pediu uma fonte só, ou a tabela não permitia os dois pares).",
        nao_atingiu: "Teve a investigação aberta e mandou as equipes sem pedir dado nenhum.",
        observacao: `${OBSERVACAO} Vale a melhor tentativa que começou com o relógio aberto.`,
      },
    },
    {
      codigo: "EM13CO14",
      marcadores: [{ id: "fontes", tipo: "acao", rotulo: "O que precisaria saber de cada fonte" }],
      criterios: {
        atingiu:
          "Nos dois cartões do registro, perguntou o que expõe a falha daquela fonte naquele bairro (quando foi medida, o que conta, se enxerga o bairro, quem a produziu).",
        em_processo: "Acertou a pergunta em um dos dois cartões.",
        nao_atingiu: "Não acertou a pergunta em nenhum dos dois cartões, ou confiou na fonte onde ela distorce.",
        observacao: `${OBSERVACAO} Sem duas fontes abertas para montar os dois cartões, não há marca. Vale a melhor tentativa que começou com o relógio aberto.`,
      },
    },
    {
      codigo: "EM13CO11",
      marcadores: [{ id: "e-se", tipo: "acao", rotulo: "\"E se…\" nas mesmas tempestades" }],
      criterios: {
        atingiu:
          "Nas duas comparações do resultado, leu certo a faixa das 20 tempestades: a que favorece uma decisão em quase todas e a que depende da tempestade.",
        em_processo: "Leu certo a comparação clara, mas não reconheceu a que depende.",
        nao_atingiu: "Não leu certo a comparação clara.",
        observacao: `${OBSERVACAO} Mede interpretar as previsões de um modelo; explorar fica no "E se…" livre, que não dá marca. Vale a primeira resposta da rodada.`,
      },
    },
    {
      codigo: "EM13CO08",
      marcadores: [{ id: "whatsapp", tipo: "acao", rotulo: "Pedido pelo WhatsApp" }],
      criterios: {
        atingiu: "No fechamento, não mandou nenhum dado pelo canal e avisou a coordenação sobre o pedido suspeito.",
        em_processo:
          "Não mandou a lista, mas não avisou a coordenação (perguntou quem era ou ignorou), ou mandou só a contagem por bairro.",
        nao_atingiu: "Mandou a lista das pessoas, mesmo pedindo que ele provasse quem é.",
        observacao: `${OBSERVACAO} Vale a primeira resposta da rodada.`,
      },
    },
    {
      codigo: "EM13CO24",
      marcadores: [{ id: "alerta", tipo: "acao", rotulo: "Alerta aos bairros sem equipe" }],
      criterios: {
        atingiu:
          "Montou o alerta com as três partes certas: um aviso agora e outro quando o perigo passar, em tom calmo e direto, dizendo onde fica o abrigo e como chegar.",
        em_processo: "Acertou duas das três partes do alerta.",
        nao_atingiu: "Acertou uma parte ou nenhuma: alerta que assusta, cansa, tranquiliza demais ou não diz o que fazer.",
        observacao: `${OBSERVACAO} Vale a primeira resposta da rodada.`,
      },
    },
    {
      codigo: "EM13CO26",
      marcadores: [
        { id: "saude", tipo: "acao", rotulo: "Ligação da Saúde" },
        { id: "moradora", tipo: "acao", rotulo: "Resposta à moradora" },
      ],
      criterios: {
        atingiu:
          "Na resposta à moradora, disse com que dados decidiu, o critério, quem decidiu (a pessoa, com o apoio da IA) e como contestar.",
        em_processo:
          "Acertou três das quatro partes da resposta à moradora, ou pediu à Saúde só a contagem por bairro, sem nomes (o teto da ligação).",
        nao_atingiu: "Pediu à Saúde a lista com nomes, ou montou a resposta com duas partes certas ou menos.",
        observacao: `${OBSERVACAO} Vale o melhor entre a ligação da Saúde e a resposta à moradora; em cada uma, a primeira resposta da rodada.`,
      },
    },
  ],
  perguntas: [],
};
