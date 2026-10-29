import type { CoberturasDaTurma } from "../a-selecao-tipos";
import type { PacotesDaTurmaEfeito } from "../efeito-amplificador-tipos";
import type { PacotesDaTurmaAssistente } from "../assistente-invisivel-tipos";
import type { PacotesDaTurmaEnigma } from "../enigma-capa-tipos";
import type { PacotesDaTurmaNina } from "../nina-noticia-tipos";
import type { PacotesDaTurma } from "../jornal-escola-tipos";
import type { PacotesDoJuri } from "../juri-estadual-tipos";
import type { PacotesDaTurmaPortaVoz } from "../porta-voz-tipos";
import type { PacotesDaTurmaQuemMandou } from "../quem-mandou-tipos";

/**
 * AS ATIVIDADES DE UMA MISSÃO (ADR-130).
 *
 * A missão é o esqueleto narrativo; a ATIVIDADE é a missão que a turma faz de
 * fato, e quem a cria é sempre o professor — a plataforma não cria nada. Cada
 * missão é DONA das próprias atividades na api (a cobertura da exp07ef1b, o
 * pacote da exp04ef1b, da exp05ef1b e da exp06ef1b, a `activity` da
 * exp08ef1b); este módulo traduz as cinco respostas para a MESMA lista da
 * ficha, e diz para onde cada atividade leva.
 *
 * Puro, e vale no cliente: o botão "Usar esta atividade agora" importa daqui.
 * As leituras server-side moram em `atividades-servidor.ts`.
 */

/**
 * As missões com atividade — as nove primeiras são o mesmo par de
 * `equipes/regras.ts#EXPERIENCIAS_COM_ATIVIDADE` na api. A exp03em1b (O
 * Porta-Voz dos Dados, ADR-198) tem atividade (o pacote homologado) mas NÃO
 * tem equipe: é individual por desenho, e a api não a põe na lista das
 * equipes (lá ela só serve para achar a atividade da equipe). Ela está em
 * `MISSOES_SEM_EQUIPE`, e a criação pula o passo das equipes.
 */
export const MISSOES_COM_ATIVIDADE = ["exp08ef1b", "exp07ef1b", "exp04ef1b", "exp05ef1b", "exp06ef1b", "exp02em1b", "exp02ef1b", "exp01em1b", "exp03ef1b", "exp03em1b"] as const;
export type MissaoComAtividade = (typeof MISSOES_COM_ATIVIDADE)[number];

export function temAtividades(expId: string | null | undefined): expId is MissaoComAtividade {
  return (MISSOES_COM_ATIVIDADE as readonly string[]).includes(expId ?? "");
}

/**
 * As missões com atividade que são INDIVIDUAIS por desenho: a api responde
 * 400 `missao-sem-equipes` a qualquer montagem. A criação não pergunta como a
 * turma senta, e a página da atividade não tem a aba Equipes.
 */
export const MISSOES_SEM_EQUIPE: readonly MissaoComAtividade[] = ["exp03em1b"];

export function aceitaEquipes(expId: MissaoComAtividade): boolean {
  return !MISSOES_SEM_EQUIPE.includes(expId);
}

/**
 * O estado na lista. Uma atividade EM ANDAMENTO por turma — a que o professor
 * escolheu —; as outras ficam PRONTAS, à espera do "Usar esta atividade agora".
 * EM PREPARO só existe no Instanooria: os posts são gerados e revisados antes.
 */
export type EstadoDaAtividade = "em-andamento" | "pronta" | "em-preparo";

export const ROTULO_DO_ESTADO: Record<EstadoDaAtividade, { rotulo: string; variante: "success" | "info" | "warning" }> = {
  "em-andamento": { rotulo: "Em andamento", variante: "success" },
  pronta: { rotulo: "Pronta", variante: "info" },
  "em-preparo": { rotulo: "Em preparo", variante: "warning" },
};

