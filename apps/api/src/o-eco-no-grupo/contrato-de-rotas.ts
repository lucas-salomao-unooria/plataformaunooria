import { z } from "zod";
import {
  IDS_DE_ESTRATEGIA,
  IDS_DE_JUSTIFICATIVA,
  IDS_DE_OPCAO,
  ESTRATEGIAS_EXIGIDAS,
} from "./catalogo";
import { ACOES } from "./regras/sessao";
import { ACOES_DO_GATE, ETAPAS, PASSOS } from "./regras/passos";

/**
 * O contrato HTTP da exp-07 — só schemas Zod, nenhum decorator.
 *
 * Os enums vêm do catálogo e das regras, nunca reescritos aqui: uma segunda
 * lista de valores é a que ninguém atualiza junto.
 *
 * A saída é ALLOWLIST explícita. O que não pode vazar é o gabarito — qual das
 * três opções é a checada, quais estratégias a missão considera prioritárias e
 * o desfecho de cada caminho (regra inviolável nº 3). Nenhum destes schemas
 * tem campo para eles, então o vazamento não é "esquecido": é impossível.
 */

const Uuid = z.string().uuid();

// -------------------------------------------------------------- entrada

export const AcaoSchema = z.object({ acao: z.enum(ACOES) });

export const IntervencaoSchema = z.object({
  opcao: z.enum(IDS_DE_OPCAO),
  /** Segundos entre abrir o menu e enviar. Teto de 2h: acima disso é aba
   *  esquecida aberta, não tempo de decisão, e a média do painel mentiria. */
  latenciaSeg: z.number().int().min(0).max(7200),
});

export const ReflexaoSchema = z.object({
  /** Exatamente 2, e distintas — a regra pura recusa repetida. */
  estrategias: z.array(z.enum(IDS_DE_ESTRATEGIA)).length(ESTRATEGIAS_EXIGIDAS),
  justificativa: z.enum(IDS_DE_JUSTIFICATIVA),
});

/**
 * A fala do estudante para Amara. 600 caracteres pelo mesmo motivo da exp-03:
 * é o campo de um chat, não um formulário — acima disso não é fala, é colagem.
 *
 * Este é o ÚNICO texto livre da missão, e ele só existe depois da decisão no
 * grupo. Ver a ADR que reabriu essa porta e `invariantes.ts`.
 */
export const AmaraSchema = z.object({ texto: z.string().trim().min(1).max(600) });

export const GateSchema = z.object({ acao: z.enum(ACOES_DO_GATE) });

// --------------------------------------------------------------- saída

const PassoSchema = z.enum(PASSOS);
const EtapaSchema = z.enum(ETAPAS);

/** Uma mensagem do feed como o estudante a recebe. Note a ausência de qualquer
 *  marca de "esta é a manipulada": o reconhecimento do padrão é a tarefa. */
export const MensagemDoFeedSchema = z.object({
  id: z.string(),
  autor: z.string(),
  hora: z.string(),
  tipo: z.enum(["texto", "audio", "foto", "print"]),
  texto: z.string(),
  midia: z.string().optional(),
  transcricao: z.string().optional(),
  duracaoSeg: z.number().int().positive().optional(),
  encaminhada: z.boolean().optional(),
  abreMateria: z.boolean().optional(),
});

export const MateriaSchema = z.object({
  fonte: z.string(),
  manchetePrint: z.string(),
  titulo: z.string(),
  paragrafoExibido: z.string(),
  paragrafoSuprimido: z.string(),
  fotoDoPrint: z.string(),
  fotoDaMateria: z.string(),
});

/** As 3 opções **sem `desfecho` e sem `correta`**. O tipo do servidor é
 *  `Omit<Opcao, "desfecho" | "correta">`, então o gabarito é impossível aqui. */
export const OpcaoPublicaSchema = z.object({ id: z.enum(IDS_DE_OPCAO), texto: z.string() });

export const CardSchema = z.object({ id: z.string(), titulo: z.string(), corpo: z.string() });

export const EstadoSchema = z.object({
  /** O passo do estudante, já reconciliado com a etapa da turma. */
  passo: PassoSchema,
  /** O passo cru dele, antes do gate — o cliente usa para saber se está preso
   *  esperando a turma ou apenas andando. */
  passoDoEstudante: PassoSchema,
  aguardandoATurma: z.boolean(),
  inspecionouMateria: z.boolean(),
  ouviuAudio: z.boolean(),
  ouviuPodcast: z.boolean(),
  cardsLidos: z.number().int().min(0),
  opcao: z.enum(IDS_DE_OPCAO).nullable(),
  /** O que a resposta produziu no bairro — `null` até haver resposta. É por ele
   *  que a tela decide o que desenhar (alfinete ou "apagar para todos"), para
   *  que o BUNDLE não precise saber qual letra é a checada. Sem isto, a tela
   *  comparava `opcao === "B"` e a resposta certa ia legível para o JS público
   *  (regra inviolável nº 3). */
  desfecho: z.enum(["ruido", "checada", "conflito"]).nullable(),
  desfazerUsado: z.number().int().min(0),
  concluidoEm: z.string().nullable(),
  turma: z.object({ etapa: EtapaSchema }),
});

/** Uma reação do bairro. `atrasoMs` carrega a cadência 2s/3s/2s da cascata. */
export const ReacaoSchema = z.object({
  autor: z.string(),
  texto: z.string(),
  atrasoMs: z.number().int().min(0),
});

export const MidiaSchema = z.object({
  /** id → URL pública, ou `null` quando a mídia ainda não foi preparada. Null
   *  é informação: é o sinal para o cliente cair na transcrição e na
   *  ilustração procedural, em vez de esperar um arquivo que não existe. */
  urls: z.record(z.string().nullable()),
});

