/**
 * O texto alternativo da imagem de um post (WCAG 1.1.1, ADR-163): o que o
 * servidor manda (a descrição da imagem gerada) e, sem ele, ao menos de quem é
 * a foto — nunca `alt=""`, que faz o leitor de tela pular um conteúdo que o
 * colega está vendo.
 */
export function altDaImagem(imageAlt: string | null | undefined, handle: string): string {
  return imageAlt?.trim() || `Foto do post de ${handle}`;
}