/** Uma atividade como a ficha a lista — a mesma forma para as cinco missões. */
export interface AtividadeNaLista {
  id: string;
  titulo: string;
  /** A linha de baixo: disciplina, origem — o que distingue duas atividades do mesmo tema. */
  detalhe: string;
  estado: EstadoDaAtividade;
  criadaEm: string;
  /** Quantas rodadas já rodaram; 0 = nunca rodou. */
  rodadas: number;
  /** Uma linha a mais, da missão: a pergunta-chave do Instanooria. */
  complemento?: string | null;
  /** Só no Instanooria, a única missão que EXCLUI atividade: o que vai junto. */
  exclusao?: { posts: number; sessoes: number };
}

/** "nunca rodou" / "1 rodada" / "3 rodadas". */
export function textoDasRodadas(n: number): string {
  if (n <= 0) return "nunca rodou";
  return n === 1 ? "1 rodada" : `${n} rodadas`;
}

const ORIGEM = { ia: "gerada com IA", padrao: "conteúdo da Unooria" } as const;

/**
 * A série da missão, a partir do código (ADR-110): `exp07ef1b` → `7EF`. É o
 * filtro das turmas que podem fazer a missão — a do 7º ano não roda no 8º.
 */
export function serieDaMissao(expId: string): string | null {
  /* `-vN` é a versão anterior (ADR-181): mora na mesma série. */
  const m = /^exp(\d{2})(ef|em)\d+b(-v\d+)?$/.exec(expId);
  if (!m) return null;
  return `${Number(m[1])}${(m[2] as string).toUpperCase()}`;
}

/**
 * Para onde a atividade leva — a PÁGINA DA ATIVIDADE. No Instanooria é a tela
 * dela, que já existia; nas outras, a aula e os resultados da missão com
 * a atividade escolhida na URL (o mesmo `?cobertura=`/`?pacote=` que o painel de
 * habilidades já lia).
 */
export function rotaDaAtividade(rotaDaMissao: string, expId: MissaoComAtividade, turmaId: string, atividadeId: string): string {
  if (expId === "exp08ef1b") return `/professor/atividades/${encodeURIComponent(atividadeId)}`;
  const chave = expId === "exp07ef1b" ? "cobertura" : "pacote";
  const busca = new URLSearchParams({ turmaId, [chave]: atividadeId });
  return `${rotaDaMissao}/resultados?${busca.toString()}`;
}

/** Onde se cria a próxima. O Instanooria tem a criação dele (a geração dos posts é longa e assíncrona). */
export function rotaDaNovaAtividade(rotaDaMissao: string, expId: MissaoComAtividade, turmaId: string): string {
  const busca = new URLSearchParams({ turmaId }).toString();
  if (expId === "exp08ef1b") return `/professor/atividades/nova?${busca}`;
  return `${rotaDaMissao}/atividades/nova?${busca}`;
}

/**
 * O caminho de "Usar esta atividade agora", sem o prefixo do BFF. No
 * Instanooria é o "Ativar" de sempre — que confere a matriz e pode responder
 * 422 com as pendências.
 */
