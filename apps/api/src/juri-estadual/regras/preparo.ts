import { z } from "zod";
import { ConteudoDoPacoteSchema, ProjetoDoPacoteEscritaSchema } from "../contrato-de-rotas";
import { HASHTAG_RE, problemasDoPacote, problemasDoProjeto, semExclamacao } from "../invariantes";
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

/** O pacote como ele é ESCRITO (os quarenta, sem os formatos da 0.4.x). */
export type ConteudoDoPacote = z.infer<typeof ConteudoDoPacoteSchema>;
export type ProjetoDoPacote = z.infer<typeof ProjetoDoPacoteEscritaSchema>;

/** A forma CRUA da IA: tudo texto, sem régua — a régua é do schema do pacote. */
const ProjetoDaIaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  escola: z.string(),
  perfil: z.string(),
  legenda: z.string(),
  bastidor: z.string(),
  hashtags: z.array(z.string()),
  imagem: z.object({ descricao: z.string(), alt: z.string() }),
});

const CategoriaDaIaSchema = z.object({ area: z.string(), nome: z.string(), hashtag: z.string() });

const SaidaDoPreparoSchema = z.object({
  categorias: z.array(CategoriaDaIaSchema),
  projetos: z.array(ProjetoDaIaSchema),
});

export type Categoria = { area: Area; nome: string; hashtag: string };

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
  const categorias = categoriasNormalizadas(saida.categorias);
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
  const lido = ProjetoDoPacoteEscritaSchema.safeParse(projetoNormalizado(cru, hashtagDaArea));
  if (!lido.success) throw new Error(mensagemDoZod(lido.error));
  const novo = lido.data;

  const outros = conteudo.projetos.filter((p) => p.id !== projetoId);
  if (repetidos([...outros.map((p) => p.titulo), novo.titulo]).length > 0) throw new Error("o título repete o de outro projeto");
  if (repetidos([...outros.map((p) => p.perfil), novo.perfil]).length > 0) throw new Error("o perfil repete o de outro projeto");
  const problemas = problemasDoPacote({ ...conteudo, projetos: conteudo.projetos.map((p) => (p.id === projetoId ? novo : p)) });
  if (problemas.length > 0) throw new Error(problemas.slice(0, 4).join("; "));
  return novo;
}

function categoriasNormalizadas(brutas: readonly z.infer<typeof CategoriaDaIaSchema>[]): Categoria[] {
  return AREAS.map((area) => {
    const c = brutas.find((x) => x.area.trim() === area);
    if (!c) throw new Error(`falta a categoria ${area}`);
    return { area, nome: texto(c.nome), hashtag: normalizarHashtag(c.hashtag) };
  });
}

// ───────────────────────────────────────── o preparo em quatro chamadas

/**
 * As QUATRO CATEGORIAS da mostra (a primeira chamada do preparo): uma por
 * área, nome de 2 a 30 caracteres, hashtags válidas e diferentes.
 */
export function categoriasDaIa(bruto: unknown): Categoria[] {
  const saida = z.object({ categorias: z.array(CategoriaDaIaSchema) }).parse(bruto);
  const categorias = categoriasNormalizadas(saida.categorias);
  for (const c of categorias) {
    if (c.nome.length < 2 || c.nome.length > 30) throw new Error(`nome da categoria ${c.area} fora de 2 a 30 caracteres`);
    if (!HASHTAG_RE.test(c.hashtag)) throw new Error(`hashtag inválida na categoria ${c.area}`);
  }
  if (new Set(categorias.map((c) => c.hashtag)).size !== categorias.length) {
    throw new Error("as hashtags das categorias se repetem");
  }
  return categorias;
}

/**
 * Os DEZ projetos de uma área (uma das quatro chamadas paralelas): exatamente
 * os ids da área, cada um normalizado e passando na régua de um projeto
 * (`problemasDoProjeto`), sem título nem perfil repetido DENTRO da área. A
 * repetição ENTRE áreas só se vê no fim (`montarConteudo`).
 */
export function projetosDaAreaDaIa(bruto: unknown, area: Area, categorias: readonly Categoria[]): ProjetoDoPacote[] {
  const saida = z.object({ projetos: z.array(ProjetoDaIaSchema) }).parse(bruto);
  const ids = IDS_DE_PROJETO.filter((id) => areaDoProjeto(id) === area);
  const fora = saida.projetos.find((p) => !ids.includes(p.id.trim()));
  if (fora) throw new Error(`id fora da área ${area}: ${fora.id.slice(0, 20)}`);
  const hashtagDaArea = new Map(categorias.map((c) => [c.area, c.hashtag]));
  const porId = new Map(saida.projetos.map((p) => [p.id.trim(), p]));
  const projetos = ids.map((id) => {
    const p = porId.get(id);
    if (!p) throw new Error(`falta o projeto ${id}`);
    const lido = ProjetoDoPacoteEscritaSchema.safeParse(projetoNormalizado(p, hashtagDaArea));
    if (!lido.success) throw new Error(`${id}: ${mensagemDoZod(lido.error)}`);
    const problemas = problemasDoProjeto(lido.data, hashtagDaArea.get(area));
    if (problemas.length > 0) throw new Error(problemas.slice(0, 4).join("; "));
    return lido.data;
  });
  if (repetidos(projetos.map((p) => p.titulo)).length > 0) throw new Error("dois projetos da área com o mesmo título");
  if (repetidos(projetos.map((p) => p.perfil)).length > 0) throw new Error("dois projetos da área com o mesmo perfil");
  return projetos;
}

/**
 * O pacote montado com as quatro áreas, e os ids dos projetos que REPETEM o
 * título ou o perfil de um projeto anterior (de outra área): esses o preparo
 * regera sozinhos, com a lista dos outros títulos. `conteudo` já passou no
 * schema da homologação — a não ser pela unicidade, que é do preparo.
 */
export function montarConteudo(
  tema: string,
  categorias: readonly Categoria[],
  projetos: readonly ProjetoDoPacote[],
): { conteudo: ConteudoDoPacote; colidem: string[] } {
  const lido = ConteudoDoPacoteSchema.safeParse({ tema: texto(tema), categorias, projetos });
  if (!lido.success) throw new Error(mensagemDoZod(lido.error));
  const colidem: string[] = [];
  const titulos = new Set<string>();
  const perfis = new Set<string>();
  for (const p of lido.data.projetos) {
    const titulo = semAcento(p.titulo.toLowerCase()).trim();
    const perfil = semAcento(p.perfil.toLowerCase()).trim();
    if (titulos.has(titulo) || perfis.has(perfil)) colidem.push(p.id);
    titulos.add(titulo);
    perfis.add(perfil);
  }
  return { conteudo: lido.data, colidem };
}
