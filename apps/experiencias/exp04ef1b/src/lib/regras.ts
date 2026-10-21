import {
  TAMANHO_DA_EDICAO,
  TIPOS_DE_PISTA,
  type CorpoDaChave,
  type CorpoDaSimulacao,
  type DecisaoDaSimulacao,
  type Estado,
  type GatePublico,
  type IdDeBloco,
  type IdDeNoticia,
  type IdDeSimulacao,
  type LadoDaCondicao,
  type PassoDaSimulacao,
  type Passo,
  type Repeticao,
  type SeFalhar,
  type TipoDePista,
  type Veredito,
} from "./tipos";

/**
 * As poucas regras que são do CLIENTE — e por que são tão poucas.
 *
 * Tudo o que decide o que VALE mora na api (`apps/api/src/jornal-escola/`): o
 * latch das duas edições, o resultado, o pilar de cada vaga, se a Chave abriu,
 * o relógio da turma. O que sobra aqui é o que a tela decide sozinha, sem ida
 * à api: qual tela o passo pede, onde entra a notícia que a criança adicionou,
 * a Chave EM MONTAGEM (que bloco está em que vaga, o que ela escolheu em cada
 * cartão), a simulação em curso e as pistas do boato abertas antes da decisão.
 * Nenhuma regra daqui sabe qual notícia é publicável, quais blocos são pilares
 * nem de que lado fica cada cartão — e não pode saber: nenhuma delas CORRIGE.
 */

// ──────────────────────────────────────────────────────────── os relógios

/** De quanto em quanto a tela pergunta em que etapa a turma está (ADR-93). */
export const INTERVALO_DO_GATE_MS = 5_000;

/** Sem nenhum toque nem tecla por este tempo, a telemetria registra a inatividade (EVT-U04). */
export const SEGUNDOS_DE_INATIVIDADE = 90;

/** A espera entre tentativas de uma chamada que caiu na rede: 2 s, 4 s, 8 s e depois 15 s. */
export function esperaDaTentativa(tentativa: number): number {
  return Math.min(15_000, 2_000 * 2 ** tentativa);
}

// ──────────────────────────────────────────── o passo e a tela que ele pede

export type Tela =
  | "abertura"
  | "mesa"
  | "motivo"
  | "espera"
  | "resultado"
  | "chave"
  | "revisao"
  | "comparativo"
  | "simulacao"
  | "desafio-final"
  | "leitura";

/**
 * A tela de cada passo — exaustivo, para um passo novo na api não cair numa
 * tela que não existe. A tela lê `sessao.passo` (o EFETIVO) e nada mais.
 */
export const TELA_DO_PASSO: Record<Passo, Tela> = {
  desafio: "abertura",
  mesa: "mesa",
  motivo: "motivo",
  publicada: "espera",
  resultado: "resultado",
  chave: "chave",
  revisao: "revisao",
  comparativo: "comparativo",
  simulacao: "simulacao",
  transferencia: "desafio-final",
  fim: "leitura",
};

/** A etapa do PRD em que cada tela está — é o `etapa` da telemetria (EVT-U02, U04, U05). */
export type EtapaDaMissao = "E1" | "E2" | "E3" | "E4" | "E5" | "EREV" | "ESIM" | "E6";

export const ETAPA_DA_TELA: Record<Tela, EtapaDaMissao> = {
  abertura: "E1",
  mesa: "E2",
  motivo: "E3",
  espera: "E4",
  resultado: "E4",
  chave: "E5",
  revisao: "EREV",
  comparativo: "EREV",
  /** A simulação da Chave (3.0.0) não tem etapa no PRD original: `ESIM`, entre a revisão e a transferência. */
  simulacao: "ESIM",
  "desafio-final": "E6",
  leitura: "E6",
};

/**
 * O polling relê a sessão? Compara passo, etapa, rodada e pacote. A rodada e o
 * pacote pegam "Zerar a turma" e o pacote novo; a etapa pega a transição que
 * não muda o passo de quem ainda monta a página. Rodada nula = o gate ainda
 * não nasceu, e isso não é mudança.
 */
export function gateMudou(estado: Pick<Estado, "passo" | "etapa" | "rodada" | "pacoteId">, gate: GatePublico): boolean {
  if (gate.passoEfetivo !== estado.passo) return true;
  if (gate.etapa !== estado.etapa) return true;
  if (gate.rodada !== null && gate.rodada !== estado.rodada) return true;
  if (gate.pacoteId !== null && gate.pacoteId !== estado.pacoteId) return true;
  return false;
}

// ─────────────────────────────────────────────────── as vagas da página

/** As três vagas como a TELA as vê: `null` é vaga vazia. A 0 é a manchete principal. */
export type Vagas = readonly (IdDeNoticia | null)[];

export const VAGAS_VAZIAS: Vagas = [null, null, null];

