import { HeaderPlataforma } from "@/components/header-plataforma";
import { ProvedorDaTrilha, TrilhaDaRota } from "@/components/trilha";
import { auth } from "@/lib/auth";

/**
 * Casca da ANÁLISE DE PRODUTO (doc 11 §5) — a área do time da Unooria.
 *
 * Espelha a casca do professor de propósito: é o mesmo `HeaderPlataforma`. O
 * que muda é o público — aqui quem entra é `gestor_contrato`, o único perfil
 * que enxerga mais de uma escola — e por isso a legenda é a área, não o papel.
 */
export default async function AnaliseLayout({ children }: { children: React.ReactNode }) {
  // Middleware garante sessão; quem recusa o gestor aqui é a api (ADR-54, §7).
  const session = await auth();

  return (
    <div className="min-h-dvh unooria-surface">
      <HeaderPlataforma href="/analise" legenda="Análise de produto" />

      {/* O max-width passou do conteúdo de cada página para CÁ. Antes eram dois
          (6xl na comparação entre turmas, 5xl no detalhe, "como no origem") e a
          trilha, que agora é do layout, ficaria 64px à esquerda do texto na
          página de 5xl. Coluna de largura diferente por página é decisão que a
          área não usava para nada — a trilha só cobrou o preço dela.
          `plataforma-largura-cheia` libera o max-width de 398px dos Cards do DS
          — aqui há tabelas largas. */}
      <main className="plataforma-largura-cheia mx-auto w-full max-w-6xl px-6 py-10">
        <ProvedorDaTrilha>
          <TrilhaDaRota papel={session!.usuario.papel} />
          {children}
        </ProvedorDaTrilha>
      </main>
    </div>
  );
}
