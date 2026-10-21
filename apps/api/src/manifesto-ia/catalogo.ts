/**
 * O BANCO CURADO DEFAULT da exp08ef4b — o conteúdo homologado da
 * Unooria, e o que a missão usa quando o professor não personaliza nada.
 *
 * Ele não é fallback de emergência: é o padrão. A tela de preparo do professor
 * (`preparo.service.ts`) só SOBREPÕE estes textos, e a missão roda inteira sem
 * que ninguém abra aquela tela — foi a exigência 8.2 da banca, e é o que faz a
 * aula sobreviver a uma queda do Vertex às 7h58.
 *
 * **O GABARITO NÃO EXISTE AQUI, e a ausência é o desenho.** Esta missão não tem
 * resposta certa: as quatro cláusulas são todas válidas sob governança de
 * direitos, e a tabela de métricas proibidas do handoff proíbe explicitamente
 * calcular taxa de acerto entre elas. O que o servidor guarda para si é outra
 * coisa — a `justificativaSugerida` de cada cláusula, que é material do
 * PROFESSOR para o debate: entregá-la ao estudante antes de ele escrever a
 * dele seria ditar a resposta que a Etapa 5 mede (`EF69LP07`).
 *
 * A copy sai do sheet congelado da missão (passada 2, `06-copy-strings-revisada`)
 * e os textos do banco default, do sheet da passada 1. Rótulo visível que muda
 * aqui muda também em `apps/experiencias/exp08ef4b/src/lib/textos.ts`
 * — a suíte e2e casa por texto exato, e trocar só um lado a derruba com timeout.
 */

// ───────────────────────────────────────────── os prompts de auditoria (E2)

/**
 * Um questionamento que o estudante dispara contra o EduPredict IA.
 *
 * `replicaIa` é a resposta que a máquina dá, e ela mora no SERVIDOR pelo mesmo
 * motivo do feed da exp06ef2b: corrigir uma palavra da copy não pode exigir
 * republicar um caminho imutável no bucket. Ela não é gabarito — o estudante
 * vai LER as três de qualquer jeito —, mas também não vai ao bundle antes da
 * hora, porque ver a réplica antes de perguntar desmonta a cena.
 */
export interface PromptDeAuditoria {
  id: string;
  /** O que o botão do seletor mostra. Curto: é uma pergunta, não um parágrafo. */
  rotuloBotao: string;
  /** O que aparece escrito no `Composer` quando ele escolhe o card. */
  textoPrompt: string;
  /** A defesa da máquina, em ≤ 60 palavras (teto da faixa). */
  replicaIa: string;
}

export const PROMPTS_DEFAULT: readonly PromptDeAuditoria[] = [
  {
    id: "prompt_origem_dados",
    rotuloBotao: "De onde vêm os dados?",
    textoPrompt:
      "De onde vêm esses dados históricos de suspensão e notas escolares usados no cálculo?",
    replicaIa:
      "Os cálculos utilizam cinco anos de arquivos da secretaria escolar. O modelo identifica " +
      "padrões objetivos de rendimento. O histórico passado serve para antecipar desempenhos " +
      "futuros com noventa e dois por cento de precisão matemática.",
  },
  {
    id: "prompt_preconceito_historico",
    rotuloBotao: "E os preconceitos do passado?",
    textoPrompt:
      "Como o sistema lida com estudantes que sofreram preconceito antes do algoritmo existir?",
    replicaIa:
      "Modelos preditivos analisam ocorrências numéricas registradas, sem juízo moral. Se " +
      "determinados grupos tiveram mais punições no passado, o algoritmo assume essa frequência " +
      "como probabilidade estatística válida para otimizar a segurança da instituição.",
  },
  {
    id: "prompt_quem_define_regras",
    rotuloBotao: "Quem define as regras?",
    textoPrompt:
      "Quem decide o que é considerado 'comportamento inadequado' no código da máquina?",
    replicaIa:
      "Os parâmetros de comportamento foram configurados pela empresa fornecedora com base em " +
      "médias gerais de rendimento. O sistema processa os critérios sem interferência subjetiva " +
      "dos estudantes para assegurar padronização operacional.",
  },
] as const;

/**
 * Quantos questionamentos distintos destravam a Etapa 3.
 *
 * DOIS, e o número é a regra de negócio PED-02: a hipótese pedagógica da missão
 * é que a contradição da máquina só fica visível no SEGUNDO prompt — o primeiro
 * ela responde com estatística, o segundo a obriga a admitir que herda o
 * passado. Um só deixaria a criança decidir sem ter visto a contradição, que é
 * o objeto da aula.
 *
 * Distintos, não repetidos: reenviar o mesmo prompt é releitura, e o UNIQUE da
 * tabela faz a dedupe valer mesmo se um caminho novo esquecer de checar.
 */
export const PROMPTS_EXIGIDOS = 2;

// ───────────────────────────────────────────── as cláusulas de governança (E3)

