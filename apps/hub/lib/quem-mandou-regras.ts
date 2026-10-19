import {
  ROTULO_DO_QUADRANTE,
  type AcaoDoGate,
  type CorpoDaAprovacao,
  type Fase,
  type MensagemDoPacote,
  type OpcaoDaMissao,
  type Origem,
  type PainelDaTurma,
  type Quadrante,
  type RecorteDaAula,
} from "./quem-mandou-tipos";

/**
 * As regras PURAS das telas do professor da exp05ef1b v2.2 — o preparo, a
 * curadoria, o console da aula e a folha. Sem React e sem `fetch`: é o que o
 * `vitest` do hub alcança (ele só varre `lib/**`), e é onde mora tudo o que a
 * tela decide e não é trivial.
 *
 * ## Os tetos são ESPELHO, e o que eles fazem aqui é APONTAR
 *
 * Quem recusa de verdade é a api (`apps/api/src/quem-mandou-isso/regras/
 * pacote.ts#validarPacote`), com 400 e a lista INTEIRA de frases. A tela
 * repete os tetos por um motivo só: dizer ENQUANTO a professora digita qual
 * campo de qual mensagem passou do limite. Sem isso ela descobre no 400, com
 * oito cards abertos, e procura. Os números têm de ser os de
 * `apps/api/src/quem-mandou-isso/catalogo.ts` — mudou lá, muda aqui — e nada
 * aqui BLOQUEIA o envio: se o espelho ficar mais estrito que a api, a
 * professora ainda consegue aprovar e quem decide continua sendo o servidor.
 */

export const TOTAL_DE_MENSAGENS = 8;

/** Espelho dos tetos de `catalogo.ts` da api. */
export const TETOS = {
  temaMinCaracteres: 3,
  temaMaxCaracteres: 60,
  /** O tema entra na fala da Nina: até 8 palavras deixam o balão em até 45. */
  temaMaxPalavras: 8,
  assuntosMin: 3,
  assuntosMax: 6,
  assuntoMinCaracteres: 2,
  assuntoMaxCaracteres: 120,
  assuntosMaxCaracteres: 600,
  contextoMaxCaracteres: 300,
  remetenteMinCaracteres: 2,
  remetenteMaxCaracteres: 30,
  textoMaxCaracteres: 400,
  textoMaxPalavras: 45,
  legendaMaxCaracteres: 200,
  legendaMaxPalavras: 25,
} as const;

/** Os quadrantes na ordem da curadoria (`e0.professor.badge_*`). */
export const QUADRANTES: readonly Quadrante[] = ["VE", "VN", "FE", "FN"];

/**
 * Termos que quebram a ficção DENTRO do clone — espelho de
 * `TERMOS_PROIBIDOS_NO_CLONE` da api: palavra inteira, sem acento, com plural.
 * "Professor" fica de fora de propósito ("Professora Helena" escreve no grupo).
 */
const TERMOS_PROIBIDOS_NO_CLONE = ["atividade", "gabarito", "nota", "exercicio"] as const;

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/** Espaço sobrando vira um só, e as pontas somem — a mesma limpeza que a api grava. */
export function limparTexto(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Palavras separadas por espaço. "3" conta: é o que a criança lê em voz alta. */
export function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export function termosProibidosEm(texto: string): string[] {
  const palavras = new Set(normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean));
  return TERMOS_PROIBIDOS_NO_CLONE.filter((t) => palavras.has(t) || palavras.has(`${t}s`));
}

function frasePrimeiraMaiuscula(frase: string): string {
  return frase.length > 0 ? frase[0]!.toLocaleUpperCase("pt-BR") + frase.slice(1) : frase;
}

// ─────────────────────────────────────────────────────────── a matriz

export function quadranteDe(m: Pick<MensagemDoPacote, "veracidade" | "tom">): Quadrante {
  const v = m.veracidade === "verdadeira" ? "V" : "F";
  const t = m.tom === "emocional" ? "E" : "N";
  return `${v}${t}` as Quadrante;
}

/** Uma mensagem com a POSIÇÃO dela no grupo (1 a 8) — é assim que a criança a vê em ordem. */
export interface MensagemNaMatriz {
  mensagem: MensagemDoPacote;
  posicao: number;
}

export interface QuadranteDaCuradoria {
  quadrante: Quadrante;
  rotulo: string;
  mensagens: MensagemNaMatriz[];
}

