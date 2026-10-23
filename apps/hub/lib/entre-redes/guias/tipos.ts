/**
 * O modelo do GUIA DA AULA — o material com que o professor conduz uma missão
 * do Entre Redes, do preparo ao fechamento.
 *
 * ## Por que é dado, e não uma página por missão
 *
 * O guia nasceu como uma página só, escrita à mão para o Instanooria: 447 linhas
 * de JSX em que conteúdo, ordem e marcação eram a mesma coisa. Replicar aquilo
 * por missão daria cinco arquivos que ninguém revisa juntos — e a seção que
 * alguém esquecesse de copiar simplesmente não existiria para aquela turma, sem
 * nenhum sinal.
 *
 * Aqui o guia é DADO e a ordem é do renderizador (`components/guia/`). Duas
 * consequências que valem o custo: seção que falta é campo que falta (o
 * TypeScript cobra, e `guias/index.test.ts` cobra o que o tipo não alcança), e
 * a ordem pedagógica — objetivos, preparo, roteiro, debate, mediação,
 * fechamento — é a mesma em toda missão, que é o que faz o professor achar a
 * informação no mesmo lugar na segunda missão que ele rodar.
 *
 * ## Os TEMPOS da aula (ADR-182)
 *
 * As nove seções se agrupam em quatro tempos — Preparar, Conduzir, Fechar,
 * Consultar —, e cada tempo é uma aba do guia (`TEMPOS_DO_GUIA`). O guia
 * corrido tinha 8 a 17 mil pixels de altura e 2,5 a 6,5 mil palavras numa
 * página só, e a queixa constante dos professores era "muita informação". Nada
 * saiu: o que mudou é que, na véspera, ele vê só o preparo, e na frente da
 * turma, só o roteiro, o debate e a mediação. O papel continua imprimindo os
 * quatro tempos, na ordem.
 *
 * ## O que NÃO vira dado
 *
 * O que tem fonte viva em outro lugar. A tabela dos momentos do Instanooria sai
 * de `CONTROLE_DO_PROFESSOR`, a revelação sai de `lib/insta/copy-da-revelacao.ts`
 * (cópia gêmea da que a exp08ef1b carrega — as duas mudam juntas), os
 * cartões da Vila do Lume vêm da api por turma, e o CONTEÚDO que a turma lê na
 * tela — os vieses do unooGPT, os vídeos do UnooTube e as intervenções do
 * Rastro do Boato — vem de uma rota `professor-only` de
 * cada módulo. Copiar qualquer um deles para
 * cá criaria a segunda cópia que diverge na primeira revisão de copy — e um
 * guia que projeta uma mensagem que ninguém recebeu põe a turma discutindo uma
 * aula que não aconteceu.
 *
 * **Descrever também é copiar.** O guia do UnooTube não guardava os vídeos:
 * guardava "metade cita fonte verificável, a outra metade é sensacionalista".
 * Nada obrigava a frase a concordar com o catálogo, e ela já não concordava —
 * são 11 e 10. Para isso existem os BLOCOS VIVOS: o renderizador
 * aceita `ReactNode` ancorado a uma seção, e a página da missão injeta o que só
 * ela sabe montar.
 */

import type { ReactNode } from "react";

/** Uma faixa de alerta no topo do guia — o que decide se a aula acontece. */
export interface AvisoDoGuia {
  /** `error` para o que causa dano se for ignorado; `warning` para o que trava a aula. */
  tom: "error" | "warning" | "info";
  titulo: string;
  texto: string;
}

/**
 * Os três eixos do Complemento de Computação à BNCC (homologado em out/2022).
 * As missões do Entre Redes vivem quase todas em Cultura Digital — o eixo
 * aparece na tela porque é ele que a coordenação procura no plano de curso.
 */
export type EixoDaComputacao = "Cultura Digital" | "Mundo Digital" | "Pensamento Computacional";

/**
 * Uma habilidade do Complemento de Computação à BNCC.
 *
 * `texto` é **verbatim** do documento oficial do MEC (*Computação na Educação
 * Básica — Complemento à BNCC*). Parafrasear aqui parece inofensivo e não é: o
 * professor cola esta linha no plano de aula que a coordenação confere contra o
 * documento, e uma palavra trocada vira apontamento na escola dele.
 *
 * Os códigos seguem a numeração real do complemento, que NÃO é a que se supõe
 * por analogia com a BNCC de linguagens: as habilidades de Computação são por
 * ano (`EF04CO08`, `EF07CO08`, `EF08CO11`) mais dois blocos plurianuais
 * (`EF15CO*` do 1º ao 5º, `EF69CO*` do 6º ao 9º) e `EM13CO*` no Médio.
 */
