/**
 * EQUIPES NA MISSÃO (E13): o que o hub lê e escreve em `/equipes/*`.
 *
 * Quando estudantes dividem um computador, quem entra na missão representa a
 * equipe. O contrato é o Zod de `apps/api/src/equipes/contrato-de-rotas.ts`;
 * estes tipos são a leitura dele do lado do hub, como `salas.ts` e
 * `unootube-tipos.ts`. Quais missões aceitam equipe é decisão da api
 * (`permitida`) — o hub não guarda lista própria.
 *
 * Este arquivo é PURO e vale no cliente: a seção da ficha (`components/equipes/`)
 * importa daqui. As leituras server-side moram em `equipes-servidor.ts`, que
 * carrega `server-only` — juntar as duas faria o bundle do cliente quebrar no
 * primeiro import.
 */

export type ModoDeMontagem = "sorteio" | "manual";

/** O lado do feed no Instanooria — a única missão que agrupa por lado. */
export type LadoDoFeed = "A" | "B";

export interface PessoaDaEquipe {
  id: string;
  nome: string;
}

export interface MontagemDeEquipes {
  modo: ModoDeMontagem;
  computadores: number;
  /** Quem faltou no dia da montagem — ficam em `semEquipe`. */
  ausentes: string[];
  /** Controle de concorrência do `PUT`: a api responde 409 quando mudou. */
  versao: number;
  atualizadoEm: string;
}

export interface EquipeSalva {
  id: string;
  nome: string;
  ordem: number;
  membros: PessoaDaEquipe[];
}

/** `GET /equipes/turma/:turmaId/missao/:expId` — e também a resposta do `PUT`. */
export interface EquipesDaMissao {
  permitida: boolean;
  montagem: MontagemDeEquipes | null;
  equipes: EquipeSalva[];
  /** Estudantes da turma fora de qualquer equipe, ausentes inclusive. */
  semEquipe: PessoaDaEquipe[];
  estudantes: number;
}

export interface EquipeSugerida {
  nome: string;
  membros: PessoaDaEquipe[];
  grupo: LadoDoFeed | null;
  mista: boolean;
}

export interface AgrupamentoDaSugestao {
  fonte: string;
  comGrupo: number;
  neutros: number;
  equipesMistas: number;
  aviso: string | null;
}

/** `POST …/sugestao` — não grava nada. */
export interface SugestaoDeEquipes {
  modo: ModoDeMontagem;
  computadores: number;
  equipes: EquipeSugerida[];
  semEquipe: PessoaDaEquipe[];
  agrupamento: AgrupamentoDaSugestao | null;
}

/** `GET …/ultima` — as equipes salvas mais recentes da turma, em OUTRA missão. */
export interface UltimasEquipes {
  origem: { expId: string; atualizadoEm: string } | null;
  equipes: { nome: string; membros: PessoaDaEquipe[] }[];
  semEquipe: PessoaDaEquipe[];
  /** Quantos daquela montagem não estão mais na turma. */
  saidas: number;
}

/** O corpo do `PUT`: substitui a montagem inteira. */
export interface CorpoDasEquipes {
  versao: number;
  modo: ModoDeMontagem;
  computadores: number;
  ausentes: string[];
  equipes: { nome: string; membros: string[] }[];
}

/** `GET /equipes/minha?expId=` — do estudante; sempre 200. */
export interface MinhaEquipe {
  equipe: { nome: string; colegas: string[] } | null;
}

/** O mesmo teto do Zod da api. */
export const NOME_MAXIMO = 30;

/** O valor do `Selection` que tira o estudante de toda equipe. */
export const SEM_EQUIPE = "__sem-equipe__";

/**
 * A missão em que a equipe é de LADO igual (Instanooria). Só serve à copy: o
 * "Manter as equipes da última missão" avisa que o lado não vem junto. Quem
 * agrupa por lado é o sorteio da api, que devolve `agrupamento`.
 */
export const MISSAO_QUE_AGRUPA_POR_LADO = "exp08ef1b";

// ── textos ──────────────────────────────────────────────────────────────

/** A `Tag` da sala: "1 equipe pronta" / "10 equipes prontas". */
export function rotuloEquipesProntas(n: number): string {
  return n === 1 ? "1 equipe pronta" : `${n} equipes prontas`;
}

