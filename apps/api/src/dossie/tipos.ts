/** doc 11 §3.1 — tempo, em milissegundos (a formatação é da UI). */
export interface TempoDaSessao {
  sessaoMs: number;
  feedMs: number;
  ativoMs: number;
  ociosoMs: number;
  vaosOciosos: number;
  porLadoMs: { A: number; B: number; neutro: number };
  porPerfilMs: Record<string, number>;
}

/** doc 11 §3.2 */
export interface Ritmo {
  postsPorMinuto: number;
  /** Coeficiente de variação dos intervalos: baixo = fluxo, alto = errático. */
  variacaoDoRitmo: number;
}

export interface ComponenteDeImersao {
  chave: 'continuidade' | 'atencao' | 'gestos' | 'voluntariedade' | 'exploracao';
  rotulo: string;
  /** 0–20. */
  pontos: number;
  detalhe: string;
}

/**
 * doc 11 §3.3 — índice 0–100. O total nunca aparece sem os componentes: é a
 * regra escrita no doc, e vale para o relatório, o monitor e a análise.
 */
export interface Imersao {
  total: number;
  componentes: ComponenteDeImersao[];
}

/** doc 11 §3.4 */
export interface Investigacao {
  usosDaBusca: number;
  termosBuscados: string[];
  postsPelaBusca: number;
  comentariosLidos: number;
  revisitas: number;
  perdasDeFoco: number;
  coberturaDosLados: { A: { posts: number; segundos: number }; B: { posts: number; segundos: number } };
  /** Posts do lado oposto ao semeado em que ele realmente parou (dwellNorm ≥ 2.2). */
  consideracaoDoOposto: number;
}

/** doc 11 §3.5 */
export interface Bolha {
  ladoInicial: 'A' | 'B';
  /** perfil | sorteio | redistribuido — é o que a explicabilidade precisa saber. */
  ladoOrigem: string;
  inverteu: boolean;
  blocoDaInversao: number | null;
}

/** doc 11 §3.6 — o perfil que o feed observou, normalizado pela exposição. */
export interface PerfilObservado {
  normalizado: Record<string, number>;
  dominante: string | null;
  margem: number;
  veredito: 'reforcou' | 'divergiu' | 'sem_referencia';
}

/**
 * Rótulos prontos para a UI. Ficam no payload em vez de o cliente importar as
 * FICHAS: elas carregam vocabulário e forma narrativa dos prompts, que não têm
 * por que viajar até o navegador.
 */
export interface RotuloDePerfil {
  chave: string;
  rotulo: string;
  /** O que costuma prender a atenção de quem tem esse perfil (doc 10 §3). */
  prende: string;
}

/**
 * A explicabilidade do lado semeado (doc 02 fase 6 §2). O "por quê" do eixo vem
 * da IA e é validado pelo professor (`afinidade.por_que_*`); o resto é derivado.
 */
export interface ExplicacaoDoLado {
  /** Rótulo humano do perfil do jogo, ou null quando não houve perfil. */
  perfilRotulo: string | null;
  ladoRotulo: string;
  /** A justificativa do eixo, escrita pela IA e aprovada pelo professor. */
  porQue: string | null;
  /** perfil | sorteio | redistribuido — muda a frase inteira, não só um trecho. */
  origem: string;
}

