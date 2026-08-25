import { CascaPlataforma } from "@/components/casca-plataforma";

/**
 * Grupo de rotas da PLATAFORMA (login, /aluno/**, /professor/**, /admin/**,
 * /analise/**). A casca visual — CSS do DS, compensações e fontes — vive em
 * `components/casca-plataforma.tsx`, compartilhada com `/exp/**`.
 */
export default function PlataformaLayout({ children }: { children: React.ReactNode }) {
  return <CascaPlataforma style={{ minHeight: "100dvh" }}>{children}</CascaPlataforma>;
}
