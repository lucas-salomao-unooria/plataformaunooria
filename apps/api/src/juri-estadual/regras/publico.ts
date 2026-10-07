import type { z } from "zod";
import type { PostPublicoSchema, ProjetoDaGaleriaSchema, ProjetoDoPacoteSchema } from "../contrato-de-rotas";
import { projetoDoPost, type Area, type TipoDePost } from "../vocabulario";

/**
 * O que o ESTUDANTE recebe de um projeto — ALLOWLIST explícita, nunca o
 * objeto do pacote com campos apagados. Campo novo no pacote nasce FORA daqui
 * até alguém decidir o contrário: é o que faz a `descricao` da imagem (o
 * pedido ao gerador, escrito para o professor) não chegar ao bundle.
 *
 * Antes da galeria, só os posts que o feed SERVIU descem (`postPublico`); os
 * outros projetos existem só no servidor. Na galeria, os dezesseis
 * (`projetoDaGaleria`).
 */

export type ProjetoDoPacote = z.infer<typeof ProjetoDoPacoteSchema>;
export type PostPublico = z.infer<typeof PostPublicoSchema>;
export type ProjetoDaGaleria = z.infer<typeof ProjetoDaGaleriaSchema>;

/** As URLs das imagens geradas, por id de projeto. */
export type Midia = Partial<Record<string, string>>;

/** Um post do feed: a apresentação (a legenda) ou o bastidor (o protótipo em teste). */
export function postPublico(postId: string, projetos: readonly ProjetoDoPacote[], midia: Midia): PostPublico | null {
  const projeto = projetos.find((p) => p.id === projetoDoPost(postId));
  if (!projeto) return null;
  const tipo = postId.endsWith(":bastidor") ? "bastidor" : "apresentacao";
  return {
    id: postId,
    projetoId: projeto.id,
    tipo: tipo as TipoDePost,
    area: projeto.area as Area,
    titulo: projeto.titulo,
    escola: projeto.escola,
    perfil: projeto.perfil,
    texto: tipo === "bastidor" ? projeto.bastidor : projeto.legenda,
    legenda: projeto.legenda,
    hashtags: [...projeto.hashtags],
    imagem: { url: midia[projeto.id] ?? null, alt: projeto.imagem.alt },
  };
}

/** Um estande na Galeria Oculta — e se ele chegou ao feed DESTE estudante. */
export function projetoDaGaleria(projeto: ProjetoDoPacote, midia: Midia, exibidoNoSeuFeed: boolean): ProjetoDaGaleria {
  return {
    id: projeto.id,
    area: projeto.area as Area,
    titulo: projeto.titulo,
    escola: projeto.escola,
    perfil: projeto.perfil,
    legenda: projeto.legenda,
    hashtags: [...projeto.hashtags],
    imagem: { url: midia[projeto.id] ?? null, alt: projeto.imagem.alt },
    exibidoNoSeuFeed,
  };
}
