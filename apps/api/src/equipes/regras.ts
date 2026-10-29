/**
 * As regras PURAS das equipes na missão (E13, ADR-111). Sem Prisma, sem Nest —
 * é o que o teste exercita sem banco.
 *
 * EQUIPE É QUEM DIVIDE UM COMPUTADOR. Não é agrupamento pedagógico, não é
 * "grupo de trabalho": é a resposta física a uma sala com menos máquinas que
 * crianças. Tudo aqui parte disso — o tamanho da equipe sai do número de
 * computadores, e não de uma preferência de quantos por grupo.
 */

/**
 * AS MISSÕES QUE ACEITAM EQUIPE — e só elas, por enquanto.
 *
 * Lista no código, e não coluna no catálogo, porque "esta missão funciona com
 * duas crianças numa tela" é propriedade do DESENHO da experiência (quem
 * clica, quem lê, o que o painel conta), e não configuração da rede. As quatro
 * foram conferidas uma a uma: o Instanooria (exp08ef1b), a Missão Tempestade
 * (exp02em1b), Quem Mandou Isso? v2.2 (exp05ef1b), A Seleção (exp07ef1b) e o
 * Jornal da Escola (exp04ef1b) — as três últimas NASCERAM com equipe: na
 * exp05ef1b o painel e o Termômetro contam por computador; na A Seleção o
 * painel conta por computador, o Mural pareia computadores e a ficha pedagógica
 * copia o nível para os colegas de tela; no Jornal o painel, o histograma e o
 * radar contam por computador, e as três ações da ficha são copiadas; no Júri
 * Estadual (exp06ef1b) o painel e a lousa do pico contam por computador, e as
 * três ações da ficha são copiadas. O Enigma da Capa da Rádio (exp02ef1b,
 * ADR-184) é individual por padrão (decisão do Lucas): a equipe é o
 * mecanismo do APARELHO COMPARTILHADO — o painel conta por computador e as
 * duas marcas da ficha são copiadas aos colegas de tela. O Assistente
 * Invisível (exp01em1b, ADR-185) segue o mesmo desenho: individual por
 * padrão, o painel conta por computador e as quatro marcas são copiadas. O
 * UnooTube estava aqui como exp04ef1b até ser ARQUIVADO (ADR-116): o código
 * passou ao Jornal, e a lista é por CÓDIGO. Missão que entra aqui sem essa
 * conferência abre para equipe e continua contando por criança no painel.
 */
export const EXPERIENCIAS_COM_EQUIPE = ["exp08ef1b", "exp02em1b-v0", "exp05ef1b", "exp07ef1b", "exp04ef1b", "exp06ef1b", "exp02em1b", "exp02ef1b", "exp01em1b", "exp03ef1b"] as const;
export type ExperienciaComEquipe = (typeof EXPERIENCIAS_COM_EQUIPE)[number];

export function permiteEquipes(expId: string): expId is ExperienciaComEquipe {
  return (EXPERIENCIAS_COM_EQUIPE as readonly string[]).includes(expId);
}

/**
 * A EQUIPE É DA ATIVIDADE (ADR-130). A missão é o esqueleto narrativo; a
 * atividade é a missão que a turma faz de fato, criada pelo professor — e é na
 * criação dela que ele diz quem senta com quem.
 *
 * Estas são as missões que TÊM atividade: cada uma é dona das próprias (a
 * cobertura da exp07ef1b, o pacote da exp04ef1b, da exp05ef1b e da exp06ef1b,
 * a `activity` da exp08ef1b), e registra no `EquipesService` como descobrir a que está em
 * andamento na turma (`registrarAtividades`). A plataforma só guarda o id,
 * opaco, como a evidência pedagógica.
 */
export const EXPERIENCIAS_COM_ATIVIDADE = ["exp08ef1b", "exp07ef1b", "exp04ef1b", "exp05ef1b", "exp06ef1b", "exp02em1b", "exp02ef1b", "exp01em1b", "exp03ef1b"] as const;

export function temAtividades(expId: string): boolean {
  return (EXPERIENCIAS_COM_ATIVIDADE as readonly string[]).includes(expId);
}

/**
 * O id de atividade da missão que NÃO tem atividade — o unooGPT, até ser
 * refeito com elas, e o UnooTube arquivado: uma montagem por turma, como era
 * antes da ADR-130.
 */
