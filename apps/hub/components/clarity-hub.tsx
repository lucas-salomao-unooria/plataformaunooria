"use client";
import { snippetClarity, idValido } from "@edu/sdk";
import Script from "next/script";
import { CLARITY_PROJECT_ID } from "@/lib/clarity";

/**
 * O Microsoft Clarity no HUB (ADR-59).
 *
 * Montado no `app/layout.tsx` RAIZ, que é o único lugar com `<html>`/`<body>` e
 * o único que cobre TODAS as rotas: a landing pública, o login, as quatro áreas
 * de papel, `/exp/**` e `/dev-embed`. A casca (`casca-plataforma.tsx`) não
 * serve — ela não passa pela landing, que é justamente onde a pessoa chega.
 *
 * `afterInteractive` e não `beforeInteractive`: o Clarity não precisa estar de
 * pé antes da hidratação, e `beforeInteractive` no root layout atrasaria o
 * primeiro render de toda tela por um script de terceiro. O que se perde são os
 * primeiros milissegundos de gravação.
 *
 * Sem id, este componente não renderiza nada — nem a tag, nem uma requisição.
 */
export function ClarityHub() {
  if (!idValido(CLARITY_PROJECT_ID)) return null;
  return (
    <Script
      id="ms-clarity"
      strategy="afterInteractive"
      // O corpo vem do `@edu/sdk`, que é a fonte única do snippet — o mesmo
      // código que as experiências injetam dentro do iframe. O `projectId` é
      // validado por `idValido` antes de ser interpolado.
      dangerouslySetInnerHTML={{ __html: snippetClarity(CLARITY_PROJECT_ID) }}
    />
  );
}
