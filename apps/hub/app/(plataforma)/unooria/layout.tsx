import { HeaderPlataforma } from "@/components/header-plataforma";
import { NavUnooria } from "@/components/nav-unooria";
import { ProvedorDaTrilha, TrilhaDaRota } from "@/components/trilha";
import { auth } from "@/lib/auth";

/**
 * Casca da ÁREA DA UNOORIA (ADR-88) — o painel da fornecedora, não da escola.
 *
 * Área própria, e não um item escondido dentro de `/admin`, por três razões
 * registradas na ADR: honestidade (o painel da fornecedora ao lado das telas da
 * escola convida ao clique errado), TRILHA (área nova exige layout novo, e é o
 * layout que a desenha — foi por não ter layout próprio que `/admin` nasceu sem
 * trilha nenhuma, ADR-77) e crescimento (o que a Unooria opera sobre uma rede
 * não termina no interruptor).
 *
 * Quem chega aqui é só `admin`: o middleware barra os outros papéis pela área, e
 * o `@Roles("admin")` da api barra as rotas. As duas trancas, como no resto do
 * hub.
 *
 * SEM `EscopoDaEscola` (o remontador da ADR-85), de propósito: aqui o escopo não
 * é a escola ativa do cabeçalho — é o escopo que o painel escolhe, e ele começa
 * no CONTRATO. Trocar de escola no header não pode remontar esta tela.
 */
export default async function UnooriaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="flex min-h-dvh flex-col unooria-surface">
      <HeaderPlataforma />
      <div className="flex flex-1">
        <NavUnooria />
        {/* Mesma largura de coluna da área administrativa: as duas são telas de
            trabalho com tabela, e a trilha do layout precisa nascer alinhada
            com o texto. O `min-w-0` também é o mesmo, e pelo mesmo motivo:
            item de flex ao lado da SideBar não encolhe abaixo do conteúdo. */}
        <div className="mx-auto w-full min-w-0 max-w-[1180px] flex-1 px-6 py-6">
          <ProvedorDaTrilha>
            <TrilhaDaRota papel={session!.usuario.papel} />
            {children}
          </ProvedorDaTrilha>
        </div>
      </div>
    </div>
  );
}
