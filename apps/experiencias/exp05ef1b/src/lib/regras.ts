import type {
  Alerta,
  Atividade,
  Atributo,
  Conector,
  Estado,
  Execucao,
  Expressao,
  Gate,
  MensagemPublica,
  Passo,
  Revelacao,
  Robo,
  Sessao,
} from "./tipos";
import type { GateVisto } from "./telemetria";

/**
 * As poucas regras que são do CLIENTE — e por que são tão poucas.
 *
 * Tudo o que decide o que vale mora no servidor
 * (`apps/api/src/quem-mandou-isso/regras/`): o passo (`passoEfetivo`), o limite
 * de três, o latch de cada etapa, a régua da EF05CO08, a expressão esperada de
 * cada pedido do alerta, quais mensagens passam num filtro e o que o robô faz
 * com cada mensagem. O que sobra aqui é o que o servidor não tem como saber:
 * qual VISTA da mesma etapa está aberta (grupo ou Mural, lista ou chat da
 * Nina), o que a criança está MONTANDO antes de tocar (o filtro, o robô) e há
 * quanto tempo a tela está parada.
 */

/** O polling do gate (ADR-93: HTTP de 3 s, nunca WebSocket). */
export const INTERVALO_DO_GATE_MS = 3_000;

/** Sem encaminhar nada por 90 s, a Nina manda o apoio (`e2.instrucao.microbanner_inatividade`). */
export const SEGUNDOS_ATE_O_APOIO = 90;

/** Quanto o aviso rápido fica na base da tela. */
export const MS_DO_AVISO = 3_500;

// ─────────────────────────────────────────────────────── a tela da vez

/**
 * As telas. Uma etapa do servidor pode ter MAIS de uma vista (`abertura` é a
 * lista e o chat da Nina; `grupo` é o grupo e o Mural), e o que escolhe a
 * vista é o cliente.
 */
export type Tela =
  | "preparo"
  | "lista"
  | "nina"
  | "grupo"
  | "mural"
  | "enquete"
  | "espera"
  | "revelacao"
  | "sintese"
  | "regra"
  | "concluida";

/** O que só esta aba sabe. Nenhum destes campos vai ao servidor. */
export interface Vista {
  /** Tocou a conversa da Nina na lista. */
  ninaAberta: boolean;
  /** Tocou "Ir para o Mural da Turma" (e não voltou com "Revisar seleção no grupo"). */
  muralAberto: boolean;
  /**
   * As 8 mensagens do grupo já CHEGARAM, uma a uma, nesta aba. Quem volta do
   * Mural para o grupo vê tudo de uma vez: a chegada é a primeira impressão do
   * grupo, não um enfeite a repetir.
   */
  grupoChegou: boolean;
}

export const VISTA_INICIAL: Vista = {
  ninaAberta: false,
  muralAberto: false,
  grupoChegou: false,
};

/**
 * A tela que o estado pede.
 *
 * `preparada` vem PRIMEIRO e ganha de todo passo: a missão nasce vazia, e cair
 * no grupo com `pacote === null` seria um mensageiro sem mensagem nenhuma — que
 * a criança leria como app quebrado.
 *
 * **O alerta não é tela própria**: ele vive no fim do Mural revelado, só
 * enquanto a turma está na revelação (`alerta.aberto`). Na reflexão, todo
 * mundo vai ao robô (`regra`), tenha enviado os alertas ou não.
 */
export function telaDe(estado: Pick<Estado, "passo" | "preparada">, vista: Vista): Tela {
  if (!estado.preparada) return "preparo";
  switch (estado.passo) {
    case "abertura":
      return vista.ninaAberta ? "nina" : "lista";
    case "grupo":
      return vista.muralAberto ? "mural" : "grupo";
    case "enquete":
    case "espera":
    case "revelacao":
    case "sintese":
    case "regra":
    case "concluida":
      return estado.passo;
  }
}

