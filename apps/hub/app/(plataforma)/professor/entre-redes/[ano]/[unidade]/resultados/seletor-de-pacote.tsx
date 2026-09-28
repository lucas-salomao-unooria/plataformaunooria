"use client";

import { useRouter } from "next/navigation";
import { Selection } from "@edu/ui/ds";
import { ROTULO_DA_ORIGEM, textoDasRodadas, type PacotesDaTurma } from "@/lib/jornal-escola-tipos";

/**
 * Qual PACOTE o painel de habilidades lê — a atividade da exp04ef1b é o pacote
 * homologado, e cada pacote novo é uma atividade nova.
 *
 * Vive na URL (`?pacote=`), como a turma (`?turmaId=`): link compartilhável, e
 * o padrão — sem o parâmetro — é o pacote EM ANDAMENTO, que é a pergunta do
 * professor na maior parte das vezes. Molde: `seletor-de-cobertura.tsx` da
 * exp07ef1b. `Selection` do DS, e não `<select>`.
 */
export function SeletorDePacote({
  historico,
  pacoteId,
  rotaBase,
  turmaId,
}: {
  historico: PacotesDaTurma["historico"];
  pacoteId: string;
  rotaBase: string;
  turmaId: string;
}) {
  const router = useRouter();

  return (
    <Selection
      label="Pacote de notícias"
      helperText="Cada pacote aprovado é uma atividade. As rodadas dele aparecem juntas no painel."
      value={pacoteId}
      showOptionCheckbox={false}
      onChange={(valor) => {
        const alvo = String(Array.isArray(valor) ? valor[0] : valor);
        const pacote = historico.find((h) => h.id === alvo);
        const busca = new URLSearchParams({ turmaId });
        // O ativo é o padrão: sem o parâmetro, o link salvo acompanha a troca de pacote.
        if (pacote && !pacote.ativo) busca.set("pacote", alvo);
        router.push(`${rotaBase}?${busca.toString()}`, { scroll: false });
      }}
      options={historico.map((h) => ({
        value: h.id,
        label: `“${h.tema}” · ${ROTULO_DA_ORIGEM[h.origem]} · ${textoDasRodadas(h.rodadas)}${h.ativo ? " · em andamento" : ""}`,
      }))}
    />
  );
}
