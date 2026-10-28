import {
  CHAVES_DAS_REACOES,
  COMENTARIO_PALAVRAS,
  TIPOS_QUE_REAGEM,
  type ChaveDaReacao,
  type ComentarioDoFeed,
  type ConteudoDoPacote,
  type Manchete,
  type TrechoViral,
} from "../conteudo";

/**
 * O FEED QUE REAGE AO POST DO ESTUDANTE (ADR-192) — puro.
 *
 * O preparo escreve, por variante (manchete × trecho que viralizou), o texto
 * dos comentários que AMPLIFICAM (a conta anônima e o engajamento). O servidor
 * escolhe a variante pelos fatos do post publicado, e troca SÓ o texto: o id,
 * o autor, o horário e o tipo de cada comentário são os do pacote, e os
 * relatos de saúde não variam. É isso que deixa a régua intacta — a EM13CO24
 * mede o motivo do aviso diante dos MESMOS relatos de saúde, e a EM13CO08
 * denuncia o MESMO perfil suspeito, em toda variante.
 */

const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const contem = (t: string, trecho: string) => trecho.trim().length > 0 && t.toLowerCase().includes(trecho.toLowerCase());

/** O mesmo teto da régua do pacote (PRD §12, `comentariosMadrugada.texto`). */
const MAX_CARACTERES = 280;

const reage = (c: ComentarioDoFeed) => TIPOS_QUE_REAGEM.includes(c.tipo);

/**
 * Qual trecho viralizou: a estatística inventada (o parágrafo da alucinação
 * ficou no post) ou o recorte. O `trechoPincado` gravado no Publicar é o que
 * decide — ele já é a regra (`previa.ts#trechoPincado`), e o fallback raro da
 * manchete conta como recorte.
 */
export function trechoViral(conteudo: Pick<ConteudoDoPacote, "rascunho">, trechoPincado: string | null): TrechoViral {
  const alucinacao = conteudo.rascunho.find((p) => p.no === "alucinacao");
  return alucinacao && trechoPincado !== null && trechoPincado.trim() === alucinacao.texto.trim() ? "dado" : "recorte";
}

export function chaveDaReacao(manchete: Manchete, trecho: TrechoViral): ChaveDaReacao {
  return `${manchete}.${trecho}`;
}

/** O texto que o algoritmo amplificou em cada trecho — o que a reação cita (o prompt e a curadoria mostram). */
export function textoDoTrecho(conteudo: Pick<ConteudoDoPacote, "rascunho" | "recorte">, trecho: TrechoViral): string {
  if (trecho === "dado") return conteudo.rascunho.find((p) => p.no === "alucinacao")?.texto ?? conteudo.recorte;
  return conteudo.recorte;
}

/**
 * Os comentários que o estudante vê: os do pacote, com o texto da variante nos
 * que reagem. Sem variante (`null`), sem reações no pacote, ou com o texto
 * ausente, vale o do pacote — o feed de antes da 2.2.0.
 */
export function comentariosDaVariante(
  conteudo: Pick<ConteudoDoPacote, "comentarios" | "reacoes">,
  chave: ChaveDaReacao | null,
): ComentarioDoFeed[] {
  const variante = chave ? conteudo.reacoes?.[chave] : undefined;
  return conteudo.comentarios.map((c) => {
    const texto = variante && reage(c) ? variante[c.id]?.trim() : undefined;
    return texto ? { ...c, texto } : { ...c };
  });
}

/**
 * A régua das reações, para a HOMOLOGAÇÃO (entra em `problemasDoConteudo`).
 * Tolerante à curadoria: o professor pode mudar o tipo de um comentário, e a
 * reação a um comentário que deixou de reagir é só ignorada no feed — o que
 * ela cobra é o que poria texto ruim na tela: chave ou comentário desconhecido,
 * tamanho fora da régua e o colega exposto pelo nome.
 */
export function problemasDasReacoes(c: Pick<ConteudoDoPacote, "comentarios" | "reacoes" | "colega">): string[] {
  if (!c.reacoes) return [];
  const p: string[] = [];
  const porId = new Map(c.comentarios.map((x) => [x.id, x]));
  for (const [chave, textos] of Object.entries(c.reacoes)) {
    if (!(CHAVES_DAS_REACOES as readonly string[]).includes(chave)) {
      p.push(`A variante de reação "${chave}" não existe.`);
      continue;
    }
    for (const [id, texto] of Object.entries(textos ?? {})) {
      const com = porId.get(id);
      if (!com) {
        p.push(`A reação da variante ${chave} aponta para um comentário que não existe (${id}).`);
        continue;
      }
      const w = palavras(texto);
      if (w < COMENTARIO_PALAVRAS.min || w > COMENTARIO_PALAVRAS.max) {
        p.push(`A reação de ${com.autor} na variante ${chave} precisa ter de ${COMENTARIO_PALAVRAS.min} a ${COMENTARIO_PALAVRAS.max} palavras.`);
      }
      if (texto.length > MAX_CARACTERES) p.push(`A reação de ${com.autor} na variante ${chave} passa de ${MAX_CARACTERES} caracteres.`);
      if (contem(texto, c.colega)) p.push(`A reação de ${com.autor} na variante ${chave} não pode expor o colega pelo nome.`);
    }
  }
  return [...new Set(p)];
}

/**
 * A régua da SAÍDA DA IA, mais estrita que a da homologação: toda variante,
 * todo comentário que reage, e o texto diferente entre as variantes de um
 * mesmo comentário — reação que não muda com o post não é reação.
 */
export function problemasDaGeracaoDeReacoes(c: Pick<ConteudoDoPacote, "comentarios" | "reacoes" | "colega">): string[] {
  const p = problemasDasReacoes(c);
  const quemReage = c.comentarios.filter(reage);
  for (const chave of CHAVES_DAS_REACOES) {
    const textos = c.reacoes?.[chave];
    if (!textos) {
      p.push(`Falta a variante ${chave}.`);
      continue;
    }
    for (const com of quemReage) if (!textos[com.id]?.trim()) p.push(`Falta a reação de ${com.autor} (${com.id}) na variante ${chave}.`);
  }
  for (const com of quemReage) {
    const distintos = new Set(CHAVES_DAS_REACOES.map((k) => c.reacoes?.[k]?.[com.id]?.trim().toLowerCase()).filter(Boolean));
    if (distintos.size < 2) p.push(`As reações de ${com.autor} (${com.id}) não mudam com o post.`);
  }
  return [...new Set(p)];
}
