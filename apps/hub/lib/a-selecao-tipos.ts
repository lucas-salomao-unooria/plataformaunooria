/**
 * O que o hub lê da exp07ef1b (A Seleção) — espelho do Zod de
 * `apps/api/src/a-selecao/contrato-de-rotas.ts`, que é a fonte da verdade.
 *
 * Note o que NÃO existe aqui, e cada ausência é uma regra:
 *
 * - **Nenhum nível, nota ou acerto por criança.** A linha do painel tem a
 *   tríade, a matriz e o par — o que a criança ESCOLHEU, nunca o que ela "é".
 *   O nível da EF07CO11 que a IA sugere mora no painel de habilidades
 *   (`lib/evidencias.ts`), com a origem e o ajuste do professor. A lista da api
 *   está em `PROIBIDO_NO_PAINEL` (`apps/api/src/a-selecao/invariantes.ts`).
 * - **Nenhum tipo de sessão de estudante.** O lado dele vive no bundle da
 *   experiência; daqui o hub só prepara e conduz.
 *
 * `legenda` e `reflexaoTexto` vêm preenchidos só para quem LECIONA a turma — o
 * recorte da ADR-108 é da api, que os devolve `null` para gestor e admin. A
 * tela não tem ramo por papel: `null` com `publicou`/`entregouReflexao` vira
 * "entregou".
 *
 * O gabarito do post (`enquadramento`, `tagFonte`, `tagAngulo`) aparece em
 * `PostDaCobertura`, que só rota de professor devolve. Quem o esconde do
 * estudante é a api, pela allowlist do post público — não esta camada.
 *
 * As funções daqui são PURAS: o painel ao vivo e o preparo são client
 * components e importam deste arquivo, e o `vitest` do hub só varre `lib/`.
 */

// ─────────────────────────────────────────────────────────────── o vocabulário

/** As etapas da TURMA, na ordem em que o botão único as abre. */
export type EtapaDaTurma = "exploracao" | "mural" | "fichas" | "explicacao";

/** Onde o estudante está — o passo EFETIVO, já reconciliado com a etapa. */
export type PassoDoEstudante =
  | "desafio"
  | "feed"
  | "salvos"
  | "publicado"
  | "mural"
  | "fichas"
  | "explicacao"
  | "reflexao"
  | "enquetes"
  | "fim";

/** As três lentes da cobertura. Cada veículo cobre com uma. */
export type Enquadramento = "institucional" | "comunitario" | "estatistico";

export type PerfilDoVeiculo = "@folhaoficial_" | "@voz_coletiva" | "@metrica_urbana";

/** `post_a_1` a `post_c_4`: o bloco (`a`/`b`/`c`) amarra o veículo e a lente. */
export type IdDePost = string;

/** A matriz de uma tríade, em CONTAGEM (0 a 3, somando 3); a da sala, em percentual. */
export type Matriz = Record<Enquadramento, number>;

/** De onde veio a cobertura. `padrao` não é falha: é o banco curado da Unooria. */
export type OrigemDaCobertura = "padrao" | "ia";

// ──────────────────────────────────────────────────────────────── o post

export interface GraficoDoPost {
  tipo: "barras" | "linhas" | "mapa-de-calor";
  titulo: string;
  unidade: string;
  series: Array<{ rotulo: string; valor: number }>;
  destaque?: string;
}

/**
 * Um post COMPLETO, com o gabarito — o que a professora lê, edita e aprova.
 * Só entra e sai por rota de professor.
 */
export interface PostDaCobertura {
  id: IdDePost;
  perfil: PerfilDoVeiculo;
  enquadramento: Enquadramento;
  autoridadeCitada?: string;
  descricaoImagem: string;
  legenda: string;
  tagFonte: string;
  tagAngulo: string;
  curtidas: number;
  comentarios: number;
  comentariosDestaque: [string, string];
  /** Só nos posts de números do banco curado: a experiência desenha o gráfico. */
  grafico?: GraficoDoPost;
}

// ─────────────────────────────────────────────────────── as rotas do professor

/** `GET /a-selecao/turmas`. `serie` é anulável no contrato (rostering sem série). */
export interface TurmaDaSelecao {
  id: string;
  nome: string;
  serie: string | null;
  estudantes: number;
}

/** A equipe de uma linha, como ESTA api a devolve: sem os membros. */
export interface EquipeDaLinha {
  id: string;
  nome: string;
}

