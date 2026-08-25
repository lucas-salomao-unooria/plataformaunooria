import Link from "next/link";

import { Card, Tag } from "@edu/ui/ds";
import type { Produto } from "@/lib/produtos";

/**
 * Ícones dos produtos, inline.
 *
 * Inline e não `Icon` do DS: a fonte Material Symbols vem do Google Fonts e,
 * sem rede, o ícone vira o nome dele escrito por extenso no meio do card.
 */
const ICONES: Record<Produto["slug"], React.ReactNode> = {
  "plano-de-aula": (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5Z" />
    </svg>
  ),
  "entre-redes": (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="7" r="2.4" />
      <circle cx="18" cy="7" r="2.4" />
      <circle cx="12" cy="17.5" r="2.4" />
      <path d="M8.2 8.3 10.4 15.6" />
      <path d="M15.8 8.3 13.6 15.6" />
      <path d="M8.4 7h7.2" />
    </svg>
  ),
};

function SetaExterna() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.25 1.75h4v4" />
      <path d="M12.25 1.75 6.5 7.5" />
      <path d="M10.5 8.75v2.5a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1h2.5" />
    </svg>
  );
}

function SetaInterna() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 7h9" />
      <path d="M7.75 3.25 11.5 7l-3.75 3.75" />
    </svg>
  );
}

function Corpo({ produto }: { produto: Produto }) {
  return (
    <Card variant="interactive" interactive className="h-full">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <span className="cartao-produto__icone">{ICONES[produto.slug]}</span>
          <Tag variant="brand" size="sm" pill>
            {produto.chamada}
          </Tag>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-[18px] font-bold leading-tight text-unooria-neutral-950">
            {produto.nome}
          </h2>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
            {produto.descricao}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[12px] text-unooria-neutral-500">
            {produto.situacao}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-unooria-navy-900">
            {produto.acao}
            {produto.externo ? <SetaExterna /> : <SetaInterna />}
          </span>
        </div>
      </div>
    </Card>
  );
}

/**
 * Card de produto do hub. Interno vira `<Link>`; externo (nenhum hoje — o
 * gerador de plano de aula passou para dentro) abre em nova guia com
 * `noopener noreferrer`.
 */
export function CartaoProduto({ produto }: { produto: Produto }) {
  if (produto.externo) {
    return (
      <a
        href={produto.destino}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
      >
        <Corpo produto={produto} />
      </a>
    );
  }

  return (
    <Link href={produto.destino} className="block h-full">
      <Corpo produto={produto} />
    </Link>
  );
}
