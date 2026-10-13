import type { EventoAgente } from "../ai/agente-professor.port";

/**
 * As regras PURAS do agente de IA do professor — sem banco, sem rede.
 * Contrato: `docs/regras/agente-professor.md`.
 */

/** A ferramenta cujos retornos viram o evento `fontes`. Nome = contrato com o agente. */
export const FERRAMENTA_DO_ACERVO = "buscar_acervo";
/** As chaves de estado que são contrato (a tabela do `docs/regras/agente-professor.md`). */
export const CHAVE_NOME_DO_PROFESSOR = "nome_professor";
export const CHAVE_TITULO_DA_CONVERSA = "titulo_conversa";
/** Espelha o CHECK `agente_professor_conversas_titulo_check`. */
export const TAMANHO_MAXIMO_DO_TITULO = 120;

/** O primeiro nome de `users.display_name`, para o estado `nome_professor`. */
export function primeiroNome(nomeCompleto: string | null | undefined): string | null {
  const primeiro = (nomeCompleto ?? "").trim().split(/\s+/)[0];
  return primeiro ? primeiro : null;
}

/**
 * O DEDUPLICADOR DO SSE DO ADK.
 *
 * Em modo SSE o ADK emite os pedaços (`partial=true`) E, no fim de cada
 * chamada ao modelo, um evento NÃO parcial que REPETE o texto inteiro.
 * Repassar os dois duplica a resposta na tela — é a primeira armadilha do
 * contrato. A regra, por segmento (uma chamada ao modelo):
 *
 *   - parcial: repassa o pedaço e acumula;
 *   - final sem nenhum parcial antes (streaming desligado, resposta curta):
 *     repassa inteiro — senão o texto sumiria;
 *   - final que COMEÇA pelo acumulado: repassa só o que faltou (normalmente
 *     nada);
 *   - final que diverge do acumulado: não repassa nada — o professor já leu a
 *     versão dos parciais, e acrescentar a outra seria a duplicação de volta.
 *
 * O segmento fecha em todo evento não parcial (inclusive o de chamada de
 * ferramenta): um turno com ferramenta tem mais de uma chamada ao modelo.
 */
export class DeduplicadorDeTexto {
  private acumulado = "";
  /** Todo o texto que foi à tela neste turno — é ele que a conferência lê. */
  textoDoTurno = "";

  receber(evento: EventoAgente): string | null {
    if (evento.autor === "user") return null;
    const texto = evento.textos.join("");
    if (evento.parcial) {
      if (!texto) return null;
      this.acumulado += texto;
      return this.emitir(texto);
    }
    const acumulado = this.acumulado;
    this.acumulado = "";
    if (!texto) return null;
    if (!acumulado) return this.emitir(texto);
    if (texto.startsWith(acumulado)) {
      const resto = texto.slice(acumulado.length);
      return resto ? this.emitir(resto) : null;
    }
    return null;
  }

  private emitir(texto: string): string {
    this.textoDoTurno += texto;
    return texto;
  }
}

/**
 * Os tokens do turno: SÓ dos eventos NÃO parciais, somados.
 *
 * Os parciais repetem o `usage_metadata` (ou trazem parcial dele) — somá-los
 * cobraria o turno várias vezes. E é SOMA, não o último: um turno com
 * ferramenta faz duas ou mais chamadas ao modelo, e cada uma é paga.
 */
export function somarTokens(eventos: Iterable<EventoAgente>): number {
  let total = 0;
  for (const e of eventos) {
    if (!e.parcial && typeof e.tokens === "number" && e.tokens > 0) total += e.tokens;
  }
  return total;
}

/**
 * O mesmo recorte de `somarTokens`, dividido para o painel de custos
 * (ADR-161): entrada e saída cobradas, e o modelo que respondeu. A saída é o
 * total menos a entrada — o raciocínio sai na tarifa de saída. Evento sem
 * `prompt_token_count` conta inteiro como saída (a tarifa mais cara).
 */
export function consumoDoTurno(
  eventos: Iterable<EventoAgente>,
  modeloPadrao: string,
): { entrada: number; saida: number; modelo: string } {
  let entrada = 0;
  let saida = 0;
  let modelo: string | undefined;
  for (const e of eventos) {
    if (e.parcial || typeof e.tokens !== "number" || e.tokens <= 0) continue;
    const deEntrada = Math.min(e.tokens, Math.max(0, e.tokensEntrada ?? 0));
    entrada += deEntrada;
    saida += e.tokens - deEntrada;
    modelo ??= e.modelo;
  }
  return { entrada, saida, modelo: modelo ?? modeloPadrao };
}

export interface Fonte {
  titulo: string;
  paginaInicio: number | null;
  paginaFim: number | null;
}

function numeroOuNulo(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return null;
}