/**
 * Uma linha do painel — um COMPUTADOR quando a turma montou equipes, uma
 * criança quando não (`resumo.porComputador`).
 */
export interface LinhaDoPainel {
  estudanteId: string;
  nome: string;
  usuario: string;
  equipe: EquipeDaLinha | null;
  iniciou: boolean;
  passo: PassoDoEstudante;
  publicou: boolean;
  publicadaEm: string | null;
  selecao: IdDePost[] | null;
  matriz: Matriz | null;
  /** Texto livre de menor: `null` para quem não leciona a turma (ADR-108). */
  legenda: string | null;
  par: { rotulo: string; virtual: boolean } | null;
  tempoFeedS: number | null;
  entregouReflexao: boolean;
  /** Texto livre de menor: `null` para quem não leciona a turma (ADR-108). */
  reflexaoTexto: string | null;
  concluiu: boolean;
}

export interface ResumoDaMidia {
  /** Quantos posts pedem imagem. Os de gráfico não contam. */
  total: number;
  prontas: number;
}

/** `GET /a-selecao/turmas/:turmaId/painel`. */
export interface PainelDaSelecao {
  turma: { id: string; nome: string; serie: string | null };
  cobertura: {
    id: string;
    tema: string;
    foco: string | null;
    origem: OrigemDaCobertura;
    midia: ResumoDaMidia;
  };
  rodada: number;
  etapa: EtapaDaTurma;
  /** O rótulo do botão único: a próxima etapa, ou `null` depois da explicação. */
  proximaEtapa: EtapaDaTurma | null;
  linhas: LinhaDoPainel[];
  resumo: {
    total: number;
    iniciaram: number;
    publicaram: number;
    entregaram: number;
    concluiram: number;
    /** "X de Y computadores publicaram". Y sai da montagem das equipes quando há. */
    computadores: { publicaram: number; total: number };
    porComputador: boolean;
    /** O perfil editorial médio da sala, em percentuais inteiros que somam 100. */
    distribuicaoMedia: Matriz;
  };
}

/** `POST /a-selecao/turmas/:turmaId/gate`. */
export interface GateDaTurma {
  turma: { id: string; nome: string; serie: string | null };
  coberturaId: string;
  rodada: number;
  etapa: EtapaDaTurma;
  proximaEtapa: EtapaDaTurma | null;
  /** Quantas tríades receberam par NESTA chamada (só na abertura do Mural). */
  pareadas: number;
  atualizadoEm: string;
}

/** `GET /a-selecao/turmas/:turmaId/coberturas`. */
export interface CoberturasDaTurma {
  /** A atividade em andamento, COM o gabarito (é a tela do preparo). */
  ativa: {
    id: string;
    tema: string;
    foco: string | null;
    origem: OrigemDaCobertura;
    rodada: number;
    etapa: EtapaDaTurma;
    posts: PostDaCobertura[];
    midia: ResumoDaMidia;
  };
  /** Todas as coberturas da turma, a ativa inclusa, da mais nova para a mais velha. */
  historico: Array<{
    id: string;
    tema: string;
    foco: string | null;
    origem: OrigemDaCobertura;
    ativa: boolean;
    criadaEm: string;
    /** A maior rodada com sessão; 0 = nunca rodou. */
    rodadas: number;
  }>;
}

/** `POST gerar-conteudo` — RASCUNHO, não persiste. `usouIa: false` = banco curado. */
export interface RascunhoDaCobertura {
  tema: string;
  foco: string | null;
  origem: OrigemDaCobertura;
  usouIa: boolean;
  posts: PostDaCobertura[];
}

/** `POST gerar-midia` — o progresso de UMA chamada (até duas imagens novas). */
export interface ProgressoDaMidia {
  coberturaId: string;
  total: number;
  prontas: number;
  faltam: number;
  /** Os posts cuja imagem saiu NESTA chamada. */
  geradas: IdDePost[];
  /** Os que falharam NESTA chamada — seguem com o card da descrição. */
  falharam: IdDePost[];
  completo: boolean;
  /** Todas as URLs conhecidas da cobertura, por post. */
  midia: Record<string, string>;
}

/** `GET /a-selecao/professor/material` — o bloco vivo do guia. */
export interface MaterialDaSelecao {
  tema: string;
  posts: PostDaCobertura[];
  roteiroDaEtapa4: { aviso: string; perguntas: string[] };
  /** Quando apertar cada botão. A chave é a etapa de DESTINO. */
  gatilhos: Record<Exclude<EtapaDaTurma, "exploracao">, string>;
  colegasVirtuais: Array<{ id: "tomas" | "malu"; nome: string; selecao: IdDePost[]; legenda: string }>;
}

