import type { ReactNode } from "react";

/**
 * A casca de toda tela: o topo do jornal, o corpo e a faixa de ações no pé
 * (à direita, como no protótipo). Não importa nenhuma seção do DS: quem
 * fala em cada pedaço é o componente que entra nela (`jornal/*` ou
 * `mecanica/*`).
 */
export function Casca({
  topo,
  children,
  acoes,
  corpo,
  inerte = false,
}: {
  topo: ReactNode;
  children: ReactNode;
  acoes?: ReactNode;
  corpo?: string;
  inerte?: boolean;
}) {
  return (
    <div className="casca" inert={inerte || undefined}>
      {topo}
      <main className={["casca__corpo", corpo].filter(Boolean).join(" ")}>{children}</main>
      {acoes ? <div className="casca__acoes">{acoes}</div> : null}
    </div>
  );
}