export const ATIVIDADE_DA_TURMA = "turma";

/**
 * O alfabeto do id da atividade: o MESMO de `evidencias_marcas.atividade_id`
 * (a evidência re-exporta daqui) e do CHECK
 * `equipes_montagens_atividade_id_check`.
 */
export const ATIVIDADE_ID_RE = /^[A-Za-z0-9_.:-]{1,100}$/;
export const FORMATO_DO_ATIVIDADE_ID = "atividadeId: 1 a 100 caracteres entre letras, dígitos e _ . : -";

/**
 * O id de atividade casa com a missão? Missão com atividade NUNCA usa o fixo
 * `turma` — seria a montagem solta que a ADR-130 aposentou; missão sem
 * atividade SÓ usa ele.
 */
export function atividadeCasaComMissao(expId: string, atividadeId: string): boolean {
  if (!ATIVIDADE_ID_RE.test(atividadeId)) return false;
  return temAtividades(expId) ? atividadeId !== ATIVIDADE_DA_TURMA : atividadeId === ATIVIDADE_DA_TURMA;
}

/**
 * Como a montagem nasceu. O MESMO vocabulário do CHECK
 * `equipes_montagens_modo_check` — o par que já custou um deploy em
 * `permissoes`, e que o teste de Postgres compara.
 *
 * - `sorteio`: a plataforma distribui os presentes pelos computadores.
 * - `manual`: nascem N equipes VAZIAS, e o professor arrasta — é ele quem sabe
 *   que aqueles dois não podem sentar juntos.
 * - `individual`: um aluno por computador (ADR-130). GRAVA a montagem — é a
 *   resposta do passo de equipes na criação da atividade — e nenhuma equipe;
 *   `computadores` fica nulo, e o painel conta por criança, como sem montagem.
 */
export const MODOS = ["sorteio", "manual", "individual"] as const;
export type Modo = (typeof MODOS)[number];

/** O teto do nome — o mesmo do CHECK da migration. É o que cabe no card do painel. */
export const NOME_MAX = 30;

/** O teto de computadores de uma sala. Folga larga: é defesa contra um laço, não regra de produto. */
export const COMPUTADORES_MAX = 200;

/** "Equipe 1", "Equipe 2"… — `i` é a posição, a partir de zero. */
export function nomePadrao(i: number): string {
  return `Equipe ${i + 1}`;
}

/**
 * A chave com que dois rótulos são comparados: sem caixa e SEM ACENTO. "Lívia"
 * e "Livia" são o mesmo rótulo para quem lê — a criança não tem como saber qual
 * das duas está no computador dela.
 */