/**
 * As oito mensagens nos quatro quadrantes da curadoria (E0-PROF-04). A ordem
 * do GRUPO não muda — ela é do molde sorteado no servidor —; o agrupamento é só
 * de leitura, para a professora conferir que cada quadrante tem as suas duas.
 */
export function agruparPorQuadrante(mensagens: readonly MensagemDoPacote[]): QuadranteDaCuradoria[] {
  const comPosicao = mensagens.map((mensagem, indice) => ({ mensagem, posicao: indice + 1 }));
  return QUADRANTES.map((quadrante) => ({
    quadrante,
    rotulo: ROTULO_DO_QUADRANTE[quadrante],
    mensagens: comPosicao.filter((m) => quadranteDe(m.mensagem) === quadrante),
  }));
}

/** A mensagem do pacote por id, com a posição — o que a folha precisa para nomear uma escolha. */
export function mensagemPorId(
  mensagens: readonly MensagemDoPacote[],
  id: string,
): MensagemNaMatriz | null {
  const indice = mensagens.findIndex((m) => m.id === id);
  return indice < 0 ? null : { mensagem: mensagens[indice]!, posicao: indice + 1 };
}

/** Troca UM campo de UMA mensagem, sem tocar nas outras (e sem mexer no gabarito). */
export function trocarCampo(
  mensagens: readonly MensagemDoPacote[],
  id: string,
  campo: CampoDaMensagem,
  valor: string,
): MensagemDoPacote[] {
  return mensagens.map((m) => (m.id === id ? { ...m, [campo]: valor } : m));
}

// ─────────────────────────────────────────────────────────── o recorte

/**
 * O recorte como a TELA o edita: os fatos balizadores são UM texto, um por
 * linha (ou separados por ";", como no exemplo do wireframe), e a lista só
 * nasce na hora de mandar.
 */
export interface RecorteEmEdicao {
  disciplina: string;
  tema: string;
  assuntosTexto: string;
  contexto: string;
}

export const RECORTE_VAZIO: RecorteEmEdicao = { disciplina: "", tema: "", assuntosTexto: "", contexto: "" };

/** Um fato por linha, ou separados por ponto e vírgula. Linha vazia não é fato. */
export function assuntosDoTexto(texto: string): string[] {
  return texto
    .split(/\r?\n|;/)
    .map(limparTexto)
    .filter(Boolean);
}

export function textoDosAssuntos(assuntos: readonly string[]): string {
  return assuntos.join("\n");
}

/** O recorte que um pacote (rascunho, ativo ou o banco curado) carrega, pronto para o formulário. */
export function recorteDoPacote(
  pacote: { tema: string; assuntos: readonly string[]; contexto?: string | null; disciplina?: string },
  disciplinaAtual = "",
): RecorteEmEdicao {
  return {
    disciplina: pacote.disciplina ?? disciplinaAtual,
    tema: pacote.tema,
    assuntosTexto: textoDosAssuntos(pacote.assuntos),
    contexto: pacote.contexto ?? "",
  };
}

/** O corpo do `POST /gerar`. Contexto vazio vai `null`, não `""`. */
export function recorteDaAula(recorte: RecorteEmEdicao): RecorteDaAula {
  const contexto = limparTexto(recorte.contexto);
  return {
    disciplina: recorte.disciplina,
    tema: limparTexto(recorte.tema),
    assuntos: assuntosDoTexto(recorte.assuntosTexto),
    contexto: contexto || null,
  };
}

/** O corpo do `POST /aprovar`: o recorte e as oito mensagens como a professora as deixou. */
export function corpoDaAprovacao(
  recorte: RecorteEmEdicao,
  origem: Origem,
  mensagens: readonly MensagemDoPacote[],
): CorpoDaAprovacao {
  return { ...recorteDaAula(recorte), origem, mensagens: mensagens.map((m) => ({ ...m })) };
}

export interface ConferenciaDoTema {
  caracteres: number;
  palavras: number;
  erro: string | null;
}

/**
 * O TEMA, que completa a fala da Nina: "Rolou uma confusão sobre {tema}." É por
 * isso que ele herda as réguas do clone — tamanho, palavras e nenhum termo que
 * denuncie a aula. Vazio não é erro AQUI (a tela decide quando cobrar).
 */