/** O `progressed gate:*` de cada passo que o professor abre. */
export function gateDoPasso(passo: Passo): GateVisto | null {
  if (passo === "revelacao") return "revelacao";
  if (passo === "sintese") return "sintese";
  /* O robô é a reflexão: o gate que o professor abriu. */
  if (passo === "regra") return "reflexao";
  return null;
}

// ──────────────────────────────────────────────────────── o polling

export function mesmaAtividade(a: Atividade | null, b: Atividade | null): boolean {
  if (a === null || b === null) return a === b;
  return a.pacoteId === b.pacoteId && a.rodada === b.rodada;
}

/**
 * O gate trouxe novidade? Quatro comparações, e nenhuma é redundante:
 *
 * - `passo`: a própria criança andou em outra aba, ou a turma a empurrou;
 * - `preparada`: o professor aprovou o pacote — é isso que tira a criança da
 *   espera do preparo sem ninguém mandar recarregar;
 * - `fase`: o botão do professor. Quem ainda está no grupo quando a revelação
 *   abre CONTINUA no grupo (o passo não muda) — mas a sessão precisa ser relida
 *   para a revelação vir junto quando ela votar;
 * - `atividade`: pacote novo aprovado ou "Zerar a turma" (rodada nova). O
 *   passo pode até coincidir, e a sessão velha falaria de outro grupo.
 */
export function gateMudou(gate: Gate, estado: Estado): boolean {
  return (
    gate.passo !== estado.passo ||
    gate.preparada !== estado.preparada ||
    gate.fase !== estado.fase ||
    !mesmaAtividade(gate.atividade, estado.atividade)
  );
}

/**
 * Uma sessão relida por cima da que a tela tem.
 *
 * Mesma atividade e ainda no grupo: a SELEÇÃO da tela vence a do servidor — o
 * `PUT` do último toque pode estar em voo, e reler no meio faria o tique piscar
 * para trás. Atividade nova: tudo o que a tela sabia era de outro grupo.
 */
export function mesclarSessao(atual: Sessao, nova: Sessao): Sessao {
  if (!mesmaAtividade(atual.atividade, nova.atividade)) return nova;
  if (atual.passo === "grupo" && nova.passo === "grupo") return { ...nova, selecao: atual.selecao };
  return nova;
}

// ───────────────────────────────────────────────────── a seleção

export type ResultadoDaSelecao =
  | { ok: true; selecao: string[]; entrou: boolean }
  | { ok: false; motivo: "limite" };

/**
 * O toque na seta de uma mensagem: tira se já estava; põe se cabe; recusa a
 * quarta. Espelha `regras/selecao.ts#conferirSelecao` da api (que é quem vale)
 * — aqui é só para a tela responder sem esperar a rede.
 */
export function alternarSelecao(selecao: readonly string[], id: string, limite: number): ResultadoDaSelecao {
  if (selecao.includes(id)) return { ok: true, selecao: selecao.filter((s) => s !== id), entrou: false };
  if (selecao.length >= limite) return { ok: false, motivo: "limite" };
  return { ok: true, selecao: [...selecao, id], entrou: true };
}

/**
 * As mensagens do Mural na ordem do GRUPO, não na ordem em que foram
 * encaminhadas: o Mural é a leitura final dela, e reordenar por toque faria a
 * mesma escolha parecer outra a cada revisão — e os crachás mudarem de lugar
 * entre uma tela e a seguinte.
 */
export function mensagensDoMural(mensagens: readonly MensagemPublica[], selecao: readonly string[]): MensagemPublica[] {
  const escolhidas = new Set(selecao);
  return mensagens.filter((m) => escolhidas.has(m.id));
}

/** "você e mais N participantes": N exclui a própria criança. */
export function outrosParticipantes(participantes: number): number {
  return Math.max(0, participantes - 1);
}

// ───────────────────────────────────────────────── a revelação

