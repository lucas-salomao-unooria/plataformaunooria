/**
 * EVIDÊNCIA PEDAGÓGICA (E14): o que o hub lê e escreve em `/evidencias/*`.
 *
 * Por estudante, quais habilidades da BNCC ele DEMONSTROU numa atividade de uma
 * missão, rodada a rodada. O contrato é o Zod de
 * `apps/api/src/evidencias/contrato-de-rotas.ts`; estes tipos são a leitura dele
 * do lado do hub, como `equipes.ts`. Quem decide nível, origem, cópia da equipe
 * e o que conta é a api — aqui só se traduz para a tela.
 *
 * Este arquivo é PURO e vale no cliente: o painel (`components/evidencias/`)
 * importa daqui. As leituras server-side moram em `evidencias-servidor.ts`, que
 * carrega `server-only` — juntar as duas faria o bundle do cliente quebrar no
 * primeiro import.
 *
 * NUNCA HÁ RANKING. Nenhuma função daqui ordena estudantes por nível, e nenhuma
 * soma níveis numa nota: o nível é de uma habilidade, não da criança. A única
 * ordem que existe é a alfabética, com a equipe junta (`ordenarPorEquipe`).
 */

// ── o contrato ──────────────────────────────────────────────────────────

/** O que uma marca pode dizer — o nível que a missão observou. */
export type Nivel = "atingiu" | "em_processo" | "nao_atingiu";

/** O nível, mais o N/A EXPLÍCITO que só o professor põe ("Não participou"). */
export type StatusDaEvidencia = Nivel | "nao_participou";

/** De onde a evidência veio. */
export type Origem = "propria" | "equipe" | "projecao" | "professor";

/** `a_revisar` só existe na cópia da aula projetada, e não conta até o professor confirmar. */
export type Situacao = "valida" | "a_revisar";

export interface HabilidadeDaFicha {
  codigo: string;
  /** O texto da BNCC, verbatim. */
  descricao: string;
  /**
   * O critério de cada nível, em texto para o professor (ADR-145). `null` na
   * habilidade que saiu da ficha; opcional porque as outras leituras (perfil
   * do aluno, consolidado) não o trazem.
   */
  criterios?: CriteriosDaHabilidade | null;
}

export interface CriteriosDaHabilidade {
  atingiu: string;
  em_processo: string;
  nao_atingiu: string;
  /** De onde vem o nível quando há mais de um marcador ("vale o melhor entre…"). */
  observacao?: string;
}

export interface EvidenciaNaCelula {
  status: StatusDaEvidencia;
  origem: Origem;
  situacao: Situacao;
}

export interface EstudanteDoPainel {
  id: string;
  nome: string;
  /** O computador em que a criança está nesta missão (E13), ou `null`. */
  equipe: { id: string; nome: string } | null;
  /** Chave de fora: o número da rodada, em texto. De dentro: o código da habilidade. */
  porRodada: Record<string, Record<string, EvidenciaNaCelula>>;
  /** A MELHOR rodada por habilidade, só com o que vale. Ausente = "Não avaliado". */
  resultado: Record<string, Nivel>;
}

/**
 * `GET /evidencias/turma/:turmaId/missao/:expId/atividade/:atividadeId` — e a
 * resposta do `POST …/confirmar` e do `PATCH …/ajustes`, que devolvem o painel
 * inteiro para a tela não precisar reler.
 */
export interface PainelDeHabilidades {
  /** `false` = a missão ainda não tem ficha pedagógica: a tela não desenha o bloco. */
  temFicha: boolean;
  /**
   * A régua desta missão só conta quando o professor ENCERRA a missão na Sala
   * de Aula (a Missão Tempestade, ADR-154), e ela ainda está aberta nesta turma:
   * não há nível para mostrar, e a tela diz por quê.
   */
  aguardandoEncerramento?: boolean;
  habilidades: HabilidadeDaFicha[];
  /** As rodadas que têm alguma evidência, em ordem crescente. */
  rodadas: number[];
  /** Em ordem alfabética (é a única ordem que a api conhece). */
  estudantes: EstudanteDoPainel[];
  /** Quantas cópias da aula projetada esperam confirmação, por rodada. */
  pendentes: Record<string, number>;
}

/** Um item do corpo do `PATCH …/ajustes`. */
export interface AjusteDeEvidencia {
  estudanteId: string;
  habilidade: string;
  status: StatusDaEvidencia;
}

/**
 * `GET /evidencias/estudante/:estudanteId` — só o que vale, sem origem. Missões
 * da mais recente para a mais antiga.
 */
