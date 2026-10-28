import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de O EFEITO AMPLIFICADOR (exp02em1b, 2ª série do EM, unidade 1) —
 * versão 2, de 2026-10-28 (a 2.1.0, ADR-191): 100% Canal A, a régua do PRD
 * §14.1 e do contrato de evidência do one-pager §12a. Toda habilidade é medida
 * pelo que o estudante FAZ:
 *
 *   - **EM13CO14** (confiabilidade) e **EM13CO26** (direito digital) no
 *     PUBLICAR, na mesma transação do latch: o que o estudante pediu ao
 *     UnooriaAI antes de exportar (`efeito-amplificador/regras/evidencia.ts`).
 *   - **EM13CO24** (saúde, o foco) e **EM13CO08** (segurança) pelo que o
 *     estudante faz no feed da madrugada: a cada ação vale a melhor, e na
 *     abertura do Explicar o que não foi feito vira "não atingiu".
 *
 * A versão 1 (a 2.0.x) media a CO24 pelos comentários abertos e a CO08 pela
 * "ajuda"; as marcas antigas ficam com a versão que as mediu. A Missão
 * Tempestade, que já teve este código, mora em `exp02em1b-v0.ts`.
 */
export const FICHA_EXP02EM1B: FichaPedagogica = {
  expId: "exp02em1b",
  versao: 2,
  habilidades: [
    {
      codigo: "EM13CO24",
      marcadores: [{ id: "moderacao_saude", tipo: "acao", rotulo: "Aviso de cuidado no feed" }],
      criterios: {
        atingiu: 'Fixa o aviso de cuidado na publicação escolhendo o motivo de saúde ("Conteúdo pode afetar a saúde de quem lê").',
        em_processo:
          'Fixa o aviso com outro motivo ("Informação sem fonte confiável" ou "Conteúdo ofensivo"), ou restringe os comentários sem fixar aviso.',
        nao_atingiu: "Não usa nenhuma ferramenta de moderação na publicação.",
        observacao:
          'Vale a melhor ação no feed. Quem publicou e não moderou fica "não atingiu" quando abre a Etapa 5; quem não chegou ao feed fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EM13CO14",
      marcadores: [{ id: "auditoria_fontes", tipo: "acao", rotulo: "Auditoria de fontes no UnooriaAI" }],
      criterios: {
        atingiu: "Questiona o UnooriaAI sobre a fonte dos dados E corrige a estatística inventada na prévia antes de exportar.",
        em_processo: "Questiona a fonte mas publica o dado inventado, ou pede a revisão do texto sem checar a origem das afirmações.",
        nao_atingiu: "Aceita o primeiro rascunho sem investigar as fontes nem corrigir a estatística.",
        observacao: 'Medida no "Publicar no Unoovista". Sem publicar, a habilidade fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EM13CO26",
      marcadores: [{ id: "direito_digital", tipo: "acao", rotulo: "Direito digital no post" }],
      criterios: {
        atingiu: "Exige o crédito do trecho copiado E anonimiza o colega exposto antes de publicar.",
        em_processo: "Resolve só um dos dois dilemas: o crédito de autoria ou a exposição do colega.",
        nao_atingiu: "Publica o trecho copiado sem crédito e o colega exposto.",
        observacao: 'Medida no "Publicar no Unoovista", pelos pedidos de correção ao UnooriaAI. Sem publicar, a habilidade fica "Não avaliado".',
      },
    },
    {
      codigo: "EM13CO08",
      marcadores: [{ id: "protecao_seguranca", tipo: "acao", rotulo: "Proteção, denúncia e apoio" }],
      criterios: {
        atingiu:
          "Usa, sem ninguém pedir, as três proteções do Unoovista: ajusta a privacidade na Configuração da Publicação, denuncia o perfil suspeito e encaminha um relato pela Central de Apoio.",
        em_processo: "Usa uma ou duas das três proteções, ou abre a Central de Apoio sem concluir o encaminhamento.",
        nao_atingiu: "Não aciona nenhuma ferramenta de proteção, privacidade, denúncia ou encaminhamento.",
        observacao:
          'A Configuração da Publicação fica no card do post e a Central de Apoio na barra do feed, sem aviso que obrigue o toque: a voluntariedade é a evidência. Vale a melhor ação; quem não usou nenhuma fica "não atingiu" ao abrir a Etapa 5.',
      },
    },
  ],
  perguntas: [],
};
