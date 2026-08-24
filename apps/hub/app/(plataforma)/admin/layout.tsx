import { Avatar, Logo } from "@edu/ui/ds";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/lib/auth";

/**
 * Casca da área administrativa (gestor / admin-contrato). Header minimalista
 * como no projeto origem: marca, identidade e sair — o caminho é o conteúdo.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const nome = session?.usuario?.nome ?? "";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-unooria-neutral-200 bg-unooria-neutral-50 px-6 py-3">
        <Logo size="sm" color="navy" aria-label="Plataforma Unooria" />
        <div className="flex items-center gap-3">
          <span className="text-[14px] text-unooria-neutral-700">{nome}</span>
          <Avatar name={nome} size="sm" />
          <LogoutButton />
        </div>
      </header>
      <div className="flex-1 px-6 py-6">{children}</div>
    </div>
  );
}