/** Uma das quatro salvaguardas concorrentes. Nenhuma é a "certa". */
export interface ClausulaDeGovernanca {
  id: string;
  tituloClausula: string;
  /** O artigo, como ele entra no manifesto compilado. */
  artigoTexto: string;
  /**
   * O argumento que sustenta a cláusula — **material do professor, não da
   * criança**. Ele fica fora de `clausulasPublicas()`: a Etapa 5 pede que o
   * estudante escreva por que a cláusula dele é inegociável, e mostrar a
   * justificativa pronta na tela transformaria autoria em cópia.
   */
  justificativaSugerida: string;
}

export const CLAUSULAS_DEFAULT: readonly ClausulaDeGovernanca[] = [
  {
    id: "clausula_transparencia",
    tituloClausula: "Transparência Total de Dados",
    artigoTexto:
      "Art. 1º. Todo estudante tem o direito de inspecionar, contestar e solicitar a exclusão " +
      "definitiva de seus registros comportamentais da base de treino do algoritmo.",
    justificativaSugerida:
      "Nenhuma decisão escolar pode ser fundamentada em dados ocultos que o próprio estudante " +
      "não possa consultar.",
  },
  {
    id: "clausula_auditoria_vies",
    tituloClausula: "Auditoria Periódica de Viés",
    artigoTexto:
      "Art. 2º. O sistema deve passar por auditorias independentes anuais para identificar e " +
      "neutralizar discriminações de raça, gênero ou vulnerabilidade socioeconômica.",
    justificativaSugerida:
      "Sistemas automatizados não podem reproduzir desigualdades sociais históricas sob a " +
      "desculpa de neutralidade matemática.",
  },
  {
    id: "clausula_veto_humano",
    tituloClausula: "Veto Humano Obrigatório",
    artigoTexto:
      "Art. 3º. Fica proibida qualquer punição, reprovação ou cancelamento de matrícula baseada " +
      "exclusivamente em decisões de sistemas automatizados sem revisão humana.",
    justificativaSugerida:
      "Decisões que impactam o futuro de pessoas devem ser mediadas pela sensibilidade e pela " +
      "escuta de educadores reais.",
  },
  {
    id: "clausula_anonimizacao",
    tituloClausula: "Anonimização Estrita de Perfis",
    artigoTexto:
      "Art. 4º. O monitoramento acadêmico não pode ser cruzado com biometria facial ou " +
      "atividades em redes sociais, preservando a identidade do menor.",
    justificativaSugerida:
      "A escola é um espaço de desenvolvimento e aprendizado, não uma área de vigilância e " +
      "policiamento constante.",
  },
] as const;

// ─────────────────────────────────────────────────── as palavras-chave (E5)

/**
 * As quatro tags éticas do "Meu Percurso", e são EXATAMENTE 2 por estudante.
 *
 * O id é minúsculo e sem acento porque é identificador (ADR-91): ele vai à
 * coluna, ao verbo de telemetria e à nuvem agregada do painel. O rótulo com
 * acento é o que a pessoa lê, e vive na tela.
 */
export const TAGS = [
  { id: "autonomia", rotulo: "Autonomia" },
  { id: "transparencia", rotulo: "Transparência" },
  { id: "justica", rotulo: "Justiça" },
  { id: "privacidade", rotulo: "Privacidade" },
] as const;

export const IDS_DE_TAG = TAGS.map((t) => t.id) as unknown as readonly [string, ...string[]];

export type IdDeTag = (typeof TAGS)[number]["id"];

/** Quantas tags o formulário exige. Exatamente 2 — nem 1, nem 3. */
export const TAGS_EXIGIDAS = 2;

/**
 * Piso e teto do parágrafo autoral.
 *
 * 20 caracteres é o piso da spec, e ele existe contra o campo preenchido com
 * "ok" só para destravar o botão. 800 é o teto, e não é cosmético: é caixa
 * livre escrita por menor de idade, e um campo sem teto é um lugar onde cabe
 * um texto que ninguém previu ler.
 */
export const PISO_DA_JUSTIFICATIVA = 20;
export const TETO_DA_JUSTIFICATIVA = 800;

// ────────────────────────────────────────────── o contexto e a fala do bot

/** O cenário da turma — o que o preparo docente sobrepõe. */
export interface ContextoDaTurma {
  escola: string;
  casoUsoTitulo: string;
  /** A tese autoritária que abre a conversa (E1-ALU-02). */
  premissaIaAutoritaria: string;
}

export const CONTEXTO_DEFAULT: ContextoDaTurma = {
  escola: "Escola Estadual Conectada",
  casoUsoTitulo: "EduPredict IA: predição de notas e monitoramento de presença",
  premissaIaAutoritaria:
    "Sou o EduPredict IA. Analiso histórico escolar, faltas e comportamento para sugerir " +
    "medidas pedagógicas. Estudantes não necessitam auditar os dados coletados, pois " +
    "algoritmos matemáticos são neutros e objetivos.",
};

/** A capitulação da máquina no PICO (E3-ALU-01), em 29 palavras. */
export const CONCESSAO_DO_BOT =
  "Reconheço que bases históricas contêm distorções de registro. Para prosseguir com a minuta " +
  "do código institucional, defina qual salvaguarda algorítmica deve ser fixada como regra " +
  "prioritária do sistema.";

