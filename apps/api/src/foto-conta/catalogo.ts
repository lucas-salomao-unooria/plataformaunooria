/**
 * exp01ef1b — o catálogo autoral da missão.
 *
 * Missão do 1º ano EF no mural da turma (clone do Instagram, seção
 * `instanooria` do DS): a criança escolhe UM enquadramento e UMA legenda,
 * publica, e descobre pelos comentários dos colegas simulados que o pedaço
 * que ela escolheu mostrar mudou a história que a foto conta.
 *
 * O que mora aqui e NUNCA cruza a fronteira do cliente antes da hora:
 * - `COMENTARIOS` do pacote (a matriz causal): entregue SÓ depois de publicar,
 *   e só a linha do par escolhido. A matriz inteira no bundle deixaria a
 *   "surpresa" legível antes da postagem (bloco 8 do handoff).
 * - `GABARITO_REFLEXAO`: a síntese certa da Etapa 6. O cliente manda a escolha
 *   e a api responde se conclui ou se é retry formativo (regra inviolável 3 —
 *   aqui não há nota, mas o que vale registro decide-se no servidor).
 */

/** Tem de bater com o `id` do `public/experiencia.json` — divergir faz a
 *  missão nunca abrir, com a liberação gravada (ADR-69). */
export const EXP_ID = "exp01ef1b";

/** Gravada em toda run e no payload analítico (DAD-06: subir a versão nunca
 *  reprocessa dado legado). */
export const VERSAO_INSTRUMENTO = "1.0.0";

/* ----------------------------- vocabulários ------------------------------ */

export const MARCAS = ["coruja", "estrela", "sol"] as const;
export type MarcaId = (typeof MARCAS)[number];

export const TEMAS = ["recreio", "nossa_horta", "sala_de_aula", "parquinho"] as const;
export type Tema = (typeof TEMAS)[number];

export const COMPLEXIDADES = ["nivel_1", "nivel_2"] as const;
export type Complexidade = (typeof COMPLEXIDADES)[number];

/** Ordem canônica das etapas da run. `roda` é o latch síncrono da Etapa 5:
 *  ninguém sai dele sem o professor liberar a turma. */
export const ETAPAS = [
  "desafiar",
  "feed",
  "decidir",
  "aha",
  "roda",
  "refletir",
  "concluida",
] as const;
export type Etapa = (typeof ETAPAS)[number];

/* ------------------------------- o pacote -------------------------------- */

/** Um post do feed de exploração (Etapa 2). A foto é asset do BUNDLE da
 *  experiência, referenciada por id — a api nunca serve binário. */
export interface PostDoFeed {
  id: string;
  fotoId: string;
  legenda: string;
}

export interface LegendaDoPar {
  id: "legenda_1" | "legenda_2";
  texto: string;
  /** Pictograma do card (redundância tripla texto+ícone+áudio do 1º EF). */
  icone: "bloco" | "vassoura";
}

/** Uma linha da matriz causal: o que Leo e Sofia dizem para UM par
 *  (foto, legenda). `audioLeo`/`audioSofia` são ids de asset do bundle; num
 *  pacote gerado por IA não há áudio gravado e os campos ficam ausentes — o
 *  cliente mostra só o balão. */
export interface ComentariosDoPar {
  fotoId: string;
  legendaId: string;
  leo: string;
  sofia: string;
  audioLeo?: string;
  audioSofia?: string;
}

/** O pacote COMPLETO de uma aula — o que `exp01ef1b_turma_config.pacote` guarda.
 *  A parte pública (sem `comentarios`) é o que a rota do estudante devolve. */
export interface PacoteDaTurma {
  tema: Tema;
  feed: PostDoFeed[];
  /** O par decisório: A é sempre o PLANO GERAL, B o PLANO DETALHE. */
  par: { fotoAId: string; fotoBId: string };
  legendas: [LegendaDoPar, LegendaDoPar];
  comentarios: ComentariosDoPar[];
}

/**
 * O banco curado padrão — "O Mistério das Peças no Pátio".
 *
 * É o fallback OBRIGATÓRIO (bloco 9 da spec): sem professor configurando, sem
 * IA ou com a IA falhando, a aula abre com este pacote, inteiro e autoral.
 *
 * Os `fotoId` apontam para os assets do bundle da experiência
 * (`public/fotos/<id>.webp`). Hoje só o tema `recreio` tem fotografias
 * produzidas (brief de assets, fases 1-2); pacote de outro tema gerado por IA
 * reusa as fotos do recreio até o banco de imagens dos demais temas existir —
 * pendência declarada no relatório, não regra escondida.
 */