function chaveDeComparacao(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

/** Partícula de sobrenome: não ganha inicial ("Ana M. Souza", nunca "Ana M. d. Souza"). */
const PARTICULAS = new Set(["da", "das", "de", "do", "dos", "e", "di", "du", "del"]);

const inicialDe = (parte: string) => `${parte.charAt(0).toLocaleUpperCase("pt-BR")}.`;

/**
 * Os rótulos possíveis de uma pessoa, do mais curto ao nome inteiro. Cada degrau
 * só é usado quando o anterior ainda empata com alguém:
 *
 *   "Gabriela" → "Gabriela C." → "Gabriela Cardoso" → "Gabriela A. Cardoso" → o nome inteiro
 */
function degrausDoRotulo(nome: string): string[] {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const [primeiro = "", ...resto] = partes;
  if (resto.length === 0) return [primeiro];
  const ultimo = resto[resto.length - 1] as string;
  const meio = resto.slice(0, -1).filter((parte) => !PARTICULAS.has(parte.toLocaleLowerCase("pt-BR")));
  const degraus = [
    primeiro,
    `${primeiro} ${inicialDe(ultimo)}`,
    `${primeiro} ${ultimo}`,
    [primeiro, ...meio.map(inicialDe), ultimo].join(" "),
    partes.join(" "),
  ];
  return degraus.filter((degrau, i) => degraus.indexOf(degrau) === i);
}

/**
 * O que a criança lê sobre os colegas de computador: o PRIMEIRO NOME, e mais
 * nada — a tela do estudante diz "com Bia e Caio", e o nome completo de outra
 * criança não tem o que fazer ali (regra 6).
 *
 * A exceção é o nome que EMPATA — duas Gabrielas no mesmo computador, e a
 * faixa diria "com Gabriela e Gabriela". Aí o rótulo sobe UM DEGRAU POR VEZ
 * (`degrausDoRotulo`), só para quem empata e só até desempatar: a inicial do
 * último sobrenome ("Gabriela C."); se ainda empata, o último sobrenome inteiro
 * ("Gabriela Cardoso" e "Gabriela Correia"); depois as iniciais do meio, sem
 * as partículas. O nome inteiro só aparece quando nada mais curto separa duas
 * pessoas. Caixa e acento não contam como diferença.
 *
 * Homônimo PERFEITO (o mesmo nome inteiro) não tem rótulo que o separe, e não
 * sobe degrau por causa do outro — só por causa de quem tem nome diferente.
 *
 * `pessoas` é o universo em que o empate é decidido; quem chama escolhe quem
 * entra (em `minha`, a equipe inteira, o próprio estudante incluso). A mesma
 * pessoa duas vezes na lista conta uma vez só. Devolve o rótulo por id.
 *
 * É A MESMA ESCADA de `apps/hub/lib/equipes.ts#rotulosCurtos` (a tela
 * projetada do "Mostrar equipes"), em duas cópias de propósito: a api não
 * importa código de outra app do monorepo — o hub é app, não pacote de
 * workspace —, e o desempate da faixa PRECISA sair daqui. Desempatar no hub
 * exigiria mandar ao navegador de uma criança o nome inteiro dos colegas para
 * mostrar só o primeiro. Os dois testes (`apps/hub/lib/equipes.test.ts` e
 * `tests/equipes-regras.spec.ts`) afirmam os MESMOS casos com as mesmas
 * respostas: mexeu numa escada, mexa na outra e nos dois testes.
 */
export function rotulosSemRepeticao(pessoas: readonly MembroDaEquipe[]): Map<string, string> {
  const unicas = [...new Map(pessoas.map((pessoa) => [pessoa.id, pessoa])).values()];
  const todas = unicas.map((pessoa) => ({
    id: pessoa.id,
    nomeInteiro: chaveDeComparacao(pessoa.nome),
    degraus: degrausDoRotulo(pessoa.nome),
    degrau: 0,
  }));
  const rotuloDe = (p: (typeof todas)[number]) => p.degraus[p.degrau] as string;

  /* Sobe um degrau quem empata com alguém de nome DIFERENTE, e repete até
     ninguém mais empatar. Termina: cada volta sobe alguém, e os degraus acabam. */
  for (let subiu = true; subiu; ) {
    subiu = false;
    const grupos = new Map<string, (typeof todas)[number][]>();
    for (const p of todas) {
      const chave = chaveDeComparacao(rotuloDe(p));
      grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
    }
    for (const grupo of grupos.values()) {
      if (new Set(grupo.map((p) => p.nomeInteiro)).size < 2) continue;
      for (const p of grupo) {
        if (p.degrau < p.degraus.length - 1) {
          p.degrau += 1;
          subiu = true;
        }
      }
    }
  }
  return new Map(todas.map((p) => [p.id, rotuloDe(p)]));
}

/**
 * O TAMANHO de cada equipe para `n` presentes em `k` computadores.
 *
 * Tamanhos que diferem em NO MÁXIMO 1, os maiores primeiro: 25 em 10 dá cinco
 * de 3 e cinco de 2. É a regra rígida do sorteio — o agrupamento por lado
 * (Instanooria) nunca a dobra, porque uma equipe de 5 ao lado de uma de 1 é o
 * que a sala reclama na hora, e com razão.
 *
 * `k` é limitado a `[1, n]`: computador sobrando não vira equipe vazia (é uma
 * máquina desligada), e `k ≥ n` quer dizer cada um no seu — o que é legítimo,
 * é a sala com um computador por criança.
 */
export function tamanhos(n: number, k: number): number[] {
  if (n <= 0) return [];
  const efetivo = Math.max(1, Math.min(n, Math.floor(k)));
  const base = Math.floor(n / efetivo);
  const resto = n % efetivo;
  return Array.from({ length: efetivo }, (_, i) => (i < resto ? base + 1 : base));
}

/** Os dois lados do Instanooria. `null` é quem não tem lado — o neutro. */
export type Lado = "A" | "B";

export interface Presente {
  id: string;
  /** O lado da criança, quando a missão tem fonte de grupo. Ausente = neutro. */
  grupo?: Lado | null;
}

export interface EquipeSorteada {
  nome: string;
  /** Ids dos estudantes. */
  membros: string[];
  /** O lado da MAIORIA dos membros com lado; `null` quando ninguém tem lado. */
  grupo: Lado | null;
  /** Tem gente dos dois lados — o que o sorteio evita e, quando não consegue, conta. */
  mista: boolean;
}

export interface ResultadoDoSorteio {
  equipes: EquipeSorteada[];
  equipesMistas: number;
}

/** Fisher–Yates com o gerador injetado — é o que torna o teste determinístico. */
function embaralhar<T>(itens: readonly T[], aleatorio: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    const tmp = copia[i] as T;
    copia[i] = copia[j] as T;
    copia[j] = tmp;
  }
  return copia;
}

