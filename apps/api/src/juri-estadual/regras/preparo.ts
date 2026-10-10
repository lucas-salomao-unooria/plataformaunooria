import { z } from "zod";
import { ConteudoDoPacoteSchema, ProjetoDoPacoteSchema } from "../contrato-de-rotas";
import { problemasDoPacote, semExclamacao } from "../invariantes";
import { AREAS, IDS_DE_PROJETO, areaDoProjeto, type Area } from "../vocabulario";

/**
 * A conferência do que a IA devolve no preparo — pura. Lançar aqui faz o
 * `generateJson` regerar a tentativa, com a mensagem no prompt seguinte.
 *
 * Duas camadas, nesta ordem:
 *
 * 1. **NORMALIZAR o cosmético**, que a IA erra com frequência e que não muda o
 *    sentido: `semExclamacao` em todo texto (a missão tem UMA exclamação, a do
 *    Léo, na experiência), hashtag e perfil em minúsculas e sem acento, a
 *    primeira hashtag forçada a ser a da área, a área tirada do id.
 * 2. **VALIDAR o resto** pelo MESMO schema da homologação
 *    (`ConteudoDoPacoteSchema`, que roda `problemasDoPacote`), mais o que só o
 *    preparo cobra: títulos e perfis sem repetição.
 */

export type ConteudoDoPacote = z.infer<typeof ConteudoDoPacoteSchema>;
export type ProjetoDoPacote = z.infer<typeof ProjetoDoPacoteSchema>;

/** A forma CRUA da IA: tudo texto, sem régua — a régua é do schema do pacote. */
const ProjetoDaIaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  escola: z.string(),
  perfil: z.string(),
  legenda: z.string(),
  bastidor: z.string(),
  prototipo: z.string().optional(),
  depoimento: z.string().optional(),
  hashtags: z.array(z.string()),
  imagem: z.object({ descricao: z.string(), alt: z.string() }),
});

const SaidaDoPreparoSchema = z.object({
  categorias: z.array(z.object({ area: z.string(), nome: z.string(), hashtag: z.string() })),
  projetos: z.array(ProjetoDaIaSchema),
});

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** `#MeioAmbiente`, `meio ambiente`, `#ciência` → `#meioambiente`, `#ciencia`. */
export function normalizarHashtag(bruta: string): string {
  const corpo = semAcento(bruta.trim().toLowerCase())
    .replace(/^#+/, "")
    .replace(/[^a-z0-9_]/g, "");
  return `#${corpo.slice(0, 24)}`;
}

/** `Equipe Água Viva` → `@equipeaguaviva`; `@lab.da.julia` fica. */
export function normalizarPerfil(bruto: string): string {
  const corpo = semAcento(bruto.trim().toLowerCase())
    .replace(/^@+/, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.]/g, "");
  return `@${corpo.slice(0, 30)}`;
}

function texto(t: string): string {
  return semExclamacao(t).replace(/\s+/g, " ").trim();
}

/** As hashtags do projeto: normalizadas, sem repetir, a da ÁREA primeiro, até quatro. */
function hashtagsDoProjeto(brutas: readonly string[], daArea: string): string[] {
  const outras = brutas.map(normalizarHashtag).filter((h) => h.length > 1 && h !== daArea);
  return [daArea, ...new Set(outras)].slice(0, 4);
}

function projetoNormalizado(bruto: z.infer<typeof ProjetoDaIaSchema>, hashtagDaArea: Map<Area, string>): ProjetoDoPacote {
  const id = bruto.id.trim();
  if (!(IDS_DE_PROJETO as readonly string[]).includes(id)) throw new Error(`id de projeto desconhecido: ${id.slice(0, 20)}`);
  const area = areaDoProjeto(id);
  return {
    id,
    area,
    titulo: texto(bruto.titulo),
    escola: texto(bruto.escola),
    perfil: normalizarPerfil(bruto.perfil),
    legenda: texto(bruto.legenda),
    bastidor: texto(bruto.bastidor),
    ...(bruto.prototipo?.trim() ? { prototipo: texto(bruto.prototipo) } : {}),
    ...(bruto.depoimento?.trim() ? { depoimento: texto(bruto.depoimento) } : {}),
    hashtags: hashtagsDoProjeto(bruto.hashtags, hashtagDaArea.get(area) ?? ""),
    imagem: { descricao: texto(bruto.imagem.descricao), alt: texto(bruto.imagem.alt) },
  };
}

