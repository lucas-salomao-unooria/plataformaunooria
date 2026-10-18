/**
 * As etapas da missão e a regra que reconcilia **a turma** com **o estudante**.
 *
 * O fluxo v2 tem dois relógios:
 *
 * - `activities.etapa` — o relógio da TURMA, que o professor controla. É o que
 *   permite dizer "agora é debate" e travar 30 telas de uma vez.
 * - `runs.fase` — a tela daquele estudante. Dentro de um mesmo momento os estudantes
 *   andam em ritmos diferentes: um ainda lê a explicabilidade enquanto o outro já
 *   está olhando os posts perdidos.
 *
 * A função `faseEfetiva` resolve os dois num só valor, e ela mora aqui — pura e
 * testável — porque tanto a API quanto a renderização do servidor precisam
 * chegar à MESMA resposta. Duas implementações divergentes disso significariam a
 * tela do estudante discordando do que o servidor acha que ele está vendo.
 */

/** Etapas da turma, na ordem em que o professor as abre. */
export const ETAPAS_DA_TURMA = [
  'investigacao',
  'conclusao',
  'debate',
  'explicabilidade',
  'perdidos',
  'reflexao',
  'fim',
] as const;

export type EtapaDaTurma = (typeof ETAPAS_DA_TURMA)[number];

/** Fases da run, na ordem em que o estudante as percorre. */
export const FASES_DA_RUN = [
  'onboarding',
  'feed',
  'encerramento',
  'conclusao',
  'debate',
  'explicabilidade',
  'perdidos',
  'reflexao',
  'fim',
] as const;

export type FaseDaRun = (typeof FASES_DA_RUN)[number];

/** Onde cada etapa da turma coloca, no mínimo, a tela do estudante. */
const PISO_DA_ETAPA: Record<EtapaDaTurma, FaseDaRun> = {
  investigacao: 'onboarding',
  conclusao: 'conclusao',
  debate: 'debate',
  explicabilidade: 'explicabilidade',
  perdidos: 'perdidos',
  reflexao: 'reflexao',
  fim: 'fim',
};

const ordemDaFase = (fase: FaseDaRun) => FASES_DA_RUN.indexOf(fase);

export function ehFaseDaRun(valor: string): valor is FaseDaRun {
  return (FASES_DA_RUN as readonly string[]).includes(valor);
}

/**
 * Fases de runs congeladas antes do fluxo v2. `revelacao` e `dossie` eram duas
 * telas separadas; hoje são um passo interno da `explicabilidade`.
 */
const LEGADAS: Record<string, FaseDaRun> = {
  revelacao: 'explicabilidade',
  dossie: 'explicabilidade',
  comparacao: 'perdidos',
};

/**
 * Traduz qualquer valor de `runs.fase` para uma fase conhecida.
 *
 * Existe porque o fallback ingênuo era `'onboarding'` — e uma run legada em
 * `dossie` fazia o estudante ser **expulso para o seletor de avatar** no meio da
 * explicabilidade. Fase desconhecida agora vira a fase equivalente, não o começo.
 */
export function normalizarFase(valor: string): FaseDaRun {
  if (ehFaseDaRun(valor)) return valor;
  return LEGADAS[valor] ?? 'onboarding';
}

export function ehEtapaDaTurma(valor: string): valor is EtapaDaTurma {
  return (ETAPAS_DA_TURMA as readonly string[]).includes(valor);
}

/**
 * A tela que o estudante deve ver, dada a fase dele e a etapa da turma.
 *
 * Duas regras, e a diferença entre elas é o ponto pedagógico:
 *
 * 1. **A etapa é PISO, não teto.** O estudante pode estar à frente da turma —
 *    terminou de ler a explicabilidade e já foi ver os posts perdidos. Puxá-lo de
 *    volta seria punir quem leu mais rápido.
 * 2. **`debate` é EXCEÇÃO: trava.** No debate a turma tem de estar na mesma tela,
 *    olhando os próprios posts salvos, porque a conversa é entre pares. Quem
 *    estava adiantado volta; quem estava atrasado avança.
 *
 * `onboarding` é preservado **só enquanto a turma investiga**. Depois disso ele é
 * arrastado junto: quem não tocou em "entrar" ficaria para sempre no seletor de
 * avatar enquanto a aula inteira segue — e uma tela de escolher figurinha, no
 * meio do debate, é pior que a tela do momento com a coleção vazia. O painel do
 * professor conta quantos estão nessa situação, e a análise registra que eles não
 * investigaram.
 */
export function faseEfetiva(faseDaRun: FaseDaRun, etapa: EtapaDaTurma): FaseDaRun {
  if (faseDaRun === 'onboarding' && etapa === 'investigacao') return 'onboarding';
  if (etapa === 'debate') return 'debate';

  const piso = PISO_DA_ETAPA[etapa];
  return ordemDaFase(faseDaRun) >= ordemDaFase(piso) ? faseDaRun : piso;
}

/**
 * O estudante já soube que o feed dele era enviesado?
 *
 * A revelação é o único acontecimento IRREVERSÍVEL da missão: depois dela a
 * criança sabe o que o instrumento media, e uma segunda passagem pelo feed não
 * mede mais a mesma coisa. `explicabilidade` é a fase que a abre — e
 * `normalizarFase` já traduz as duas fases legadas (`revelacao`, `dossie`) para
 * ela, então comparar a ordem basta.
 */