export interface HabilidadeDaComputacao {
  /** Ex.: `EF08CO11`. */
  codigo: string;
  /** O texto oficial da habilidade, sem cortes. */
  texto: string;
  eixo: EixoDaComputacao;
  /** A habilidade que a missão trabalha de frente. As demais são de apoio. */
  principal?: boolean;
  /** Onde, na missão, essa habilidade acontece de fato. Escrito por nós. */
  ondeAcontece: string;
}

/** Um passo do preparo — o título é o que se lê correndo os olhos. */
export interface PassoDePreparo {
  titulo: string;
  texto: string;
}

/** Uma linha do roteiro cronometrado da aula. */
export interface LinhaDoRoteiro {
  /** Minutos, no formato "0–5". Em missão de duas aulas, "Aula 2 · 0–5". */
  tempo: string;
  /** O que acontece na tela e na sala. */
  momento: string;
  /** O que VOCÊ faz e fala — a coluna que o guia antigo não tinha. */
  professor: string;
  /** O botão do painel que abre este momento, quando existe. */
  botao?: string;
}

/**
 * Os quatro níveis do banco de perguntas, na ordem em que se pergunta.
 *
 * Não é decoração: é a escada que leva do que aconteceu na tela ao que a
 * criança faz na vida dela. Pular direto para `transferencia` ("onde isso
 * acontece com você?") antes de a turma ter descrito o que viu produz a resposta
 * decorada que o professor já esperava ouvir — e a aula termina sem que ninguém
 * tenha olhado para o próprio comportamento.
 */
export type NivelDaPergunta = "retomada" | "analise" | "generalizacao" | "transferencia";

export const ROTULO_DO_NIVEL: Record<NivelDaPergunta, string> = {
  retomada: "Retomada — o que aconteceu",
  analise: "Análise — por que aconteceu",
  generalizacao: "Generalização — o que isso quer dizer",
  transferencia: "Transferência — e na sua vida",
};

export interface PerguntaDeDebate {
  nivel: NivelDaPergunta;
  pergunta: string;
  /** O que você está caçando com ela. Sem isto o professor lê a pergunta e não sabe o que fazer com a resposta. */
  porQue: string;
}

/**
 * Uma intervenção de mediação: a situação que VAI acontecer e o que fazer.
 *
 * Escritas a partir do que cada missão produz de previsível — a turma que
 * acerta cedo demais, a criança que ri de ter caído, a sala que conclui "então
 * rede social é ruim". São essas as horas em que a aula descarrila, e são as
 * únicas em que um guia serve para alguma coisa no meio de 30 adolescentes.
 */
export interface Intervencao {
  /** "Se a turma disser…", "Quando alguém…" */
  quando: string;
  faca: string;
  /** O erro simétrico — o que a vontade de resolver rápido manda fazer. */
  naoFaca?: string;
}

/**
 * A folha de observação: o que marcar ao lado do nome de cada estudante
 * ENQUANTO a aula acontece.
 *
 * É avaliação formativa de verdade, e não a nota do produto final: a Vila do
 * Lume só se lê assim (o jogo não pontua nada de propósito), e nas outras
 * missões ela é o que distingue quem participou de quem repetiu o colega.
 */
export interface FolhaDeObservacao {
  intro: string;
  marcas: Array<{ letra: string; texto: string }>;
  nota?: string;
}

/** Um critério da rubrica, em três níveis. Sempre sobre a ANÁLISE, nunca sobre o desempenho na ficção. */
export interface CriterioDaRubrica {
  criterio: string;
  emDesenvolvimento: string;
  adequado: string;
  avancado: string;
}

export interface Adaptacao {
  /** "50 minutos em vez de 100", "turma sem fone", "leitura em formação". */
  contexto: string;
  comoAdaptar: string;
}

export interface DuvidaFrequente {
  pergunta: string;
  resposta: string;
}

