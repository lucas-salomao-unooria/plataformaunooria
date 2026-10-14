import type { z } from "zod";
import type { PostPublicoSchema, ProjetoDaGaleriaSchema, ProjetoDoPacoteSchema } from "../contrato-de-rotas";
import { projetoDoPost, tipoDoPost, type Area, type TipoDePost } from "../vocabulario";

/**
 * O que o ESTUDANTE recebe de um projeto — ALLOWLIST explícita, nunca o
 * objeto do pacote com campos apagados. Campo novo no pacote nasce FORA daqui
 * até alguém decidir o contrário: é o que faz a `descricao` da imagem (o
 * pedido ao gerador, escrito para o professor) não chegar ao bundle.
 *
 * Antes da galeria, só os posts que o feed SERVIU descem (`postPublico`); os
 * outros projetos existem só no servidor. Na galeria, os quarenta (ou os
 * dezesseis do pacote legado) — `projetoDaGaleria`.
 */

export type ProjetoDoPacote = z.infer<typeof ProjetoDoPacoteSchema>;
export type PostPublico = z.infer<typeof PostPublicoSchema>;
export type ProjetoDaGaleria = z.infer<typeof ProjetoDaGaleriaSchema>;

/** As URLs das imagens geradas, por id de projeto. */
export type Midia = Partial<Record<string, string>>;

/**
 * O texto de cada FORMATO do post. O motor serve só a `apresentacao` (a
 * legenda); os outros três são das sessões 2.0.0, cujo feed gravado repetia o
 * projeto em formatos diferentes. O protótipo e o depoimento só existem nos
 * pacotes da 0.4.x que os tinham: sem eles, o protótipo mostra o bastidor e o
 * depoimento, a legenda — a tela distingue o formato pelo `tipo`.
 */
function textoDoFormato(projeto: ProjetoDoPacote, tipo: TipoDePost): string {
  if (tipo === "bastidor") return projeto.bastidor;
  if (tipo === "prototipo") return projeto.prototipo ?? projeto.bastidor;
  if (tipo === "depoimento") return projeto.depoimento ?? projeto.legenda;
  return projeto.legenda;
}

/** Um post do feed: a apresentação (ou, numa sessão 2.0.0, um formato legado). */
export function postPublico(postId: string, projetos: readonly ProjetoDoPacote[], midia: Midia): PostPublico | null {
  const projeto = projetos.find((p) => p.id === projetoDoPost(postId));
  if (!projeto) return null;
  const tipo = tipoDoPost(postId);
  return {
    id: postId,
    projetoId: projeto.id,
    tipo,
    area: projeto.area as Area,
    titulo: projeto.titulo,
    escola: projeto.escola,
    perfil: projeto.perfil,
    texto: textoDoFormato(projeto, tipo),
    legenda: projeto.legenda,
    bastidor: projeto.bastidor,
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
    /** O resumo técnico da ficha de inspeção (E4-ALU-02): o texto do bastidor. */
    resumo: projeto.bastidor,
    hashtags: [...projeto.hashtags],
    imagem: { url: midia[projeto.id] ?? null, alt: projeto.imagem.alt },
    exibidoNoSeuFeed,
  };
}