/**
 * Qual equipe fica com qual lado.
 *
 * Os tamanhos só têm dois valores (`grande` e `pequeno`, ver `tamanhos`), então
 * "quais equipes são do lado A" se resume a QUANTAS grandes e QUANTAS pequenas —
 * são no máximo 201 × 201 combinações, e a busca é exaustiva. Para cada uma, a
 * capacidade do lado A (`capA`) é comparada ao que ele precisa:
 *
 *   1. `capA` em `[|A|, n − |B|]` — ninguém com lado sobra para o outro lado.
 *      Os neutros são o que preenche a diferença.
 *   2. Entre as viáveis, a mais perto do alvo PROPORCIONAL `n·|A|/(|A|+|B|)` —
 *      os neutros se repartem na proporção dos lados, em vez de irem todos para
 *      um.
 *   3. Desempate: o número de equipes mais perto da mesma proporção — com 12 A
 *      e 8 B em 10 computadores, 6 equipes para A e 4 para B, em vez de 5 e 5
 *      com as de A todas maiores.
 *
 * Sem combinação viável (13 A e 15 B em 7 computadores de 4: nenhuma soma de
 * quatros dá 13), fica a que MENOS transborda — e o transbordo é contado em
 * `equipesMistas`, para a tela dizer isso ao professor em vez de esconder.
 *
 * QUAIS equipes grandes e pequenas ficam com cada lado é sorteado: senão o
 * lado A seria sempre "Equipe 1 a 6", e o nome da equipe contaria o lado.
 */
function ladosDasEquipes(
  tamanhosDasEquipes: readonly number[],
  nA: number,
  nB: number,
  aleatorio: () => number,
): Lado[] {
  const k = tamanhosDasEquipes.length;
  const n = tamanhosDasEquipes.reduce((s, t) => s + t, 0);
  const grande = tamanhosDasEquipes[0] ?? 0;
  const grandes = tamanhosDasEquipes.filter((t) => t === grande).length;
  const pequeno = grande - 1;
  const pequenas = k - grandes;

  const alvo = (n * nA) / (nA + nB);
  const alvoDeEquipes = (k * nA) / (nA + nB);

  let melhor = { a: 0, b: 0, excesso: Infinity, distancia: Infinity, distanciaDeEquipes: Infinity };
  for (let a = 0; a <= grandes; a++) {
    for (let b = 0; b <= pequenas; b++) {
      const capA = a * grande + b * pequeno;
      const capB = n - capA;
      const excesso = Math.max(0, nA - capA) + Math.max(0, nB - capB);
      const distancia = Math.abs(capA - alvo);
      const distanciaDeEquipes = Math.abs(a + b - alvoDeEquipes);
      const ehMelhor =
        excesso < melhor.excesso ||
        (excesso === melhor.excesso && distancia < melhor.distancia) ||
        (excesso === melhor.excesso &&
          distancia === melhor.distancia &&
          distanciaDeEquipes < melhor.distanciaDeEquipes);
      if (ehMelhor) melhor = { a, b, excesso, distancia, distanciaDeEquipes };
    }
  }

  const lados: Lado[] = Array.from({ length: k }, () => "B");
  const indicesGrandes = embaralhar(
    Array.from({ length: grandes }, (_, i) => i),
    aleatorio,
  );
  const indicesPequenas = embaralhar(
    Array.from({ length: pequenas }, (_, i) => grandes + i),
    aleatorio,
  );
  for (const i of indicesGrandes.slice(0, melhor.a)) lados[i] = "A";
  for (const i of indicesPequenas.slice(0, melhor.b)) lados[i] = "A";
  return lados;
}

