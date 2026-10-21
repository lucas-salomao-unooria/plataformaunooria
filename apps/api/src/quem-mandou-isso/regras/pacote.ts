import { embaralhar } from "../../evidencias/regras";
import {
  ASSUNTO_MAX_CARACTERES,
  ASSUNTO_MIN_CARACTERES,
  ASSUNTOS_MAX,
  ASSUNTOS_MAX_CARACTERES,
  ASSUNTOS_MIN,
  BOLHA_MAX_PALAVRAS,
  CONTEXTO_MAX_CARACTERES,
  FORMATOS_BALANCEADOS,
  IDS_DE_MENSAGEM,
  LEGENDA_MAX_CARACTERES,
  LEGENDA_MAX_PALAVRAS,
  POR_QUADRANTE,
  QUADRANTES,
  REMETENTE_MAX_CARACTERES,
  REMETENTE_MIN_CARACTERES,
  TEMA_MAX_CARACTERES,
  TEMA_MAX_PALAVRAS,
  TEMA_MIN_CARACTERES,
  TEXTO_MAX_CARACTERES,
  TIPOS_DE_MENSAGEM,
  TIPOS_NO_PACOTE,
  TOTAL_DE_MENSAGENS,
  falaDaNina,
  quadranteDe,
  type IdDeMensagem,
  type MensagemDoPacote,
  type Quadrante,
  type TipoDeMensagem,
  type Tom,
  type Veracidade,
} from "../catalogo";

/**
 * As regras PURAS do pacote da exp05ef1b: o que torna as oito mensagens
 * aceitáveis para uma turma de 5º ano. Sem Prisma, sem Nest.
 *
 * O mesmo validador serve às TRÊS portas por onde um pacote chega — a saída da
 * IA (rejeitar faz o modelo regerar), a curadoria do professor (`POST
 * /aprovar`, 400 com a lista inteira) e o preset (a suíte cobra que ele passe).
 * Uma régua por porta seria a régua que uma delas esquece.
 */

/** Minúsculas e sem acento — "EXERCÍCIO" e "exercicio" são o mesmo termo para quem lê. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/** Palavras separadas por espaço. "3" conta: é o que a criança lê em voz alta. */
export function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Termos que QUEBRAM A FICÇÃO dentro do clone: no iframe quem fala é um app de
 * mensagens, e "atividade", "gabarito", "nota" ou "exercício" numa mensagem do
 * grupo (ou na fala da Nina) denunciam a aula — e a missão mede o impulso
 * espontâneo de repassar.
 *
 * Casados por PALAVRA INTEIRA, sem acento e com o plural: "notícia" e
 * "anotar" não são "nota". "Professor" NÃO entra, e a ausência é deliberada:
 * o grupo é o da turma, e a "Professora Helena" escrevendo nele é o WhatsApp
 * real (o preset reprovaria na própria régua).
 */
export const TERMOS_PROIBIDOS_NO_CLONE = ["atividade", "gabarito", "nota", "exercicio"] as const;

/** Os termos proibidos que aparecem no texto, na forma base. */
export function termosProibidosEm(texto: string): string[] {
  const palavras = new Set(normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean));
  return TERMOS_PROIBIDOS_NO_CLONE.filter((t) => palavras.has(t) || palavras.has(`${t}s`));
}

/**
 * O TEMA, que vai para dentro do clone na fala da Nina ("Rolou uma confusão
 * sobre {tema}."). Por isso ele herda as réguas do clone: ≤ 60 caracteres
 * (RF-001), ≤ 8 palavras (é o que deixa o balão da Nina em ≤ 45) e nenhum
 * termo proibido.
 */
export function validarTema(tema: string): string[] {
  const erros: string[] = [];
  const t = tema.trim();
  if (t.length < TEMA_MIN_CARACTERES) erros.push(`O tema precisa de pelo menos ${TEMA_MIN_CARACTERES} caracteres.`);
  if (t.length > TEMA_MAX_CARACTERES) erros.push(`O tema passa de ${TEMA_MAX_CARACTERES} caracteres.`);
  if (contarPalavras(t) > TEMA_MAX_PALAVRAS) erros.push(`O tema passa de ${TEMA_MAX_PALAVRAS} palavras.`);
  const proibidos = termosProibidosEm(t);
  if (proibidos.length > 0) erros.push(`O tema usa um termo que quebra a simulação: ${proibidos.join(", ")}.`);
  if (erros.length === 0 && contarPalavras(falaDaNina(t)) > BOLHA_MAX_PALAVRAS) {
    erros.push(`A fala da Nina com este tema passa de ${BOLHA_MAX_PALAVRAS} palavras.`);
  }
  return erros;
}

