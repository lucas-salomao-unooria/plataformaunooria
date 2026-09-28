/**
 * Catálogo canônico de disciplinas da Educação Básica (porte do `lib/curriculo.ts`
 * do app original e `catalogo.ts` da api).
 */
export interface DisciplinaCatalogo {
  slug: string;
  label: string;
}

export const DISCIPLINAS_CATALOGO: ReadonlyArray<DisciplinaCatalogo> = [
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