export function crachasDe(revelacao: Revelacao | null, mensagemId: string) {
  return revelacao?.mensagens.find((m) => m.id === mensagemId) ?? null;
}

/** Um percentual para a barra: inteiro e dentro de 0–100, venha o que vier. */
export function percentualDaBarra(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.min(100, Math.max(0, Math.round(valor)));
}

// ─────────────────────────────────────────── o alerta do grupo

/** O pedido da vez: o primeiro sem alerta enviado. `null` com os quatro enviados. */
export function pedidoDaVez(alerta: Pick<Alerta, "pedidos" | "andamento">): { n: number; texto: string } | null {
  return alerta.pedidos.find((p) => !alerta.andamento.find((a) => a.pedido === p.n)?.enviado) ?? null;
}

/** As execuções e o enviado de um pedido (vazio se ainda não foi aberto). */
export function andamentoDo(alerta: Pick<Alerta, "andamento">, n: number): { execucoes: Execucao[]; enviado: Execucao | null } {
  const dele = alerta.andamento.find((a) => a.pedido === n);
  return { execucoes: dele?.execucoes ?? [], enviado: dele?.enviado ?? null };
}

/** O que a criança está montando: cada peça pode estar vazia. Só desta aba. */
export interface MontadorDoFiltro {
  a: { attr: Atributo | null; nao: boolean };
  op: Conector | null;
  b: { attr: Atributo | null; nao: boolean };
}

export const MONTADOR_VAZIO: MontadorDoFiltro = { a: { attr: null, nao: false }, op: null, b: { attr: null, nao: false } };

/**
 * A expressão que o montador forma, ou `null` se falta peça: a 1ª condição é
 * obrigatória; com conector, a 2ª também ("Ver resultado" só acende com uma
 * expressão inteira).
 */
export function expressaoDoMontador(m: MontadorDoFiltro): Expressao | null {
  if (!m.a.attr) return null;
  const a = { attr: m.a.attr, nao: m.a.nao };
  if (!m.op) return { a };
  if (!m.b.attr) return null;
  return { a, op: m.op, b: { attr: m.b.attr, nao: m.b.nao } };
}

/** O montador a partir de uma expressão (o F5 volta à última executada). */
export function montadorDe(e: Expressao | null): MontadorDoFiltro {
  if (!e) return MONTADOR_VAZIO;
  return { a: { ...e.a }, op: e.op ?? null, b: e.b ? { ...e.b } : { attr: null, nao: false } };
}

/** A MESMA expressão, peça a peça — espelho de `regras/alerta.ts#mesmaExpressao` da api. */
export function mesmaExpressao(x: Expressao | null, y: Expressao | null): boolean {
  if (!x || !y) return false;
  const igual = (c?: Expressao["a"], d?: Expressao["a"]) =>
    c === undefined || d === undefined ? c === d : c.attr === d.attr && c.nao === d.nao;
  return igual(x.a, y.a) && x.op === y.op && igual(x.b, y.b);
}

/**
 * "Enviar alerta ao grupo" acende? Só se o que está NA TELA é a última
 * execução do pedido — a criança envia o que viu passar (o servidor cobra o
 * mesmo, 400 `execute-antes`).
 */
export function podeEnviarAlerta(execucoes: readonly Execucao[], naTela: Expressao | null): boolean {
  const ultima = execucoes.at(-1);
  return Boolean(ultima && mesmaExpressao(ultima.expressao, naTela));
}

/** "a mensagem de Pedro" a partir do rótulo do quadro ("Mensagem de Pedro"). */
export function referenciaNoAlerta(rotulo: string): string {
  return `a ${rotulo.charAt(0).toLowerCase()}${rotulo.slice(1)}`;
}

/** As referências das mensagens que passaram, na ordem do grupo. */
export function referenciasDoAlerta(passam: readonly string[], quadro: Alerta["quadro"]): string[] {
  return quadro.filter((m) => passam.includes(m.id)).map((m) => referenciaNoAlerta(m.rotulo));
}