export function conferirTema(tema: string): ConferenciaDoTema {
  const limpo = limparTexto(tema);
  const caracteres = limpo.length;
  const palavras = contarPalavras(limpo);
  let erro: string | null = null;
  if (caracteres > 0 && caracteres < TETOS.temaMinCaracteres) {
    erro = `O tema precisa de pelo menos ${TETOS.temaMinCaracteres} caracteres.`;
  } else if (caracteres > TETOS.temaMaxCaracteres) {
    erro = `O tema passa de ${TETOS.temaMaxCaracteres} caracteres.`;
  } else if (palavras > TETOS.temaMaxPalavras) {
    erro = `O tema passa de ${TETOS.temaMaxPalavras} palavras.`;
  } else {
    const proibidos = termosProibidosEm(limpo);
    if (proibidos.length > 0) erro = `O tema usa um termo que quebra a simulação: ${proibidos.join(", ")}.`;
  }
  return { caracteres, palavras, erro };
}

/**
 * Os fatos balizadores: de 3 a 6, cada um de 2 a 120 caracteres, até 600
 * somados. `null` = em ordem.
 *
 * O erro da contagem diz COMO separar: o professor que escreve os três temas
 * numa linha só, separados por vírgula, via "1 fato" e não entendia por que o
 * Continuar não andava (o pedido do PO em 2026-10-05).
 */
export function conferirAssuntos(assuntos: readonly string[]): string | null {
  if (assuntos.length < TETOS.assuntosMin || assuntos.length > TETOS.assuntosMax) {
    const mesmaLinha = assuntos.length === 1 && /,/.test(assuntos[0] ?? "");
    return (
      `Liste de ${TETOS.assuntosMin} a ${TETOS.assuntosMax} fatos, um por linha (hoje: ${assuntos.length}). ` +
      (mesmaLinha
        ? "Parece que eles estão todos na mesma linha: aperte Enter entre um fato e outro."
        : "Aperte Enter entre um fato e outro.")
    );
  }
  if (assuntos.some((a) => a.length < TETOS.assuntoMinCaracteres || a.length > TETOS.assuntoMaxCaracteres)) {
    return `Cada fato tem de ${TETOS.assuntoMinCaracteres} a ${TETOS.assuntoMaxCaracteres} caracteres.`;
  }
  if (assuntos.join("").length > TETOS.assuntosMaxCaracteres) {
    return `Os fatos passam de ${TETOS.assuntosMaxCaracteres} caracteres somados.`;
  }
  return null;
}

export function conferirContexto(contexto: string): string | null {
  return limparTexto(contexto).length > TETOS.contextoMaxCaracteres
    ? `O contexto passa de ${TETOS.contextoMaxCaracteres} caracteres.`
    : null;
}

// ────────────────────────────────────────────────────────── a mensagem

export type CampoDaMensagem = "remetente" | "texto" | "legenda";

/**
 * O que falta ou sobra em cada campo de UMA mensagem. Objeto vazio = em ordem.
 * A régua da MATRIZ (duas por quadrante, 4/2/2, imagem e link balanceados) não
 * mora aqui: a curadoria não deixa a professora mexer no gabarito nem no
 * formato, então só o molde do servidor poderia quebrá-la.
 */
export function conferirMensagem(m: MensagemDoPacote): Partial<Record<CampoDaMensagem, string>> {
  const erros: Partial<Record<CampoDaMensagem, string>> = {};

  const remetente = limparTexto(m.remetente);
  if (remetente.length < TETOS.remetenteMinCaracteres || remetente.length > TETOS.remetenteMaxCaracteres) {
    erros.remetente = `O remetente tem de ${TETOS.remetenteMinCaracteres} a ${TETOS.remetenteMaxCaracteres} caracteres.`;
  } else if (termosProibidosEm(remetente).length > 0) {
    erros.remetente = `Usa um termo que quebra a simulação (${termosProibidosEm(remetente).join(", ")}).`;
  }

  const texto = limparTexto(m.texto);
  if (!texto) erros.texto = "A mensagem está sem texto.";
  else if (texto.length > TETOS.textoMaxCaracteres) erros.texto = `O texto passa de ${TETOS.textoMaxCaracteres} caracteres.`;
  else if (contarPalavras(texto) > TETOS.textoMaxPalavras) erros.texto = `O texto passa de ${TETOS.textoMaxPalavras} palavras.`;
  else if (termosProibidosEm(texto).length > 0) {
    erros.texto = `Usa um termo que quebra a simulação (${termosProibidosEm(texto).join(", ")}).`;
  }

  if (m.tipo !== "texto") {
    const legenda = limparTexto(m.legenda ?? "");
    if (!legenda) {
      erros.legenda = m.tipo === "imagem" ? "O comunicado precisa do texto da imagem." : "O link precisa da manchete da prévia.";
    } else if (legenda.length > TETOS.legendaMaxCaracteres) {
      erros.legenda = `A legenda passa de ${TETOS.legendaMaxCaracteres} caracteres.`;
    } else if (contarPalavras(legenda) > TETOS.legendaMaxPalavras) {
      erros.legenda = `A legenda passa de ${TETOS.legendaMaxPalavras} palavras.`;
    } else if (termosProibidosEm(legenda).length > 0) {
      erros.legenda = `Usa um termo que quebra a simulação (${termosProibidosEm(legenda).join(", ")}).`;
    }
  }
  return erros;
}