/** A primeira mensagem de um ZodError, curta — é ela que volta ao prompt da próxima tentativa. */
function mensagemDoZod(erro: z.ZodError): string {
  const unicas = [...new Set(erro.issues.map((i) => (i.code === "custom" ? i.message : `${i.path.join(".")}: ${i.message}`)))];
  return unicas.slice(0, 6).join("; ");
}

function repetidos(valores: readonly string[]): string[] {
  const vistos = new Set<string>();
  const dup = new Set<string>();
  for (const v of valores.map((x) => semAcento(x.toLowerCase()).trim())) {
    if (vistos.has(v)) dup.add(v);
    vistos.add(v);
  }
  return [...dup];
}

/**
 * O pacote INTEIRO gerado pela IA, normalizado e conferido. O `tema` é o da
 * professora, não o que a IA escreveria: é o que ela pediu.
 */
export function conteudoDaIa(bruto: unknown, tema: string): ConteudoDoPacote {
  const saida = SaidaDoPreparoSchema.parse(bruto);
  const categorias = AREAS.map((area) => {
    const c = saida.categorias.find((x) => x.area.trim() === area);
    if (!c) throw new Error(`falta a categoria ${area}`);
    return { area, nome: texto(c.nome), hashtag: normalizarHashtag(c.hashtag) };
  });
  const hashtagDaArea = new Map(categorias.map((c) => [c.area, c.hashtag]));
  const desconhecido = saida.projetos.find((p) => !(IDS_DE_PROJETO as readonly string[]).includes(p.id.trim()));
  if (desconhecido) throw new Error(`id de projeto desconhecido: ${desconhecido.id.slice(0, 20)}`);
  const porId = new Map(saida.projetos.map((p) => [p.id.trim(), p]));
  const projetos = IDS_DE_PROJETO.map((id) => {
    const p = porId.get(id);
    if (!p) throw new Error(`falta o projeto ${id}`);
    return projetoNormalizado(p, hashtagDaArea);
  });

  const lido = ConteudoDoPacoteSchema.safeParse({ tema: texto(tema), categorias, projetos });
  if (!lido.success) throw new Error(mensagemDoZod(lido.error));

  const titulos = repetidos(lido.data.projetos.map((p) => p.titulo));
  if (titulos.length > 0) throw new Error("dois projetos com o mesmo título");
  const perfis = repetidos(lido.data.projetos.map((p) => p.perfil));
  if (perfis.length > 0) throw new Error("dois projetos com o mesmo perfil");
  return lido.data;
}

/**
 * UM projeto regerado no lugar de outro do rascunho: o mesmo id e a mesma
 * área, a hashtag da área primeiro, um título que não repete o de outro, e o
 * pacote INTEIRO, com ele no lugar, continuando válido.
 */
export function projetoRegeneradoDaIa(bruto: unknown, conteudo: ConteudoDoPacote, projetoId: string): ProjetoDoPacote {
  const corpo = bruto && typeof bruto === "object" ? (bruto as { projeto?: unknown }).projeto : undefined;
  const cru = ProjetoDaIaSchema.parse({ ...(corpo as object), id: projetoId });
  const hashtagDaArea = new Map(conteudo.categorias.map((c) => [c.area as Area, c.hashtag]));
  const lido = ProjetoDoPacoteSchema.safeParse(projetoNormalizado(cru, hashtagDaArea));
  if (!lido.success) throw new Error(mensagemDoZod(lido.error));
  const novo = lido.data;

  const outros = conteudo.projetos.filter((p) => p.id !== projetoId);
  if (repetidos([...outros.map((p) => p.titulo), novo.titulo]).length > 0) throw new Error("o título repete o de outro projeto");
  const problemas = problemasDoPacote({ ...conteudo, projetos: conteudo.projetos.map((p) => (p.id === projetoId ? novo : p)) });
  if (problemas.length > 0) throw new Error(problemas.slice(0, 4).join("; "));
  return novo;
}
