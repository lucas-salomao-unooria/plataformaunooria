import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de O ASSISTENTE INVISÍVEL (exp01em1b, 1ª série EM, unidade 1,
 * ADR-185) — versão 1, de 2026-10-26: 100% Canal A, sem pergunta. Toda
 * habilidade é medida pelo que a comissão FAZ (`assistente-invisivel/regras/evidencia.ts`),
 * e as quatro são marcadas JUNTAS no LATCH 2 ("Publicar Transparência e
 * Comunicado"). Quem apostou e não publicou recebe as quatro no "Encerrar" do
 * professor, com a publicação ausente (o padrão "conta ao encerrar", ADR-154).
 *
 *   - **EM13CO20** (o foco): a página de transparência e os quatro blocos do comunicado (E6).
 *   - **EM13CO01**: os critérios reutilizados do banco, no último reteste (E5).
 *   - **EM13CO18**: o ciclo — a equidade do reteste E a publicação plena.
 *   - **EM13CO03**: o painel OPCIONAL das etapas do algoritmo (E5).
 *
 * A F3 (sugestões) e os cartões da E5 vão só ao painel. Falha técnica = sem
 * marca ("Não avaliado"). Com equipe, a marca vai a cada integrante (E13).
 */
export const FICHA_EXP01EM1B: FichaPedagogica = {
  expId: "exp01em1b",
  versao: 1,
  habilidades: [
    {
      codigo: "EM13CO20",
      marcadores: [{ id: "comunicado-de-transparencia", tipo: "acao", rotulo: "A página de transparência e o comunicado" }],
      criterios: {
        atingiu:
          "Ativa a página de transparência e publica o comunicado com os quatro blocos da cadeia causal: o problema, a inferência sobre dados observados, a regra corrigida e a revisão humana.",
        em_processo:
          "Publica a página com o comunicado incompleto (um bloco em branco, ou só o problema trocado), ou monta os quatro blocos certos sem ativar a página.",
        nao_atingiu:
          "Não publica o comunicado, ou escolhe a inferência, a regra ou a salvaguarda errada — o que descaracteriza a relação entre dados observados, inferência e direito à revisão.",
        observacao: 'Medida ao publicar. Quem apostou e não publicou recebe "não atingiu" quando você encerra a missão.',
      },
    },
    {
      codigo: "EM13CO01",
      marcadores: [{ id: "criterios-reutilizados", tipo: "acao", rotulo: "Os critérios reutilizados do banco" }],
      criterios: {
        atingiu: "No último reteste, troca os critérios das funções 1 e 2 por opções não discriminatórias do banco (1A ou 1C, e 2A ou 2C) e obtém a homologação de equidade.",
        em_processo: "Corrige só uma das duas funções (por exemplo, os exercícios, mantendo a trava pela estabilidade da conexão nas dúvidas).",
        nao_atingiu: "Mantém os critérios originais enviesados (1B e 2B) ou não executa o reteste.",
        observacao: "Vale o ÚLTIMO reteste antes de publicar. A função 3 (sugestões) não entra na régua: aparece só no painel.",
      },
    },
    {
      codigo: "EM13CO18",
      marcadores: [{ id: "ciclo-da-auditoria", tipo: "acao", rotulo: "O ciclo da auditoria" }],
      criterios: {
        atingiu: "Obtém a equidade total no reteste E publica a página ativa com os quatro blocos certos: investigação, reestruturação e publicação coerentes.",
        em_processo: "Completa uma das pontas e não a outra: a equidade sem a publicação plena, ou a publicação plena com só uma função corrigida.",
        nao_atingiu: "Não chega à equidade nem à publicação plena.",
      },
    },
    {
      codigo: "EM13CO03",
      marcadores: [{ id: "etapas-do-algoritmo", tipo: "acao", rotulo: "As etapas do algoritmo (painel opcional)" }],
      criterios: {
        atingiu: "Abre o painel de processamento e marca exatamente as etapas de inferência (checar o relógio, calcular o cansaço, alterar a trilha) como dispensáveis.",
        em_processo: "Abre o painel e marca outro conjunto de etapas, sem distinguir as essenciais das de inferência.",
        nao_atingiu: "Não abre o painel, pula a etapa ou não marca nenhuma etapa.",
        observacao: 'O painel é opcional: no relatório, esta habilidade aparece como "% Participou" (quem abriu).',
      },
    },
  ],
  perguntas: [],
};
