import { HeaderPlataforma } from "@/components/header-plataforma";
import { NavAdmin } from "@/components/nav-admin";
import { auth } from "@/lib/auth";

/**
 * Casca da área administrativa (gestor / admin-contrato). Mesmo header de
 * todas as áreas (`HeaderPlataforma`): marca, identidade e sair. A navegação
 * lateral entrou quando a área deixou de ter uma tela só — pessoas, turmas e
 * importação são três passos do mesmo trabalho.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="flex min-h-dvh flex-col unooria-surface">
      <HeaderPlataforma largura="cheia" />
      <div className="flex flex-1">
        <NavAdmin
          papel={session!.usuario.papel}
          escolas={session!.usuario.escolas?.length ?? 1}
        />
        <div className="flex-1 px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
