import { HeaderPlataforma } from "@/components/header-plataforma";
import { ProvedorDaTrilha, TrilhaDaRota } from "@/components/trilha";
import { auth } from "@/lib/auth";

/**
 * Casca das superfícies do professor.
 *
 * O header é o `HeaderPlataforma`, o MESMO de todas as áreas e da experiência
 * — marca, identidade e "Sair". Não tem atalhos ("Guia da aula", "Plano de
 * aula"): eram links de quando a plataforma era uma atividade só. Agora ela é
 * um **hub de produtos** (`lib/produtos.ts`) e a navegação é hierárquica — a
 * marca leva ao hub e a TRILHA devolve o caminho de volta.
 *
 * **A trilha é desenhada aqui, uma vez, para a área inteira** (`TrilhaDaRota`,
 * em `components/trilha.tsx`). Era por página, e o resultado foi o que o dono
 * do produto viu: 20 páginas com trilha e 10 sem, porque nada obrigava. Página
 * nova nesta área ganha trilha sem escrever uma linha; o que ela pode fazer é
 * PUBLICAR o nome próprio do que está mostrando (`RotuloDaTrilha`), nunca
 * apagar a trilha.
 *
 * O `ProvedorDaTrilha` não renderiza DOM: se renderizasse, `.tela-cheia`
 * deixaria de ser filho DIRETO do `main` e o `main:has(> .tela-cheia)` de
 * `plataforma.css` pararia de distribuir a altura — de volta à barra de rolagem
 * parada das três telas de embed.
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
export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  // O middleware garante sessão de professor em /professor/**.
  const session = await auth();

  return (
    <div className="flex min-h-dvh flex-col unooria-surface">
      <HeaderPlataforma />

      {/* `plataforma-largura-cheia` libera o max-width de 398px dos Cards do DS:
          aqui há grades de 2–3 colunas e tabelas largas. */}
      <main className="plataforma-largura-cheia mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        <ProvedorDaTrilha>
          <TrilhaDaRota papel={session!.usuario.papel} />
          {children}
        </ProvedorDaTrilha>
      </main>
    </div>
  );
}