/** O corpo de erro da api: `{codigo, mensagem}`, e `erros[]` no `lote-invalido`. */
export interface ErroDaSelecao {
  codigo?: string;
  mensagem?: string;
  erros?: string[];
}

// ───────────────────────────────────────────────────────────── os rótulos

/** O que cada etapa quer dizer na tela da professora. */
export const ROTULO_DA_ETAPA: Record<EtapaDaTurma, string> = {
  exploracao: "Exploração — cada um no feed, nos salvos e na publicação",
  mural: "Mural da Turma — os Stories pareados, sem as fichas",
  fichas: "Fichas técnicas reveladas — quem cada post ouviu",
  explicacao: "Conclusão individual — os cards, a reflexão e as enquetes",
};

/**
 * O rótulo do botão único, pela etapa de DESTINO — verbatim do sheet
 * (`prof.gatilho.*`, "Strings do professor"). A suíte e2e casa por
 * texto exato: mudar aqui é mudar lá.
 */
export const ROTULO_DO_BOTAO: Record<Exclude<EtapaDaTurma, "exploracao">, string> = {
  mural: "Liberar Mural da Turma",
  fichas: "Revelar Fichas Técnicas",
  explicacao: "Liberar Conclusão Individual",
};

/** O rótulo do botão para a próxima etapa, ou `null` quando não há próxima. */
export function rotuloDoBotao(proxima: EtapaDaTurma | null): string | null {
  if (proxima === null || proxima === "exploracao") return null;
  return ROTULO_DO_BOTAO[proxima];
}

/** O que o estudante está vendo agora, em uma linha. */
export const ROTULO_DO_PASSO: Record<PassoDoEstudante, string> = {
  desafio: "Lendo o pedido da Amara",
  feed: "Rolando o feed",
  salvos: "Escolhendo nos salvos",
  publicado: "Publicou — esperando o Mural",
  mural: "No Mural da Turma",
  fichas: "Vendo as fichas técnicas",
  explicacao: "Lendo os cards da conclusão",
  reflexao: "Escrevendo a reflexão",
  enquetes: "Respondendo as enquetes",
  fim: "Concluiu",
};

/**
 * As três lentes em linguagem de professor. É a mesma divisão que o gráfico
 * da ficha técnica mostra à turma: Oficial é a lente institucional da
 * `@folhaoficial_`, Comunitária a da `@voz_coletiva`, Números a estatística da
 * `@metrica_urbana`.
 */
export const ROTULO_DA_LENTE: Record<Enquadramento, string> = {
  institucional: "Oficial",
  comunitario: "Comunitária",
  estatistico: "Números",
};

const LENTES: readonly Enquadramento[] = ["institucional", "comunitario", "estatistico"];

export const ROTULO_DA_ORIGEM: Record<OrigemDaCobertura, string> = {
  padrao: "curada pela Unooria",
  /* "aprovada", sem "por você": quem aprovou pode ter sido a coordenação. */
  ia: "gerada com IA e aprovada",
};

/**
 * A lente de um post pelo id. A amarra é de POSIÇÃO e a api a cobra na
 * homologação (bloco `a` = institucional, `b` = comunitário, `c` =
 * estatístico) — por isso ela vale para qualquer cobertura, curada ou gerada.
 */
export function lenteDoPost(id: IdDePost): Enquadramento | null {
  const bloco = /^post_([abc])_[1-4]$/.exec(id)?.[1];
  if (bloco === "a") return "institucional";
  if (bloco === "b") return "comunitario";
  if (bloco === "c") return "estatistico";
  return null;
}

// ────────────────────────────────────────────────────── as leituras do painel

/**
 * A matriz de uma tríade em linguagem de professor: "2 Oficial · 1 Números".
 * Lente com zero não aparece — a ausência é o que a leitura procura, e ela
 * salta mais sem um "0" ao lado.
 */
export function descreverMatriz(m: Matriz | null): string {
  if (!m) return "—";
  const partes = LENTES.filter((l) => m[l] > 0).map((l) => `${m[l]} ${ROTULO_DA_LENTE[l]}`);
  return partes.length > 0 ? partes.join(" · ") : "—";
}

/**
 * O `prof.dash.distribuicao` do sheet, com as lentes no vocabulário desta
 * tela. Sala sem ninguém publicado não tem perfil: `null`, e a tela cala.
 */
