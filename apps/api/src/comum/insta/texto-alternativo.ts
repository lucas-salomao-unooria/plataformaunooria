/**
 * O texto alternativo da imagem de um post (WCAG 1.1.1, ADR-163).
 *
 * É o `imageBrief`: a geração já o pede como "descrição visual objetiva da
 * foto, em uma frase, sem texto", em português, e ele passa pelos mesmos
 * filtros de palavra bloqueada da legenda. Diz só o que a imagem MOSTRA — o
 * que o colega que enxerga já vê —, nunca o lado, o perfil ou a intensidade,
 * que continuam no servidor.
 *
 * Só vale para imagem GERADA (`imageStatus === "ok"`): na arte procedural o
 * brief não descreve mais o que aparece, e ali não há `<img>` — os emojis já
 * são texto na tela. Brief ausente ou curto demais para descrever alguma coisa
 * volta `null`, e o cliente cai num nome genérico em vez de ler lixo.
 */
export function textoAlternativoDaImagem(post: {
  imageStatus: string;
  imageUrl: string | null;
  imageBrief?: string | null;
}): string | null {
  if (post.imageStatus !== "ok" || !post.imageUrl) return null;
  const brief = post.imageBrief?.trim().replace(/\s+/g, " ");
  if (!brief || brief.length < 10) return null;
  return /[.!?…]$/.test(brief) ? brief : `${brief}.`;
}
