"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Selection } from "@edu/ui/ds";

/**
 * Um `Selection` do DS que escreve a escolha na URL (`?<parametro>=`): a turma
 * do painel do professor, a regional do painel da rede. Na URL, e não em
 * estado, porque é a PÁGINA (servidor) que lê a api com a escolha — e o
 * endereço copiado abre a mesma visão.
 */
export function SeletorDaConsulta({
  id,
  rotulo,
  parametro,
  valor,
  opcoes,
}: {
  id: string;
  rotulo: string;
  parametro: string;
  valor: string;
  opcoes: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const busca = useSearchParams();

  return (
    <div className="max-w-sm">
      <Selection
        id={id}
        label={rotulo}
        value={valor}
        options={opcoes}
        onChange={(v) => {
          const novos = new URLSearchParams(busca.toString());
          if (v) novos.set(parametro, String(v));
          else novos.delete(parametro);
          const query = novos.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
      />
    </div>
  );
}
