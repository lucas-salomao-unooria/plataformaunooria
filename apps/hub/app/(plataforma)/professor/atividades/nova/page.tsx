import { notFound } from "next/navigation";

import {
  MISSAO_ATUAL,
  buscarMissao,
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
export default async function NovaAtividadePage({
  searchParams,
}: {
  /** `?turmaId=` chega de quem veio da sala de aula (ADR-100). */
  searchParams: Promise<{ turmaId?: string }>;
}) {
  // O middleware já garante sessão de professor em /professor/**.
  const { turmaId } = await searchParams;
  const encontrado = buscarMissao(
    MISSAO_ATUAL.anoSlug,
    MISSAO_ATUAL.unidadeSlug,
  );
  if (!encontrado) notFound();
  const { ano, missao } = encontrado;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">
          Nova atividade
        </h1>
        <p className="text-[14px] text-unooria-neutral-500">
          {missao.titulo} · {rotuloDaMissao(ano, missao)}. Tudo parte da
          pergunta-chave do seu debate final.
        </p>
      </div>

      {/* A turma NÃO é validada aqui: o `select` só casa com uma das turmas que
          o próprio formulário busca, e `POST /atividades` recusa turma em que o
          professor não leciona. Um id inventado na URL cai em "Escolha a turma…". */}
      <FormularioAtividade turmaInicial={turmaId?.trim() ?? ""} />
    </div>
  );
}