/**
 * "Adicionar ao Jornal": a notícia entra na PRIMEIRA vaga vazia. É o que faz o
 * "Trocar Matéria" funcionar como substituição — tirar a manchete e adicionar
 * outra devolve a nova à vaga da manchete, não ao fim.
 */
export function adicionar(vagas: Vagas, id: IdDeNoticia): { vagas: Vagas; resultado: "adicionada" | "cheia" | "repetida" } {
  if (vagas.includes(id)) return { vagas, resultado: "repetida" };
  const livre = vagas.indexOf(null);
  if (livre === -1) return { vagas, resultado: "cheia" };
  const novas = [...vagas];
  novas[livre] = id;
  return { vagas: novas, resultado: "adicionada" };
}

/** "Trocar Matéria": a vaga fica vazia, esperando a próxima escolha. */
export function esvaziar(vagas: Vagas, indice: number): Vagas {
  return vagas.map((v, i) => (i === indice ? null : v));
}

/** Tira uma notícia da página, esteja na vaga que estiver. */
export function retirar(vagas: Vagas, id: IdDeNoticia): Vagas {
  return vagas.map((v) => (v === id ? null : v));
}

export function preenchidas(vagas: Vagas): number {
  return vagas.filter((v) => v !== null).length;
}

/** As três vagas cheias, na ordem — ou `null` se falta alguma. É o `slots` do contrato. */
export function completas(vagas: Vagas): IdDeNoticia[] | null {
  const ids = vagas.filter((v): v is IdDeNoticia => v !== null);
  return ids.length === TAMANHO_DA_EDICAO && vagas.length === TAMANHO_DA_EDICAO ? ids : null;
}

/** A chave de cache da diagramação: os ids NA ORDEM (a api usa a mesma). */
export function chaveDasVagas(slots: readonly IdDeNoticia[]): string {
  return slots.join("|");
}

/**
 * As vagas que voltam da memória da aba (F5 antes de publicar) só valem se
 * forem ids desta mesa, três posições e sem repetição. Qualquer outra coisa
 * (rodada anterior, `sessionStorage` adulterado) vira página vazia.
 */
export function vagasValidas(valor: unknown, ids: ReadonlySet<string>): Vagas | null {
  if (!Array.isArray(valor) || valor.length !== TAMANHO_DA_EDICAO) return null;
  const vistas = new Set<string>();
  const saida: (IdDeNoticia | null)[] = [];
  for (const v of valor) {
    if (v === null) {
      saida.push(null);
      continue;
    }
    if (typeof v !== "string" || !ids.has(v) || vistas.has(v)) return null;
    vistas.add(v);
    saida.push(v as IdDeNoticia);
  }
  return saida;
}

// ─────────────────────────────────────────────────────────────── as pistas

/** A chave de uma pista no mapa da tela: um par (notícia, tipo). */
export function chaveDaPista(noticiaId: IdDeNoticia, tipo: TipoDePista): string {
  return `${noticiaId}:${tipo}`;
}

// ──────────────────────────────────────────────── a Chave em montagem

/**
 * Uma vaga do Montador como a TELA a vê: `null` é o que ainda não foi
 * escolhido. `lados` está na ordem CANÔNICA dos cartões (`Cartao.indice`), não
 * na embaralhada que a tela mostra — é o `lados` do contrato.
 */
export interface VagaDaChave {
  bloco: IdDeBloco | null;
  lados: readonly [LadoDaCondicao | null, LadoDaCondicao | null];
  seFalhar: SeFalhar | null;
}

export interface MontagemDaChave {
  vagas: readonly VagaDaChave[];
  repeticao: Repeticao | null;
}

const VAGA_VAZIA: VagaDaChave = { bloco: null, lados: [null, null], seFalhar: null };

export function montagemVazia(tamanho: number): MontagemDaChave {
  return { vagas: Array.from({ length: tamanho }, () => VAGA_VAZIA), repeticao: null };
}

function trocarVaga(m: MontagemDaChave, indice: number, vaga: VagaDaChave): MontagemDaChave {
  return { ...m, vagas: m.vagas.map((v, i) => (i === indice ? vaga : v)) };
}

/** Os blocos que já estão em alguma vaga (a bandeja mostra os outros). */
export function blocosNasVagas(m: MontagemDaChave): ReadonlySet<IdDeBloco> {
  return new Set(m.vagas.flatMap((v) => (v.bloco ? [v.bloco] : [])));
}

/** A primeira vaga vazia, ou -1. É o "Adicionar na próxima vaga". */
export function proximaVagaLivre(m: MontagemDaChave): number {
  return m.vagas.findIndex((v) => v.bloco === null);
}

