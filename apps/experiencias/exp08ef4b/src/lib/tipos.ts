/**
 * O contrato de `/manifesto-ia/*` como o cliente o vê.
 *
 * Espelha `apps/api/src/manifesto-ia/contrato-de-rotas.ts`. Dois campos NÃO
 * existem aqui, e a ausência é o desenho: não há tipo para a `replicaIa` de um
 * questionamento que ainda não foi feito (ela chega na resposta do disparo, e
 * antes disso ver a defesa desmontaria a cena da auditoria) nem para a
 * `justificativaSugerida` de uma cláusula (é material do professor, e mostrá-la
 * transformaria a autoria da Etapa 5 em cópia).
 *
 * **Gabarito não existe nesta missão.** As quatro cláusulas são salvaguardas
 * válidas — não há resposta certa a esconder, e calcular acerto entre elas está
 * na lista de métricas proibidas do handoff.
 */

export const EXP_ID = "exp08ef4b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O CI lê a do manifesto, e a divergência já causou
 * bug — o `versao.test.ts` compara os três (ADR-84).
 */
export const EXP_VERSION = "0.1.6";

export type Passo =
  | "briefing"
  | "chat"
  | "decisao"
  | "manifesto"
  | "percurso"
  | "podcast"
  | "fim";

/** A etapa da TURMA. `debate` é o Checkpoint A ativo. */
export type Etapa = "missao" | "debate";

export interface PromptPublico {
  id: string;
  rotuloBotao: string;
  textoPrompt: string;
}

export interface ClausulaPublica {
  id: string;
  tituloClausula: string;
  artigoTexto: string;
}

export interface Fala {
  papel: "user" | "assistant";
  texto: string;
  promptId?: string;
}

export interface Tag {
  id: string;
  rotulo: string;
}

export interface BlocoDoPodcast {
  rotulo: string;
  falas: string[];
}

export interface CatalogoDaMissao {
  contexto: {
    escola: string;
    casoUsoTitulo: string;
    premissaIaAutoritaria: string;
  };
  /** `turma` = a professora homologou um pacote; `default` = o curado. */
  origemDoConteudo: "turma" | "default";
  prompts: PromptPublico[];
  clausulas: ClausulaPublica[];
  promptsExigidos: number;
  concessaoDoBot: string;
  principiosEmDisputa: string;
  tags: Tag[];
  tagsExigidas: number;
  pisoDaJustificativa: number;
  tetoDaJustificativa: number;
  perguntaDaReflexao: string;
  insignia: string;
  podcast: { titulo: string; blocos: BlocoDoPodcast[] };
  delayDaGovernancaMs: number;
}

export interface Estado {
  passo: Passo;
  passoDoEstudante: Passo;
  aguardandoATurma: boolean;
  promptsEnviados: string[];
  totalAuditorias: number;
  cotaAtingida: boolean;
  faltamAuditorias: number;
  clausulaId: string | null;
  manifestoMarkdown: string | null;
  registrouPercurso: boolean;
  concluidoEm: string | null;
  turma: { etapa: Etapa };
}

export interface RespostaDoDisparo extends Estado {
  /** A defesa da máquina. Só existe AQUI, depois da pergunta. */
  replica: string;
}

export interface RespostaDaClausula extends Estado {
  manifestoMarkdown: string;
  /** O delay diegético que a tela tem de respeitar (não-negociável 2). */
  delayMs: number;
}

export interface RespostaSessao extends Estado {
  catalogo: CatalogoDaMissao;
  /** A conversa reconstituída — é o que faz o F5 devolver a tela exata. */
  falas: Fala[];
  percurso: { tags: string[]; justificativa: string } | null;
  estudante: { nome: string };
}

export interface RespostaDoGate {
  etapa: Etapa;
  passoEfetivo: Passo;
  /**
   * A tela está congelada esperando a turma? **Quem decide é o servidor.**
   *
   * Não deduza isto de `passoEfetivo !== passo`: parado no primeiro passo
   * congelado os dois são iguais, e a dedução deixa de congelar quem acabou de
   * ler o manifesto — que é quem o debate existe para reunir.
   */
  aguardandoATurma: boolean;
  /** O instante do SERVIDOR: o relógio da máquina da escola atrasa. */
  agora: string;
}

/**
 * Os códigos de erro que a TELA distingue.
 *
 * `dado-pessoal-no-texto` é o único que vem com status próprio (422) e por isso
 * é reconhecível sem ambiguidade — os 409 são ambíguos de propósito (o
 * Checkpoint A, o latch da cláusula e a missão concluída respondem o mesmo), e
 * quem sabe distinguir é a tela, que conhece o passo em que estava.
 */
export type CodigoErro =
  | "dado-pessoal-no-texto"
  | "conflito"
  | "payload-invalido"
  | "rede";
