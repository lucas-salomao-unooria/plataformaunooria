import { notFound } from "next/navigation";

import { Trilha } from "@/components/trilha";
import {
  MISSAO_ATUAL,
  buscarMissao,
  rotaDaMissao,
  rotuloDaMissao,
} from "@/lib/entre-redes/catalogo";

import { FormularioAtividade } from "./formulario-atividade";

/**
 * Nova atividade — uma configuração da missão para um tema do professor.
 *
 * MISSÃO ÚNICA: enquanto só a Unidade 1 do 8º ano existe, a atividade nasce
 * ligada a ela por construção (nota de modelagem em
 * `lib/entre-redes/catalogo.ts`). Quando houver mais missões, esta rota passa a
 * receber a missão de origem.
 */
export default async function NovaAtividadePage() {
  // O middleware já garante sessão de professor em /professor/**.
  const encontrado = buscarMissao(
    MISSAO_ATUAL.anoSlug,
    MISSAO_ATUAL.unidadeSlug,
  );
  if (!encontrado) notFound();
  const { ano, missao } = encontrado;

  return (
    <div className="flex flex-col gap-6">
      <Trilha
        itens={[
          { label: "Início", href: "/professor" },
          { label: "Entre Redes", href: "/professor/entre-redes" },
          { label: rotuloDaMissao(ano, missao), href: rotaDaMissao(missao) },
          { label: "Nova atividade" },
        ]}
      />

      <div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">
          Nova atividade
        </h1>
        <p className="text-[14px] text-unooria-neutral-500">
          {missao.titulo} · {rotuloDaMissao(ano, missao)}. Tudo parte da
          pergunta-chave do seu debate final.
        </p>
      </div>

      <FormularioAtividade />
    </div>
  );
}