export function jaViuARevelacao(faseDaRun: FaseDaRun): boolean {
  return ordemDaFase(faseDaRun) >= ordemDaFase('explicabilidade');
}

/**
 * A fase quando o professor **volta** um momento.
 *
 * Aqui a etapa é TETO, não piso — o oposto de `faseEfetiva`. E é o oposto de
 * propósito: "piso, não teto" existe para não punir quem leu mais rápido *dentro*
 * do momento que o professor liberou. Voltar é outra intenção: o professor
 * adiantou sem querer, ou quer refazer um momento com a turma. Se a regra do piso
 * valesse aqui também, "voltar um momento" mudaria o rótulo no painel e **nada**
 * na tela dos estudantes.
 *
 * Foi exactamente o que aconteceu na primeira turma real: a aula foi para o
 * debate por engano, voltar não trouxe ninguém, e a resposta de todo mundo passou
 * a ser recusada com 409 — porque a run seguia em `debate` e a rota da resposta só
 * aceita `conclusao`.
 *
 * `onboarding` continua preservado: quem nunca entrou no aparelho não tem para
 * onde voltar.
 */
export function faseAoVoltar(faseDaRun: FaseDaRun, etapa: EtapaDaTurma): FaseDaRun {
  if (faseDaRun === 'onboarding') return 'onboarding';
  if (etapa === 'debate') return 'debate';

  /**
   * Voltar para a investigação tem dois cuidados que o piso da etapa não dá:
   *
   * 1. **O teto é o FEED, não o `onboarding`.** Usar o piso literal
   *    (`PISO_DA_ETAPA.investigacao === 'onboarding'`) jogaria a turma inteira de
   *    volta para o seletor de figurinha — quem já entrou no aparelho não escolhe
   *    avatar de novo.
   * 2. **Quem já viu a REVELAÇÃO não volta ao feed.** Para na tela da resposta,
   *    que dá para refazer. O motivo é o INSTRUMENTO, não o relatório: quem já
   *    sabe que o feed era enviesado não pode ser medido por ele de novo.
   *
   * Até 2026-09-10 o item 2 dizia "sessão congelada não reabre" e olhava
   * `runs.finished_at` — o que tornava o ramo do `feed` INALCANÇÁVEL, porque
   * sair da investigação congela TODA run que entrou no aparelho (`moverEtapa`
   * chama `encerrarRun`). O professor voltava a turma, o painel trocava de
   * rótulo e nenhuma tela mudava: exatamente o sintoma que o parágrafo acima
   * diz que esta função existe para evitar (ADR-92). Reabrir a sessão — apagar
   * o dossiê e zerar `finished_at` — é do CHAMADOR; o relatório é recomputado
   * dos eventos, que continuam todos lá.
   */
  const teto: FaseDaRun =
    etapa === 'investigacao'
      ? jaViuARevelacao(faseDaRun)
        ? 'conclusao'
        : 'feed'
      : PISO_DA_ETAPA[etapa];

  return ordemDaFase(faseDaRun) <= ordemDaFase(teto) ? faseDaRun : teto;
}

/** A turma está andando para trás? Decide qual das duas regras vale. */
export function ehVoltar(de: EtapaDaTurma, para: EtapaDaTurma): boolean {
  return ETAPAS_DA_TURMA.indexOf(para) < ETAPAS_DA_TURMA.indexOf(de);
}

/** Rótulos do controle do professor, na ordem dos botões. */
/**
 * O controle do professor. `nome` é o substantivo do momento (vai no stepper);
 * `rotulo` é o VERBO da ação que leva até ele (vai no botão).
 *
 * A separação não é preciosismo: com o mesmo texto nos dois, o rótulo do passo e
 * o do botão colidiam — inclusive para leitor de tela, porque o `Stepper` do DS
 * renderiza cada passo como `<button>` mesmo quando não é clicável.
 */
export const CONTROLE_DO_PROFESSOR: {
  etapa: EtapaDaTurma;
  nome: string;
  rotulo: string;
  descricao: string;
}[] = [
  {
    etapa: 'investigacao',
    nome: 'Investigação',
    rotulo: 'Começar investigação',
    descricao: 'A turma explora o feed e salva os posts que vão ajudar a responder.',
  },
  {
    etapa: 'conclusao',
    nome: 'Resposta',
    rotulo: 'Encerrar investigação',
    descricao: 'Fecha o feed e pede a resposta: cada estudante escolhe um dos três lados e faz o Raio-x de 6 posts que viu.',
  },
  {
    etapa: 'debate',
    nome: 'Debate',
    rotulo: 'Iniciar debate',
    descricao: 'Trava as telas nos posts que cada um salvou. A conversa é entre pares.',
  },
  {
    etapa: 'explicabilidade',
    nome: 'Explicação',
    rotulo: 'Encerrar debate',
    descricao: 'Libera a explicação de como o feed de cada um foi montado, com a devolutiva do Raio-x.',
  },
  {
    etapa: 'perdidos',
    nome: 'O que perderam',
    rotulo: 'Mostrar o que perderam',
    descricao: 'O feed do outro lado, em cinza: o que o algoritmo escondeu de cada um. Depois, os termos e o envio.',
  },
  {
    etapa: 'reflexao',
    nome: 'Reflexão',
    rotulo: 'Abrir reflexão',
    descricao: 'Fecha a atividade com a escrita livre sobre o que eles entenderam.',
  },
  { etapa: 'fim', nome: 'Fim', rotulo: 'Encerrar atividade', descricao: 'Fim da missão.' },
];
