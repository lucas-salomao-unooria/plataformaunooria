import { z } from "zod";
import { IDS_DE_BLOCO, IDS_DE_OPCAO, TETO_DA_REFLEXAO } from "./catalogo";
import { ACOES_DO_GATE, ETAPAS, PASSOS } from "./regras/passos";

/**
 * O contrato HTTP da exp-06 — só schemas Zod, nenhum decorator.
 *
 * Os enums vêm do catálogo e das regras, nunca reescritos aqui: uma segunda
 * lista de valores é a que ninguém atualiza junto.
 *
 * A saída é ALLOWLIST explícita. O que não pode vazar é o gabarito — qual das
 * três opções interrompe a corrente, a ordem certa dos quatro blocos e a
 * matriz de propagação (regra inviolável nº 3). Nenhum schema de catálogo tem
 * campo para eles, então o vazamento não é "esquecido": é impossível.
 */

// -------------------------------------------------------------- entrada

export const AuditoriaSchema = z.object({
  mensagemId: z.string().min(1).max(64),
  /** Segundos com o modal aberto. Teto de 1h: acima disso é aba esquecida
   *  aberta, não leitura, e a calibragem de fluxo mentiria. */
  tempoLeituraS: z.number().int().min(0).max(3600).default(0),
});

export const DecisaoSchema = z.object({
  opcao: z.enum(IDS_DE_OPCAO),
  /** Segundos entre a crise chegar e o envio. Teto de 2h, pela mesma razão. */
  latenciaSeg: z.number().int().min(0).max(7200),
  /** O alerta de inação de 90s chegou a aparecer nesta tela? */
  houveInacao90s: z.boolean().default(false),
});

export const ModelagemSchema = z.object({
  /** Exatamente 4 e distintos — a regra pura recusa repetido, que é slot vazio
   *  disfarçado de array cheio. */
  ordemBlocos: z.array(z.enum(IDS_DE_BLOCO)).length(IDS_DE_BLOCO.length),
});

/**
 * A reflexão do "Meu percurso". 280 caracteres, o teto do campo na tela.
 *
 * `trim` antes do `min(1)`: um campo com três espaços é um percurso em branco,
 * e ele contaria como entregue no painel da professora.
 */
export const ReflexaoSchema = z.object({
  texto: z.string().trim().min(1).max(TETO_DA_REFLEXAO),
});

export const GateSchema = z.object({ acao: z.enum(ACOES_DO_GATE) });

// --------------------------------------------------------------- saída

const PassoSchema = z.enum(PASSOS);
const EtapaSchema = z.enum(ETAPAS);
const OpcaoSchema = z.enum(IDS_DE_OPCAO);
const DesfechoSchema = z.enum(["interrompeu", "amplificou", "silenciou"]);

/** Os metadados do modal. Note a ausência de qualquer campo `confiavel`: ler os
 *  números é a tarefa, e um booleano responderia a pergunta. */
const MetadadosSchema = z.object({
  saltos: z.number().int().nullable(),
  autor: z.string(),
  detalhe: z.string(),
  carimbo: z.string(),
});

/** Uma mensagem do feed. Sem marca de "esta é a falsa" — reconhecer o padrão é
 *  o que a missão mede (EF06CO01). */
export const MensagemSchema = z.object({
  id: z.string(),
  chat: z.string(),
  autor: z.string(),
  hora: z.string(),
  tipo: z.enum(["texto", "audio", "documento"]),
  texto: z.string(),
  transcricao: z.string().optional(),
  duracaoSeg: z.number().int().positive().optional(),
  encaminhada: z.boolean().optional(),
  anexo: z.string().optional(),
  metadados: MetadadosSchema,
});

export const ConversaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  subtitulo: z.string(),
  naoLidas: z.number().int().min(0),
  previa: z.string(),
  hora: z.string(),
});

/** As 3 opções **sem `desfecho` e sem `reacao`**. O tipo do servidor é
 *  `Omit<Opcao, "desfecho" | "reacao">`, então o gabarito é impossível aqui. */
export const OpcaoPublicaSchema = z.object({ id: OpcaoSchema, texto: z.string() });

/** Os 4 blocos **sem posição**: a ordem certa mora no servidor. */
export const BlocoSchema = z.object({ id: z.enum(IDS_DE_BLOCO), texto: z.string() });

/** Um anel da malha, já AGRUPADO: `nos` é o número real, `desenhar` é quantos
 *  círculos o cliente põe no DOM. É o que mantém 60fps no Chromebook. */
const AnelSchema = z.object({
  nivel: z.number().int().min(0),
  nos: z.number().int().min(0),
  desenhar: z.number().int().min(0),
  aceso: z.boolean(),
});

export const TopologiaSchema = z.object({
  desfecho: DesfechoSchema,
  alcance: z.number().int().min(0),
  nivelDoEstudante: z.number().int().min(0),
  interrompeu: z.boolean(),
  aneis: z.array(AnelSchema),
  legenda: z.string(),
});

export const CurvasSchema = z.object({
  minutos: z.array(z.number().int()),
  boato: z.array(z.number().int()),
  laudo: z.array(z.number().int()),
  razao: z.number().int(),
});

export const EstadoSchema = z.object({
  /** O passo do estudante, já reconciliado com a etapa da turma. */
  passo: PassoSchema,
  /** O passo cru dele. Divergente do de cima = a turma o está segurando. */
  passoDoEstudante: PassoSchema,
  aguardandoATurma: z.boolean(),
  auditadas: z.array(z.string()),
  totalAuditadas: z.number().int().min(0),
  cotaAtingida: z.boolean(),
  faltamAuditar: z.number().int().min(0),
  opcao: OpcaoSchema.nullable(),
  /** Só DEPOIS do envio — a essa altura a criança já viu a cena na tela. */
  desfecho: DesfechoSchema.nullable(),
  reacao: z.string().nullable(),
  topologia: TopologiaSchema.nullable(),
  ordemBlocos: z.array(z.string()),
  coerente: z.boolean().nullable(),
  entregouPercurso: z.boolean(),
  concluidoEm: z.string().nullable(),
  turma: z.object({ etapa: EtapaSchema }),
});

