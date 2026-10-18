import type { Atividade, Estado, FraseDoCartao, Gate, MensagemPublica, Passo, Resposta, Revelacao, Sessao } from "./tipos";
import type { GateVisto } from "./telemetria";

/**
 * As poucas regras que são do CLIENTE — e por que são tão poucas.
 *
 * Tudo o que decide o que vale mora no servidor
 * (`apps/api/src/quem-mandou-isso/regras/`): o passo (`passoEfetivo`), o limite
 * de três, o latch de cada etapa, o filtro de texto sem sentido, a régua da
 * EF05CO08, a resposta certa de cada frase do cartão e o que a regra do tio
 * faz com o áudio. O que sobra aqui é o que o servidor não tem como saber:
 * qual VISTA da mesma etapa está aberta (grupo ou Mural, lista ou chat da
 * Nina) e há quanto tempo a tela está parada.
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
  | "cartao"
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
 * **O cartão segue o caminho da criança.** Na revelação e na síntese ele está
 * dentro do Mural, embaixo dos crachás. Na reflexão, quem ainda não o enviou
 * cai no passo `cartao` — o Mural inteiro (crachás, termômetro, lâmina) com o
 * cartão no fim —, e só depois na `regra`. É o que cobre quem votou atrasado:
 * ninguém chega ao tio sem ter visto os crachás e respondido o cartão.
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
    case "cartao":
    case "regra":
    case "concluida":
      return estado.passo;
  }
}

/** O `progressed gate:*` de cada passo que o professor abre. */
export function gateDoPasso(passo: Passo): GateVisto | null {
  if (passo === "revelacao") return "revelacao";
  if (passo === "sintese") return "sintese";
  /* O cartão pendente e a regra são a reflexão: o gate que o professor abriu. */
  if (passo === "cartao" || passo === "regra") return "reflexao";
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

// ─────────────────────────────────────────── o cartão de frases

/** O cartão só envia com as seis respondidas: não existe resultado parcial. */
export function cartaoCompleto(frases: readonly FraseDoCartao[], respostas: Readonly<Record<string, Resposta>>): boolean {
  return frases.length > 0 && frases.every((f) => respostas[f.id] === "sim" || respostas[f.id] === "nao");
}

/**
 * A frase em pedaços, com os operadores marcados para o destaque (E, OU,
 * NÃO). Só o operador ISOLADO, em maiúsculas: "verdadeira" e "Então" não
 * acendem nada.
 */
export function partesDaFrase(texto: string): { texto: string; operador: boolean }[] {
  return texto
    .split(/(?<= )(E|OU|NÃO)(?= )/u)
    .filter((p) => p !== "")
    .map((p) => ({ texto: p, operador: p === "E" || p === "OU" || p === "NÃO" }));
}

// ─────────────────────────────────────────── a regra do tio

/** A regra está montada o bastante para testar ou enviar: condição e a primeira ação. */
export function regraMontada(condicao: string | null, acao1: string | null): boolean {
  return Boolean(condicao && acao1);
}

/** As ações da regra, em ordem: a segunda só se escolhida e diferente da primeira. */
export function acoesDaRegra(acao1: string, acao2: string | null): string[] {
  return acao2 && acao2 !== acao1 ? [acao1, acao2] : [acao1];
}

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