export interface PerfilDoEstudante {
  estudante: { id: string; nome: string };
  missoes: {
    expId: string;
    nome: string;
    /** A unidade do ano (1 a 4); `null` na transversal. */
    unidade: number | null;
    /** ISO 8601: quando a evidência desta missão mudou pela última vez. */
    ultimaEm: string;
    /**
     * A MISSÃO: cada habilidade da ficha com o MELHOR nível entre as
     * atividades. `null` = "Não avaliado" — nunca "Não atingiu".
     */
    habilidades: { codigo: string; descricao: string; status: Nivel | null }[];
    atividades: {
      atividadeId: string;
      habilidades: { codigo: string; descricao: string; status: Nivel }[];
    }[];
  }[];
}

/** O mesmo teto do Zod da api: quantos ajustes cabem num `PATCH`. */
export const AJUSTES_MAX = 200;

/** A ordem em que o professor escolhe o nível — do melhor ao N/A explícito. */
export const STATUS_DA_EVIDENCIA: readonly StatusDaEvidencia[] = [
  "atingiu",
  "em_processo",
  "nao_atingiu",
  "nao_participou",
];

// ── os textos ───────────────────────────────────────────────────────────

export const ROTULO_DO_STATUS: Record<StatusDaEvidencia, string> = {
  atingiu: "Atingiu",
  em_processo: "Em processo",
  nao_atingiu: "Não atingiu",
  nao_participou: "Não participou",
};

/**
 * A AUSÊNCIA de evidência. Nunca vira "Não atingiu": não ter sido observado
 * não é ter falhado, e a criança que faltou seria lida como a que errou.
 */
export const NAO_AVALIADO = "Não avaliado";

/** As variantes da `Tag` do DS que o painel usa. */
export type VarianteDaCelula = "success" | "info" | "warning" | "neutral" | "outline";

/**
 * A cor de cada nível. "Não atingiu" é `warning`, e não `danger`: é uma leitura
 * pedagógica de uma habilidade numa rodada, não um erro — o vermelho diria que
 * há algo quebrado com a criança. "Não avaliado" é contorno, sem cor: é a
 * ausência, e precisa parecer ausência.
 */
export const VARIANTE_DO_STATUS: Record<StatusDaEvidencia, VarianteDaCelula> = {
  atingiu: "success",
  em_processo: "info",
  nao_atingiu: "warning",
  nao_participou: "neutral",
};

/**
 * A marca DISCRETA embaixo do nível: de onde ele veio. A evidência própria não
 * leva marca — é o caso comum, e marcar tudo é não marcar nada.
 */
export const MARCA_DA_ORIGEM: Record<Origem, string | null> = {
  propria: null,
  equipe: "da equipe",
  projecao: "projeção",
  professor: "revisado",
};

/** O glifo do Material Symbols ao lado da marca (identificador, não texto). */
export const ICONE_DA_ORIGEM: Record<Origem, string | null> = {
  propria: null,
  equipe: "groups",
  projecao: "cast_for_education",
  professor: "edit",
};

/** A origem por extenso — a janela de ajuste ("Hoje: Atingiu · Copiado da equipe"). */
export const ROTULO_DA_ORIGEM: Record<Origem, string> = {
  propria: "Registro próprio",
  equipe: "Copiado da equipe",
  projecao: "Da aula projetada",
  professor: "Ajuste docente",
};

/** A marca da cópia da aula projetada que ainda não foi confirmada. */
export const MARCA_A_REVISAR = "a revisar";
export const ICONE_A_REVISAR = "pending";

// ── as rodadas ──────────────────────────────────────────────────────────

/** O recorte do painel: uma rodada, ou o resultado da atividade (a melhor rodada). */
export type RecorteDoPainel = number | "resultado";

export const RESULTADO = "resultado" as const;

/**
 * As rodadas que a tela oferece. Sem evidência nenhuma ainda, a rodada 1 existe
 * assim mesmo — é a regra da api (`rodada-inexistente` só vale DEPOIS da
 * última), e é o que deixa o professor registrar a atividade feita fora da
 * missão.
 */
export function rodadasDoPainel(painel: Pick<PainelDeHabilidades, "rodadas">): number[] {
  const rodadas = [...new Set(painel.rodadas)].filter((r) => Number.isInteger(r) && r > 0).sort((a, b) => a - b);
  return rodadas.length > 0 ? rodadas : [1];
}

/**
 * O painel com a rodada EM ANDAMENTO, mesmo sem evidência nenhuma nela ainda.
 * A api conta as rodadas pelas linhas de evidência; logo depois de "Zerar", a
 * rodada nova não tem linha e a aba dela não existiria até o primeiro estudante
 * jogar e alguém recarregar a página. Quem sabe a rodada em andamento é a
 * missão (o detalhe da atividade), e a página a passa para cá.
 */
