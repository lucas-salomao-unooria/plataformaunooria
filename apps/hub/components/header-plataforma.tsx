import Link from "next/link";

import { Avatar, Logo } from "@edu/ui/ds";
import { LogoutButton } from "@/components/logout-button";
import { SeletorDeEscola } from "@/components/seletor-de-escola";
import { auth } from "@/lib/auth";
import { homeDoPapel, rotuloDoPapel } from "@/lib/papeis";

/** Larguras do miolo do header — casam com o `max-width` do `<main>` de cada área. */
const LARGURAS = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  cheia: "max-w-none",
} as const;

/**
 * Header padrão da plataforma: marca à esquerda, identidade + "Sair" à direita.
 *
 * É UM só para TODOS os papéis (aluno, professor, gestor, admin-contrato) e
 * para todas as superfícies — inclusive `/exp/**`, o aparelho do aluno. Antes
 * cada área desenhava o próprio header copiado (professor, aluno, admin,
 * análise) e a experiência não tinha nenhum: quem entrava numa missão perdia a
 * marca, o nome e o caminho de saída.
 *
 * A regra de ouro continua valendo um nível abaixo: nada da marca entra DENTRO
 * do iframe. O header é chrome do hub, desenhado acima do aparelho.
 */
export async function HeaderPlataforma({
  href,
  legenda,
  voltar,
  largura = "5xl",
}: {
  /** Onde a marca leva. Default: a home do papel de quem está logado. */
  href?: string;
  /** Linha de apoio sob o nome. Default: a série (aluno) ou o rótulo do papel. */
  legenda?: string;
  /** Caminho de volta, desenhado ao lado da marca (usado dentro da missão). */
  voltar?: { href: string; rotulo: string };
  largura?: keyof typeof LARGURAS;
}) {
  // Toda rota que usa este header passa pelo middleware, que garante sessão.
  const session = await auth();
  const usuario = session!.usuario;

  // A sessão do hub não carrega o username do origem; a linha de apoio mostra
  // a série (quando há) ou o papel.
  const apoio = legenda ?? usuario.serie ?? rotuloDoPapel(usuario.papel);

  return (
    <header className="border-b border-unooria-neutral-200 bg-unooria-neutral-50">
      <div
        className={`mx-auto flex h-16 items-center justify-between gap-4 px-5 ${LARGURAS[largura]}`}
      >
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
                className="text-[13px] font-semibold text-unooria-neutral-600 hover:text-unooria-neutral-950"
              >
                ← {voltar.rotulo}
              </Link>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {/* Quem está lotado em mais de uma escola escolhe onde está agora.
              A escola ativa é o que o token de dados carrega. */}
          <SeletorDeEscola escolas={usuario.escolas ?? []} ativa={usuario.escolaId} />
          <div className="hidden text-right sm:block">
            <p className="text-[13px] font-semibold text-unooria-neutral-950">{usuario.nome}</p>
            <p className="text-[12px] text-unooria-neutral-500">{apoio}</p>
          </div>
          <Avatar name={usuario.nome} size="xs" />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
