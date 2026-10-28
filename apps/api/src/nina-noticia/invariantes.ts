/**
 * As INVARIANTES do pacote da exp03ef1b — o que todo pacote homologado tem de
 * cumprir, venha da IA, da edição da professora ou do banco padrão. O preparo,
 * a regeneração e o `homologar` chamam a mesma função: uma regra escrita duas
 * vezes é a que diverge.
 *
 * A ESTRUTURA é do servidor (spec §0.5) e a IA nunca a muda: três suportes
 * fixos, na ordem; as três com Quem = estudantes e Quando = sexta; Onde = pátio
 * no mural e no portal e VAZIO no telão; o lugar da foto é o pátio nas três; e
 * a descrição da cena do telão fala do pátio (é o que o prompt da imagem
 * exige). `aplicarEstrutura` a escreve; aqui ela é CONFERIDA.
 *
 * Puro e sem dependência de Nest ou Prisma.
 */
import { FICHA_DO_SUPORTE, type ConteudoDoPacote } from "./conteudo";
import { CAMPOS, LUGAR_DO_EVENTO, SUPORTES, SUPORTE_OMITIDO } from "./vocabulario";

/** A manchete tem no máximo QUATRO palavras (regra 1 do prompt de sistema do sheet). */
export const MAX_PALAVRAS_DA_MANCHETE = 4;
/** Legenda curta, para leitura em voz alta no 3º ano (as do 01e têm 7–8 palavras). */
export const MAX_PALAVRAS_DA_LEGENDA = 15;
/** O texto do cartaz (o nome do evento). */
export const MAX_PALAVRAS_DO_CARTAZ = 8;

/**
 * Marcas e nomes de terceiros que não entram no jornal (a feira é fictícia, e a
 * missão não faz propaganda). Comparação por palavra inteira, sem acento e sem
 * caixa.
 */
export const TERMOS_PROIBIDOS = [
  "instagram",
  "facebook",
  "tiktok",
  "whatsapp",
  "youtube",
  "google",
  "lego",
  "apple",
  "samsung",
  "microsoft",
  "chatgpt",
  "openai",
  "disney",
  "marvel",
] as const;

export function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function termosProibidosEm(texto: string): string[] {
  const palavras = new Set(semAcento(texto).split(/[^a-z0-9]+/));
  return TERMOS_PROIBIDOS.filter((termo) => palavras.has(termo));
}

/**
 * Os problemas do pacote, em frases para o log e para a tela da professora.
 * Lista vazia = pacote válido.
 */
export function problemasDoPacote(conteudo: ConteudoDoPacote): string[] {
  const problemas: string[] = [];
  const suportes = conteudo.reportagens.map((r) => r.suporte);
  if (suportes.length !== SUPORTES.length || SUPORTES.some((s, i) => suportes[i] !== s)) {
    problemas.push("o pacote precisa de três reportagens: mural, portal e telão, nesta ordem");
  }

  for (const r of conteudo.reportagens) {
    const esperada = FICHA_DO_SUPORTE[r.suporte];
    for (const campo of CAMPOS) {
      if (r.ficha[campo] !== esperada[campo]) {
        problemas.push(
          esperada[campo] === null
            ? `a ficha do ${r.suporte} precisa do campo ${campo} vazio`
            : `a ficha do ${r.suporte} precisa de ${campo} = ${esperada[campo]}`,
        );
      }
    }
    if (r.lugar !== LUGAR_DO_EVENTO) problemas.push(`a foto do ${r.suporte} precisa mostrar o pátio`);
    if (contarPalavras(r.manchete) === 0) problemas.push(`manchete vazia no ${r.suporte}`);
    if (contarPalavras(r.manchete) > MAX_PALAVRAS_DA_MANCHETE) {
      problemas.push(`a manchete do ${r.suporte} passa de ${MAX_PALAVRAS_DA_MANCHETE} palavras`);
    }
    if (contarPalavras(r.legenda) > MAX_PALAVRAS_DA_LEGENDA) {
      problemas.push(`a legenda do ${r.suporte} passa de ${MAX_PALAVRAS_DA_LEGENDA} palavras`);
    }
    const proibidos = termosProibidosEm([r.manchete, r.legenda, r.imagem.descricao, r.imagem.alt].join(" "));
    if (proibidos.length > 0) problemas.push(`o ${r.suporte} cita ${proibidos.join(", ")}`);
  }

  const telao = conteudo.reportagens.find((r) => r.suporte === SUPORTE_OMITIDO);
  if (telao && !semAcento(telao.imagem.descricao).includes("patio")) {
    problemas.push("a cena do telão precisa mostrar o pátio com clareza");
  }

  const manchetes = conteudo.reportagens.map((r) => semAcento(r.manchete.trim()));
  if (new Set(manchetes).size !== manchetes.length) problemas.push("as manchetes se repetem");

  if (contarPalavras(conteudo.cartaz.texto) === 0) problemas.push("o cartaz precisa de texto");
  if (contarPalavras(conteudo.cartaz.texto) > MAX_PALAVRAS_DO_CARTAZ) {
    problemas.push(`o texto do cartaz passa de ${MAX_PALAVRAS_DO_CARTAZ} palavras`);
  }
  const proibidosNoTema = termosProibidosEm([conteudo.tema, conteudo.cartaz.texto].join(" "));
  if (proibidosNoTema.length > 0) problemas.push(`o tema cita ${proibidosNoTema.join(", ")}`);

  return problemas;
}