/**
 * As seções do guia, na ordem em que são renderizadas. É a chave das âncoras e dos blocos vivos.
 *
 * `cuidados` vem logo depois do preparo, e não no fim: é o que se lê ANTES da
 * aula (a seção leva o selo "leia antes"), e no fim do documento ela ficava
 * depois da rubrica, onde ninguém chega na véspera.
 */
export const SECOES_DO_GUIA = [
  "objetivos",
  "antes",
  "cuidados",
  "roteiro",
  "debate",
  "mediacao",
  "depois",
  "adaptacoes",
  "duvidas",
] as const;

export type SecaoDoGuia = (typeof SECOES_DO_GUIA)[number];

/**
 * Os quatro TEMPOS da aula — as abas do guia, na ordem em que o professor os
 * vive. Cada seção mora em exatamente um tempo (`guias/index.test.ts` cobra).
 *
 * O tempo é a pergunta que o professor traz quando abre o guia: "o que eu
 * preparo?", "o que eu faço agora, na frente da turma?", "como eu fecho?". Um
 * documento corrido obrigava a achar a resposta rolando por todas as outras.
 */
export const TEMPOS_DO_GUIA = [
  {
    id: "preparar",
    rotulo: "Preparar",
    quando: "Na véspera",
    icone: "checklist",
    secoes: ["objetivos", "antes", "cuidados"],
  },
  {
    id: "conduzir",
    rotulo: "Conduzir",
    quando: "Na frente da turma",
    icone: "co_present",
    secoes: ["roteiro", "debate", "mediacao"],
  },
  {
    id: "fechar",
    rotulo: "Fechar",
    quando: "No fim e depois",
    icone: "flag",
    secoes: ["depois"],
  },
  {
    id: "consultar",
    rotulo: "Consultar",
    quando: "Quando precisar",
    icone: "help",
    secoes: ["adaptacoes", "duvidas"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  rotulo: string;
  quando: string;
  /** Glifo do Material Symbols — identificador, não texto (ADR-91). */
  icone: string;
  secoes: readonly SecaoDoGuia[];
}>;

export type TempoDoGuia = (typeof TEMPOS_DO_GUIA)[number]["id"];

/**
 * Um bloco que o guia NÃO guarda como texto: ele é montado pela página da
 * missão (de uma fonte viva) e ancorado logo depois de uma seção.
 */
export type BlocosVivos = Partial<Record<SecaoDoGuia, ReactNode>>;

export interface GuiaDaAula {
  /** A missão a que este guia pertence — a chave do registro em `guias/index.ts`. */
  expId: string;
  /** O que este guia cobre, em duas linhas, logo abaixo do título. */
  chamada: string;
  avisos?: AvisoDoGuia[];
  /** O que o estudante deve sair sabendo FAZER. Verbo no infinitivo, um por linha. */
  objetivos: string[];
  bncc: HabilidadeDaComputacao[];
  antes: {
    tecnico: PassoDePreparo[];
    pedagogico: PassoDePreparo[];
    /** O que não pode ser dito antes da hora — e é o que a vontade de explicar manda dizer. */
    naoDiga: string[];
  };
  roteiro: {
    /** "2 aulas · 100 min", "1 aula · 50 min". */
    total: string;
    linhas: LinhaDoRoteiro[];
    nota?: string;
  };
  debate: {
    /** A pergunta que vai para a lousa, sozinha. */
    aberturaNaLousa: string;
    /** Quanto tempo o debate precisa, e por quê. */
    tempo: string;
    perguntas: PerguntaDeDebate[];
  };
  observacao: FolhaDeObservacao;
  mediacao: Intervencao[];
  depois: {
    /**
     * As duas ou três frases que a turma leva da aula — ditas em voz alta por
     * você, no fim.
     *
     * É uma seção e não um comentário porque a síntese é a parte que mais se
     * perde: a aula acaba no horário, a turma sai, e o que aconteceu na tela
     * nunca vira uma frase que alguém consiga repetir em casa.
     */
    sintese: string[];
    /** O registro individual que fecha a aula. */
    registro: string;
    /** O entregável, quando a missão pede um. */
    produto?: { titulo: string; itens: string[] };
    rubrica: { nota: string; criterios: CriterioDaRubrica[] };
    /** Como levar isto para dentro da sua disciplina na aula seguinte. */
    desdobramentos: string[];
  };
  cuidados: string[];
  adaptacoes: Adaptacao[];
  duvidas: DuvidaFrequente[];
}
