import { HeaderPlataforma } from "@/components/header-plataforma";

/**
 * Casca da ANÁLISE DE PRODUTO (doc 11 §5) — a área do time da Unooria.
 *
 * Espelha a casca do professor de propósito: é o mesmo `HeaderPlataforma`. O
 * que muda é o público — aqui quem entra é `admin-contrato`, o único perfil
 * que enxerga mais de uma escola — e por isso a legenda é a área, não o papel.
 */
export default function AnaliseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh unooria-surface">
      <HeaderPlataforma href="/analise" legenda="Análise de produto" largura="6xl" />

      {/* Cada página desta área traz o próprio max-width (6xl na comparação
          entre turmas, 5xl no detalhe), como no origem: a casca só dá o header,
          a superfície e o respiro. `plataforma-largura-cheia` libera o
          max-width de 398px dos Cards do DS — aqui há tabelas largas. */}
      <main className="plataforma-largura-cheia px-6 py-10">{children}</main>
    </div>
  );
}