export const PACOTE_PADRAO: PacoteDaTurma = {
  tema: "recreio",
  feed: [
    { id: "post_1", fotoId: "gato", legenda: "O GATO DA ESCOLA DORMINDO!" },
    { id: "post_2", fotoId: "corrida", legenda: "HORA DA CORRIDA NO PÁTIO!" },
    { id: "post_3", fotoId: "lanche", legenda: "NOSSO LANCHE GOSTOSO DE HOJE!" },
  ],
  par: { fotoAId: "par_a", fotoBId: "par_b" },
  legendas: [
    { id: "legenda_1", texto: "OLHA O BRINQUEDO QUE A GENTE FEZ!", icone: "bloco" },
    { id: "legenda_2", texto: "O PÁTIO ESTÁ CHEIO DE COISAS!", icone: "vassoura" },
  ],
  // A matriz causal do Aha (brief de assets, seção E): determinística por par,
  // com os cruzamentos produzindo estranhamento cômico de propósito.
  comentarios: [
    {
      fotoId: "par_b",
      legendaId: "legenda_1",
      leo: "EU SÓ VI O BRINQUEDO!",
      sofia: "NEM DÁ PRA VER O PÁTIO!",
      audioLeo: "aud_e4_feedback_leo_b1",
      audioSofia: "aud_e4_feedback_sofia_b1",
    },
    {
      fotoId: "par_a",
      legendaId: "legenda_2",
      leo: "NOSSA, QUANTA COISA NO CHÃO!",
      sofia: "PARECE QUE NINGUÉM ARRUMOU NADA!",
      audioLeo: "aud_e4_feedback_leo_a2",
      audioSofia: "aud_e4_feedback_sofia_a2",
    },
    {
      fotoId: "par_b",
      legendaId: "legenda_2",
      leo: "CADÊ AS COISAS DO CHÃO?",
      sofia: "EU SÓ ACHEI O BRINQUEDO!",
      audioLeo: "aud_e4_feedback_leo_b2",
      audioSofia: "aud_e4_feedback_sofia_b2",
    },
    {
      fotoId: "par_a",
      legendaId: "legenda_1",
      leo: "ONDE ESTÁ O BRINQUEDO?",
      sofia: "TEM MUITA COISA ESPALHADA AQUI!",
      audioLeo: "aud_e4_feedback_leo_a1",
      audioSofia: "aud_e4_feedback_sofia_a1",
    },
  ],
};

/* --------------------------- reflexão (Etapa 6) --------------------------- */

export const OPCOES_REFLEXAO = ["lupa", "globo"] as const;
export type OpcaoReflexao = (typeof OPCOES_REFLEXAO)[number];

/** A síntese que CONCLUI. Vive aqui, nunca no bundle: o cliente descobre pela
 *  resposta da api se celebra ou se ouve o retry gentil de Nina. */
export const GABARITO_REFLEXAO: OpcaoReflexao = "lupa";

/* ------------------------- material do professor -------------------------- */

/** As 3 perguntas norteadoras da Roda de Conversa (copy final, passada 2).
 *  Vão à projeção da lousa pela api — cópia no hub divergiria do guia. */
export const PERGUNTAS_DA_RODA = [
  "Quem escolheu a foto do brinquedo bem de perto, o que queria que todo mundo visse primeiro?",
  "Se uma pessoa que nunca veio na nossa escola olhar só a foto do chão espalhado, o que ela vai pensar do nosso recreio?",
  "A câmera fotográfica consegue mostrar tudo o que existe ou ela só mostra o pedaço que a gente escolheu?",
] as const;

/** Rótulos da projeção comparativa (E5-PROF-01). B é o detalhe ("no meio"),
 *  A é o plano geral ("de fora"). */
export const ROTULOS_DA_PROJECAO = {
  meio: "O QUE FICOU NO MEIO?",
  fora: "O QUE FICOU DE FORA?",
} as const;

/** Depois de quantos ms sem interação na tela de decisão o estudante entra na
 *  lista de hesitação do painel (> 60s, bloco 8 da spec). */
export const HESITACAO_MS = 60_000;
