import { createHash } from "node:crypto";
import { VERSAO_DO_PEDIDO_DE_IMAGEM, promptDaImagem, promptDaLamina, type ProjetoDaLamina } from "../prompts";
import { ID_DE_PROJETO_RE } from "../vocabulario";

/**
 * As LÂMINAS do carrossel de um estande (0.8.0, ADR-178): quatro imagens por
 * projeto, na ordem do post.
 *
 * - `capa` — a foto do estande, a que a missão sempre gerou. A chave na
 *   `midia` do pacote continua sendo o id do projeto (`proj-a1`), e o nome do
 *   arquivo continua o de antes: as imagens já geradas e aprovadas seguem
 *   valendo, sem gerar de novo.
 * - `detalhe` — o protótipo de perto: as peças, os materiais, o funcionamento.
 * - `equipe` — a equipe demonstrando o projeto no estande, sem rosto
 *   identificável.
 * - `bastidor` — a bancada de testes, a partir do texto dos "Bastidores do
 *   estande" (o texto continua na lâmina, embaixo da imagem).
 *
 * Até a 0.7.0 as lâminas 2 e 3 eram a arte procedural e a 4ª só texto: o pacote
 * tinha uma foto por projeto. Sem imagem, a experiência continua desenhando a
 * arte procedural da lâmina — a missão roda igual.
 */
export const LAMINAS = ["capa", "detalhe", "equipe", "bastidor"] as const;
export type Lamina = (typeof LAMINAS)[number];

/** As lâminas que nasceram na 0.8.0 (as que têm sufixo na chave). */
export const LAMINAS_EXTRAS = ["detalhe", "equipe", "bastidor"] as const satisfies readonly Lamina[];
export type LaminaExtra = (typeof LAMINAS_EXTRAS)[number];

/** A chave na `midia` do pacote: o id do projeto (a capa) ou `proj-a1:detalhe`. */
export function chaveDaMidia(projetoId: string, lamina: Lamina): string {
  return lamina === "capa" ? projetoId : `${projetoId}:${lamina}`;
}

/** O que uma chave da `midia` diz — `null` se ela não é de lâmina conhecida. */
export function lerChaveDaMidia(chave: string): { projetoId: string; lamina: Lamina } | null {
  const [projetoId, sufixo, ...resto] = chave.split(":");
  if (!projetoId || resto.length > 0 || !ID_DE_PROJETO_RE.test(projetoId)) return null;
  if (sufixo === undefined) return { projetoId, lamina: "capa" };
  return (LAMINAS_EXTRAS as readonly string[]).includes(sufixo) ? { projetoId, lamina: sufixo as Lamina } : null;
}

export function ehChaveDaMidia(chave: string): boolean {
  return lerChaveDaMidia(chave) !== null;
}

/** As chaves de todas as lâminas de uma lista de projetos, projeto a projeto, na ordem do carrossel. */
export function chavesDosProjetos(projetoIds: readonly string[]): string[] {
  return projetoIds.flatMap((id) => LAMINAS.map((l) => chaveDaMidia(id, l)));
}

/**
 * O nome do arquivo no bucket, abaixo de `experiencias/exp06ef1b/`.
 *
 * `variacao` é a imagem REFEITA: o professor recusou a da descrição, e a nova
 * não pode cair no mesmo arquivo — sobrescrevê-lo trocaria a imagem de todo
 * pacote que herdou aquela descrição, inclusive o de uma turma em aula. Sem
 * variação, o nome continua sendo só o da descrição.
 */
export function nomeDaImagem(descricao: string, variacao?: string): string {
  const chave = [VERSAO_DO_PEDIDO_DE_IMAGEM, descricao.trim(), ...(variacao ? [variacao] : [])].join("|");
  const hash = createHash("sha256").update(chave).digest("hex");
  return `mostra/${hash.slice(0, 32)}.webp`;
}

/**
 * O nome do arquivo de UMA lâmina (0.8.0, ADR-178). A capa é `nomeDaImagem` —
 * o mesmo arquivo de sempre, para as imagens já geradas seguirem valendo. As
 * lâminas extras levam a lâmina, o título e a cena no hash (e o texto dos
 * bastidores, na dela): mudar o que o pedido diz é outro arquivo, e a mesma
 * cena noutra turma reaproveita o que já está no bucket.
 */
export function nomeDaLamina(lamina: Lamina, projeto: ProjetoDaLamina, variacao?: string): string {
  if (lamina === "capa") return nomeDaImagem(projeto.imagem.descricao, variacao);
  const partes = [
    VERSAO_DO_PEDIDO_DE_IMAGEM,
    lamina,
    projeto.titulo.trim(),
    projeto.imagem.descricao.trim(),
    ...(lamina === "bastidor" ? [projeto.bastidor.trim()] : []),
    ...(variacao ? [variacao] : []),
  ];
  const hash = createHash("sha256").update(partes.join("|")).digest("hex");
  return `mostra/${lamina}-${hash.slice(0, 32)}.webp`;
}

/** O pedido ao modelo de UMA lâmina. */
export function promptDeLamina(lamina: Lamina, projeto: ProjetoDaLamina): string {
  return lamina === "capa" ? promptDaImagem(projeto.imagem.descricao) : promptDaLamina(lamina, projeto);
}

/** Cada lâmina de cada projeto, na ordem do carrossel: o que a geração percorre. */
export function laminasDosProjetos<P extends ProjetoDaLamina & { id: string }>(projetos: readonly P[]) {
  return projetos.flatMap((projeto) => LAMINAS.map((lamina) => ({ projeto, lamina, chave: chaveDaMidia(projeto.id, lamina) })));
}
