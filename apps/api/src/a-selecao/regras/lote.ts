import { z } from "zod";
import {
  BLOCOS,
  ENQUADRAMENTOS,
  IDS_DE_POST,
  ID_DE_POST_RE,
  PERFIS,
  POSTS_POR_PERFIL,
  TOTAL_DE_POSTS,
  blocoDe,
  ehIdDePost,
  type IdDePost,
  type PostDaCobertura,
} from "../catalogo";
import { termosProibidosEm } from "../invariantes";
import { problemasDasFalasDoTema, type FalasDoTema } from "../podcast";

/**
 * As regras do LOTE de uma cobertura — os 12 posts que a turma lê no feed —,
 * valham para o banco curado, para o rascunho da IA ou para o que a professora
 * editou antes de homologar. Sem Prisma, sem Nest: é o que o teste exercita.
 *
 * São os critérios de reprovação do brief de assets (`dev/01b-brief-assets.md`
 * §3) que um programa consegue conferir:
 *   - 4:4:4, com o id amarrado ao veículo e à lente (critério 4);
 *   - legenda entre 20 e 45 palavras (critério 7);
 *   - nenhum termo que antecipe a revelação no que a criança lê antes do Mural
 *     (critério 8, `invariantes.ts#TERMOS_PROIBIDOS_NA_TELA`).
 * Os outros (pessoa real identificável, categoria adivinhável pela forma da
 * imagem) são de olho humano — é para isso que a homologação existe.
 */

/** O teto de leitura da faixa por legenda (critério 7 do brief). */
export const PALAVRAS_DA_LEGENDA = { min: 20, max: 45 } as const;

export function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * TUDO que impede um lote de ir para a turma, em frases para o PROFESSOR.
 * Lista vazia = pode homologar.
 *
 * A lista inteira, e não o primeiro erro, pela lição de `validarMontagem` das
 * equipes: quem editou doze posts precisa ver os três problemas de uma vez. E
 * a frase aponta o POST (`post_b_3`), nunca repete o texto: o 400 vai ao log.
 */
export function problemasDoLote(posts: readonly PostDaCobertura[]): string[] {
  const erros: string[] = [];
  if (posts.length !== TOTAL_DE_POSTS) erros.push(`O lote precisa de exatamente ${TOTAL_DE_POSTS} posts.`);

  const vistos = new Set<string>();
  const porPerfil = new Map<string, number>();
  for (const post of posts) {
    if (!ehIdDePost(post.id)) {
      erros.push(`O post ${post.id} não tem um id conhecido.`);
      continue;
    }
    if (vistos.has(post.id)) erros.push(`O post ${post.id} aparece mais de uma vez.`);
    vistos.add(post.id);

    const bloco = BLOCOS[blocoDe(post.id)];
    if (post.perfil !== bloco.perfil) erros.push(`O post ${post.id} tem de ser do ${bloco.perfil}.`);
    if (post.enquadramento !== bloco.enquadramento) {
      erros.push(`O post ${post.id} tem de ter o enquadramento ${bloco.enquadramento}.`);
    }
    porPerfil.set(post.perfil, (porPerfil.get(post.perfil) ?? 0) + 1);

    const n = palavras(post.legenda);
    if (n < PALAVRAS_DA_LEGENDA.min || n > PALAVRAS_DA_LEGENDA.max) {
      erros.push(
        `A legenda do ${post.id} tem ${n} palavras; o limite é de ${PALAVRAS_DA_LEGENDA.min} a ${PALAVRAS_DA_LEGENDA.max}.`,
      );
    }

    /* Só o que a criança lê ANTES do Mural. As tags são a própria revelação:
       quando elas aparecem, a descoberta já aconteceu. */
    const lidos = [post.legenda, post.descricaoImagem, ...post.comentariosDestaque];
    const proibidos = [...new Set(lidos.flatMap(termosProibidosEm))];
    if (proibidos.length > 0) {
      erros.push(`O post ${post.id} usa termo que antecipa a revelação: ${proibidos.join(", ")}.`);
    }
  }

  /* O 4:4:4 já decorre do id amarrado ao perfil — a conta explícita existe
     para o dia em que alguém mexer nos BLOCOS e esquecer a proporção. */
  for (const perfil of PERFIS) {
    const n = porPerfil.get(perfil) ?? 0;
    if (n !== POSTS_POR_PERFIL) erros.push(`O ${perfil} precisa de ${POSTS_POR_PERFIL} posts, e tem ${n}.`);
  }
  return [...new Set(erros)];
}

