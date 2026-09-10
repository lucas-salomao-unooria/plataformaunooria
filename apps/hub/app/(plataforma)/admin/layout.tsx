import { HeaderPlataforma } from "@/components/header-plataforma";
import { NavAdmin } from "@/components/nav-admin";
import { EscopoDaEscola } from "@/components/escopo-da-escola";
import { ProvedorDaTrilha, TrilhaDaRota } from "@/components/trilha";
import { auth } from "@/lib/auth";

/**
 * Casca da área administrativa (gestor / admin-contrato). Mesmo header de
 * todas as áreas (`HeaderPlataforma`): marca, identidade e sair. A navegação
 * lateral entrou quando a área deixou de ter uma tela só — pessoas, turmas e
 * importação são três passos do mesmo trabalho.
 *
 * A barra lateral diz em que dos seis lugares você está; ela não diz que a
 * turma aberta está DENTRO de Turmas. Quem diz isso é a trilha, desenhada aqui
 * para a área inteira (`TrilhaDaRota`) — as 7 páginas desta área não tinham
 * nenhuma até 2026-09-07, e a barra lateral era a razão pela qual ninguém
 * notou: ela cobre a navegação de primeiro nível e esconde a falta do segundo.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="flex min-h-dvh flex-col unooria-surface">
      <HeaderPlataforma />
      <div className="flex flex-1">
        <NavAdmin
          papel={session!.usuario.papel}
          escolas={session!.usuario.escolas?.length ?? 1}
        />
        {/* A largura da coluna é DAQUI. Cada página trazia a sua (1080px em
            quatro, 1180px em duas, sem razão registrada) e a trilha, que agora
            é do layout, nasceria desalinhada do texto em metade da área. */}
        <div className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-6">
          <ProvedorDaTrilha>
            <TrilhaDaRota papel={session!.usuario.papel} />
            <EscopoDaEscola>{children}</EscopoDaEscola>
          </ProvedorDaTrilha>
        </div>
      </div>
    </div>
  );
}
