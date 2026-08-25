import { z } from "zod";
import { SerieSchema, rotuloDaSerie, type Serie } from "../comum/series";

/**
 * Disciplinas conhecidas (slug → rótulo), herdadas de `lib/curriculo.ts` do
 * app origem. O slug é a chave de `planos_referencias.disciplina`; quais estão
 * DISPONÍVEIS não é decidido aqui — é o que tem referência importada
 * (`PlanosService.disponiveis`). Slug fora da lista é aceito com rótulo
 * derivado, para uma rede nova não exigir deploy.
 */
export const DISCIPLINAS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "letramento-digital", label: "Letramento Digital" },
  { slug: "lingua-portuguesa", label: "Língua Portuguesa" },
  { slug: "matematica", label: "Matemática" },
  { slug: "ciencias", label: "Ciências" },
  { slug: "biologia", label: "Biologia" },
  { slug: "fisica", label: "Física" },
  { slug: "quimica", label: "Química" },
  { slug: "historia", label: "História" },
  { slug: "geografia", label: "Geografia" },
  { slug: "arte", label: "Arte" },
  { slug: "educacao-fisica", label: "Educação Física" },
  { slug: "lingua-inglesa", label: "Língua Inglesa" },
  { slug: "ensino-religioso", label: "Ensino Religioso" },
  { slug: "filosofia", label: "Filosofia" },
  { slug: "sociologia", label: "Sociologia" },
];

export const DisciplinaSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug de disciplina (ex.: letramento-digital)")
  .max(60);

export function rotuloDaDisciplina(slug: string): string {
  const conhecida = DISCIPLINAS.find((d) => d.slug === slug);
  if (conhecida) return conhecida.label;
  return slug
    .split("-")
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

export function tituloDoPlano(disciplina: string, serie: Serie): string {
  return `Plano Anual — ${rotuloDaDisciplina(disciplina)} — ${rotuloDaSerie(serie)}`;
}

export const CriarPlanoSchema = z.object({
  disciplina: DisciplinaSchema,
  serie: SerieSchema,
});
export type CriarPlano = z.infer<typeof CriarPlanoSchema>;

/** Teto do HTML salvo: um plano anual tem 30–150 KB; 1 MB já é abuso. */
export const MAX_HTML_BYTES = 1_000_000;
export const SalvarConteudoSchema = z.object({
  html: z.string().min(1).max(MAX_HTML_BYTES),
});

export const RenomearSchema = z.object({
  titulo: z.string().trim().min(3).max(160),
});

export const ImportarReferenciaSchema = z.object({
  disciplina: DisciplinaSchema,
  serie: SerieSchema.nullable().optional(),
  nome: z.string().trim().min(1).max(200),
  /** Texto já extraído (o script local faz pdf-parse/mammoth); cabe no body de 2 MB. */
  texto: z.string().min(1).max(1_500_000),
  ordem: z.number().int().min(0).max(999).default(0),
});
