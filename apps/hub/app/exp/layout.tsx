import { CascaPlataforma } from "@/components/casca-plataforma";

/**
 * Casca da superfície da MISSÃO (`/exp/:expId`).
 *
 * Fora do grupo `(plataforma)` de propósito: o `max-width` e o padding do
 * layout do professor não servem a um aparelho em tela cheia. Mas o header
 * padrão do hub é desenhado aqui, então as folhas do DS e as fontes precisam
 * entrar — daí a `CascaPlataforma` compartilhada.
 *
 * Altura travada em `100dvh` e coluna: o header ocupa o que precisa e a
 * experiência fica com o resto exato, sem a página rolar. Nada disto atravessa
 * o iframe — dentro dele a tipografia e a marca são da experiência.
 */
export default function ExpLayout({ children }: { children: React.ReactNode }) {
  return (
    <CascaPlataforma className="flex flex-col" style={{ height: "100dvh" }}>
      {children}
    </CascaPlataforma>
  );
}