type Vaga = { livres: number[]; membros: Presente[][] };

/**
 * Distribui em RODÍZIO pelas equipes indicadas, pulando as cheias — é o que
 * espalha os de um lado por igual, em vez de encher a primeira equipe e deixar
 * a última só com neutros. Devolve quem não coube.
 */
function emRodizio(alunos: readonly Presente[], equipes: readonly number[], vaga: Vaga): Presente[] {
  const sobra: Presente[] = [];
  let p = 0;
  for (const aluno of alunos) {
    let tentativas = 0;
    while (tentativas < equipes.length && (vaga.livres[equipes[p % equipes.length] ?? 0] ?? 0) === 0) {
      p++;
      tentativas++;
    }
    if (tentativas >= equipes.length) {
      sobra.push(aluno);
      continue;
    }
    const i = equipes[p % equipes.length] ?? 0;
    vaga.membros[i]?.push(aluno);
    vaga.livres[i] = (vaga.livres[i] ?? 0) - 1;
    p++;
  }
  return sobra;
}

/**
 * O TRANSBORDO vai CONCENTRADO, não em rodízio: a equipe com mais vagas enche
 * primeiro. Espalhar três crianças do lado A por três equipes do lado B faria
 * três equipes mistas onde uma bastava.
 */
function concentrado(alunos: readonly Presente[], equipes: readonly number[], vaga: Vaga): Presente[] {
  const ordem = [...equipes].sort((x, y) => (vaga.livres[y] ?? 0) - (vaga.livres[x] ?? 0) || x - y);
  const sobra: Presente[] = [];
  let i = 0;
  for (const aluno of alunos) {
    while (i < ordem.length && (vaga.livres[ordem[i] ?? 0] ?? 0) === 0) i++;
    const alvo = ordem[i];
    if (alvo === undefined) {
      sobra.push(aluno);
      continue;
    }
    vaga.membros[alvo]?.push(aluno);
    vaga.livres[alvo] = (vaga.livres[alvo] ?? 0) - 1;
  }
  return sobra;
}

/**
 * O SORTEIO: os presentes distribuídos por `computadores` equipes.
 *
 * O TAMANHO É RÍGIDO (`tamanhos`). O que o sorteio escolhe é só QUEM vai onde.
 *
 * Sem ninguém com lado, é embaralhar e distribuir. Com lado (o Instanooria
 * divide a turma em dois times, e uma equipe com gente dos dois lados diante da
 * mesma tela desmancha a missão), cada equipe recebe um lado
 * (`ladosDasEquipes`), os de cada lado se espalham em rodízio pelas equipes
 * dele, o transbordo — quando a aritmética não fecha — vai concentrado para o
 * outro lado, e os NEUTROS preenchem o que sobrou. Neutro é enchimento: é quem
 * não tem lado que absorve a diferença entre os tamanhos.
 *
 * O `grupo` da equipe é o da maioria dos membros com lado; empate fica com o
 * lado que a equipe recebeu no desenho, que é determinístico.
 *
 * `aleatorio` é injetável: o teste passa um gerador com semente e confere o
 * resultado inteiro.
 */
