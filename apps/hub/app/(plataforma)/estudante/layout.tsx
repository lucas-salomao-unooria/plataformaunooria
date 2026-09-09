import { HeaderPlataforma } from "@/components/header-plataforma";
import { ProvedorDaTrilha, TrilhaDaRota } from "@/components/trilha";
import { auth } from "@/lib/auth";

/**
 * Casca do hub do estudante.
 *
 * É a plataforma, não o aparelho: aqui a marca institucional pode aparecer, no
 * mesmo `HeaderPlataforma` do professor e das demais áreas. A regra de ouro
 * vale um nível abaixo — nada da marca, da aula ou do professor entra DENTRO
 * do iframe da experiência.
 *
 * A `TrilhaDaRota` está aqui e HOJE NÃO DESENHA NADA: `/estudante` é a home do
 * papel, e trilha de um item só, que é a própria página, é ruído. Ela fica
 * montada porque a área tem uma rota só — a segunda que aparecer nasce com
 * trilha em vez de nascer sem, que é exatamente como as 10 páginas sem trilha
 * apareceram.
 */
export default async function EstudanteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth(); // middleware garante sessão em /estudante/**

  return (
    <div className="min-h-dvh unooria-surface">
      <HeaderPlataforma />

      {/* Libera o max-width de 398px dos Cards do DS: aqui há grade de 2 colunas. */}
      <main className="plataforma-largura-cheia mx-auto max-w-5xl px-6 py-8">
        <ProvedorDaTrilha>
          <TrilhaDaRota papel={session!.usuario.papel} />
          {children}
        </ProvedorDaTrilha>
      </main>
    </div>
  );
}