// ─────────────────────────────────────────── o robô do grupo

/** As quatro vagas do robô, na ordem da calha. */
export const VAGAS_DO_ROBO = ["laco", "condicao", "acao1", "acao2"] as const;
export type VagaDoRobo = (typeof VAGAS_DO_ROBO)[number];

/** O robô em montagem: cada vaga pode estar vazia. Só desta aba. */
export interface MontagemDoRobo {
  laco: boolean;
  condicao: string | null;
  acao1: string | null;
  acao2: string | null;
}

export const MONTAGEM_VAZIA: MontagemDoRobo = { laco: false, condicao: null, acao1: null, acao2: null };

export type BlocoTocado = { tipo: "laco" } | { tipo: "condicao"; id: string } | { tipo: "acao"; id: string };

/**
 * O toque num bloco da bandeja: o laço e a condição vão para a vaga deles (a
 * condição troca a anterior); a ação vai para a primeira vaga de ação livre,
 * e não entra duas vezes. Com as duas ações cheias, nada muda.
 */
export function encaixar(m: MontagemDoRobo, bloco: BlocoTocado): MontagemDoRobo {
  if (bloco.tipo === "laco") return { ...m, laco: true };
  if (bloco.tipo === "condicao") return { ...m, condicao: bloco.id };
  if (m.acao1 === bloco.id || m.acao2 === bloco.id) return m;
  if (!m.acao1) return { ...m, acao1: bloco.id };
  if (!m.acao2) return { ...m, acao2: bloco.id };
  return m;
}

/** O toque num bloco encaixado: volta para a bandeja. Tirar a 1ª ação sobe a 2ª. */
export function tirar(m: MontagemDoRobo, vaga: VagaDoRobo): MontagemDoRobo {
  if (vaga === "laco") return { ...m, laco: false };
  if (vaga === "condicao") return { ...m, condicao: null };
  if (vaga === "acao1") return { ...m, acao1: m.acao2, acao2: null };
  return { ...m, acao2: null };
}

/** O robô que a montagem forma, ou `null` sem condição e sem a 1ª ação ("Ligar" apagado). */
export function roboDaMontagem(m: MontagemDoRobo): Robo | null {
  if (!m.condicao || !m.acao1) return null;
  return { laco: m.laco, condicao: m.condicao, acoes: m.acao2 ? [m.acao1, m.acao2] : [m.acao1] };
}

/** A montagem a partir de um robô (o F5 volta ao último ligado). */
export function montagemDe(r: Robo | null): MontagemDoRobo {
  if (!r) return MONTAGEM_VAZIA;
  return { laco: r.laco, condicao: r.condicao, acao1: r.acoes[0] ?? null, acao2: r.acoes[1] ?? null };
}

/** Quantas mensagens a animação já mostrou chegando (o servidor já executou todas). */
export const MS_POR_MENSAGEM_DO_ROBO = 1_200;

// ─────────────────────────────────────────── o desenho das mídias

/**
 * "Nome do site: manchete" (o formato que o preparo pede ao modelo e que o
 * banco curado segue) → as duas partes. Sem os dois-pontos, ou com um rótulo
 * longo demais para ser nome de site, a legenda inteira é o corpo.
 */
/**
 * O DESENHO de cada imagem do grupo. Antes as duas imagens do pacote eram o
 * mesmo papel timbrado, e a turma via "a mesma imagem" duas vezes (o PO,
 * 2026-10-05). Agora cada uma tem um desenho próprio: comunicado, cartaz,
 * print de tela ou bilhete.
 *
 * As duas imagens de um pacote saem SEMPRE com desenhos diferentes (posições
 * vizinhas na lista), e o par muda de pacote para pacote (o deslocamento vem
 * do texto delas) — assim o desenho não vira pista de veracidade de uma turma
 * para outra. Puro e estável: o grupo, o Mural e a imagem aberta concordam.
 */
