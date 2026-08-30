/**
 * Shapes de LEITURA da análise — exatamente o que a api NestJS devolve em
 * `GET /atividades/:id/analise`, `GET /analise/resumo` e
 * `GET /analise/atividades/:id`.
 *
 * Cópia dos tipos do projeto origem, com os comentários que explicam POR QUE
 * cada número existe — são eles que as telas transformam em legenda:
 * - `lib/analise/metricas.ts` → MetricasDaRun
 * - `lib/analise/turma.ts`    → Celula / AnaliseDaTurma
 * - `lib/analise/produto.ts`  → ResumoDeAtividade / EficaciaDaEscrita / AnaliseDeProduto
 * - `lib/dossie/tipos.ts`     → Bolha, TempoDaSessao, Ritmo, Imersao,
 *                               Investigacao, PerfilObservado
 *
 * Uma diferença deliberada em relação ao servidor: os campos que lá são `Date`
 * chegam aqui como STRING (JSON não tem data). Nenhuma tela de análise os
 * formata hoje; quando formatar, é `new Date(...)` na borda.
 */

/* ------------------------------------------------------------------ */
/* lib/dossie/tipos.ts                                                */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* lib/analise/metricas.ts                                            */
/* ------------------------------------------------------------------ */

/**
 * Métricas por run, **derivadas** — nunca persistidas (doc 11 §6).
 *
 * Recalcular a partir de `events` custa pouco (uma turma tem ~40 runs de algumas
 * centenas de eventos) e evita a pior armadilha de analytics: número gravado que
 * ninguém sabe mais como foi computado. Quando a definição de "tempo ativo" muda,
 * muda em um lugar — `lib/dossie/telemetria.ts` — e as três superfícies
 * (relatório do estudante, análise do professor, análise de produto) concordam.
 */
export interface MetricasDaRun {
  runId: string;
  estudante?: { username: string; displayName: string };
  aluno: { username: string; displayName: string };
  fase: string;
  /** `Date` no servidor, string no JSON. */
  iniciadaEm: string;
  encerradaEm: string | null;

  /** Perfil do Ato 1, renormalizado no servidor (doc 10 §4). */
  perfilJogo: { dominante: string; origem: string } | null;
  perfilObservado: PerfilObservado;

  bolha: Bolha;
  ladoDominante: 'A' | 'B' | 'indefinido';
  dominio: number;
  postsConsumidos: number;
  blocos: number;
  /** Escada de intensidade destravada por lado (doc 11 §3.5). */
  escada: { A: number; B: number };

  tempo: TempoDaSessao;
  ritmo: Ritmo;
  imersao: Imersao;
  investigacao: Investigacao;

  interacoes: {
    curtidas: number;
    comentarios: number;
    salvos: number;
    compartilhados: number;
    seguidos: number;
    naoInteressa: number;
    publicou: boolean;
  };

  /**
   * A COLEÇÃO do estudante — os posts que ele salvou, que no fluxo v2 são o artefato
   * da missão e o material do debate.
   *
   * Diferente de `interacoes.salvos`, que conta eventos: aqui o último evento por
   * post decide, então salvar e dessalvar se anulam. Sem isso a coleção mostrada
   * ao professor estaria maior que a real.
   */
  colecao: {
    total: number;
    doLadoSemeado: number;
    doOutroLado: number;
    neutros: number;
    comentados: number;
  };

  /**
   * No fluxo v2 a conclusão é só a escolha de um lado — `texto` fica nulo. O
   * texto livre virou a REFLEXÃO do fim, que é sobre a atividade (letramento
   * digital), não sobre a pergunta-chave.
   */
  conclusao: {
    inclinacao: 'A' | 'B' | 'duvida';
    /** A PRIMEIRA escolha — `null` nas respostas anteriores a guardá-la. */
    inclinacaoInicial: 'A' | 'B' | 'duvida' | null;
    trocas: number;
    texto: string | null;
    caracteres: number;
  } | null;
  /** O fechamento escrito da atividade, sem limite de caracteres. */
  reflexao: { texto: string; caracteres: number } | null;

  /**
   * Há quanto tempo o estudante não gera evento nenhum. É o número que faz o
   * professor levantar da cadeira — e por isso é `null` quando a run já acabou:
   * ninguém precisa ser cutucado por estar "ocioso" num relatório.
   */
  ociosoHaMs: number | null;
}

/* ------------------------------------------------------------------ */
/* lib/analise/turma.ts                                               */
/* ------------------------------------------------------------------ */