export const SessaoSchema = EstadoSchema.extend({
  catalogo: z.object({
    feed: z.array(MensagemDoFeedSchema),
    materia: MateriaSchema,
    opcoes: z.array(OpcaoPublicaSchema),
    cards: z.array(CardSchema),
    estrategias: z.array(z.object({ id: z.string(), texto: z.string() })),
    justificativas: z.array(z.object({ id: z.string(), texto: z.string() })),
    amaraCelebra: z.string(),
    amaraCutucao: z.string(),
  }),
  midia: MidiaSchema,
  /** As reações já gravadas — o F5 depois da cascata devolve a MESMA cena. */
  reacoes: z.array(ReacaoSchema).nullable(),
  /** A conversa com Amara, para a reentrada. Só o que ela e o estudante
   *  disseram; nada de gabarito. */
  amara: z.array(z.object({ papel: z.enum(["estudante", "amara"]), texto: z.string() })),
  reflexao: z
    .object({ estrategias: z.array(z.string()), justificativa: z.string(), devolutiva: z.string().nullable() })
    .nullable(),
  estudante: z.object({ nome: z.string(), avatar: z.string() }),
});

export const IntervencaoRespostaSchema = EstadoSchema.extend({
  /** `checada` fixa a mensagem pelo Admin; `ruido` e `conflito` abrem o
   *  "Apagar para todos". Quem decide é o servidor. */
  desfecho: z.enum(["ruido", "checada", "conflito"]),
  reacoes: z.array(ReacaoSchema),
  /** Presente só quando o bairro se acalma: é a fala de Amara no privado. */
  amaraCelebra: z.string().optional(),
});

export const ReflexaoRespostaSchema = EstadoSchema.extend({
  /** O que a experiência devolve ao hub no `exp:concluir`. O estudante não vê
   *  este número: a interface dele não tem nota nem estrela (PED-05). */
  score: z.number().int(),
  devolutiva: z.string().nullable(),
});

export const AmaraRespostaSchema = z.object({
  texto: z.string(),
  turnosRestantes: z.number().int().min(0),
});

export const GatePublicoSchema = z.object({
  etapa: EtapaSchema,
  /** O passo em que a turma coloca o estudante — o cliente compara com o dele. */
  passoEfetivo: PassoSchema,
  /** Instante do SERVIDOR. O relógio da máquina da escola atrasa, e não é ele
   *  que decide o momento da aula. */
  agora: z.string(),
});

// ------------------------------------------------------ visão do professor

export const TurmasDoEcoSchema = z.object({
  turmas: z.array(
    z.object({
      id: Uuid,
      nome: z.string(),
      serie: z.string(),
      estudantes: z.number().int().min(0).optional(),
    }),
  ),
});

/**
 * A linha de um estudante no painel.
 *
 * NÃO tem `score` (`invariantes.ts`, `PROIBIDO_NO_PAINEL`): a leitura do
 * professor é de progresso e de estratégia, não uma coluna de pontos que
 * ordene crianças. `opcao` está aqui porque a distribuição A/B/C é o material
 * do debate — e ela aparece na tela como percentual da turma, não como
 * "quem errou".
 */
export const LinhaDaTurmaSchema = z.object({
  estudanteId: Uuid,
  nome: z.string(),
  usuario: z.string(),
  iniciou: z.boolean(),
  passo: PassoSchema,
  inspecionouMateria: z.boolean(),
  ouviuPodcast: z.boolean(),
  opcao: z.enum(IDS_DE_OPCAO).nullable(),
  desfazerUsado: z.number().int().min(0),
  entregouPercurso: z.boolean(),
  /** Minutos desde a última ação. Alimenta o alerta de ociosidade (> 3 min),
   *  que é para o professor ir até a carteira — não para punir. */
  ociosoMin: z.number().int().min(0).nullable(),
});

export const PainelDaTurmaSchema = z.object({
  turma: z.object({ id: Uuid, nome: z.string(), serie: z.string(), etapa: EtapaSchema }),
  estudantes: z.array(LinhaDaTurmaSchema),
  resumo: z.object({
    total: z.number().int().min(0),
    iniciaram: z.number().int().min(0),
    inspecionaram: z.number().int().min(0),
    responderam: z.number().int().min(0),
    entregaram: z.number().int().min(0),
    ociosos: z.number().int().min(0),
    /** Percentuais A/B/C entre quem respondeu. Distribuição neutra: a rubrica
     *  proíbe exibir "taxa de erro" com viés punitivo. */
    distribuicao: z.record(z.number().int().min(0)),
    usaramRecuperacao: z.number().int().min(0),
    /** Quantos marcaram as 2 estratégias que a missão ensinou. Não é nota. */
    percursoComAsDuas: z.number().int().min(0),
  }),
});

export const GateDaTurmaSchema = z.object({
  turma: z.object({ id: Uuid, nome: z.string(), serie: z.string() }),
  etapa: EtapaSchema,
  atualizadoEm: z.string(),
});

export const ZerarTurmaSchema = z.object({
  sucesso: z.literal(true),
  registrosApagados: z.number().int().min(0),
});

export const PreparoDaMidiaSchema = z.object({
  urls: z.record(z.string().nullable()),
  /** O que esta chamada gerou agora (o resto já estava no bucket). Preparar
   *  duas vezes é idempotente: é o clique que se dá duas vezes. */
  geradas: z.array(z.string()),
  /** O que falhou, por id. A missão continua jogável sem mídia — a transcrição
   *  é o canal principal, e a ilustração cai no procedural. */
  falharam: z.array(z.string()),
});
