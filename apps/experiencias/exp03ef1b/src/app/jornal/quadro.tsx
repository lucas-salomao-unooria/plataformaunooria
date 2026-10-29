import type { ReactNode } from "react";

/**
 * O quadro do jornal (a faixa das pastilhas, os valores, a área do resultado
 * da busca). (b) COMPENSAÇÃO — sem par no DS: a seção não publica um
 * "painel" sem foto; é fio, raio e recuo com tokens `--ujn-*`
 * (`.quadro-jornal`). `tracejado` é a área do resultado ainda vazia.
 */
export function QuadroDoJornal({
  children,
  tracejado = false,
  centro = false,
  rotulo,
  className,
}: {
  children: ReactNode;
  tracejado?: boolean;
  centro?: boolean;
  rotulo?: string;
  className?: string;
}) {
  return (
    <section
      aria-label={rotulo}
      className={["quadro-jornal", tracejado ? "quadro-jornal--tracejado" : "", centro ? "quadro-jornal--centro" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