/** Os posts na ordem canônica dos ids — é como o lote é gravado. */
export function emOrdemCanonica<T extends { id: string }>(posts: readonly T[]): T[] {
  const posicao = (id: string) => (IDS_DE_POST as readonly string[]).indexOf(id);
  return [...posts].sort((a, b) => posicao(a.id) - posicao(b.id));
}

// ──────────────────────────────────────────────── o lote como a IA o devolve

/**
 * O Zod do lote gerado por IA — VERBATIM do brief de assets (§2.5), em
 * snake_case porque é o formato que o modelo devolve (o `responseSchema` de
 * `prompts.ts` pede estes nomes). A conversão para o post interno é
 * `postsDaIa`, logo abaixo.
 *
 * Os tetos daqui são MAIS apertados que os da homologação
 * (`contrato-de-rotas.ts#PostDaCoberturaSchema`): 240 caracteres de legenda e
 * 35 de tag são o que o brief pede do gerador; o banco curado passa disso em
 * alguns posts, e a professora que edita o rascunho não pode ser reprovada por
 * um teto que a Unooria não cumpriu.
 */
export const PostDaIaSchema = z.object({
  id: z.string().regex(ID_DE_POST_RE),
  perfil: z.enum(PERFIS),
  enquadramento: z.enum(ENQUADRAMENTOS),
  autoridade_citada: z.string().max(60),
  descricao_imagem: z.string().max(120),
  legenda: z.string().min(20).max(240),
  tag_enquadramento: z.string().max(35),
  tag_fonte: z.string().max(35),
  curtidas_simuladas: z.number().int().min(10).max(999),
  comentarios_simulados_count: z.number().int().min(2).max(150),
  comentarios_destaque: z.array(z.string().max(140)).length(2),
});

export const LoteDaIaSchema = z.object({
  tema_resolvido: z.string().min(5).max(100),
  posts: z.array(PostDaIaSchema).length(TOTAL_DE_POSTS),
  /** As três falas do Bloco 2 do podcast, sobre o que cada veículo mostrou (`podcast.ts`). */
  podcast: z.object({
    institucional: z.string().max(600),
    comunitario: z.string().max(600),
    estatistico: z.string().max(600),
  }),
});

export type LoteDaIa = z.infer<typeof LoteDaIaSchema>;

/**
 * Converte o lote da IA no post interno e o CONFERE — lançar aqui faz a
 * tentativa ser regerada (contrato do `generateJson`). As três falas do
 * podcast passam pela mesma régua da homologação (`podcast.ts`): fora dela,
 * a tentativa inteira é regerada, como um post torto.
 *
 * `tag_enquadramento` vira a `tagAngulo`: é o "Ângulo da imagem" da ficha
 * técnica, e o prompt pede ao modelo exatamente isso (o que a foto enquadra),
 * e não o rótulo da lente — "Foco Institucional" na ficha seria dizer a
 * resposta com outras palavras.
 */
export function postsDaIa(bruto: unknown): { tema: string; posts: PostDaCobertura[]; podcast: FalasDoTema } {
  const lote = LoteDaIaSchema.parse(bruto);
  const podcast: FalasDoTema = {
    institucional: lote.podcast.institucional.trim(),
    comunitario: lote.podcast.comunitario.trim(),
    estatistico: lote.podcast.estatistico.trim(),
  };
  const posts: PostDaCobertura[] = lote.posts.map((p) => ({
    id: p.id as IdDePost,
    perfil: p.perfil,
    enquadramento: p.enquadramento,
    autoridadeCitada: p.autoridade_citada.trim() || undefined,
    descricaoImagem: p.descricao_imagem.trim(),
    legenda: p.legenda.trim(),
    tagFonte: p.tag_fonte.trim(),
    tagAngulo: p.tag_enquadramento.trim(),
    curtidas: p.curtidas_simuladas,
    comentarios: p.comentarios_simulados_count,
    comentariosDestaque: [
      (p.comentarios_destaque[0] ?? "").trim(),
      (p.comentarios_destaque[1] ?? "").trim(),
    ] as const,
  }));
  const problemas = problemasDoLote(posts);
  for (const post of posts) {
    if (!post.descricaoImagem || !post.tagFonte || !post.tagAngulo) {
      problemas.push(`O post ${post.id} veio sem descrição de imagem ou sem tag.`);
    }
  }
  problemas.push(...problemasDasFalasDoTema(podcast));
  if (problemas.length > 0) throw new Error(problemas.join(" "));
  return { tema: lote.tema_resolvido.trim(), posts: emOrdemCanonica(posts), podcast };
}
