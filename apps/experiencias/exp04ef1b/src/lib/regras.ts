import {
  TAMANHO_DA_EDICAO,
  type Estado,
  type GatePublico,
  type IdDeBloco,
  type IdDeNoticia,
  type Passo,
  type TipoDePista,
} from "./tipos";

/**
 * As poucas regras que são do CLIENTE — e por que são tão poucas.
 *
 * Tudo o que decide o que VALE mora na api (`apps/api/src/jornal-escola/`): o
 * latch das duas edições, o resultado, o pilar de cada vaga, se a Chave abriu,
 * o relógio da turma. O que sobra aqui é o que a tela decide sozinha, sem ida
 * à api: qual tela o passo pede, onde entra a notícia que a criança adicionou,
 * o que a bandeja da Chave mostra entre duas tentativas, e como separar o
 * enunciado de P1. Nenhuma regra daqui sabe qual notícia é publicável nem
 * quais blocos abrem a Chave — e não pode saber.
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
  transferencia: "desafio-final",
  fim: "leitura",
};

/** A etapa do PRD em que cada tela está — é o `etapa` da telemetria (EVT-U02, U04, U05). */
export type EtapaDaMissao = "E1" | "E2" | "E3" | "E4" | "E5" | "EREV" | "E6";

export const ETAPA_DA_TELA: Record<Tela, EtapaDaMissao> = {
  abertura: "E1",
  mesa: "E2",
  motivo: "E3",
  espera: "E4",
  resultado: "E4",
  chave: "E5",
  revisao: "EREV",
  comparativo: "EREV",
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

// ──────────────────────────────────────────────────────────────── a Chave

/**
 * A bandeja e a calha da Chave entre duas tentativas. `vagas` são os blocos
 * encaixados, na ordem; `devolvidos` são os que a ÚLTIMA tentativa mandou de
 * volta (o estado `returned` do `PuzzleBlock`, que é breve: some na jogada
 * seguinte). Quem decide o que abre a Chave é o `POST /chave`, nunca daqui.
 */
export interface JogadaDaChave {
  vagas: readonly IdDeBloco[];
  devolvidos: readonly IdDeBloco[];
}

export const JOGADA_INICIAL: JogadaDaChave = { vagas: [], devolvidos: [] };

/** Toque num bloco da bandeja: encaixa na próxima vaga (e a jogada anterior "esquece" os devolvidos). */
export function encaixar(jogada: JogadaDaChave, id: IdDeBloco, tamanho: number): JogadaDaChave {
  if (jogada.vagas.includes(id) || jogada.vagas.length >= tamanho) return jogada;
  return { vagas: [...jogada.vagas, id], devolvidos: [] };
}

/** Toque num bloco encaixado: volta à bandeja. */
export function desencaixar(jogada: JogadaDaChave, id: IdDeBloco): JogadaDaChave {
  return { vagas: jogada.vagas.filter((v) => v !== id), devolvidos: [] };
}

/** A tentativa que não abriu: os blocos que a api devolveu saem da calha; os outros ficam. */
export function devolver(jogada: JogadaDaChave, devolvidos: readonly IdDeBloco[]): JogadaDaChave {
  const fora = new Set(devolvidos);
  return { vagas: jogada.vagas.filter((v) => !fora.has(v)), devolvidos: [...devolvidos] };
}

// ─────────────────────────────────────────────────────── o desafio final

/**
 * O enunciado de P1 chega com o boato, o detalhe e a pergunta separados por
 * linha em branco (a ficha da api, `fichas/exp04ef1b.ts`): o boato vira o
 * balão da mensagem encaminhada, o detalhe vira a legenda sob ele, e a
 * pergunta vira o rótulo das alternativas. Com dois blocos, o primeiro é o
 * boato; com um, tudo é pergunta — nada some.
 */
export function separarEnunciado(enunciado: string): { boato: string | null; detalhe: string | null; pergunta: string } {
  const partes = enunciado
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pergunta = partes.pop() ?? enunciado.trim();
  const boato = partes.shift() ?? null;
  const detalhe = partes.length > 0 ? partes.join(" ") : null;
  return { boato, detalhe, pergunta };
}

/** Segundos inteiros entre dois instantes; nunca negativo (o relógio da máquina da escola atrasa). */
export function segundosDesde(inicioMs: number, agoraMs: number): number {
  return Math.max(0, Math.floor((agoraMs - inicioMs) / 1000));
}
