import Link from "next/link";

import { Card, Tag } from "@edu/ui/ds";
import type { CopyDaMissao } from "@/lib/missoes-do-estudante";
import { podeEntrar, type EstadoDaMissao } from "@/lib/salas";

/**
 * Cartão de missão no hub do estudante.
 *
 * Nada de "aula", "plano" ou "professor" aqui — e nada que entregue a virada da
 * missão: a copy vem de `missao.estudante` no catálogo, escrita para ser lida
 * ANTES de jogar.
 *
 * TRÊS ESTADOS, e os três aparecem (ADR-69):
 *
 * - `liberada` — o card é um link, e diz "Começar".
 * - `bloqueada` — CADEADO, sem link. Sumir da tela era mais simples e foi
 *   recusado: a grade do ano é a promessa do que vem depois, e uma lista que
 *   muda de tamanho sozinha não deixa a criança entender que a próxima unidade
 *   existe. E some a diferença entre "ainda não abriu" e "a missão sumiu".
 * - `encerrada` — continua visível, com o rótulo. O que ela fez não pode
 *   evaporar da tela quando o professor fecha a aula.
 *
 * O que o card NÃO faz é explicar POR QUE está fechada em linguagem de sistema.
 * "Ainda não abriu" é o que a criança precisa saber; quem abre é assunto do
 * adulto que está na sala com ela.
 */

function Seta() {
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

/** O cadeado. SVG local porque é um glifo de estado, não um componente do DS. */
function Cadeado() {
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
      <rect x="2.75" y="6" width="8.5" height="6" rx="1.5" />
      <path d="M4.75 6V4.25a2.25 2.25 0 0 1 4.5 0V6" />
    </svg>
  );
}

function Corpo({
  missao,
  estado,
}: {
  missao: CopyDaMissao;
  estado: EstadoDaMissao;
}) {
  const aberta = podeEntrar(estado);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2
          className={`text-[18px] font-bold leading-tight ${
            aberta ? "text-unooria-neutral-950" : "text-unooria-neutral-700"
          }`}
        >
          {missao.titulo}
        </h2>
        {estado === "encerrada" ? <Tag>encerrada</Tag> : null}
      </div>
      <p
        className={`text-[14px] leading-relaxed ${
          aberta ? "text-unooria-neutral-700" : "text-unooria-neutral-500"
        }`}
      >
        {missao.chamada}
      </p>
      {aberta ? (
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-unooria-navy-900">
          Começar
          <Seta />
        </span>
      ) : (
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-unooria-neutral-500">
          <Cadeado />
          {estado === "encerrada" ? "Esta você já fechou" : "Ainda não abriu"}
        </span>
      )}
    </div>
  );
}

export function CartaoMissaoEstudante({
  missao,
  estado,
}: {
  missao: CopyDaMissao;
  estado: EstadoDaMissao;
}) {
  if (!podeEntrar(estado)) {
    /* Sem `<Link>`: a missão fechada não é clicável. Um link que leva a um 404
       é pior que nenhum link — a criança acha que quebrou. */
    return (
      <Card variant="outlined" className="h-full" data-estado={estado}>
        <Corpo missao={missao} estado={estado} />
      </Card>
    );
  }

  return (
    <Link href={missao.rota} className="block h-full">
      <Card variant="interactive" interactive className="h-full" data-estado={estado}>
        <Corpo missao={missao} estado={estado} />
      </Card>
    </Link>
  );
}
