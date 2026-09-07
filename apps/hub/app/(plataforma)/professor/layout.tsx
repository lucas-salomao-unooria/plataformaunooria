import { HeaderPlataforma } from "@/components/header-plataforma";

/**
 * Casca das superfícies do professor.
 *
 * O header é o `HeaderPlataforma`, o MESMO de todas as áreas e da experiência
 * — marca, identidade e "Sair". Não tem atalhos ("Guia da aula", "Plano de
 * aula"): eram links de quando a plataforma era uma atividade só. Agora ela é
 * um **hub de produtos** (`lib/produtos.ts`) e a navegação é hierárquica — a
 * marca leva ao hub e cada página desenha a própria trilha com o `Trilha`
 * (`components/trilha.tsx`).
 *
 * **Coluna flex, com o `main` em `flex-1`** — o mesmo arranjo de
 * `app/exp/layout.tsx`: o header ocupa o que precisa e o `main` fica com o
 * RESTO EXATO. É isso que deixa a página de tela cheia usar a classe
 * `.tela-cheia` (em `@edu/ui/styles/plataforma.css`) em vez de subtrair a altura
 * do header. A subtração é que estava errada: o header mede
 * **65px** (`h-16` = 64 + a `border-b` de 1px) e as três páginas que embedam
 * experiência descontavam 64 — a página transbordava 1px e ganhava uma barra de
 * rolagem vertical PARADA na tela, visível sem ter o que rolar. Altura de irmão
 * não se estima: quem distribui é o flex.
 */
export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col unooria-surface">
      <HeaderPlataforma />

      {/* `plataforma-largura-cheia` libera o max-width de 398px dos Cards do DS:
          aqui há grades de 2–3 colunas e tabelas largas. */}
      <main className="plataforma-largura-cheia mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  );
}