/** Põe um bloco da bandeja numa vaga VAZIA. Vaga cheia ou bloco já usado: nada muda. */
export function porNaVaga(m: MontagemDaChave, indice: number, bloco: IdDeBloco): MontagemDaChave {
  const vaga = m.vagas[indice];
  if (!vaga || vaga.bloco !== null || blocosNasVagas(m).has(bloco)) return m;
  return trocarVaga(m, indice, { ...VAGA_VAZIA, bloco });
}

/** Tocar numa vaga cheia devolve o bloco à bandeja — e as escolhas dela vão junto. */
export function tirarDaVaga(m: MontagemDaChave, indice: number): MontagemDaChave {
  if (!m.vagas[indice]) return m;
  return trocarVaga(m, indice, VAGA_VAZIA);
}

/** O lado que a criança deu a um cartão, pela posição CANÔNICA dele (0 ou 1). */
export function marcarLado(m: MontagemDaChave, indice: number, cartao: 0 | 1, lado: LadoDaCondicao): MontagemDaChave {
  const vaga = m.vagas[indice];
  if (!vaga?.bloco) return m;
  const lados: [LadoDaCondicao | null, LadoDaCondicao | null] = [vaga.lados[0], vaga.lados[1]];
  lados[cartao] = lado;
  return trocarVaga(m, indice, { ...vaga, lados });
}

export function marcarSeFalhar(m: MontagemDaChave, indice: number, seFalhar: SeFalhar): MontagemDaChave {
  const vaga = m.vagas[indice];
  if (!vaga?.bloco) return m;
  return trocarVaga(m, indice, { ...vaga, seFalhar });
}

export function marcarRepeticao(m: MontagemDaChave, repeticao: Repeticao): MontagemDaChave {
  return { ...m, repeticao };
}

/**
 * O corpo do `POST chave` — ou `null` enquanto falta qualquer escolha. É o que
 * decide se o "Pronto" acende: três blocos diferentes, os dois cartões de cada
 * um, o "se falhar" das três e a repetição. Não diz se está CERTO: isso é da api.
 */
export function corpoDaChave(m: MontagemDaChave): CorpoDaChave | null {
  if (m.repeticao === null) return null;
  const vagas: CorpoDaChave["vagas"] = [];
  for (const v of m.vagas) {
    const [a, b] = v.lados;
    if (v.bloco === null || a === null || b === null || v.seFalhar === null) return null;
    vagas.push({ bloco: v.bloco, lados: [a, b], seFalhar: v.seFalhar });
  }
  if (new Set(vagas.map((v) => v.bloco)).size !== vagas.length) return null;
  return { vagas, repeticao: m.repeticao };
}

const ehLado = (v: unknown): v is LadoDaCondicao => v === "aprova" || v === "reprova";
const ehSeFalhar = (v: unknown): v is SeFalhar => v === "parar" || v === "seguir";
const ehRepeticao = (v: unknown): v is Repeticao => v === "todas" || v === "so_a_primeira";
const ehVeredito = (v: unknown): v is Veredito => v === "confio" || v === "nao_confio";
const ehPista = (v: unknown): v is TipoDePista => typeof v === "string" && (TIPOS_DE_PISTA as readonly string[]).includes(v);

/**
 * A Chave em montagem que volta da memória da aba só vale com blocos DESTA
 * bandeja, o número certo de vagas e sem bloco repetido; qualquer outra coisa
 * (rodada anterior, `sessionStorage` adulterado) vira o Montador vazio.
 */
export function montagemValida(valor: unknown, blocos: ReadonlySet<string>, tamanho: number): MontagemDaChave | null {
  if (!valor || typeof valor !== "object") return null;
  const bruto = valor as { vagas?: unknown; repeticao?: unknown };
  if (!Array.isArray(bruto.vagas) || bruto.vagas.length !== tamanho) return null;
  const vistos = new Set<string>();
  const vagas: VagaDaChave[] = [];
  for (const v of bruto.vagas as unknown[]) {
    const vaga = (v ?? {}) as { bloco?: unknown; lados?: unknown; seFalhar?: unknown };
    if (vaga.bloco === null) {
      vagas.push(VAGA_VAZIA);
      continue;
    }
    if (typeof vaga.bloco !== "string" || !blocos.has(vaga.bloco) || vistos.has(vaga.bloco)) return null;
    vistos.add(vaga.bloco);
    const lados = Array.isArray(vaga.lados) ? vaga.lados : [];
    vagas.push({
      bloco: vaga.bloco as IdDeBloco,
      lados: [ehLado(lados[0]) ? lados[0] : null, ehLado(lados[1]) ? lados[1] : null],
      seFalhar: ehSeFalhar(vaga.seFalhar) ? vaga.seFalhar : null,
    });
  }
  return { vagas, repeticao: ehRepeticao(bruto.repeticao) ? bruto.repeticao : null };
}

// ──────────────────────────────────────────────────── a simulação da Chave