/** Os fatos balizadores: 3 a 6 tópicos, cada um de 2 a 120 caracteres, ≤ 600 somados. */
export function validarAssuntos(assuntos: readonly string[]): string[] {
  const erros: string[] = [];
  const limpos = assuntos.map((a) => a.trim());
  if (limpos.length < ASSUNTOS_MIN || limpos.length > ASSUNTOS_MAX) {
    erros.push(`Liste de ${ASSUNTOS_MIN} a ${ASSUNTOS_MAX} fatos da aula.`);
  }
  if (limpos.some((a) => a.length < ASSUNTO_MIN_CARACTERES || a.length > ASSUNTO_MAX_CARACTERES)) {
    erros.push(`Cada fato tem de ${ASSUNTO_MIN_CARACTERES} a ${ASSUNTO_MAX_CARACTERES} caracteres.`);
  }
  if (limpos.join("").length > ASSUNTOS_MAX_CARACTERES) {
    erros.push(`Os fatos passam de ${ASSUNTOS_MAX_CARACTERES} caracteres somados.`);
  }
  return erros;
}

export function validarContexto(contexto: string | null | undefined): string[] {
  if (contexto === null || contexto === undefined) return [];
  return contexto.trim().length > CONTEXTO_MAX_CARACTERES
    ? [`O contexto passa de ${CONTEXTO_MAX_CARACTERES} caracteres.`]
    : [];
}

/**
 * AS OITO MENSAGENS, em frases para o professor. Lista vazia = pode ir para a
 * turma. O que se confere, e por quê:
 *
 *   - exatamente 8, cada id de `msg_1` a `msg_8` uma vez — a seleção do
 *     estudante é conferida contra estes ids;
 *   - exatamente 2 por quadrante (2 VE, 2 VN, 2 FE, 2 FN) — travado pelo
 *     briefing, e é o que dá à revelação uma surpresa para cada lado;
 *   - exatamente 4 textos, 2 imagens e 2 links;
 *   - imagem e link com UMA verdadeira e UMA falsa cada (o GAP): formato que
 *     prediz a veracidade vira a heurística "link = mentira";
 *   - a legenda existe na imagem e no link e SÓ neles;
 *   - os tetos de leitura da faixa (bolha ≤ 45 palavras, legenda ≤ 25);
 *   - nenhum termo proibido no que a criança lê dentro do clone.
 */
export function validarMensagens(mensagens: readonly MensagemDoPacote[]): string[] {
  const erros: string[] = [];
  if (mensagens.length !== TOTAL_DE_MENSAGENS) {
    erros.push(`O pacote precisa de exatamente ${TOTAL_DE_MENSAGENS} mensagens.`);
  }

  const ids = mensagens.map((m) => m.id);
  const esperados = new Set<string>(IDS_DE_MENSAGEM);
  if (new Set(ids).size !== ids.length || ids.some((id) => !esperados.has(id))) {
    erros.push(`Cada id de msg_1 a msg_${TOTAL_DE_MENSAGENS} aparece uma vez só.`);
  }

  const porQuadrante = new Map<Quadrante, number>(QUADRANTES.map((q) => [q, 0]));
  for (const m of mensagens) porQuadrante.set(quadranteDe(m), (porQuadrante.get(quadranteDe(m)) ?? 0) + 1);
  if (QUADRANTES.some((q) => porQuadrante.get(q) !== POR_QUADRANTE)) {
    erros.push(
      `A matriz precisa de exatamente ${POR_QUADRANTE} verdadeiras emocionais, ${POR_QUADRANTE} verdadeiras neutras, ` +
        `${POR_QUADRANTE} falsas emocionais e ${POR_QUADRANTE} falsas neutras.`,
    );
  }

  const porTipo = new Map<TipoDeMensagem, number>(TIPOS_DE_MENSAGEM.map((t) => [t, 0]));
  for (const m of mensagens) porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + 1);
  if (TIPOS_DE_MENSAGEM.some((t) => porTipo.get(t) !== TIPOS_NO_PACOTE[t])) {
    erros.push(
      `O pacote precisa de exatamente ${TIPOS_NO_PACOTE.texto} textos, ${TIPOS_NO_PACOTE.imagem} imagens e ${TIPOS_NO_PACOTE.link} links.`,
    );
  }

  for (const formato of FORMATOS_BALANCEADOS) {
    const doFormato = mensagens.filter((m) => m.tipo === formato);
    const verdadeiras = doFormato.filter((m) => m.veracidade === "verdadeira").length;
    if (doFormato.length === 2 && verdadeiras !== 1) {
      erros.push(
        `As duas mensagens de ${formato} precisam ser uma verdadeira e uma falsa — senão o formato entrega a resposta.`,
      );
    }
  }

  for (const m of mensagens) {
    const rotulo = m.id;
    const remetente = m.remetente.trim();
    if (remetente.length < REMETENTE_MIN_CARACTERES || remetente.length > REMETENTE_MAX_CARACTERES) {
      erros.push(`${rotulo}: o remetente tem de ${REMETENTE_MIN_CARACTERES} a ${REMETENTE_MAX_CARACTERES} caracteres.`);
    }
    const texto = m.texto.trim();
    if (!texto) erros.push(`${rotulo}: a mensagem está sem texto.`);
    if (texto.length > TEXTO_MAX_CARACTERES) erros.push(`${rotulo}: o texto passa de ${TEXTO_MAX_CARACTERES} caracteres.`);
    if (contarPalavras(texto) > BOLHA_MAX_PALAVRAS) {
      erros.push(`${rotulo}: o texto passa de ${BOLHA_MAX_PALAVRAS} palavras.`);
    }

    const legenda = m.legenda?.trim() ?? "";
    if (m.tipo === "texto" && legenda) erros.push(`${rotulo}: mensagem de texto não tem legenda.`);
    if (m.tipo !== "texto" && !legenda) {
      erros.push(`${rotulo}: ${m.tipo === "imagem" ? "o comunicado precisa do texto da imagem" : "o link precisa da manchete da prévia"}.`);
    }
    if (legenda.length > LEGENDA_MAX_CARACTERES) erros.push(`${rotulo}: a legenda passa de ${LEGENDA_MAX_CARACTERES} caracteres.`);
    if (contarPalavras(legenda) > LEGENDA_MAX_PALAVRAS) {
      erros.push(`${rotulo}: a legenda passa de ${LEGENDA_MAX_PALAVRAS} palavras.`);
    }

    const proibidos = [...new Set([remetente, texto, legenda].flatMap(termosProibidosEm))];
    if (proibidos.length > 0) {
      erros.push(`${rotulo}: usa um termo que quebra a simulação (${proibidos.join(", ")}).`);
    }
  }
  return erros;
}

