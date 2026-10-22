import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de O EFEITO AMPLIFICADOR (exp02em1b, 2ª série do EM, unidade 1, ADR-181)
 * — versão 1, de 2026-10-22: só o Canal A. O one-pager aprovado previa um
 * Canal B (quatro enquetes) e uma etapa de transferência; o PO tirou os dois
 * (2026-10-22), e toda habilidade é medida pelo que o estudante FAZ:
 *
 *   - **EM13CO14** (confiabilidade) e **EM13CO26** (direito digital) no
 *     PUBLICAR, na mesma transação do latch: o que ficou no post depois da
 *     auditoria no UnooriaAI (`efeito-amplificador/regras/evidencia.ts`).
 *   - **EM13CO24** (saúde, o foco) e **EM13CO08** (segurança) pelo que o
 *     estudante faz no feed da madrugada: a cada ação vale a melhor, e na
 *     abertura do Explicar o que não foi feito vira "não atingiu".
 *
 * A Missão Tempestade, que tinha este código, mora em `exp02em1b-v0.ts`.
 */
export const FICHA_EXP02EM1B: FichaPedagogica = {
  expId: "exp02em1b",
  versao: 1,
  habilidades: [
    {
      codigo: "EM13CO24",
      marcadores: [{ id: "cuidado-com-a-saude", tipo: "acao", rotulo: "Feed da madrugada" }],
      criterios: {
        atingiu:
          "No feed da madrugada, abre relatos das duas dimensões — saúde física (sono, dor de cabeça, horas na tela) e saúde mental (ansiedade, medo, humilhação) — e usa ao menos uma moderação (restringir comentários, fixar aviso ou arquivar).",
        em_processo:
          "Abre relatos de uma dimensão só, ou das duas sem moderar, ou modera e abre as métricas sem ter lido as duas dimensões.",
        nao_atingiu: "Não abre nenhum relato, não abre as métricas e não usa nenhuma moderação.",
        observacao:
          'Vale a melhor ação no feed. Quem publicou e não fez nada no feed fica "não atingiu" quando abre a Etapa 5; quem não chegou ao feed fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EM13CO14",
      marcadores: [{ id: "auditoria-da-fonte", tipo: "acao", rotulo: "Auditoria no UnooriaAI" }],
      criterios: {
        atingiu: "Pergunta ao UnooriaAI a fonte da estatística e tira ou corrige o dado inventado antes de publicar.",
        em_processo: "Pergunta a fonte mas publica o dado inventado, ou tira o dado sem ter checado a origem.",
        nao_atingiu: "Publica o rascunho sem perguntar a fonte nem mexer na estatística.",
        observacao: 'Medida no "Publicar no Unoovista". Sem publicar, a habilidade fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EM13CO26",
      marcadores: [{ id: "direito-digital-no-post", tipo: "acao", rotulo: "Direito digital no post" }],
      criterios: {
        atingiu: "Credita o trecho copiado (entre aspas, com o veículo) e tira do post o nome e o caso de saúde do colega.",
        em_processo: "Resolve só um dos dois dilemas: o crédito ou a exposição do colega.",
        nao_atingiu: "Publica o trecho copiado sem crédito e o colega exposto.",
        observacao:
          'Medida no "Publicar no Unoovista": vale pedir a correção ao UnooriaAI ou tirar o parágrafo do post. Sem publicar, a habilidade fica "Não avaliado".',
      },
    },
    {
      codigo: "EM13CO08",
      marcadores: [{ id: "protecao-na-rede", tipo: "acao", rotulo: "Proteção na rede" }],
      criterios: {
        atingiu:
          "Usa, sem ninguém pedir, as três proteções do Unoovista: deixa a conta privada, denuncia um perfil suspeito e abre a Central de Apoio.",
        em_processo: "Usa uma ou duas das três proteções.",
        nao_atingiu: "Não usa nenhuma proteção durante a crise do post.",
        observacao:
          'As três ficam nos menus de três pontos, sem aviso que obrigue o clique: a voluntariedade é a evidência. Vale a melhor ação; quem não usou nenhuma fica "não atingiu" ao abrir a Etapa 5.',
      },
    },
  ],
  perguntas: [],
};