export function caminhoDoEmAndamento(expId: MissaoComAtividade, turmaId: string, atividadeId: string): string {
  const t = encodeURIComponent(turmaId);
  const a = encodeURIComponent(atividadeId);
  switch (expId) {
    case "exp08ef1b":
      return `/atividades/${a}/ativar`;
    case "exp07ef1b":
      return `/a-selecao/turmas/${t}/coberturas/${a}/em-andamento`;
    case "exp04ef1b":
      return `/jornal-escola/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp05ef1b":
      return `/quem-mandou-isso/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp06ef1b":
      return `/juri-estadual/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp02em1b":
      return `/efeito-amplificador/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp02ef1b":
      return `/enigma-capa/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp01em1b":
      return `/assistente-invisivel/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp03ef1b":
      return `/nina-noticia/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp03em1b":
      /* Aqui o em andamento é da TURMA, e o pacote vai no corpo (`corpoDoEmAndamento`). */
      return `/porta-voz-dos-dados/turmas/${t}/em-andamento`;
  }
}

/**
 * O corpo de "Usar esta atividade agora". Nas irmãs a atividade vai no
 * caminho e o corpo é vazio; no Instanooria vai o `forcar` (as pendências do
 * 422); na exp03em1b o pacote vai no corpo.
 */
export function corpoDoEmAndamento(expId: MissaoComAtividade, atividadeId: string, forcar = false): Record<string, unknown> {
  if (expId === "exp08ef1b") return { forcar };
  if (expId === "exp03em1b") return { pacoteId: atividadeId };
  return {};
}

/** A atividade do Instanooria como `GET /atividades` a devolve. */
export interface AtividadeDoInstanooria {
  id: string;
  turmaId: string | null;
  titulo: string;
  disciplina: string;
  recorte: string;
  perguntaChave: string;
  status: string;
  criadoEm: string;
  posts: number;
  sessoes: number;
}

/** O ciclo de vida do Instanooria em três estados: ativa, pronta (revisão ou encerrada), em preparo. */
export function estadoDoInstanooria(status: string): EstadoDaAtividade {
  if (status === "ativa") return "em-andamento";
  if (status === "revisao" || status === "encerrada") return "pronta";
  return "em-preparo";
}

export function atividadesDoInstanooria(atividades: readonly AtividadeDoInstanooria[]): AtividadeNaLista[] {
  return atividades.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    detalhe: [a.disciplina, a.recorte].filter(Boolean).join(" · "),
    estado: estadoDoInstanooria(a.status),
    criadaEm: a.criadoEm,
    /* O Instanooria não tem rodada: quem rodou é quem teve sessão. */
    rodadas: a.sessoes > 0 ? 1 : 0,
    complemento: a.perguntaChave || null,
    exclusao: { posts: a.posts, sessoes: a.sessoes },
  }));
}

export function atividadesDaSelecao(c: CoberturasDaTurma): AtividadeNaLista[] {
  return c.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [h.foco, ORIGEM[h.origem]].filter(Boolean).join(" · "),
    /* Sem a segunda fase da aprovação (ADR-146), a atividade não vai ao ar:
       "Em preparo", e o card não oferece "Usar esta atividade agora" — a api
       recusaria com 409 `imagens-nao-aprovadas`. */
    estado: h.ativa ? "em-andamento" : h.imagensAprovadas ? "pronta" : "em-preparo",
    criadaEm: h.criadaEm,
    rodadas: h.rodadas,
  }));
}

export function atividadesDoJornal(p: PacotesDaTurma): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [h.disciplina, ORIGEM[h.origem]].join(" · "),
    /* Sem as imagens geradas e aprovadas (ADR-147), a atividade não vai ao ar:
       "Em preparo", e o card não oferece "Usar esta atividade agora" — a api
       recusaria com 409 `imagens-nao-aprovadas`. */
    estado: h.ativo ? "em-andamento" : h.imagensAprovadas ? "pronta" : "em-preparo",
    criadaEm: h.criadoEm,
    rodadas: h.rodadas,
  }));
}

export function atividadesDoQuemMandou(
  p: PacotesDaTurmaQuemMandou,
  rotuloDaDisciplina: (slug: string) => string,
): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
    estado: h.ativo ? "em-andamento" : "pronta",
    criadaEm: h.aprovadoEm,
    rodadas: h.rodadas,
  }));
}

/** O Júri Estadual: o pacote homologado é a atividade, como no Jornal. A disciplina vem em slug. */
export function atividadesDoJuri(p: PacotesDoJuri, rotuloDaDisciplina: (slug: string) => string): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
    /* Sem as imagens aprovadas (a segunda fase, o pedido do PO), a atividade não
       vai ao ar: "Em preparo", sem "Usar esta atividade agora" — a api recusaria
       com 409 `imagens-nao-aprovadas`. A que já está no ar continua no ar. */
    estado: h.ativo ? "em-andamento" : h.imagensAprovadas ? "pronta" : "em-preparo",
    criadaEm: h.criadoEm,
    rodadas: h.rodadas,
  }));
}

/** O Efeito Amplificador (ADR-181): o pacote homologado é a atividade, sem segunda fase de aprovação. */
export function atividadesDoEfeito(p: PacotesDaTurmaEfeito, rotuloDaDisciplina: (slug: string) => string): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
    estado: h.ativo ? "em-andamento" : "pronta",
    criadaEm: h.aprovadoEm,
    rodadas: h.rodadas,
  }));
}

/**
 * O Enigma da Capa da Rádio (ADR-184): o pacote aprovado é a atividade, sem
 * segunda fase. O título é o tema; a linha de baixo diz a disciplina e a origem
 * (pacote pronto ou gerado com IA).
 */
export function atividadesDoEnigma(p: PacotesDaTurmaEnigma, rotuloDaDisciplina: (slug: string) => string): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
    estado: h.ativo ? "em-andamento" : "pronta",
    criadaEm: h.aprovadoEm,
    rodadas: h.rodadas,
  }));
}

/**
 * O Assistente Invisível (ADR-185): o pacote homologado é a atividade, sem
 * segunda fase. O título é o tema; a linha de baixo diz a disciplina e a origem.
 */
export function atividadesDoAssistente(p: PacotesDaTurmaAssistente, rotuloDaDisciplina: (slug: string) => string): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
    estado: h.ativo ? "em-andamento" : "pronta",
    criadaEm: h.aprovadoEm,
    rodadas: h.rodadas,
  }));
}

/**
 * Nina e a Notícia que Desapareceu (ADR-197): o pacote homologado é a
 * atividade, como no Júri — com a SEGUNDA fase da aprovação (as imagens, ADR-146).
 * Sem ela a atividade é "Em preparo", e o card não oferece "Usar esta atividade
 * agora": a api recusaria com 409 `imagens-nao-aprovadas`.
 */
export function atividadesDaNina(p: PacotesDaTurmaNina, rotuloDaDisciplina: (slug: string) => string): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
    estado: h.ativo ? "em-andamento" : h.imagensAprovadas ? "pronta" : "em-preparo",
    criadaEm: h.criadoEm,
    rodadas: h.rodadas,
  }));
}

/**
 * O Porta-Voz dos Dados (ADR-198): o pacote HOMOLOGADO é a atividade. A lista
 * da api traz também o rascunho da curadoria (`aprovadoEm: null`), que não é
 * atividade ainda — fica de fora.
 */
export function atividadesDoPortaVoz(p: PacotesDaTurmaPortaVoz, rotuloDaDisciplina: (slug: string) => string): AtividadeNaLista[] {
  return p.pacotes.flatMap((h) =>
    h.aprovadoEm
      ? [
          {
            id: h.id,
            titulo: h.tema,
            detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
            estado: h.ativo ? ("em-andamento" as const) : ("pronta" as const),
            criadaEm: h.aprovadoEm,
            rodadas: h.rodadas,
          },
        ]
      : [],
  );
}

/**
 * A ordem da lista: a EM ANDAMENTO primeiro (é a pergunta de quem abre a
 * ficha: "o que a turma está fazendo?"), depois da mais nova à mais velha.
 */
export function ordenarAtividades(lista: readonly AtividadeNaLista[]): AtividadeNaLista[] {
  return [...lista].sort((a, b) => {
    const pesoA = a.estado === "em-andamento" ? 0 : 1;
    const pesoB = b.estado === "em-andamento" ? 0 : 1;
    return pesoA - pesoB || b.criadaEm.localeCompare(a.criadaEm);
  });
}