export function distribuicaoDaSala(m: Matriz, publicaram: number): string | null {
  if (publicaram === 0) return null;
  return `Perfil editorial médio da sala: ${m.institucional}% ${ROTULO_DA_LENTE.institucional}, ${m.comunitario}% ${ROTULO_DA_LENTE.comunitario}, ${m.estatistico}% ${ROTULO_DA_LENTE.estatistico}.`;
}

/**
 * Com quem a publicação foi pareada no Mural. O rótulo é o que a api
 * CONGELOU no pareamento (o primeiro nome, o nome da equipe, ou Tomás/Malu).
 */
export function textoDoPar(par: LinhaDoPainel["par"]): string | null {
  if (!par) return null;
  return par.virtual ? `com ${par.rotulo} (colega virtual)` : `com ${par.rotulo}`;
}

/**
 * O `prof.dash.taxa_envio` do sheet. Com equipes, o sujeito é o computador:
 * chamar de "estudantes" o que é uma máquina com três crianças diante dela
 * faria a professora esperar gente que já publicou.
 */
export function textoDoEnvio(
  computadores: PainelDaSelecao["resumo"]["computadores"],
  porComputador: boolean,
): string {
  const sujeito = porComputador ? "computadores" : "estudantes";
  return `${computadores.publicaram} de ${computadores.total} ${sujeito} publicaram os Stories nos perfis simulados.`;
}

/** Quantos % publicaram, inteiro. Turma vazia: 0, nunca `NaN`. */
export function percentualPublicado(computadores: PainelDaSelecao["resumo"]["computadores"]): number {
  if (computadores.total <= 0) return 0;
  return Math.round((computadores.publicaram / computadores.total) * 100);
}

/** O piso do sheet para abrir o Mural (`prof.gatilho.mural`). */
export const PISO_DO_MURAL = 80;

/**
 * A aula ainda CORRE? É o que decide se o painel continua consultando. Para
 * quando a turma inteira concluiu a última etapa — antes disso sempre há
 * algo a acompanhar (publicação, reflexão, enquete).
 */
export function aulaEmAndamento(p: Pick<PainelDaSelecao, "etapa" | "resumo">): boolean {
  return !(p.etapa === "explicacao" && p.resumo.total > 0 && p.resumo.concluiram >= p.resumo.total);
}

/**
 * Um post da tríade em uma linha: a lente e o começo da legenda, que é por
 * onde a professora reconhece o post que a criança cita. Sem o post à mão (a
 * cobertura mudou entre duas leituras), fica só a lente — que o id garante.
 */
export function rotuloDoPost(id: IdDePost, posts: readonly PostDaCobertura[]): string {
  const lente = lenteDoPost(id);
  const rotuloDaLente = lente ? ROTULO_DA_LENTE[lente] : "Post";
  const post = posts.find((p) => p.id === id);
  if (!post) return rotuloDaLente;
  const palavrasDaLegenda = post.legenda.trim().split(/\s+/);
  const inicio = palavrasDaLegenda.slice(0, 6).join(" ");
  return `${rotuloDaLente}: “${inicio}${palavrasDaLegenda.length > 6 ? "…" : ""}”`;
}

/**
 * Alfabética pelo que a primeira célula MOSTRA — o nome da equipe, quando há
 * —, com número como número ("Equipe 2" antes de "Equipe 10"). Nunca por
 * lente, publicação ou velocidade: listagem ordenável vira ranking.
 */
export function ordenarLinhas(linhas: readonly LinhaDoPainel[]): LinhaDoPainel[] {
  const rotulo = (l: LinhaDoPainel) => l.equipe?.nome ?? l.nome;
  return [...linhas].sort((a, b) =>
    rotulo(a).localeCompare(rotulo(b), "pt-BR", { sensitivity: "base", numeric: true }),
  );
}

/** "nunca rodou" / "1 rodada" / "3 rodadas" — o histórico de coberturas. */
export function textoDasRodadas(n: number): string {
  if (n <= 0) return "nunca rodou";
  return n === 1 ? "1 rodada" : `${n} rodadas`;
}

// ────────────────────────────────────────────────────────────── o preparo