/** Quantas das oito estão em ordem — é o "8 / 8 validados" do topo da curadoria. */
export function mensagensEmOrdem(mensagens: readonly MensagemDoPacote[]): number {
  return mensagens.filter((m) => Object.keys(conferirMensagem(m)).length === 0).length;
}

// ──────────────────────────────────────────────── os erros do 400 da api

export interface ErrosDaAprovacao {
  tema: string[];
  assuntos: string[];
  contexto: string[];
  /** Por id de mensagem (`msg_3`), sem o prefixo, e com a primeira letra maiúscula. */
  porMensagem: Record<string, string[]>;
  /** O que não tem campo: a matriz, os formatos, os ids. Vai perto do botão de aprovar. */
  geral: string[];
}

/**
 * Cada frase do 400 (`pacote-invalido`/`preparo-invalido`) PERTO DO CAMPO dela.
 *
 * A api devolve TODOS os problemas de uma vez, em frases para o professor, e
 * as de uma mensagem começam pelo id dela (`msg_3: o texto passa de 45
 * palavras.`) — é por esse prefixo, e pelo começo das frases do recorte, que a
 * tela as reparte. O que não casa com nada vai para `geral`: melhor uma frase
 * no lugar errado do que uma frase sumida.
 */
export function distribuirErros(erros: readonly string[]): ErrosDaAprovacao {
  const saida: ErrosDaAprovacao = { tema: [], assuntos: [], contexto: [], porMensagem: {}, geral: [] };
  for (const frase of erros) {
    const daMensagem = /^(msg_\d+):\s*(.+)$/.exec(frase);
    if (daMensagem) {
      const [, id, resto] = daMensagem;
      (saida.porMensagem[id!] ??= []).push(frasePrimeiraMaiuscula(resto!));
      continue;
    }
    if (/^(O tema|A fala da Nina)/.test(frase)) saida.tema.push(frase);
    else if (/^(Liste de|Cada fato|Os fatos)/.test(frase)) saida.assuntos.push(frase);
    else if (/^O contexto/.test(frase)) saida.contexto.push(frase);
    else saida.geral.push(frase);
  }
  return saida;
}

/** A frase e a lista de um corpo de erro da api — com o texto padrão quando ela não disse nada. */
export function erroDaApi(corpo: unknown, padrao: string): { mensagem: string; erros: string[] } {
  if (!corpo || typeof corpo !== "object") return { mensagem: padrao, erros: [] };
  const { mensagem, erros } = corpo as { mensagem?: unknown; erros?: unknown };
  return {
    mensagem: typeof mensagem === "string" && mensagem ? mensagem : padrao,
    erros: Array.isArray(erros) ? erros.filter((e): e is string => typeof e === "string") : [],
  };
}

// ─────────────────────────────────────────────────────── o console da aula

const ORDEM_DA_FASE: Readonly<Record<Fase, number>> = { triagem: 0, revelacao: 1, explicar: 2, reflexao: 3 };

/** A turma já chegou a `alvo`? Sem pacote (`null`) não chegou a nada. */
export function faseAtingiu(fase: Fase | null, alvo: Fase): boolean {
  return fase !== null && ORDEM_DA_FASE[fase] >= ORDEM_DA_FASE[alvo];
}

export type EstadoDoBotao = "feito" | "disponivel" | "indisponivel";

export interface BotaoDaAula {
  acao: AcaoDoGate;
  /** A fase que o botão abre. */
  fase: Fase;
  /** O rótulo literal da copy (`e4/e5.professor.btn_*`); "Apresentar Síntese" é do one-pager pedagógico. */
  rotulo: string;
  estado: EstadoDoBotao;
  /** O botão que a aula pede agora — o único em destaque. */
  proximo: boolean;
}