/** "Ana", "Ana e Bruno", "Ana, Bruno e Caio". */
export function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** A faixa do estudante, acima da missão. `colegas` já vêm só com o primeiro nome. */
export function textoSuaEquipe(equipe: { nome: string; colegas: readonly string[] }): string {
  const base = `Sua equipe: ${equipe.nome}`;
  return equipe.colegas.length > 0 ? `${base} · com ${juntarNomes(equipe.colegas)}` : base;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/**
 * A chave com que dois rótulos são comparados: sem caixa e SEM ACENTO. Na tela
 * projetada, do fundo da sala, "Lívia L." e "Livia L." são o mesmo rótulo — a
 * criança não tem como saber qual é o dela.
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
  const ultimo = resto[resto.length - 1]!;
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
 * O que a tela PROJETADA mostra de cada estudante: o primeiro nome, e mais nada.
 *
 * A exceção é o nome que EMPATA na turma — duas Marias na mesma sala é o caso
 * comum, e "Maria" sozinho deixa as duas sem saber de qual equipe são. Aí o
 * rótulo sobe um degrau por vez (`degrausDoRotulo`), só para quem empata e só
 * até desempatar: primeiro a inicial do último sobrenome ("Maria S."); se duas
 * Gabrielas ainda ficam "Gabriela C.", o último sobrenome inteiro ("Gabriela
 * Cardoso" e "Gabriela Correia"); depois as iniciais do meio. O nome inteiro só
 * aparece quando nada mais curto separa duas pessoas.
 *
 * Homônimo PERFEITO (o mesmo nome inteiro) não tem rótulo que o separe, e não
 * sobe degrau por causa do outro — só por causa de quem tem nome diferente.
 *
 * `pessoas` é a TURMA que a tela pode mostrar: quem desempata com quem é
 * decidido sobre ela inteira, e não só sobre quem está numa equipe agora.
 */
export function rotulosCurtos(pessoas: readonly PessoaDaEquipe[]): Map<string, string> {
  const unicas = [...new Map(pessoas.map((pessoa) => [pessoa.id, pessoa])).values()];
  const todas = unicas.map((pessoa) => ({
    id: pessoa.id,
    nomeInteiro: chaveDeComparacao(pessoa.nome),
    degraus: degrausDoRotulo(pessoa.nome),
    degrau: 0,
  }));
  const rotuloDe = (p: (typeof todas)[number]) => p.degraus[p.degrau]!;

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
 * O tamanho que sai do número de computadores — a regra da api é diferença de
 * no máximo 1 entre as equipes, então isto é aritmética, não previsão.
 */
export function tamanhoDasEquipes(presentes: number, computadores: number): string {
  if (presentes <= 0 || computadores <= 0) return "Ninguém presente para dividir.";
  const quem = `${presentes} ${presentes === 1 ? "estudante" : "estudantes"}`;
  const onde = `${computadores} ${computadores === 1 ? "computador" : "computadores"}`;
  if (computadores >= presentes) return `${quem} em ${onde}: cada um no seu.`;
  const menor = Math.floor(presentes / computadores);
  const sobra = presentes % computadores;
  const tamanho = sobra === 0 ? `${menor}` : `${menor} ou ${menor + 1}`;
  return `${quem} em ${onde}: equipes de ${tamanho}.`;
}

/** O valor inicial do "Quantos computadores": o anterior, senão metade da turma. */
export function computadoresPadrao(estudantes: number, anterior: number | null | undefined): number {
  const teto = Math.max(1, estudantes);
  const base = anterior && anterior > 0 ? anterior : Math.ceil(estudantes / 2);
  return Math.min(teto, Math.max(1, base));
}

/** O resumo da sugestão no Instanooria, em uma linha. */
export function resumoDoAgrupamento(agrupamento: AgrupamentoDaSugestao): string {
  const mistas =
    agrupamento.equipesMistas === 0
      ? "Nenhuma equipe mista."
      : agrupamento.equipesMistas === 1
        ? "1 equipe mista."
        : `${agrupamento.equipesMistas} equipes mistas.`;
  return `${agrupamento.comGrupo} com lado, ${agrupamento.neutros} sem perfil (sorteados). ${mistas}`;
}

/**
 * O que impede o `PUT` de passar, dito ANTES de apertar Salvar — as mesmas
 * regras do Zod da api (toda equipe com alguém, nome de 1 a 30, sem repetir).
 * A api confere de novo; isto só evita mandar o professor de volta com um 400.
 */
export function problemasAntesDeSalvar(
  equipes: readonly { nome: string; membros: readonly unknown[] }[],
): string[] {
  if (equipes.length === 0) return ["Monte pelo menos uma equipe."];
  const problemas: string[] = [];
  const vistos = new Map<string, number>();
  let semNome = false;
  for (const equipe of equipes) {
    const nome = equipe.nome.trim();
    if (!nome) semNome = true;
    else if (nome.length > NOME_MAXIMO) problemas.push(`O nome "${nome}" passa de ${NOME_MAXIMO} caracteres.`);
    if (equipe.membros.length === 0) {
      problemas.push(
        nome
          ? `${nome}: sem ninguém. Ponha alguém nela ou remova a equipe.`
          : "Há uma equipe sem ninguém. Ponha alguém nela ou remova a equipe.",
      );
    }
    if (nome) {
      const chave = nome.toLocaleLowerCase("pt-BR");
      vistos.set(chave, (vistos.get(chave) ?? 0) + 1);
    }
  }
  if (semNome) problemas.unshift("Toda equipe precisa de um nome.");
  for (const equipe of equipes) {
    const nome = equipe.nome.trim();
    const chave = nome.toLocaleLowerCase("pt-BR");
    if (nome && (vistos.get(chave) ?? 0) > 1) {
      problemas.push(`Há mais de uma equipe com o nome "${nome}".`);
      vistos.delete(chave);
    }
  }
  /* Duas equipes vazias sem nome dariam a MESMA frase duas vezes. */
  return [...new Set(problemas)];
}

// ── o rascunho da edição ────────────────────────────────────────────────

export interface EquipeEmEdicao {
  /** Chave local: o id salvo, ou uma chave nova para equipe ainda não salva. */
  chave: string;
  nome: string;
  membros: PessoaDaEquipe[];
  /** O lado da sugestão (Instanooria). O hub não sabe o lado de ninguém. */
  grupo: LadoDoFeed | null;
  mista: boolean;
  /** O professor mexeu em quem está aqui: o lado da sugestão deixa de valer. */
  mexida: boolean;
}

export interface RascunhoDeEquipes {
  modo: ModoDeMontagem;
  computadores: number;
  ausentes: string[];
  equipes: EquipeEmEdicao[];
  semEquipe: PessoaDaEquipe[];
  agrupamento: AgrupamentoDaSugestao | null;
}

const porNome = (a: PessoaDaEquipe, b: PessoaDaEquipe) => a.nome.localeCompare(b.nome, "pt-BR");

/** Toda a turma, de onde quer que esteja, em ordem alfabética. */
export function turmaInteira(dados: Pick<EquipesDaMissao, "equipes" | "semEquipe">): PessoaDaEquipe[] {
  const todos = new Map<string, PessoaDaEquipe>();
  for (const pessoa of [...dados.equipes.flatMap((e) => e.membros), ...dados.semEquipe]) {
    todos.set(pessoa.id, pessoa);
  }
  return [...todos.values()].sort(porNome);
}

/**
 * "Sem equipe" de uma sugestão: quem ela devolveu e mais os ausentes, que ela
 * não devolve (a api só distribui os presentes).
 */
function semEquipeComAusentes(
  semEquipe: readonly PessoaDaEquipe[],
  ausentes: readonly string[],
  turma: readonly PessoaDaEquipe[],
): PessoaDaEquipe[] {
  const todos = new Map<string, PessoaDaEquipe>();
  for (const pessoa of semEquipe) todos.set(pessoa.id, pessoa);
  for (const pessoa of turma) if (ausentes.includes(pessoa.id)) todos.set(pessoa.id, pessoa);
  return [...todos.values()].sort(porNome);
}

export function rascunhoDaSugestao(
  sugestao: SugestaoDeEquipes,
  ausentes: readonly string[],
  turma: readonly PessoaDaEquipe[],
): RascunhoDeEquipes {
  return {
    modo: sugestao.modo,
    computadores: sugestao.computadores,
    ausentes: [...ausentes],
    equipes: sugestao.equipes.map((equipe, indice) => ({
      chave: `nova-${indice + 1}`,
      nome: equipe.nome,
      membros: [...equipe.membros],
      grupo: equipe.grupo,
      mista: equipe.mista,
      mexida: false,
    })),
    semEquipe: semEquipeComAusentes(sugestao.semEquipe, ausentes, turma),
    agrupamento: sugestao.agrupamento,
  };
}

export function rascunhoDasSalvas(dados: EquipesDaMissao): RascunhoDeEquipes {
  return {
    modo: dados.montagem?.modo ?? "manual",
    computadores: dados.montagem?.computadores ?? dados.equipes.length,
    ausentes: [...(dados.montagem?.ausentes ?? [])],
    equipes: [...dados.equipes]
      .sort((a, b) => a.ordem - b.ordem)
      .map((equipe) => ({
        chave: equipe.id,
        nome: equipe.nome,
        membros: [...equipe.membros],
        grupo: null,
        mista: false,
        mexida: false,
      })),
    semEquipe: [...dados.semEquipe].sort(porNome),
    agrupamento: null,
  };
}

/**
 * "Manter as equipes da última missão". Quem faltou HOJE sai da equipe e fica
 * em "Sem equipe" — a mesma regra do sorteio, que só distribui os presentes.
 */
export function rascunhoDaUltima(
  ultima: UltimasEquipes,
  ausentes: readonly string[],
  turma: readonly PessoaDaEquipe[],
): RascunhoDeEquipes {
  const faltou = new Set(ausentes);
  const equipes = ultima.equipes.map((equipe, indice) => ({
    chave: `nova-${indice + 1}`,
    nome: equipe.nome,
    membros: equipe.membros.filter((p) => !faltou.has(p.id)),
    grupo: null,
    mista: false,
    mexida: false,
  }));
  const tirados = ultima.equipes.flatMap((e) => e.membros).filter((p) => faltou.has(p.id));
  return {
    modo: "manual",
    computadores: equipes.length,
    ausentes: [...ausentes],
    equipes,
    semEquipe: semEquipeComAusentes([...ultima.semEquipe, ...tirados], ausentes, turma),
    agrupamento: null,
  };
}

/**
 * Leva um estudante para outra equipe (ou para "Sem equipe"). As duas equipes
 * envolvidas ficam `mexida`: a tag de lado da sugestão deixa de ser verdade, e
 * o hub não tem como recalculá-la. Quem faltou e foi posto numa equipe chegou
 * atrasado — sai dos ausentes.
 */
export function moverEstudante(
  rascunho: RascunhoDeEquipes,
  estudanteId: string,
  destino: string,
): RascunhoDeEquipes {
  const pessoa =
    rascunho.semEquipe.find((p) => p.id === estudanteId) ??
    rascunho.equipes.flatMap((e) => e.membros).find((p) => p.id === estudanteId);
  if (!pessoa) return rascunho;
  const origem = rascunho.equipes.find((e) => e.membros.some((p) => p.id === estudanteId))?.chave ?? SEM_EQUIPE;
  if (origem === destino) return rascunho;
  if (destino !== SEM_EQUIPE && !rascunho.equipes.some((e) => e.chave === destino)) return rascunho;

  const equipes = rascunho.equipes.map((equipe) => {
    if (equipe.chave === origem) {
      return { ...equipe, membros: equipe.membros.filter((p) => p.id !== estudanteId), mexida: true };
    }
    if (equipe.chave === destino) {
      return { ...equipe, membros: [...equipe.membros, pessoa], mexida: true };
    }
    return equipe;
  });
  const semEquipe =
    destino === SEM_EQUIPE
      ? [...rascunho.semEquipe, pessoa].sort(porNome)
      : rascunho.semEquipe.filter((p) => p.id !== estudanteId);
  const ausentes = destino === SEM_EQUIPE ? rascunho.ausentes : rascunho.ausentes.filter((id) => id !== estudanteId);
  return { ...rascunho, equipes, semEquipe, ausentes };
}

export function renomearEquipe(rascunho: RascunhoDeEquipes, chave: string, nome: string): RascunhoDeEquipes {
  return {
    ...rascunho,
    equipes: rascunho.equipes.map((e) => (e.chave === chave ? { ...e, nome: nome.slice(0, NOME_MAXIMO) } : e)),
  };
}

/** Remove a equipe; quem estava nela vai para "Sem equipe". */
export function removerEquipe(rascunho: RascunhoDeEquipes, chave: string): RascunhoDeEquipes {
  const alvo = rascunho.equipes.find((e) => e.chave === chave);
  if (!alvo) return rascunho;
  return {
    ...rascunho,
    equipes: rascunho.equipes.filter((e) => e.chave !== chave),
    semEquipe: [...rascunho.semEquipe, ...alvo.membros].sort(porNome),
  };
}

/** Uma equipe vazia a mais, com o primeiro "Equipe N" que ninguém usa. */
export function novaEquipe(rascunho: RascunhoDeEquipes): RascunhoDeEquipes {
  const usados = new Set(rascunho.equipes.map((e) => e.nome.trim().toLocaleLowerCase("pt-BR")));
  let n = rascunho.equipes.length + 1;
  while (usados.has(`equipe ${n}`)) n += 1;
  const chaves = new Set(rascunho.equipes.map((e) => e.chave));
  let k = rascunho.equipes.length + 1;
  while (chaves.has(`nova-${k}`)) k += 1;
  return {
    ...rascunho,
    equipes: [
      ...rascunho.equipes,
      { chave: `nova-${k}`, nome: `Equipe ${n}`, membros: [], grupo: null, mista: false, mexida: true },
    ],
  };
}

/**
 * O corpo do `PUT`. `computadores` vai como o número de equipes: é quantos
 * computadores a turma vai de fato usar depois de o professor criar ou remover
 * equipe. Os ausentes que ficaram são só os que continuam sem equipe.
 */
export function corpoParaSalvar(rascunho: RascunhoDeEquipes, versao: number): CorpoDasEquipes {
  const semEquipe = new Set(rascunho.semEquipe.map((p) => p.id));
  return {
    versao,
    modo: rascunho.modo,
    computadores: rascunho.equipes.length,
    ausentes: rascunho.ausentes.filter((id) => semEquipe.has(id)),
    equipes: rascunho.equipes.map((equipe) => ({
      nome: equipe.nome.trim(),
      membros: equipe.membros.map((p) => p.id),
    })),
  };
}
