"use client";

import { usePathname, useRouter } from "next/navigation";

import { Tabs } from "@edu/ui/ds";

/**
 * As abas da sala. O estado vive na URL (`?aba=`), não no componente.
 *
 * Mesmo desenho do seletor de turma dos resultados, e pelo mesmo motivo: o link
 * fica compartilhável, o botão voltar funciona, e o servidor consegue renderizar
 * a aba certa direto — sem um flash de "Missões" antes de trocar.
 *
 * `Tabs` do design system em modo CONTROLADO. Não se escreve aba à mão aqui: o
 * componente é do DS, e o que este arquivo acrescenta é só a ponte com o router.
 */
export type AbaDaSala = "missoes" | "estudantes";

export function AbasDaSala({
  aba,
  estudantes,
  missoes,
}: {
  aba: AbaDaSala;
  estudantes: number;
  missoes: number;
}) {
  const router = useRouter();
  const caminho = usePathname();

  return (
    <Tabs
      value={aba}
      onChange={(valor) => router.push(`${caminho}?aba=${String(valor)}`)}
      items={[
        { value: "missoes", label: "Missões", badge: missoes },
        { value: "estudantes", label: "Estudantes", badge: estudantes },
      ]}
    />
  );
}