/**
 * A chegada das mensagens do grupo: um intervalo e o "digitando…" antes de
 * cada uma — ~0,9 s por mensagem, ~7 s para as oito. Antes elas apareciam
 * todas de uma vez, "chapadas" (o PO, 2026-10-05).
 */
export const MS_ENTRE_MENSAGENS = 250;
export const MS_DIGITANDO = 650;

/**
 * A COR do nome de cada colega no grupo (`senderTone` do Unoochat, 0.2.17):
 * um tom de 2 a 8, estável pelo nome — a mesma pessoa tem sempre a mesma cor,
 * no grupo e no "digitando…". O tom 1 fica de fora porque é o acento, a cor
 * que o nome tinha antes, e nome em acento não se distingue do resto.
 */
export type TomDoRemetente = 2 | 3 | 4 | 5 | 6 | 7 | 8;

export function tomDoRemetente(nome: string): TomDoRemetente {
  let soma = 0;
  for (const caractere of nome.trim().toLowerCase()) soma = (soma * 31 + caractere.charCodeAt(0)) % 7919;
  return (2 + (soma % 7)) as TomDoRemetente;
}

/** A chegada só anima na primeira abertura do grupo e com a seleção vazia (um F5 no meio da escolha não esconde nada). */
export function grupoChegaEmSequencia(vista: Pick<Vista, "grupoChegou">, selecao: readonly string[]): boolean {
  return !vista.grupoChegou && selecao.length === 0;
}

export const ESTILOS_DE_IMAGEM = ["comunicado", "cartaz", "print", "bilhete"] as const;
export type EstiloDeImagem = (typeof ESTILOS_DE_IMAGEM)[number];

export function estiloDaImagem(mensagens: readonly Pick<MensagemPublica, "id" | "tipo" | "texto">[], id: string): EstiloDeImagem {
  const imagens = mensagens.filter((m) => m.tipo === "imagem");
  const posicao = Math.max(0, imagens.findIndex((m) => m.id === id));
  let deslocamento = 0;
  for (const caractere of imagens.map((m) => m.texto).join("")) {
    deslocamento = (deslocamento * 31 + caractere.charCodeAt(0)) % 9973;
  }
  return ESTILOS_DE_IMAGEM[(deslocamento + posicao) % ESTILOS_DE_IMAGEM.length]!;
}

export function dividirLegenda(legenda: string): { rotulo: string | null; corpo: string } {
  const i = legenda.indexOf(": ");
  if (i <= 0 || i > 60) return { rotulo: null, corpo: legenda.trim() };
  return { rotulo: legenda.slice(0, i).trim(), corpo: legenda.slice(i + 2).trim() };
}

/** As iniciais de um nome, para o avatar sem foto ("Turma 5ºB" → "T5", "Mural da Turma" → "MT"). */
const LIGACOES = new Set(["da", "de", "do", "das", "dos", "e"]);
export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter((p) => p && !LIGACOES.has(p))
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * O horário de cada balão do grupo — a manhã daquela turma. Fixo de propósito:
 * o pacote não tem horário (é conteúdo do professor, não registro), e um
 * relógio real faria as oito mensagens "chegarem agora", todas no mesmo minuto.
 */
const HORARIOS_DO_GRUPO = ["09:12", "09:14", "09:17", "09:19", "09:22", "09:25", "09:27", "09:30"];
export function horarioDaMensagem(indice: number): string {
  return HORARIOS_DO_GRUPO[Math.min(Math.max(indice, 0), HORARIOS_DO_GRUPO.length - 1)]!;
}

/** O relógio do aparelho e a hora do convite da Nina, coerentes com o grupo. */
export const HORA_DO_APARELHO = "09:41";
export const HORA_DA_NINA = "09:38";
