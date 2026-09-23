/**
 * O contrato de `/quem-mandou-isso/*` como o CLIENTE o vê.
 *
 * Espelha `apps/api/src/quem-mandou-isso/contrato-de-rotas.ts`, e espelha só o
 * que a TELA precisa ver.
 *
 * **Não existe tipo para a veracidade dentro do lote**, e a ausência é a regra
 * 3 desenhada em TypeScript: `MensagemPublica` não tem `veracidade`, `tom` nem
 * `explicacao` porque a api monta a projeção por `Omit` e esses três campos
 * nunca descem antes do telão. Acrescentar um campo opcional aqui "por
 * garantia" seria escrever a suspeita de que eles podem vir — e a próxima pessoa
 * leria isso como permissão. O gabarito aparece UMA vez, dentro de `Revelacao`,
 * que a api devolve depois de a professora acender a revelação coletiva.
 *
 * Os ids de mensagem são `string` de propósito, e não a união `msg-1 … msg-8`
 * do catálogo: o cliente nunca CONSTRÓI um id — ele devolve o que veio no lote.
 * Uma segunda cópia da lista aqui seria a que ninguém atualiza quando o molde
 * do lote mudar.
 */

export const EXP_ID = "exp05ef1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O CI lê a do manifesto para montar o caminho
 * IMUTÁVEL no bucket, e a divergência já causou bug — o `versao.test.ts`
 * compara os três (ADR-84).
 */
export const EXP_VERSION = "0.1.1";

// ──────────────────────────────────────────────────────────── vocabulário

/** Os passos do estudante, na ordem em que ele os percorre. */
export type Passo = "contexto" | "curadoria" | "espera" | "revelado" | "reflexao" | "fim";

/** As etapas da turma — o que os dois botões da professora abrem. */
export type Etapa = "exploracao" | "revelacao" | "reflexao";

/** O formato do balão. Sem mídia binária: o áudio é transcrição, o link é card. */
export type TipoDeMensagem = "texto" | "audio" | "imagem" | "link";

/** Só existe DENTRO de `Revelacao`. Ver a nota do topo. */
export type Veracidade = "verdadeira" | "falsa" | "ambigua";

/** Para que lado a sala pendeu. É o que escolhe a redação do card de síntese. */
export type Polaridade = "urgencia-venceu" | "informativas-venceram" | "empate";

// ─────────────────────────────────────────────────────────────── o lote

/** Uma mensagem como o estudante a recebe. Sem gabarito, por construção. */
export interface MensagemPublica {
  id: string;
  remetente: string;
  /** "HH:MM" — o histórico recente da manhã. */
  hora: string;
  tipo: TipoDeMensagem;
  /** No `audio` é a transcrição; na `imagem`, a legenda; no `link`, a descrição. */
  corpo: string;
  /** Só em `audio`. Teto de 20 s. */
  duracaoSeg?: number;
  /** `imagem`: o rótulo do que a foto mostra. `link`: a manchete. */
  titulo?: string;
  /** Só em `link`: o veículo. */
  fonte?: string;
  /** Só em `link`: a data — o detalhe que a mensagem ambígua esconde. */
  data?: string;
}

/**
 * O lote homologado pela professora. `null` enquanto ela não homologou nada —
 * e é por isso que a missão NASCE VAZIA: sem lote, a tela é de espera.
 */
export interface LotePublico {
  tema: string;
  grupo: { nome: string; subtitulo: string };
  mural: { nome: string };
  mensagens: MensagemPublica[];
}

// ───────────────────────────────────────────────────────────── revelação

/** Uma fita do Mural revelado. Só chega DEPOIS do telão. */
export interface MensagemRevelada {
  id: string;
  veracidade: Veracidade;
  explicacao: string;
  /** Quantos estudantes CONFIRMADOS encaminharam. É a métrica social do balão. */
  total: number;
  percentual: number;
}

export interface Sintese {
  /** Encaminhamentos de mensagens com tom alarmista ou urgente. */
  emocionais: number;
  /** Encaminhamentos de comunicados neutros ou ponderados. */
  informativas: number;
  polaridade: Polaridade;
}

/** `null` até a professora acender o telão. O único lugar com gabarito. */
export interface Revelacao {
  totalConfirmados: number;
  mensagens: MensagemRevelada[];
  sintese: Sintese;
}

// ──────────────────────────────────────────────────────────────── estado

export interface Estado {
  /** Já reconciliado com a etapa da turma — USE ESTE, nunca o cru. */
  passo: Passo;
  /** O passo cru do estudante. Divergente = a turma o segura ou o empurra. */
  passoDoEstudante: Passo;
  aguardandoATurma: boolean;
  /** A professora já homologou um lote para esta turma? Sem isso, tela de espera. */
  preparada: boolean;
  encaminhadas: string[];
  totalEncaminhadas: number;
  atingiuPiso: boolean;
  faltam: number;
  leuTudo: boolean;
  /** Piso de 3 E leitura integral. É o que libera "Ver Mural" e "Confirmar envio". */
  podeConfirmar: boolean;
  /** O caminho degenerado "escolheu tudo": o card vira atrito, sem trava. */
  encaminhouTudo: boolean;
  confirmou: boolean;
  confirmadoEm: string | null;
  midiasAbertas: string[];
  entregouReflexao: boolean;
  concluidoEm: string | null;
  turma: { etapa: Etapa };
  revelacao: Revelacao | null;
}

export interface Podcast {
  titulo: string;
  blocos: { rotulo: string; falas: string[] }[];
}

export interface Constantes {
  pisoDeEncaminhamentos: number;
  totalDeMensagens: number;
  perguntaDaReflexao: string;
  pisoDaReflexao: number;
  tetoDaReflexao: number;
  podcast: Podcast;
}

export interface RespostaSessao extends Estado {
  lote: LotePublico | null;
  constantes: Constantes;
  /** A reflexão do PRÓPRIO estudante. Nunca a de outro. */
  reflexao: { texto: string } | null;
  estudante: { nome: string };
}

export interface RespostaEncaminhamento extends Estado {
  /** `false` = a mensagem já estava no Mural. Não é erro, e não conta de novo. */
  novo: boolean;
}

export interface RespostaGate {
  etapa: Etapa;
  passoEfetivo: Passo;
  aguardandoATurma: boolean;
  preparada: boolean;
  /** O instante do SERVIDOR: o relógio da máquina da escola atrasa. */
  agora: string;
}

/**
 * Os códigos que a TELA distingue — não os da api.
 *
 * O SDK joga `Error` com "API POST /x → 409", **sem o corpo**, então a
 * classificação é pelo status. O 409 é ambíguo de propósito: o gate da turma, o
 * latch da curadoria e a revelação já iniciada respondem todos o mesmo. Quem
 * sabe distinguir é a tela, que conhece o passo em que estava quando chamou.
 */
export type CodigoErro =
  | "conflito-de-etapa"
  | "missao-nao-liberada"
  | "payload-invalido"
  | "rede";