export function comRodadaEmAndamento<P extends Pick<PainelDeHabilidades, "rodadas">>(
  painel: P,
  emAndamento: number | null | undefined,
): P {
  if (!emAndamento || !Number.isInteger(emAndamento) || emAndamento < 1) return painel;
  if (painel.rodadas.includes(emAndamento)) return painel;
  return { ...painel, rodadas: [...painel.rodadas, emAndamento].sort((a, b) => a - b) };
}

/**
 * A rodada existe na tela, mas a api ainda não tem registro nela: ninguém jogou
 * desde que ela abriu. O ajuste do professor seria recusado
 * (`rodada-inexistente`: a api aceita até a maior rodada com registro, e a 1
 * sempre), então a aba é só de leitura até a primeira marca.
 */
export function rodadaSemRegistro(painelDaApi: Pick<PainelDeHabilidades, "rodadas">, rodada: number | null): boolean {
  return rodada !== null && rodada > Math.max(1, ...painelDaApi.rodadas);
}

export function rotuloDoRecorte(recorte: RecorteDoPainel): string {
  return recorte === RESULTADO ? "Resultado da atividade (melhor rodada)" : `Rodada ${recorte}`;
}

/** O valor da aba (o `Tabs` do DS fala em texto ou número; a rodada vai como texto). */
export function valorDoRecorte(recorte: RecorteDoPainel): string {
  return recorte === RESULTADO ? RESULTADO : String(recorte);
}

export function recorteDoValor(valor: string | number, painel: Pick<PainelDeHabilidades, "rodadas">): RecorteDoPainel {
  if (valor === RESULTADO) return RESULTADO;
  const rodada = Number(valor);
  return rodadasDoPainel(painel).includes(rodada) ? rodada : RESULTADO;
}

/**
 * Onde o painel abre: na rodada mais recente que tem cópia da aula projetada
 * esperando confirmação (é o que o professor precisa decidir), senão no
 * resultado da atividade (é o que se lê).
 */
export function recorteInicial(painel: Pick<PainelDeHabilidades, "rodadas" | "pendentes">): RecorteDoPainel {
  const comPendencia = rodadasDoPainel(painel).filter((r) => (painel.pendentes[String(r)] ?? 0) > 0);
  return comPendencia.length > 0 ? comPendencia[comPendencia.length - 1]! : RESULTADO;
}

/**
 * O aviso da rodada com cópia da aula projetada esperando o professor. `null`
 * quando não há o que confirmar — e no resultado da atividade, que não é uma
 * rodada.
 */
export function resumoPendentes(pendentes: Record<string, number>, rodada: RecorteDoPainel): string | null {
  if (rodada === RESULTADO) return null;
  const n = pendentes[String(rodada)] ?? 0;
  return n > 0 ? `Resultado da aula projetada aguardando sua confirmação (${n})` : null;
}

/**
 * O mesmo aviso para quem só LÊ (a coordenação): "sua confirmação" seria falso,
 * e o botão não aparece para ela.
 */
export function resumoPendentesParaLeitura(pendentes: Record<string, number>, rodada: RecorteDoPainel): string | null {
  if (rodada === RESULTADO) return null;
  const n = pendentes[String(rodada)] ?? 0;
  return n > 0 ? `Resultado da aula projetada aguardando confirmação docente (${n})` : null;
}

/** As rodadas com pendência, para o aviso do resultado da atividade ("ainda não conta aqui"). */
export function rodadasComPendentes(pendentes: Record<string, number>): number[] {
  return Object.entries(pendentes)
    .filter(([, n]) => n > 0)
    .map(([r]) => Number(r))
    .filter((r) => Number.isInteger(r) && r > 0)
    .sort((a, b) => a - b);
}

// ── a célula ────────────────────────────────────────────────────────────

export interface LeituraDaCelula {
  /** "Atingiu", "Em processo", "Não atingiu", "Não participou" ou "Não avaliado". */
  rotulo: string;
  variante: VarianteDaCelula;
  /** `null` = não avaliado. */
  status: StatusDaEvidencia | null;
  /** Só numa rodada: o resultado da atividade não tem origem. */
  origem?: Origem;
  /** A marca discreta: "da equipe", "projeção", "revisado" ou "a revisar". */
  marca?: string;
  /** Cópia da aula projetada que ainda não conta. */
  aRevisar?: boolean;
}

const NAO_AVALIADA: LeituraDaCelula = { rotulo: NAO_AVALIADO, variante: "outline", status: null };

/**
 * O que a célula (estudante × habilidade) mostra num recorte. Habilidade sem
 * linha é "Não avaliado" — NUNCA "Não atingiu".
 */