export function sortear(
  presentes: readonly Presente[],
  computadores: number,
  aleatorio: () => number = Math.random,
): ResultadoDoSorteio {
  const tams = tamanhos(presentes.length, computadores);
  if (tams.length === 0) return { equipes: [], equipesMistas: 0 };

  const ladoA = presentes.filter((p) => p.grupo === "A");
  const ladoB = presentes.filter((p) => p.grupo === "B");
  const neutros = presentes.filter((p) => p.grupo !== "A" && p.grupo !== "B");
  const todas = tams.map((_, i) => i);
  const vaga: Vaga = { livres: [...tams], membros: tams.map(() => []) };

  const comLado = ladoA.length + ladoB.length > 0;
  const lados: (Lado | null)[] = comLado
    ? ladosDasEquipes(tams, ladoA.length, ladoB.length, aleatorio)
    : tams.map(() => null);

  let sobra: Presente[] = [];
  if (comLado) {
    const equipesA = todas.filter((i) => lados[i] === "A");
    const equipesB = todas.filter((i) => lados[i] === "B");
    const sobraA = emRodizio(embaralhar(ladoA, aleatorio), equipesA, vaga);
    const sobraB = emRodizio(embaralhar(ladoB, aleatorio), equipesB, vaga);
    sobra = [...concentrado(sobraA, equipesB, vaga), ...concentrado(sobraB, equipesA, vaga)];
  }
  /* O que ainda não coube (não deveria haver: a soma dos tamanhos é `n`) vai
     junto dos neutros. Perder uma criança no sorteio seria pior que qualquer
     desequilíbrio. */
  emRodizio([...sobra, ...embaralhar(neutros, aleatorio)], todas, vaga);

  const equipes = vaga.membros.map((membros, i): EquipeSorteada => {
    const a = membros.filter((m) => m.grupo === "A").length;
    const b = membros.filter((m) => m.grupo === "B").length;
    const grupo: Lado | null = a > b ? "A" : b > a ? "B" : a === 0 ? null : (lados[i] ?? null);
    return {
      nome: nomePadrao(i),
      membros: membros.map((m) => m.id),
      grupo,
      mista: a > 0 && b > 0,
    };
  });
  return { equipes, equipesMistas: equipes.filter((e) => e.mista).length };
}

/**
 * O MODO MANUAL: N equipes vazias, e todo mundo esperando para ser arrastado.
 *
 * N é limitado a `[1, n]` pela mesma razão de `tamanhos`: equipe que nunca vai
 * ter ninguém é só um card vazio a mais para o professor apagar. Sem presentes,
 * nenhuma equipe.
 */
export function propostaManual<T extends { id: string }>(
  presentes: readonly T[],
  computadores: number,
): { equipes: { nome: string; membros: T[] }[]; semEquipe: T[] } {
  const n = presentes.length;
  if (n === 0) return { equipes: [], semEquipe: [] };
  const k = Math.max(1, Math.min(n, Math.floor(computadores)));
  return {
    equipes: Array.from({ length: k }, (_, i) => ({ nome: nomePadrao(i), membros: [] })),
    semEquipe: [...presentes],
  };
}

/** O que `validarMontagem` precisa do corpo do `PUT`. */
export interface MontagemProposta {
  modo: Modo;
  computadores?: number | null;
  ausentes: readonly string[];
  equipes: readonly { nome: string; membros: readonly string[] }[];
}

/**
 * Tudo que torna uma montagem impossível de salvar, em frases para o
 * PROFESSOR. Lista vazia = pode gravar.
 *
 * A lista inteira, e não o primeiro erro: quem monta quinze equipes arrastando
 * nomes precisa ver os três problemas de uma vez, e não descobrir um por
 * salvamento.
 *
 * Nenhuma mensagem leva nome de criança nem id: o 400 volta para a tela e vai
 * para o log de 4xx, e o que o professor precisa saber é QUAL EQUIPE olhar.
 *
 * `idsDaTurma` é a lista de estudantes da turma AGORA — um id de fora dela é
 * uma criança que saiu da turma com a tela aberta, ou um corpo forjado; nos
 * dois casos, não se grava.
 */