/**
 * O teto de leitura da legenda do post (critério 7 do brief), repetido aqui
 * de propósito: a fonte é `PALAVRAS_DA_LEGENDA` em
 * `apps/api/src/a-selecao/regras/lote.ts`, e quem RECUSA é a api
 * (`lote-invalido`, com a frase). O que mora aqui é o APONTAMENTO — qual post,
 * enquanto ela digita —, que só a tela sabe onde desenhar. É a lição do
 * preparo da v1 da exp05ef1b: um 400 sobre doze legendas, sem dizer qual, faz a
 * professora reler todas com a turma esperando.
 */
export const PALAVRAS_DA_LEGENDA = { min: 20, max: 45 } as const;

/** O teto de caracteres do `PostDaCoberturaSchema` — a mesma ressalva de cima. */
export const CARACTERES_DA_LEGENDA_MAX = 320;

export function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** O que falta na legenda de um post, em frase para a professora. `null` = pode aprovar. */
export function problemaDaLegenda(legenda: string): string | null {
  const n = palavras(legenda);
  if (n === 0) return "A legenda não pode ficar vazia.";
  /* `.length`, e não code points: é a régua do `z.string().max()` da api. */
  if (legenda.trim().length > CARACTERES_DA_LEGENDA_MAX) {
    return `Encurte para até ${CARACTERES_DA_LEGENDA_MAX} caracteres.`;
  }
  if (n < PALAVRAS_DA_LEGENDA.min) return `Tem ${n} palavras; o mínimo é ${PALAVRAS_DA_LEGENDA.min}.`;
  if (n > PALAVRAS_DA_LEGENDA.max) return `Tem ${n} palavras; o máximo é ${PALAVRAS_DA_LEGENDA.max}.`;
  return null;
}

/** O tema: de 5 a 100 caracteres depois do `trim` (`ParametrosDoPreparoSchema`, em `.length`). */
export const TEMA = { min: 5, max: 100 } as const;
export const FOCO_MAX = 100;

/**
 * O lote na tela é o MESMO que está em andamento? Aprovar de novo o que já
 * roda criaria uma atividade nova idêntica — e a turma voltaria à rodada 1 sem
 * nada ter mudado. Compara o que a professora pode mexer: tema, foco e as
 * legendas (o resto do post não é editável nesta tela).
 */
export function mesmoLote(
  a: { tema: string; foco: string | null; posts: readonly Pick<PostDaCobertura, "id" | "legenda">[] },
  b: { tema: string; foco: string | null; posts: readonly Pick<PostDaCobertura, "id" | "legenda">[] },
): boolean {
  if (a.tema.trim() !== b.tema.trim()) return false;
  if ((a.foco ?? "").trim() !== (b.foco ?? "").trim()) return false;
  if (a.posts.length !== b.posts.length) return false;
  const legendaDe = new Map(b.posts.map((p) => [p.id, p.legenda.trim()]));
  return a.posts.every((p) => legendaDe.get(p.id) === p.legenda.trim());
}

// ─────────────────────────────────────────────────────────────── as imagens

/**
 * O laço do "Gerar imagens": a api gera ATÉ DUAS por chamada (o BFF corta em
 * 30 s e doze não cabem), e o cliente repete. Para em dois casos:
 *
 * - `completo` — não falta nada;
 * - a chamada não gerou NENHUMA — tudo o que sobrou falhou. Repetir aí é pedir
 *   de novo as mesmas imagens que o provedor acabou de recusar, em laço, e
 *   cobrar da quota da professora a cada volta.
 */
export function continuarGerando(p: Pick<ProgressoDaMidia, "completo" | "geradas">): boolean {
  return !p.completo && p.geradas.length > 0;
}

/**
 * As falhas ACUMULADAS entre chamadas. Um post que falhou numa volta e saiu
 * na seguinte deixa de ser falha — a verdade é o `midia` da última resposta.
 */
export function falhasAcumuladas(anteriores: readonly IdDePost[], p: Pick<ProgressoDaMidia, "falharam" | "midia">): IdDePost[] {
  const todas = new Set([...anteriores, ...p.falharam]);
  return [...todas].filter((id) => !p.midia[id]).sort();
}

/** "8 de 8 imagens prontas" — e o caso da cobertura que não pede imagem. */
export function textoDoProgressoDaMidia(m: ResumoDaMidia): string {
  if (m.total === 0) return "Nenhum post desta cobertura pede imagem.";
  if (m.prontas >= m.total) return m.total === 1 ? "A imagem está pronta." : `As ${m.total} imagens estão prontas.`;
  return `${m.prontas} de ${m.total} ${m.total === 1 ? "imagem pronta" : "imagens prontas"}.`;
}