/**
 * Uma matéria da simulação em curso. `passos` são as pistas abertas E
 * marcadas, NA ORDEM em que a criança as abriu — a ordem é a evidência, e a
 * tela não a força. `pendente` é a pista aberta que ainda espera o "confio /
 * não confio": enquanto ela existe, nada mais anda (a marcação é obrigatória
 * aqui, ao contrário da mesa). A `decisao` fecha a matéria.
 */
export interface MateriaEmSimulacao {
  passos: readonly PassoDaSimulacao[];
  pendente: TipoDePista | null;
  decisao: DecisaoDaSimulacao | null;
}

export const MATERIA_NOVA: MateriaEmSimulacao = { passos: [], pendente: null, decisao: null };

export function jaAberta(m: MateriaEmSimulacao, tipo: TipoDePista): boolean {
  return m.pendente === tipo || m.passos.some((p) => p.tipo === tipo);
}

/** Abre uma pista — se nenhuma outra espera a marcação, ela é nova e a matéria não foi decidida. */
export function abrirNaSimulacao(m: MateriaEmSimulacao, tipo: TipoDePista): MateriaEmSimulacao {
  if (m.decisao !== null || m.pendente !== null || jaAberta(m, tipo)) return m;
  return { ...m, pendente: tipo };
}

/** A marcação da pista pendente: ela entra nos passos, na ordem. */
export function marcarNaSimulacao(m: MateriaEmSimulacao, veredito: Veredito): MateriaEmSimulacao {
  if (m.pendente === null || m.decisao !== null) return m;
  return { ...m, passos: [...m.passos, { tipo: m.pendente, veredito }], pendente: null };
}

/** "Publicar" / "Não publicar" — a qualquer momento, menos com uma pista sem marcação. */
export function decidirNaSimulacao(m: MateriaEmSimulacao, decisao: DecisaoDaSimulacao): MateriaEmSimulacao {
  if (m.pendente !== null || m.decisao !== null) return m;
  return { ...m, decisao };
}

/** O corpo do `POST simulacao`, ou `null` enquanto alguma matéria não foi decidida. */
export function corpoDaSimulacao(
  ids: readonly IdDeSimulacao[],
  materias: Readonly<Partial<Record<IdDeSimulacao, MateriaEmSimulacao>>>,
): CorpoDaSimulacao | null {
  const saida: CorpoDaSimulacao["materias"] = [];
  for (const id of ids) {
    const m = materias[id];
    if (!m || m.decisao === null) return null;
    saida.push({ id, passos: [...m.passos], decisao: m.decisao });
  }
  return { materias: saida };
}

/** A matéria em curso que volta da memória da aba — só com pistas e vereditos válidos e sem repetir pista. */
export function materiaValida(valor: unknown): MateriaEmSimulacao | null {
  if (!valor || typeof valor !== "object") return null;
  const bruto = valor as { passos?: unknown; pendente?: unknown; decisao?: unknown };
  if (!Array.isArray(bruto.passos)) return null;
  const vistos = new Set<string>();
  const passos: PassoDaSimulacao[] = [];
  for (const p of bruto.passos as unknown[]) {
    const passo = (p ?? {}) as { tipo?: unknown; veredito?: unknown };
    if (!ehPista(passo.tipo) || !ehVeredito(passo.veredito) || vistos.has(passo.tipo)) return null;
    vistos.add(passo.tipo);
    passos.push({ tipo: passo.tipo, veredito: passo.veredito });
  }
  const pendente = ehPista(bruto.pendente) && !vistos.has(bruto.pendente) ? bruto.pendente : null;
  const decisao = bruto.decisao === "publicar" || bruto.decisao === "nao_publicar" ? bruto.decisao : null;
  return { passos, pendente: decisao ? null : pendente, decisao };
}

// ───────────────────────────────────────────────── a transferência (o boato)

/** Registra a pista aberta ANTES da decisão, uma vez, na ordem. Depois da decisão, nada mais conta. */
export function registrarPistaDoBoato(abertas: readonly TipoDePista[], tipo: TipoDePista, decidida: boolean): readonly TipoDePista[] {
  if (decidida || abertas.includes(tipo)) return abertas;
  return [...abertas, tipo];
}

export function pistasDoBoatoValidas(valor: unknown): TipoDePista[] {
  if (!Array.isArray(valor)) return [];
  const saida: TipoDePista[] = [];
  for (const v of valor as unknown[]) if (ehPista(v) && !saida.includes(v)) saida.push(v);
  return saida;
}

/** Segundos inteiros entre dois instantes; nunca negativo (o relógio da máquina da escola atrasa). */
export function segundosDesde(inicioMs: number, agoraMs: number): number {
  return Math.max(0, Math.floor((agoraMs - inicioMs) / 1000));
}