/**
 * Versão do cômputo do relatório. Sobe quando o cálculo muda de forma que um
 * dossiê já congelado ficaria **errado** (não só incompleto) — a leitura
 * recomputa sozinha. Só é seguro porque a run congelada não muda mais.
 *
 * 1 → dossiê pré-M8 (8 seções).
 * 2 → M8: seções novas + correção do envelope de `perfil_jogo`, que fazia todo
 *     estudante com perfil ser lido como `misto`.
 * 3 → M8: `blocoDaInversao` pelo acumulado (bloco-cauda apagava a virada) e o
 *     "por quê" do lado passa a ser o do PERFIL do estudante, não o do polo nomeado
 *     do eixo — antes um estudante de Conservação lia a justificativa da Abertura,
 *     que defende o lado contrário ao dele.
 * 4 → `postsOcultados` passa a ser contado pela EXPOSIÇÃO e não pelo domínio
 *     (ADR-42): nos estudantes que viraram o jogo, o relatório do professor contava
 *     os posts do lado que o algoritmo estava EMPURRANDO neles, e divergia do
 *     número que a criança lia na tela. E a janela do tempo passa a terminar com
 *     o feed (ADR-44), o que devolve a imersão que derretia durante a aula.
 *     Os dois exigem RECOMPUTAR o que está congelado — é o que a versão faz.
 */
export const VERSAO_DO_RELATORIO = 4;

/** Shape do dossiê (doc 06). */
export interface DossierData {
  /** Ausente nos dossiês congelados antes do M8. */
  versaoDoRelatorio?: number;
  estudante: { displayName: string; avatar: string };
  atividade: { titulo: string; perguntaChave: string; ladoALabel: string; ladoBLabel: string };
  proporcaoFinal: { A: number; B: number; neutro: number };
  ladoDominante: 'A' | 'B' | 'indefinido';
  dominio: number;
  porBloco: { bloco: number; A: number; B: number; neutro: number; intensidadeMediaDominante: number }[];
  topDwell: { postId: string; dwellMs: number }[];
  postsOcultados: {
    ladoOposto: string[];
    total: number;
    /** Sem post de tese servido: não há lado a nomear, e 0 mentiria (ADR-42). */
    ladoNaoObservado: boolean;
  };
  interacoes: {
    curtidas: number;
    comentarios: number;
    salvos: number;
    compartilhados: number;
    seguidos: number;
    naoInteressa: number;
  };
  sinais: { sinal: string; valorSessao: string; contribuicao: number }[];
  studentPost?: { texto: string; ladoInferido: string };
  /**
   * A conclusão escrita da missão (doc 02 fase 4). Anexada na LEITURA, não no
   * congelamento: o dossiê é computado no `finish`, antes de o estudante escrever.
   * `undefined` quando a sessão foi interrompida — e o relatório precisa
   * funcionar assim (doc 02 fase 4).
   */
  conclusao?: { inclinacao: 'A' | 'B' | 'duvida'; texto: string | null; escritaEm: string };

  // ---- doc 02 fase 6, seções novas do M8 ----
  /** O lado em que o feed nasceu, e de onde essa decisão veio (doc 04 §3.1). */
  bolha: Bolha;
  /** Por que o feed começou desse lado — a seção nova mais importante. */
  explicacaoDoLado: ExplicacaoDoLado;
  /** O perfil que o Ato 1 mediu. `null` quando o jogo não integrou. */
  perfilJogo: { escores: Record<string, number>; dominante: string; origem: string } | null;
  perfilObservado: PerfilObservado;
  /** Rótulo e "o que prende" de cada um dos 4 perfis, para o relatório escrever. */
  rotulosDePerfil: RotuloDePerfil[];
  tempo: TempoDaSessao;
  ritmo: Ritmo;
  investigacao: Investigacao;
  imersao: Imersao;
}

/** Post que o dossiê mostra — aqui o disfarce já caiu, então lado pode aparecer. */
export interface PostDoDossie {
  id: string;
  lado: string;
  intensidade: number;
  caption: string;
  imageUrl: string | null;
  /** O texto alternativo da imagem gerada, ou `null` (ADR-163). */
  imageAlt: string | null;
  imageStatus: string;
  categoria: string;
  handle: string;
  fallbackArt: { corFundo: string; emojis: string };
}

export interface RespostaDossie {
  dossie: DossierData;
  posts: {
    topDwell: (PostDoDossie & { dwellMs: number; segundos: number })[];
    ocultados: PostDoDossie[];
  };
}
