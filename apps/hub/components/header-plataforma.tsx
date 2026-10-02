import Link from "next/link";

import { Icon, Logo } from "@edu/ui/ds";
import { MenuDaConta } from "@/components/menu-da-conta";
import { SeletorDeEscola } from "@/components/seletor-de-escola";
import { auth } from "@/lib/auth";
import { homeDoPapel, rotuloDoPapel } from "@/lib/papeis";
import { produtoLigado } from "@/lib/recursos";

/**
 * O gutter do chrome — e o MESMO da coluna de conteúdo de cada área.
 *
 * Vale 24px (`px-6`) em todo lugar. Quando o header andava em `px-5` e o
 * `<main>` de `/analise` em `px-6`, a marca ficava 4px à esquerda do título da
 * própria página: um desalinhamento que ninguém consegue nomear olhando, e que
 * volta sozinho se os dois valores forem escritos separados de novo.
 */
const GUTTER = "px-6";

/**
 * Header padrão da plataforma: marca à esquerda, identidade + menu da conta à
 * direita — e é no menu do avatar que o "Sair" mora (`MenuDaConta`).
 *
 * É UM só para TODOS os papéis (estudante, professor, gestor, admin-contrato) e
 * para todas as superfícies — inclusive `/exp/**`, o aparelho do estudante. Antes
 * cada área desenhava o próprio header copiado (professor, estudante, admin,
 * análise) e a experiência não tinha nenhum: quem entrava numa missão perdia a
 * marca, o nome e o caminho de saída.
 *
 * A regra de ouro continua valendo um nível abaixo: nada da marca entra DENTRO
 * do iframe. O header é chrome do hub, desenhado acima do aparelho.
 *
 * **A marca ancora na JANELA, não na coluna de conteúdo.** O miolo é
 * full-bleed: nada de `max-width` com `mx-auto` aqui. Ele já teve um parâmetro
 * `largura` (`5xl` | `6xl` | `cheia`) que "casava com o `max-width` do `<main>`
 * de cada área — e o efeito medido foi a marca ocupar QUATRO posições
 * diferentes conforme a página: 20px em `/admin` e `/exp`, 164px em `/analise`,
 * 228px em `/professor` e `/estudante` (num viewport de 1440px; em 1920px o
 * salto entre a primeira e a última é de 448px). O header é o mesmo em todas as
 * telas — mesma altura, mesmos elementos —, então ele não pode se mover ao
 * navegar. E o acoplamento nunca teve como convergir: `/admin` tem navegação
 * lateral e `/exp` é aparelho em tela cheia, logo essas áreas jamais teriam a
 * coluna de `/professor`.
 */
export async function HeaderPlataforma({
  href,
  legenda,
  voltar,
}: {
  /** Onde a marca leva. Default: a home do papel de quem está logado. */
  href?: string;
  /** Linha de apoio sob o nome. Default: a série (estudante) ou o rótulo do papel. */
  legenda?: string;
  /** Caminho de volta, desenhado ao lado da marca (usado dentro da missão). */
  voltar?: { href: string; rotulo: string };
}) {
  // Toda rota que usa este header passa pelo middleware, que garante sessão.
  const session = await auth();
  const usuario = session!.usuario;

  // A sessão do hub não carrega o username do origem; a linha de apoio mostra
  // a série (quando há) ou o papel.
  const apoio = legenda ?? usuario.serie ?? rotuloDoPapel(usuario.papel);

  // A Ajuda com atendente (ADR-132) é de todo papel MENOS o estudante — e o
  // header é o mesmo dentro de `/exp`, o aparelho da criança. Quem tranca de
  // verdade é a api (`@Roles` + `@Produto("ajuda")`); aqui é não mostrar a porta.
  const comAjuda = usuario.papel !== "estudante" && (await produtoLigado("ajuda"));

  return (
    <header className="border-b border-unooria-neutral-200 bg-unooria-neutral-50">
      <div className={`flex h-16 w-full items-center justify-between gap-4 ${GUTTER}`}>
        <div className="flex items-center gap-4">
          <Link
            href={href ?? homeDoPapel(usuario.papel)}
            className="flex items-center gap-3"
            aria-label="Plataforma Unooria — início"
          >
            <Logo size="sm" color="navy" />
          </Link>

          {voltar ? (
            <>
              <span aria-hidden className="h-6 w-px bg-unooria-neutral-200" />
              <Link
                href={voltar.href}
                className="flex items-center gap-1 text-[13px] font-semibold text-unooria-neutral-600 hover:text-unooria-neutral-950"
              >
                {/* Era um `←` literal. Ícone é componente, e o DS publica `Icon`
                    — o mesmo `arrow_back` que a casca legal já usa. O glifo em
                    texto não escalava com a tipografia e o leitor de tela
                    anunciava "seta para a esquerda" no meio do rótulo. */}
                <Icon name="arrow_back" size="s" color="currentColor" aria-hidden />
                {voltar.rotulo}
              </Link>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {/* Quem está lotado em mais de uma escola escolhe onde está agora.
              A escola ativa é o que o token de dados carrega. */}
          <SeletorDeEscola escolas={usuario.escolas ?? []} ativa={usuario.escolaId} />
          {/* Identidade + menu do avatar, e é no menu que o "Sair" mora. Antes
              eram três peças soltas — nome, avatar decorativo e um botão "Sair"
              com o mesmo peso visual da marca, para a ação mais destrutiva da
              barra. O nome e o papel foram para dentro do `MenuDaConta` porque
              a tira do `HeaderMenu` abre POR CIMA do que está à esquerda do
              gatilho; o porquê inteiro está lá. */}
          <MenuDaConta nome={usuario.nome} apoio={apoio} comAjuda={comAjuda} />
        </div>
      </div>
    </header>
  );
}