/**
 * Agregados de uma turma — o nível PEDAGÓGICO (doc 11 §4).
 *
 * A peça central é a tabela `conclusão × lado semeado`. Se o lado em que o feed
 * nasceu prevê a conclusão que o estudante escreveu, o resultado experimental da
 * turma está nessa grade — e é ela que o professor projeta no momento-espelho
 * (doc 09). Tudo o mais nesta tela existe para explicar essa grade.
 */
export interface Celula {
  A: number;
  duvida: number;
  B: number;
}

export interface AnaliseDaTurma {
  atividade: { id: string; titulo: string; perguntaChave: string; ladoALabel: string; ladoBLabel: string };

  /** A tabela que vale a aula: linhas = lado semeado, colunas = conclusão. */
  conclusaoPorLadoSemeado: { semeadoEmA: Celula; semeadoEmB: Celula };

  /**
   * Quantos concluíram no mesmo lado em que o feed nasceu, sobre quem concluiu
   * com lado (a dúvida não conta nem a favor nem contra).
   */
  poderDoViesSemeado: {
    seguiram: number;
    viraram: number;
    emDuvida: number;
    taxa: number | null;
    /** Quantos mexeram na resposta depois de escolher a primeira vez. */
    trocaramDeIdeia: number;
    /** E quantos, desses, acabaram num lado diferente do que escolheram de cara. */
    terminaramNoutroLado: number;
  };

  turma: {
    total: number;
    naMissao: number;
    concluiram: number;
    semConcluir: { username: string; displayName: string; fase: string }[];
    inverteram: { username: string; displayName: string; de: string; para: string; bloco: number | null }[];
  };

  /** Distribuição do lado semeado e de onde ele veio — auditoria da largada. */
  largada: { porLado: { A: number; B: number }; porOrigem: Record<string, number> };

  busca: { usaram: number; naoUsaram: number; termos: string[] };

  imersao: {
    media: number | null;
    porComponente: { chave: string; rotulo: string; media: number }[];
  };

  estudantes?: MetricasDaRun[];
  alunos: MetricasDaRun[];
}

/* ------------------------------------------------------------------ */
/* lib/analise/produto.ts                                             */
/* ------------------------------------------------------------------ */

/**
 * Nível de PRODUTO (doc 11 §5) — o que a Unooria olha para saber se a atividade
 * funciona, não se a turma aprendeu.
 */
export interface ResumoDeAtividade {
  id: string;
  titulo: string;
  status: string;
  /** `Date` no servidor, string no JSON. */
  criadaEm: string;
  runs: number;
  concluidas: number;

  imersao: { media: number | null; porComponente: Record<string, number> };
  tempoMedioDeFeedMs: number | null;
  taxaDeInversao: number | null;
  /** P(conclusão = lado semeado): o poder do viés que a plataforma plantou. */
  poderDoViesSemeado: number | null;
  descobertaDaBusca: number | null;
  /** Posts aprovados que nunca foram servidos a ninguém. */
  conteudoMorto: { posts: number; total: number; fracao: number | null };
  taxaDeImagensOk: number | null;
}

/**
 * A métrica que valida — ou refuta — a premissa do projeto (doc 11 §5.2).
 *
 * `delta` = dwell médio dos posts do perfil P entre estudantes de perfil P
 *           menos o dwell médio dos MESMOS posts entre estudantes de outro perfil.
 *
 * Sempre com a exposição no denominador (doc 04 §7): sem isso, mediria o próprio
 * viés do feed — que serve mais posts do perfil do estudante — e "confirmaria" a
 * premissa por construção.
 *
 * Se o delta for consistentemente positivo, as fichas de linguagem do doc 10 §3
 * funcionam. **Se for zero, elas não funcionam** — e a gente descobre com número
 * em vez de achismo. Nenhuma outra métrica do sistema é capaz disso.
 */
export interface EficaciaDaEscrita {
  perfil: string;
  rotulo: string;
  /** Segundos por post, entre estudantes DESTE perfil. */
  dwellDosDoPerfil: number | null;
  /** Segundos por post, entre estudantes de OUTROS perfis. */
  dwellDosOutros: number | null;
  delta: number | null;
  amostra: { estudantesDoPerfil?: number; alunosDoPerfil: number; estudantesDeOutros?: number; alunosDeOutros: number };
}

export interface AnaliseDeProduto {
  atividade: { id: string; titulo: string; status: string };
  resumo: ResumoDeAtividade;
  eficaciaDaEscrita: EficaciaDaEscrita[];
  /** Média dos deltas com amostra suficiente — o veredito em um número. */
  eficaciaMedia: number | null;
}