export const AuditoriaRespostaSchema = EstadoSchema.extend({
  /** `false` = releitura do mesmo balão. Não é erro, e não conta de novo. */
  novo: z.boolean(),
});

export const DecisaoRespostaSchema = EstadoSchema.extend({
  reacao: z.string(),
});

const PodcastSchema = z.object({
  titulo: z.string(),
  blocos: z.array(z.object({ rotulo: z.string(), falas: z.array(z.string()) })),
});

export const SessaoSchema = EstadoSchema.extend({
  catalogo: z.object({
    conversas: z.array(ConversaSchema),
    mensagens: z.array(MensagemSchema),
    convocacao: z.object({
      id: z.string(),
      chat: z.string(),
      autor: z.string(),
      hora: z.string(),
      duracaoSeg: z.number().int().positive(),
      texto: z.string(),
      transcricao: z.string(),
      banner: z.string(),
    }),
    opcoes: z.array(OpcaoPublicaSchema),
    blocos: z.array(BlocoSchema),
    auditoriasExigidas: z.number().int().positive(),
    perguntaDoPercurso: z.string(),
    tetoDaReflexao: z.number().int().positive(),
    podcast: PodcastSchema,
    curvas: CurvasSchema,
  }),
  reflexao: z.object({ texto: z.string() }).nullable(),
  estudante: z.object({ nome: z.string() }),
});

export const GatePublicoSchema = z.object({
  etapa: EtapaSchema,
  passoEfetivo: PassoSchema,
  /** O instante do SERVIDOR: o relógio da máquina da escola atrasa. */
  agora: z.string(),
});

// ------------------------------------------------------ saída do professor

export const TurmasSchema = z.object({
  turmas: z.array(
    z.object({
      id: z.string().uuid(),
      nome: z.string(),
      serie: z.string().nullable(),
      estudantes: z.number().int().min(0),
    }),
  ),
});

const TurmaDoPainelSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  serie: z.string().nullable(),
  etapa: EtapaSchema.nullable(),
});

/**
 * Uma linha do painel.
 *
 * **Sem `score` e sem `nivel`** — `PROIBIDO_NO_PAINEL` em `invariantes.ts` tem
 * o teste que cobra a ausência. O que há é progresso e escolha, que é o
 * material do debate; uma coluna de pontos ordenaria crianças na leitura ainda
 * que a tela não ordenasse (PED-07).
 *
 * `reflexaoTexto` está AQUI e só aqui: é caixa livre de menor, e a rota é a do
 * professor da turma dela.
 */
const LinhaDoPainelSchema = z.object({
  estudanteId: z.string().uuid(),
  nome: z.string(),
  usuario: z.string(),
  iniciou: z.boolean(),
  passo: PassoSchema,
  auditadas: z.number().int().min(0),
  auditouTudo: z.boolean(),
  opcao: OpcaoSchema.nullable(),
  houveInacao90s: z.boolean(),
  latenciaSeg: z.number().int().nullable(),
  modeloCoerente: z.boolean().nullable(),
  entregouPercurso: z.boolean(),
  reflexaoTexto: z.string().nullable(),
  ociosoMin: z.number().int().nullable(),
});

export const PainelSchema = z.object({
  turma: TurmaDoPainelSchema,
  estudantes: z.array(LinhaDoPainelSchema),
  resumo: z.object({
    total: z.number().int().min(0),
    iniciaram: z.number().int().min(0),
    auditaramTudo: z.number().int().min(0),
    responderam: z.number().int().min(0),
    entregaram: z.number().int().min(0),
    ociosos: z.number().int().min(0),
    modelosCoerentes: z.number().int().min(0),
    estouraramOAlerta: z.number().int().min(0),
    /** Contagem por opção. É o material do debate, não um placar. */
    distribuicao: z.record(OpcaoSchema, z.number().int().min(0)),
  }),
});

export const GateDaTurmaSchema = z.object({
  turma: z.object({
    id: z.string().uuid(),
    nome: z.string(),
    serie: z.string().nullable(),
  }),
  etapa: EtapaSchema,
  atualizadoEm: z.string(),
});

export const ZerarTurmaSchema = z.object({
  sucesso: z.literal(true),
  registrosApagados: z.number().int().min(0),
});

/**
 * O material do guia da aula: as três intervenções COM gabarito e o ciclo na
 * ordem certa.
 *
 * Professor-only, e por dois motivos que não são o mesmo: `desfecho` é o
 * gabarito da decisão (a tela do estudante recebe o desfecho DELE, depois de
 * escolher, nunca a tabela inteira), e `ciclo` aqui vai ordenado — para a
 * criança ele chega embaralhado, porque montar a ordem É a tarefa.
 */
export const MaterialDoProfessorSchema = z.object({
  intervencoes: z.array(
    z.object({
      id: z.string(),
      texto: z.string(),
      /** GABARITO. */
      desfecho: z.enum(["interrompeu", "amplificou", "silenciou"]),
      reacao: z.string(),
      interrompe: z.boolean(),
    }),
  ),
  /** Na ORDEM CORRETA — o contrário de `blocosPublicos()`. */
  ciclo: z.array(z.object({ id: z.string(), texto: z.string() })),
});
