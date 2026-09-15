import { Card, Tag } from "@edu/ui/ds";

/**
 * As três intervenções do Rastro do Boato COM o gabarito — BLOCO VIVO do guia.
 *
 * Vem de `GET /rastro-boato/professor/material` (professor only). O guia
 * descrevia as opções — "a opção que respondeu no grupo em vez de sair dele" —
 * e a paráfrase escondia o que sustenta a lição inteira: **A e C produzem a
 * MESMA reação do grupo**. Lado a lado isso salta; descrito, some.
 */
export interface MaterialDoRastro {
  intervencoes: Array<{
    id: string;
    texto: string;
    desfecho: "interrompeu" | "amplificou" | "silenciou";
    reacao: string;
    interrompe: boolean;
  }>;
  ciclo: Array<{ id: string; texto: string }>;
}

const ROTULO_DO_DESFECHO: Record<MaterialDoRastro["intervencoes"][number]["desfecho"], string> = {
  interrompeu: "interrompe a corrente",
  amplificou: "amplifica",
  silenciou: "silencia — a corrente segue sem você",
};

export function IntervencoesDoRastro({ dados }: { dados: MaterialDoRastro | null }) {
  if (!dados) {
    return (
      <div className="guia-bloco">
        <Card variant="outlined" title="As intervenções não carregaram">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Atualize esta página antes da aula. O debate desta missão parte das três frases
            que a turma leu na tela — conduzi-lo de memória troca as palavras que elas
            escolheram.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="elevated" title="As três intervenções e o que cada uma faz — só para você">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          <strong>Não projete e não antecipe qual funciona.</strong> Leia antes para conduzir:
          repare que <strong>A e C têm a mesma reação do grupo</strong>. É a peça central da
          missão — apagar para si mesmo não interrompe nada, só tira você da conta. Ninguém
          precisa dizer o que escolheu.
        </p>

        <ol className="mt-4 flex flex-col gap-3">
          {dados.intervencoes.map((i) => (
            <li key={i.id} className="rounded-lg border border-unooria-neutral-200 p-3">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  opção {i.id}
                </span>
                <Tag variant={i.interrompe ? "success" : "danger"} size="sm" pill>
                  {ROTULO_DO_DESFECHO[i.desfecho]}
                </Tag>
              </span>
              <p className="mt-1 text-[15px] leading-relaxed text-unooria-neutral-950">
                {i.texto}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-unooria-neutral-700">
                <span className="text-unooria-neutral-500">O grupo responde:</span> {i.reacao}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-[13px] font-semibold text-unooria-neutral-950">
          O ciclo, na ordem certa
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-unooria-neutral-500">
          A turma recebe estes quatro blocos embaralhados e monta a sequência. Esta é a ordem
          que a api aceita — é por ela que você confere.
        </p>
        <ol className="mt-2 flex flex-col gap-1">
          {dados.ciclo.map((bloco, indice) => (
            <li key={bloco.id} className="text-[13px] leading-relaxed text-unooria-neutral-800">
              <strong>{indice + 1}.</strong> {bloco.texto}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
