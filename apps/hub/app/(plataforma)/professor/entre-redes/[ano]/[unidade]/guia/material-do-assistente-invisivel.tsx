import { Card } from "@edu/ui/ds";
import type { Material } from "@/lib/assistente-invisivel-tipos";

/**
 * O material de O Assistente Invisível, VIVO (de `GET
 * /assistente-invisivel/professor/material`): as quatro perguntas do roteiro
 * do PO, cada uma no momento dela, para a mediação; o critério de cada nível
 * das quatro habilidades, para o depois. Sem a api, o cartão diz que não
 * carregou — o resto do guia continua servindo.
 */
function NaoCarregou() {
  return (
    <div className="guia-bloco">
      <Card variant="outlined">
        <p className="text-[13px] text-unooria-neutral-600">O material da missão não carregou agora. Recarregue a página em instantes.</p>
      </Card>
    </div>
  );
}

/** Em que momento da aula cada pergunta do roteiro entra (one-pager §9a e Figma E4-PROF-01 / E6-PROF-01). */
const MOMENTO_DA_PERGUNTA = [
  "Mediação 1, depois das fichas (Etapa 4)",
  "Mediação 1, depois das fichas (Etapa 4)",
  "Fechamento coletivo (Etapa 6)",
  "Fechamento coletivo (Etapa 6)",
];

export function RoteiroDoAssistente({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  return (
    <div className="guia-bloco">
      <Card variant="outlined" title="O roteiro de debate mediado — as quatro perguntas">
        <div className="flex flex-col gap-4 text-[13px] leading-relaxed text-unooria-neutral-800" data-roteiro-do-assistente>
          <ol className="flex list-decimal flex-col gap-3 pl-5">
            {dados.roteiro.perguntas.map((p, i) => (
              <li key={p}>
                <span className="block text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  {MOMENTO_DA_PERGUNTA[i] ?? "Debate"}
                </span>
                {`“${p}”`}
              </li>
            ))}
          </ol>
        </div>
      </Card>
    </div>
  );
}

export function ReguasDoAssistente({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="outlined" title="O critério de cada nível (registrado pelo que o estudante faz)">
        <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-unooria-neutral-800">
          {dados.habilidades.map((h) => (
            <div key={h.codigo} className="flex flex-col gap-1">
              <strong className="text-unooria-neutral-950">{`${h.codigo} — ${h.rotulo}`}</strong>
              <span>{`Atingiu: ${h.criterios.atingiu}`}</span>
              <span>{`Em processo: ${h.criterios.em_processo}`}</span>
              <span>{`Não atingiu: ${h.criterios.nao_atingiu}`}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
