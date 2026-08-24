import type { Config } from "tailwindcss";

/**
 * Tailwind SÓ para utilitárias de layout (flex/grid/gap/padding) — padrão
 * validado no projeto origem. NENHUMA cor/fonte institucional entra aqui:
 * cor e tipografia da plataforma vêm dos tokens do DS via
 * `@edu/ui/styles/plataforma.css` (classes `.text-unooria-*` etc.), para a
 * marca nunca vazar por nome de classe para superfícies do aluno.
 */
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  /**
   * Preflight LIGADO, como no projeto origem. Desligá-lo parecia inofensivo
   * (o DS traz o próprio CSS), mas o DS estiliza COMPONENTES, não elementos:
   * sem o reset, todo `<a>` volta a ser sublinhado e todo `<ul>` volta a ter
   * bullet — foi o que o smoke visual pegou nos cards de produto.
   */
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