/** O pacote inteiro: o recorte do professor e as oito mensagens. */
export function validarPacote(p: {
  tema: string;
  assuntos: readonly string[];
  contexto?: string | null;
  mensagens: readonly MensagemDoPacote[];
}): string[] {
  return [...validarTema(p.tema), ...validarAssuntos(p.assuntos), ...validarContexto(p.contexto), ...validarMensagens(p.mensagens)];
}

// ───────────────────────────────────────────── o molde sorteado para a IA

/** O que uma posição do pacote TEM de ser — a IA só escreve remetente, texto e legenda. */
export interface MoldeDaMensagem {
  id: IdDeMensagem;
  tipo: TipoDeMensagem;
  veracidade: Veracidade;
  tom: Tom;
}

const EIXOS: Readonly<Record<Quadrante, { veracidade: Veracidade; tom: Tom }>> = {
  VE: { veracidade: "verdadeira", tom: "emocional" },
  VN: { veracidade: "verdadeira", tom: "neutra" },
  FE: { veracidade: "falsa", tom: "emocional" },
  FN: { veracidade: "falsa", tom: "neutra" },
};

/** Um índice inteiro em `[0, n)`. `aleatorio` é injetável para o teste ser determinístico. */
function sortearIndice(n: number, aleatorio: () => number): number {
  return Math.min(n - 1, Math.floor(aleatorio() * n));
}

/**
 * UM MOLDE SORTEADO para a geração por IA: que tipo e que quadrante cada uma
 * das oito posições tem de ser.
 *
 * Por que a estrutura não fica com o modelo: o enum do schema restringe os
 * VALORES, mas nada garante que ele entregue 2 por quadrante nem que as duas
 * imagens não saiam verdadeiras — e cada saída fora da régua é uma tentativa
 * paga e jogada fora. Com o molde, o modelo só escreve; quem garante a matriz
 * é esta função.
 *
 * Por que SORTEADO, e não fixo como o preset: com o molde fixo a `msg_2`
 * seria sempre a falsa neutra em toda turma que gerasse com IA, e a posição
 * viraria a pista. A construção satisfaz as réguas por definição — imagem e
 * link recebem um quadrante verdadeiro e um falso cada, e os quatro que sobram
 * são os textos — e a ordem das posições é embaralhada no fim.
 */
export function sortearMolde(aleatorio: () => number = Math.random): MoldeDaMensagem[] {
  const verdadeiros: Quadrante[] = ["VE", "VE", "VN", "VN"];
  const falsos: Quadrante[] = ["FE", "FE", "FN", "FN"];
  const tirar = (lista: Quadrante[]): Quadrante => lista.splice(sortearIndice(lista.length, aleatorio), 1)[0] as Quadrante;

  const posicoes: { tipo: TipoDeMensagem; quadrante: Quadrante }[] = [];
  for (const tipo of FORMATOS_BALANCEADOS) {
    posicoes.push({ tipo, quadrante: tirar(verdadeiros) }, { tipo, quadrante: tirar(falsos) });
  }
  for (const quadrante of [...verdadeiros, ...falsos]) posicoes.push({ tipo: "texto", quadrante });

  return embaralhar(posicoes, aleatorio).map((p, i) => ({
    id: IDS_DE_MENSAGEM[i] as IdDeMensagem,
    tipo: p.tipo,
    ...EIXOS[p.quadrante],
  }));
}
