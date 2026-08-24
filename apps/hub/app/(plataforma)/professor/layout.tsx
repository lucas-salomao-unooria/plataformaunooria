import Link from "next/link";

import { Avatar, Logo } from "@edu/ui/ds";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/lib/auth";

/**
 * Casca das superfícies do professor.
 *
 * O header não tem mais atalhos ("Guia da aula", "Plano de aula"): eram links de
 * quando a plataforma era uma atividade só. Agora ela é um **hub de produtos**
 * (`lib/produtos.ts`) e a navegação é hierárquica — a marca leva ao hub e cada
 * página desenha a própria trilha com o `Trilha` (`components/trilha.tsx`).
 */
export default async function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O middleware já garante sessão de professor em /professor/**.
  const session = await auth();
  const usuario = session!.usuario;

  return (
    <div className="min-h-dvh unooria-surface">
      <header className="border-b border-unooria-neutral-200 bg-unooria-neutral-50">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
          <Link
            href="/professor"
            className="flex items-center gap-3"
            aria-label="Plataforma Unooria — início"
          >
            <Logo size="sm" color="navy" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-semibold text-unooria-neutral-950">
                {usuario.nome}
              </p>
              {/* A sessão do hub não carrega o username do origem; a linha de
                  apoio mostra o papel. */}
              <p className="text-[12px] text-unooria-neutral-500">
                Professor
              </p>
            </div>
            <Avatar name={usuario.nome} size="xs" />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* `plataforma-largura-cheia` libera o max-width de 398px dos Cards do DS:
          aqui há grades de 2–3 colunas e tabelas largas. */}
      <main className="plataforma-largura-cheia mx-auto max-w-5xl px-5 py-8">
        {children}
      </main>
    </div>
  );
}