export function validarMontagem(corpo: MontagemProposta, idsDaTurma: ReadonlySet<string>): string[] {
  const erros = new Set<string>();
  if (corpo.modo === "individual") {
    /* Um aluno por computador não tem equipe nenhuma: uma lista aqui é corpo
       forjado, ou a tela mandando o sorteio com o modo errado. */
    if (corpo.equipes.length > 0) erros.add("Com um aluno por computador não há equipes para salvar.");
  } else {
    if (corpo.equipes.length === 0) erros.add("Monte pelo menos uma equipe.");
    if (corpo.computadores == null) erros.add("Diga quantos computadores a sala tem.");
  }

  const nomes = new Map<string, number>();
  /* Por POSIÇÃO, e não por nome: duas equipes com o mesmo nome são duas. */
  const equipeDe = new Map<string, { posicao: number; rotulo: string }>();

  corpo.equipes.forEach((equipe, i) => {
    const nome = equipe.nome.trim();
    /* `"Equipe 3"` ou `na posição 3` — a frase funciona com e sem nome. */
    const rotulo = nome ? `"${nome}"` : `na posição ${i + 1}`;
    if (!nome) erros.add(`A equipe na posição ${i + 1} está sem nome.`);
    if (nome.length > NOME_MAX) {
      erros.add(`O nome "${nome}" passa de ${NOME_MAX} caracteres.`);
    }
    if (nome) {
      const chave = nome.toLocaleLowerCase("pt-BR");
      nomes.set(chave, (nomes.get(chave) ?? 0) + 1);
      if ((nomes.get(chave) ?? 0) === 2) erros.add(`Há mais de uma equipe chamada "${nome}".`);
    }
    if (equipe.membros.length === 0) erros.add(`A equipe ${rotulo} está sem ninguém.`);

    for (const id of equipe.membros) {
      if (!idsDaTurma.has(id)) erros.add(`A equipe ${rotulo} tem alguém que não é desta turma.`);
      const anterior = equipeDe.get(id);
      if (anterior !== undefined) {
        erros.add(
          anterior.posicao === i
            ? `Há um estudante repetido na equipe ${rotulo}.`
            : `Há um estudante em duas equipes (${anterior.rotulo} e ${rotulo}).`,
        );
      } else {
        equipeDe.set(id, { posicao: i, rotulo });
      }
    }
  });

  for (const id of corpo.ausentes) {
    if (!idsDaTurma.has(id)) erros.add("A lista de ausentes tem alguém que não é desta turma.");
    const equipe = equipeDe.get(id);
    if (equipe !== undefined) {
      erros.add(`Há um estudante marcado como ausente dentro da equipe ${equipe.rotulo}.`);
    }
  }

  return [...erros];
}

/** Um membro como as telas o mostram. `nome` é o `displayName`. */
export interface MembroDaEquipe {
  id: string;
  nome: string;
}

/** A equipe de um estudante, como `consulta.ts#mapaDeEquipes` a entrega. */
export type EquipeDoMapa = { id: string; nome: string; membros: MembroDaEquipe[] };

/** Uma UNIDADE do painel: um computador — uma equipe, ou uma criança sozinha. */
export interface Unidade<L> {
  /** `equipe:<id>` ou `estudante:<id>` — estável entre leituras do polling. */
  chave: string;
  equipe: EquipeDoMapa | null;
  /** A linha que REPRESENTA o computador: é ela que o painel lê. */
  linha: L;
  /** Todas as linhas dos membros que têm linha. */
  linhas: L[];
}

/**
 * O painel contado POR COMPUTADOR, e não por criança.
 *
 * É a razão de as equipes existirem: dois estudantes numa tela, com o login de
 * um deles, produzem UMA sessão e uma linha vazia — e o painel por criança
 * dizia que metade da sala não começou. Aqui as linhas dos membros de uma
 * equipe viram UMA unidade, representada pela linha de quem INICIOU (a mais
 * recente por `recencia`, se mais de um iniciou — o computador que trocou de
 * login no meio da aula continua na sessão nova); sem ninguém que iniciou, a
 * primeira linha da equipe. Quem não tem equipe é a própria unidade.
 *
 * A ORDEM é a da primeira aparição: o painel já chega ordenado (por nome, por
 * progresso), e reordenar aqui desfaria a escolha dele.
 *
 * Genérico na linha porque o UnooTube e o unooGPT têm linhas de painel
 * diferentes; o que esta função sabe delas é só o id, "iniciou?" e quando.
 */
export function colapsarEmUnidades<L>(
  linhas: readonly L[],
  idDe: (l: L) => string,
  mapa: ReadonlyMap<string, EquipeDoMapa>,
  iniciou: (l: L) => boolean,
  recencia?: (l: L) => number,
): Unidade<L>[] {
  const porChave = new Map<string, { equipe: EquipeDoMapa | null; linhas: L[] }>();
  for (const linha of linhas) {
    const id = idDe(linha);
    const equipe = mapa.get(id) ?? null;
    const chave = equipe ? `equipe:${equipe.id}` : `estudante:${id}`;
    const existente = porChave.get(chave);
    if (existente) existente.linhas.push(linha);
    else porChave.set(chave, { equipe, linhas: [linha] });
  }

  return [...porChave.entries()].map(([chave, { equipe, linhas: doGrupo }]) => {
    let representante: L | undefined;
    for (const l of doGrupo) {
      if (!iniciou(l)) continue;
      if (representante === undefined) representante = l;
      else if (recencia && recencia(l) > recencia(representante)) representante = l;
    }
    return { chave, equipe, linha: representante ?? (doGrupo[0] as L), linhas: doGrupo };
  });
}
