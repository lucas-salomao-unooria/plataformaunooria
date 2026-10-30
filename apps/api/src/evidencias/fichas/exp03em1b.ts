import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de O PORTA-VOZ DOS DADOS (exp03em1b, 3ª série do EM, unidade 1) —
 * versão 2, de 2026-10-29 (a v1 é da ADR-198; a v2, da ADR-203: a 4ª camada
 * do compositor é INCORRETA de propósito e põe teto na EM13CO22): 100% Canal A, sem perguntas e sem
 * resolvedor de contexto. A régua é a do plano aprovado (§1 "Evidência"), com
 * as diretrizes do PO e as decisões do Lucas por cima do PRD §14 — o código
 * está em `porta-voz-dos-dados/regras/evidencia.ts`. Toda habilidade é medida
 * pelo que o estudante FAZ, e é marcada na transação do próprio gesto:
 *
 *   - **EM13CO13** (consulta a dados) no PUBLICAR da 1ª publicação;
 *   - **EM13CO12**, **EM13CO21**, **EM13CO22** e **EM13CO26** na DECISÃO DA
 *     ERRATA (publicar ou "Avançar sem publicar errata"): elas leem o conjunto
 *     FINAL, e a errata pode melhorar ou piorar a 1ª;
 *   - **EM13CO14** (confiabilidade) no parecer da perícia (ou no pular).
 *
 * Quem não chega ao gesto fica "Não avaliado" (a ausência de marca), e o
 * professor ajusta. A atividade é o PACOTE; a rodada, o "Zerar Turma".
 */
export const FICHA_EXP03EM1B: FichaPedagogica = {
  expId: "exp03em1b",
  versao: 2,
  habilidades: [
    {
      codigo: "EM13CO12",
      marcadores: [{ id: "boletim_final", tipo: "acao", rotulo: "Escala e fonte do boletim final" }],
      criterios: {
        atingiu: "A publicação final (a errata, se houve; senão a 1ª) usa a escala proporcional (eixo em 0%) com a fonte dos dados ligada.",
        em_processo: "A publicação final usa a escala proporcional sem a fonte, ou a escala recortada (eixo em 80%) com a fonte ligada.",
        nao_atingiu: "A publicação final usa a escala recortada (eixo em 80%) sem a fonte dos dados.",
        observacao: 'Medida quando o estudante decide a errata (publica ou avança sem publicar). Quem não chegou à errata fica "Não avaliado".',
      },
    },
    {
      codigo: "EM13CO13",
      marcadores: [{ id: "inspecao_anexo", tipo: "acao", rotulo: "Consulta à nota técnica" }],
      criterios: {
        atingiu: "Abre a nota técnica da subprefeitura por conta própria, antes de abrir o compositor e antes do aviso de inatividade de 90 segundos.",
        em_processo: "Abre a nota técnica antes do compositor, mas só depois do aviso de inatividade.",
        nao_atingiu: "Abre o compositor sem ter aberto a nota técnica.",
        observacao: 'Medida na 1ª publicação, pelo horário do servidor. Sem publicar, fica "Não avaliado".',
      },
    },
    {
      codigo: "EM13CO14",
      marcadores: [{ id: "pericia_eleitoral", tipo: "acao", rotulo: "Perícia dos cartões eleitorais" }],
      criterios: {
        atingiu: "Sinaliza só o Cartão B, com o motivo escala.",
        em_processo: "Sinaliza o Cartão B com outro motivo (fonte ou título), e/ou sinaliza também o Cartão A.",
        nao_atingiu: "Não sinaliza o Cartão B, ou avança sem emitir parecer.",
        observacao: "Abrir os dados ou emitir o parecer, sozinhos, não pontuam: vale o que foi sinalizado.",
      },
    },
    {
      codigo: "EM13CO21",
      marcadores: [{ id: "anotacao_escala", tipo: "acao", rotulo: "Explicação da escala no boletim" }],
      criterios: {
        atingiu: "Liga a explicação da escala já na 1ª publicação (e a mantém na errata, se publicar uma).",
        em_processo: "Liga a explicação da escala só na errata, ou a liga na 1ª e a desliga na errata.",
        nao_atingiu: "Não liga a explicação da escala em nenhuma publicação.",
        observacao: 'Medida quando o estudante decide a errata. Quem não chegou à errata fica "Não avaliado".',
      },
    },
    {
      codigo: "EM13CO22",
      marcadores: [{ id: "camadas_do_boletim", tipo: "acao", rotulo: "Gráfico com camadas de informação" }],
      criterios: {
        atingiu:
          "A publicação final traz o gráfico com pelo menos duas informações corretas ligadas (explicação da escala, fonte, contexto) e sem a projeção, que a nota técnica desmente.",
        em_processo:
          "A publicação final traz o gráfico com uma informação correta ligada; ou com a projeção ligada junto de pelo menos uma correta — ligou tudo sem avaliar cada camada.",
        nao_atingiu: "A publicação final traz o gráfico sem nenhuma informação correta.",
        observacao: 'Medida quando o estudante decide a errata. Quem não chegou à errata fica "Não avaliado".',
      },
    },
    {
      codigo: "EM13CO26",
      marcadores: [{ id: "errata_responsavel", tipo: "acao", rotulo: "Responsabilidade na errata" }],
      criterios: {
        atingiu:
          "A 1ª publicação já era adequada (eixo em 0% com a fonte) e não regrediu; ou a errata corrigiu o problema (o eixo de 80% para 0%, ou acrescentou a fonte ou o contexto que faltavam, ou desligou a projeção que a nota técnica desmente) sem levar o eixo de 0% para 80%.",
        em_processo: "Publica a errata sem corrigir de fato o que faltava na 1ª publicação.",
        nao_atingiu: "Mantém uma 1ª publicação inadequada sem errata, ou publica uma errata que leva o eixo de 0% para 80%.",
        observacao: "Trocar o eixo de 80% para 0% conta como correção mesmo tirando a fonte: o eixo é o centro. Quem publicou adequado e avançou sem errata atingiu.",
      },
    },
  ],
  perguntas: [],
};
