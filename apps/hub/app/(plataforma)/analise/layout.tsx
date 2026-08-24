import Link from "next/link";

import { Avatar, Logo } from "@edu/ui/ds";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/lib/auth";

/**
 * Casca da ANÁLISE DE PRODUTO (doc 11 §5) — a área do time da Unooria.
 *
 * Espelha a casca do professor de propósito: mesma marca, mesma identidade à
 * direita, mesmo "Sair". O que muda é o público — aqui quem entra é
 * `admin-contrato`, o único perfil que enxerga mais de uma escola.
 */
export default async function AnaliseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O middleware já garante sessão de admin-contrato em /analise/**.
  const session = await auth();
  const usuario = session!.usuario;

  return (
    <div className="min-h-dvh unooria-surface">
      <header className="border-b border-unooria-neutral-200 bg-unooria-neutral-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link
            href="/analise"
            className="flex items-center gap-3"
            aria-label="Plataforma Unooria — análise de produto"
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
                Análise de produto
              </p>
            </div>
            <Avatar name={usuario.nome} size="xs" />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Cada página desta área traz o próprio max-width (6xl na comparação
          entre turmas, 5xl no detalhe), como no origem: a casca só dá o header,
          a superfície e o respiro. `plataforma-largura-cheia` libera o
          max-width de 398px dos Cards do DS — aqui há tabelas largas. */}
      <main className="plataforma-largura-cheia px-6 py-10">{children}</main>
    </div>
  );
}