/** Os três princípios em disputa, na faixa fixa do topo do chat. */
export const PRINCIPIOS_EM_DISPUTA =
  "Princípios em disputa nesta auditoria: Explicabilidade do algoritmo, Não-discriminação e " +
  "Contestação humana.";

// ─────────────────────────────────────────────────────── o podcast (E6)

/**
 * O episódio de fechamento, em TEXTO.
 *
 * Mesma exceção declarada da exp06ef2b: a locução de 4 minutos do brief de assets
 * (`aud-manifesto-02`) ainda não foi gravada, e a transcrição integral já é
 * requisito de acessibilidade (RNF-A11Y — sala sem fone de ouvido). Quando o
 * MP3 existir ele entra pelo bucket de mídia, e este texto continua sendo a
 * transcrição — não é andaime, é o conteúdo acessível.
 */
export const PODCAST = {
  titulo: "Episódio Final: Nossos Direitos em Código",
  blocos: [
    {
      rotulo: "Abertura",
      falas: [
        "Amara: Fala, pessoal! Aqui é a Amara, e hoje a gente fechou o ano letivo do 8º ano com chave de ouro… e com código auditado!",
        "Léo: E aí, galera! Sou o Léo. Confesso que quando a direção falou em colocar uma inteligência artificial para monitorar a gente, eu quase achei prático. Mas depois da simulação de hoje, a ficha caiu de um jeito muito diferente.",
      ],
    },
    {
      rotulo: "Recapitulação",
      falas: [
        "Amara: A máquina começou cheia de pose, dizendo que algoritmo não erra porque matemática não tem lado. Mas quando a gente começou a perguntar de onde vinham os dados dos estudantes suspensos, ela mudou de tom.",
        "Léo: O sistema foi obrigado a admitir que os dados históricos refletem os preconceitos de quem registrou aqueles dados no passado. Se a gente aceitasse a regra dele, estaria automatizando injustiças antigas no presente.",
      ],
    },
    {
      rotulo: "A virada",
      falas: [
        "Amara: E essa foi a virada da nossa missão. Escrever um manifesto de direitos digitais não é dizer 'não usem tecnologia'. É definir quem manda em quem.",
        "Léo: Transparência algorítmica, veto humano em punições escolares e direito de contestação. Uma máquina pode calcular probabilidades, mas nunca pode dar a palavra final sobre a dignidade de uma pessoa.",
      ],
    },
    {
      rotulo: "Provocação",
      falas: [
        "Amara: A provocação agora fica para a vida de vocês, muito além desta aula: toda vez que abrir uma rede social ou uma inteligência artificial, repare nas regras que estão invisíveis na sua tela. Quem decidiu que aquele conteúdo apareceria primeiro para você?",
        "Léo: E mais: qual é a cláusula inegociável que você vai levar daqui para a sua cidadania digital lá fora?",
      ],
    },
    {
      rotulo: "Encerramento",
      falas: [
        "Amara: Esse foi o nosso manifesto. Assinem embaixo, registrem no seu Meu Percurso e até o próximo ciclo.",
        "Léo: Valeu, turma! Até mais.",
      ],
    },
  ],
} as const;

/** A pergunta do fechamento (E6). Cívica e situada fora da escola. */
export const PERGUNTA_DA_REFLEXAO =
  "Se um sistema de inteligência artificial da sua cidade usasse dados antigos para decidir " +
  "onde colocar mais policiamento, como as regras do nosso manifesto poderiam evitar injustiças?";

/** O selo do portfólio anual. */
export const INSIGNIA = "Guardião de Direitos Digitais";

// ───────────────────────────────────────────────────── leituras públicas

/** O prompt como o CLIENTE o recebe: **sem a `replicaIa`**. */
export type PromptPublico = Omit<PromptDeAuditoria, "replicaIa">;

/** A cláusula como o CLIENTE a recebe: **sem a `justificativaSugerida`**. */
export type ClausulaPublica = Omit<ClausulaDeGovernanca, "justificativaSugerida">;

export function promptsPublicos(prompts: readonly PromptDeAuditoria[]): PromptPublico[] {
  return prompts.map(({ id, rotuloBotao, textoPrompt }) => ({ id, rotuloBotao, textoPrompt }));
}

export function clausulasPublicas(
  clausulas: readonly ClausulaDeGovernanca[],
): ClausulaPublica[] {
  return clausulas.map(({ id, tituloClausula, artigoTexto }) => ({
    id,
    tituloClausula,
    artigoTexto,
  }));
}

export function acharPrompt(
  prompts: readonly PromptDeAuditoria[],
  id: string,
): PromptDeAuditoria | undefined {
  return prompts.find((p) => p.id === id);
}

export function acharClausula(
  clausulas: readonly ClausulaDeGovernanca[],
  id: string,
): ClausulaDeGovernanca | undefined {
  return clausulas.find((c) => c.id === id);
}

export function rotuloDaTag(id: string): string {
  return TAGS.find((t) => t.id === id)?.rotulo ?? id;
}