function comoObjeto(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

/**
 * Os itens de um retorno de `buscar_acervo`. O agente ainda está sendo escrito,
 * então a leitura é tolerante: lista direta, ou lista dentro de `trechos`,
 * `resultados`, `fontes` ou `result` (o ADK embrulha retorno que não é dict em
 * `{"result": ...}`). A forma PREFERIDA — a que o mock usa e o `AGENTS.md` do
 * módulo documenta — é `{ "trechos": [{ "titulo", "pagina_inicio", "pagina_fim", … }] }`.
 */
function itensDoRetorno(resposta: unknown): unknown[] {
  if (Array.isArray(resposta)) return resposta;
  const o = comoObjeto(resposta);
  if (!o) return [];
  for (const chave of ["trechos", "resultados", "fontes", "result", "results"]) {
    const v = o[chave];
    if (Array.isArray(v)) return v;
    if (comoObjeto(v)) return itensDoRetorno(v);
  }
  return [];
}

/** Um item → `Fonte`, aceitando snake, camel e o `pageSpan` do Vertex AI Search. */
function fonteDoItem(bruto: unknown): Fonte | null {
  const o = comoObjeto(bruto);
  if (!o) return null;
  const titulo = [o.titulo, o.title, o.documento, o.nome_documento].find(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
  if (!titulo) return null;
  const span = comoObjeto(o.pageSpan ?? o.page_span);
  return {
    titulo: titulo.trim(),
    paginaInicio: numeroOuNulo(o.pagina_inicio ?? o.paginaInicio ?? span?.pageStart ?? span?.page_start),
    paginaFim: numeroOuNulo(o.pagina_fim ?? o.paginaFim ?? span?.pageEnd ?? span?.page_end),
  };
}

/** As fontes de um turno: dos retornos de `buscar_acervo`, sem repetição, na ordem em que vieram. */
export function extrairFontes(eventos: Iterable<EventoAgente>): Fonte[] {
  const vistas = new Set<string>();
  const fontes: Fonte[] = [];
  for (const e of eventos) {
    for (const r of e.respostasDeFerramenta) {
      if (r.nome !== FERRAMENTA_DO_ACERVO) continue;
      for (const item of itensDoRetorno(r.resposta)) {
        const fonte = fonteDoItem(item);
        if (!fonte) continue;
        const chave = `${fonte.titulo}|${fonte.paginaInicio}|${fonte.paginaFim}`;
        if (vistas.has(chave)) continue;
        vistas.add(chave);
        fontes.push(fonte);
      }
    }
  }
  return fontes;
}

/**
 * Os códigos de habilidade da BNCC citados num texto.
 *
 * Os formatos que existem no currículo (`src/curriculo/dados`):
 * `EF06MA01` (EF, 2 letras, 2 dígitos), `EM13LP01` (EM, 2 letras, 2 dígitos),
 * `EM13MAT101` (EM, 3 letras, 3 dígitos) e os de Computação, que têm os DOIS
 * tamanhos no mesmo ano — `EF05CO01` e `EF05CO011` são habilidades diferentes.
 * Por isso o número final é `\d{2,3}` com fronteira de palavra: o de três
 * dígitos não pode ser lido como o de dois.
 */
const CODIGO_RE = /\b(E[FM]\d{2}[A-Z]{2,3}\d{2,3})\b/g;

export function codigosCitados(texto: string): string[] {
  return [...new Set(Array.from(texto.matchAll(CODIGO_RE), (m) => m[1] as string))];
}

/** Os citados que o currículo não conhece — cada um vira um `aviso`. */
export function codigosInexistentes(texto: string, existe: (codigo: string) => boolean): string[] {
  return codigosCitados(texto).filter((c) => !existe(c));
}

/** O `titulo_conversa` de um estado (ou delta), já saneado para a coluna. */
export function tituloDoEstado(estado: Record<string, unknown> | undefined): string | null {
  const bruto = estado?.[CHAVE_TITULO_DA_CONVERSA];
  if (typeof bruto !== "string") return null;
  const limpo = bruto.replace(/\s+/g, " ").trim();
  if (!limpo) return null;
  return limpo.length > TAMANHO_MAXIMO_DO_TITULO ? `${limpo.slice(0, TAMANHO_MAXIMO_DO_TITULO - 1)}…` : limpo;
}

export interface MensagemDaConversa {
  autor: "professor" | "agente";
  texto: string;
  fontes?: Fonte[];
}

/**
 * O histórico da tela a partir dos eventos da sessão.
 *
 * Só o texto do professor e o texto FINAL do agente: parciais não são
 * persistidos pelo engine (e, se vierem, são descartados — seriam a
 * duplicação), e chamada/retorno de ferramenta não é fala. Os textos do agente
 * entre duas falas do professor viram UMA mensagem (um turno com ferramenta
 * pode ter texto antes e depois da busca), com as fontes do turno.
 */
export function mensagensDaSessao(eventos: readonly EventoAgente[]): MensagemDaConversa[] {
  const mensagens: MensagemDaConversa[] = [];
  let turno: EventoAgente[] = [];

  const fecharTurno = () => {
    const texto = turno
      .filter((e) => !e.parcial)
      .map((e) => e.textos.join(""))
      .join("")
      .trim();
    if (texto) {
      const fontes = extrairFontes(turno);
      mensagens.push({ autor: "agente", texto, ...(fontes.length > 0 ? { fontes } : {}) });
    }
    turno = [];
  };

  for (const e of eventos) {
    if (e.autor === "user") {
      fecharTurno();
      const texto = e.textos.join("").trim();
      if (texto) mensagens.push({ autor: "professor", texto });
    } else {
      turno.push(e);
    }
  }
  fecharTurno();
  return mensagens;
}
