"use client";

import { useRouter } from "next/navigation";
import { Selection } from "@edu/ui/ds";
import { ROTULO_DA_ORIGEM, textoDasRodadas, type CoberturasDaTurma } from "@/lib/a-selecao-tipos";

/**
 * Qual COBERTURA o painel de habilidades lê — a atividade da exp07ef1b é a
 * cobertura homologada, e cada tema novo é uma atividade nova.
 *
 * Vive na URL (`?cobertura=`), como a turma (`?turmaId=`): link
 * compartilhável, e o padrão — sem o parâmetro — é a cobertura EM ANDAMENTO,
 * que é a pergunta da professora na maior parte das vezes. `Selection` do DS,
 * e não `<select>`: a regra de ouro vale para o seletor também.
 */
export function SeletorDeCobertura({
  historico,
  coberturaId,
  rotaBase,
  turmaId,
}: {
  historico: CoberturasDaTurma["historico"];
  coberturaId: string;
  rotaBase: string;
  turmaId: string;
}) {
  const router = useRouter();

  return (
    <Selection
      label="Cobertura"
      helperText="Cada cobertura aprovada é uma atividade. As rodadas dela aparecem juntas no painel."
      value={coberturaId}
      onChange={(valor) => {
        const alvo = String(valor);
        const cobertura = historico.find((h) => h.id === alvo);
        const busca = new URLSearchParams({ turmaId });
        // A ativa é o padrão: sem o parâmetro, o link salvo acompanha a troca de tema.
        if (cobertura && !cobertura.ativa) busca.set("cobertura", alvo);
        router.push(`${rotaBase}?${busca.toString()}`, { scroll: false });
      }}
      options={historico.map((h) => ({
        value: h.id,
        label: `“${h.tema}” · ${ROTULO_DA_ORIGEM[h.origem]} · ${textoDasRodadas(h.rodadas)}${h.ativa ? " · em andamento" : ""}`,
      }))}
    />
  );
}
