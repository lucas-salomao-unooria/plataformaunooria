import { HeaderPlataforma } from "@/components/header-plataforma";

/**
 * Casca do hub do aluno.
 *
 * É a plataforma, não o aparelho: aqui a marca institucional pode aparecer, no
 * mesmo `HeaderPlataforma` do professor e das demais áreas. A regra de ouro
 * vale um nível abaixo — nada da marca, da aula ou do professor entra DENTRO
 * do iframe da experiência.
 */
export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh unooria-surface">
      <HeaderPlataforma />

      {/* Libera o max-width de 398px dos Cards do DS: aqui há grade de 2 colunas. */}
      <main className="plataforma-largura-cheia mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
