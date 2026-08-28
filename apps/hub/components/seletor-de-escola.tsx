"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@edu/ui/ds";

/**
 * O seletor de ESCOLA ATIVA de quem está lotado em mais de uma unidade — o
 * professor de rede estadual.
 *
 * Só aparece com duas ou mais: numa escola só, seria um campo com uma opção.
 *
 * A escola ativa é o que o token de dados carrega, e é por isso que a troca
 * passa pelo servidor (`/api/escola-ativa`) em vez de ser estado de tela: quem
 * valida se a escola é dela é a api, contra as lotações. Depois da troca vem um
 * `router.refresh()` — as telas são Server Components e leem a escola da sessão.
 */
export function SeletorDeEscola({
  escolas,
  ativa,
}: {
  escolas: Array<{ id: string; nome: string; papel: string }>;
  ativa: string;
}) {
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState(false);

  if (escolas.length < 2) return null;

  async function trocar(escolaId: string) {
    if (escolaId === ativa || trocando) return;
    setTrocando(true);
    setErro(false);
    try {
      const resposta = await fetch("/api/escola-ativa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ escolaId }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      router.refresh();
    } catch {
      setErro(true);
    } finally {
      setTrocando(false);
    }
  }

  return (
    <label className="hidden items-center gap-2 md:flex">
      <Icon name="apartment" size={18} aria-hidden />
      <span className="sr-only">Escola ativa</span>
      <select
        className="unooria-select max-w-[240px] text-[13px]"
        value={ativa}
        disabled={trocando}
        onChange={(e) => void trocar(e.target.value)}
        aria-label="Escola ativa"
      >
        {escolas.map((escola) => (
          <option key={escola.id} value={escola.id}>
            {escola.nome}
          </option>
        ))}
      </select>
      {erro ? (
        <span className="text-[12px] text-unooria-danger">não deu para trocar</span>
      ) : null}
    </label>
  );
}
