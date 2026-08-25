import { HeaderPlataforma } from "@/components/header-plataforma";

/**
 * Casca das superfícies do professor.
 *
 * O header é o `HeaderPlataforma`, o MESMO de todas as áreas e da experiência
 * — marca, identidade e "Sair". Não tem atalhos ("Guia da aula", "Plano de
 * aula"): eram links de quando a plataforma era uma atividade só. Agora ela é
 * um **hub de produtos** (`lib/produtos.ts`) e a navegação é hierárquica — a
 * marca leva ao hub e cada página desenha a própria trilha com o `Trilha`
 * (`components/trilha.tsx`).
 */
export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh unooria-surface">
      <HeaderPlataforma />

      {/* `plataforma-largura-cheia` libera o max-width de 398px dos Cards do DS:
          aqui há grades de 2–3 colunas e tabelas largas. */}
      <main className="plataforma-largura-cheia mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