export function celula(
  estudante: Pick<EstudanteDoPainel, "porRodada" | "resultado">,
  recorte: RecorteDoPainel,
  codigo: string,
): LeituraDaCelula {
  if (recorte === RESULTADO) {
    const nivel = estudante.resultado[codigo];
    return nivel ? { rotulo: ROTULO_DO_STATUS[nivel], variante: VARIANTE_DO_STATUS[nivel], status: nivel } : NAO_AVALIADA;
  }
  const evidencia = estudante.porRodada[String(recorte)]?.[codigo];
  if (!evidencia) return NAO_AVALIADA;
  const aRevisar = evidencia.situacao === "a_revisar";
  const marca = aRevisar ? MARCA_A_REVISAR : MARCA_DA_ORIGEM[evidencia.origem];
  return {
    rotulo: ROTULO_DO_STATUS[evidencia.status],
    variante: VARIANTE_DO_STATUS[evidencia.status],
    status: evidencia.status,
    origem: evidencia.origem,
    ...(marca ? { marca } : {}),
    ...(aRevisar ? { aRevisar: true } : {}),
  };
}

/** A cor de um nível do perfil (o perfil só tem níveis válidos). */
export function varianteDoNivel(nivel: Nivel): VarianteDaCelula {
  return VARIANTE_DO_STATUS[nivel];
}

/** O nome acessível da célula clicável: quem, o quê, e o que está lá hoje. */
export function descricaoDaCelula(nome: string, codigo: string, leitura: LeituraDaCelula): string {
  return `${nome}, ${codigo}: ${leitura.rotulo}${leitura.marca ? ` (${leitura.marca})` : ""}`;
}

// ── a ordem das linhas ──────────────────────────────────────────────────

/**
 * A ordem das linhas: ALFABÉTICA, com quem divide o computador junto.
 *
 * A equipe entra na posição do primeiro colega dela na ordem alfabética, e os
 * outros vêm logo abaixo, também em ordem alfabética. Nada aqui olha o nível —
 * ordenar pelo resultado seria o ranking que o produto não tem.
 */
export function ordenarPorEquipe<E extends Pick<EstudanteDoPainel, "id" | "nome" | "equipe">>(
  estudantes: readonly E[],
): E[] {
  const alfabetica = [...estudantes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const daEquipe = new Map<string, E[]>();
  for (const e of alfabetica) {
    if (!e.equipe) continue;
    daEquipe.set(e.equipe.id, [...(daEquipe.get(e.equipe.id) ?? []), e]);
  }
  const vistas = new Set<string>();
  const ordem: E[] = [];
  for (const e of alfabetica) {
    if (!e.equipe) {
      ordem.push(e);
      continue;
    }
    if (vistas.has(e.equipe.id)) continue;
    vistas.add(e.equipe.id);
    ordem.push(...(daEquipe.get(e.equipe.id) ?? []));
  }
  return ordem;
}

// ── o que vai para a api ────────────────────────────────────────────────

/**
 * O corpo do "Ajustar a seleção": o MESMO nível numa habilidade para cada
 * estudante marcado. Sem repetição — a api recusa o mesmo estudante duas vezes
 * na mesma habilidade (`ajuste-invalido`).
 */
export function ajustesEmMassa(
  ids: readonly string[],
  habilidade: string,
  status: StatusDaEvidencia,
): AjusteDeEvidencia[] {
  return [...new Set(ids)].map((estudanteId) => ({ estudanteId, habilidade, status }));
}

/** O endereço do painel no BFF — o prefixo `evidencias` está na allowlist. */
export function caminhoDoPainel(turmaId: string, expId: string, atividadeId: string): string {
  return `/api/plataforma/evidencias/turma/${encodeURIComponent(turmaId)}/missao/${encodeURIComponent(
    expId,
  )}/atividade/${encodeURIComponent(atividadeId)}`;
}

/**
 * O erro da api em texto para o professor: a `mensagem` e, no `ajuste-invalido`,
 * a lista inteira de `erros` — que a api já escreve em frases.
 */
export function erroDaApi(corpo: unknown, padrao: string): { mensagem: string; erros: string[] } {
  const bruto = (corpo ?? {}) as { mensagem?: unknown; erros?: unknown };
  const mensagem = typeof bruto.mensagem === "string" && bruto.mensagem ? bruto.mensagem : padrao;
  const erros = Array.isArray(bruto.erros) ? bruto.erros.filter((e): e is string => typeof e === "string" && !!e) : [];
  return { mensagem, erros };
}

// ── o perfil ────────────────────────────────────────────────────────────

/**
 * O título de cada atividade no perfil. O id da atividade é OPACO (é da
 * missão) e não se mostra: com uma atividade só, a missão basta; com mais de
 * uma, elas viram "Atividade 1", "Atividade 2" na ordem em que a api as manda.
 */
export function tituloDaAtividadeNoPerfil(indice: number, total: number): string | null {
  return total > 1 ? `Atividade ${indice + 1}` : null;
}
