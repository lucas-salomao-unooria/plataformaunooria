import { HeaderPlataforma } from "@/components/header-plataforma";

/**
 * Casca da área administrativa (gestor / admin-contrato). Mesmo header de
 * todas as áreas (`HeaderPlataforma`): marca, identidade e sair — o caminho é
 * o conteúdo.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col unooria-surface">
      <HeaderPlataforma largura="cheia" />
      <div className="flex-1 px-6 py-6">{children}</div>
    </div>
  );
}