const BOTOES: ReadonlyArray<Pick<BotaoDaAula, "acao" | "fase" | "rotulo">> = [
  { acao: "liberar_revelacao", fase: "revelacao", rotulo: "Liberar Revelação" },
  { acao: "apresentar_sintese", fase: "explicar", rotulo: "Apresentar Síntese" },
  { acao: "liberar_reflexao", fase: "reflexao", rotulo: "Liberar Reflexão" },
];

/**
 * Os TRÊS botões, na ordem, e o que cada um pode fazer agora.
 *
 * A fase só anda para a frente (na api, `avancarFase`): o que já passou é
 * `feito`, e não se aperta de novo. A síntese e a reflexão só depois da
 * revelação — a api aceitaria pular direto para a reflexão, mas uma turma que
 * monta a regra sem ter visto os próprios selos faz a Etapa 6 sem a descoberta
 * que ela fecha. Pular a SÍNTESE continua possível: depois da revelação, a
 * reflexão está disponível ao lado dela.
 */
export function botoesDaAula(fase: Fase | null): BotaoDaAula[] {
  const botoes = BOTOES.map((b): BotaoDaAula => {
    if (fase === null) return { ...b, estado: "indisponivel", proximo: false };
    if (faseAtingiu(fase, b.fase)) return { ...b, estado: "feito", proximo: false };
    const liberado = b.fase === "revelacao" || faseAtingiu(fase, "revelacao");
    return { ...b, estado: liberado ? "disponivel" : "indisponivel", proximo: false };
  });
  const proximo = botoes.find((b) => b.estado === "disponivel");
  return botoes.map((b) => (b === proximo ? { ...b, proximo: true } : b));
}

/**
 * O painel ainda precisa se atualizar sozinho? Sim enquanto há aula (um pacote
 * aprovado) e alguém ainda não concluiu. Turma inteira concluída, ou sem
 * pacote, é trabalho para ninguém.
 */
export function deveConsultar(painel: Pick<PainelDaTurma, "atividade" | "progresso">): boolean {
  if (!painel.atividade) return false;
  const { unidades, concluiram } = painel.progresso;
  return !(unidades > 0 && concluiram >= unidades);
}

/**
 * Mudou algo que a EVIDÊNCIA registra? A EF05CO08 é marcada quando o Mural
 * fecha, a EF05CO03 quando o cartão de frases é enviado e a EF05CO04 quando a
 * regra do tio é enviada — e a atividade troca com um pacote novo ou uma rodada
 * nova. É só nesses casos que vale reler a página inteira para o painel de
 * habilidades acompanhar.
 */
export function mudouAEvidencia(
  antes: Pick<PainelDaTurma, "atividade" | "progresso">,
  depois: Pick<PainelDaTurma, "atividade" | "progresso">,
): boolean {
  return (
    antes.progresso.confirmaram !== depois.progresso.confirmaram ||
    antes.progresso.responderamCartao !== depois.progresso.responderamCartao ||
    antes.progresso.enviaramRegra !== depois.progresso.enviaramRegra ||
    antes.progresso.concluiram !== depois.progresso.concluiram ||
    antes.atividade?.pacoteId !== depois.atividade?.pacoteId ||
    antes.atividade?.rodada !== depois.atividade?.rodada
  );
}

// ─────────────────────────────────────────────── o termômetro e a folha

/**
 * O percentual do telão, ou `null` quando não há base. Sem ninguém que
 * confirmou o Mural, "0%" mentiria — diria que ninguém caiu, quando ninguém
 * jogou. A tela escreve "sem dados".
 */
export function percentualComBase(base: number, percentual: number): number | null {
  return base > 0 ? percentual : null;
}

/** "45 s", "2 min", "2 min 10 s". `null` = ainda não fechou o Mural. */
export function duracaoLegivel(segundos: number | null): string {
  if (segundos === null) return "—";
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  if (minutos === 0) return `${resto} s`;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
}

/** O rótulo que a criança leu, ou o próprio id se a api não o mandou (nunca some a resposta). */
export function rotuloDaOpcao(opcoes: readonly OpcaoDaMissao[], id: string | null): string | null {
  if (!id) return null;
  return opcoes.find((o) => o.id === id)?.rotulo ?? id;
}
