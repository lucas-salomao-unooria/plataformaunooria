import { Card, Tag } from "@edu/ui/ds";

/**
 * As três respostas do Eco no Grupo COM o gabarito e as reações do bairro —
 * BLOCO VIVO do guia.
 *
 * Vem de `GET /o-eco-no-grupo/professor/material` (professor only). O guia
 * descrevia a decisão em uma linha; o que a turma comenta depois não é a letra
 * clicada, é o pânico da Dona Lúcia — e isso não cabe em paráfrase.
 *
 * As reações são o roteiro CANÔNICO, o que roda com a IA desligada. Com IA as
 * falas respondem ao que o estudante postou, mas o desfecho é o mesmo: é a
 * FORMA da reação que o professor precisa antecipar.
 */
export interface MaterialDoEco {
  intervencoes: Array<{
    id: string;
    texto: string;
    desfecho: "ruido" | "checada" | "conflito";
    correta: boolean;
    reacoes: Array<{ autor: string; texto: string }>;
  }>;
}

const ROTULO_DO_DESFECHO: Record<MaterialDoEco["intervencoes"][number]["desfecho"], string> = {
  checada: "o bairro se acalma",
  ruido: "o boato se espalha",
  conflito: "o grupo entra em conflito",
};

export function IntervencoesDoEco({ dados }: { dados: MaterialDoEco | null }) {
  if (!dados) {
    return (
      <div className="guia-bloco">
        <Card variant="outlined" title="As respostas não carregaram">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Atualize esta página antes da aula. O debate parte do que o bairro respondeu na
            tela de cada estudante, e sem isto você conduz sem saber o que eles viram.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="elevated" title="As três respostas e o que o bairro devolve — só para você">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          <strong>Não projete e não diga qual é a certa.</strong> Leia antes: a cascata de
          reações é o pico da missão, e é dela que a turma vai falar. O que se avalia é a
          análise no debate, não a letra que cada um clicou.
        </p>

        <ol className="mt-4 flex flex-col gap-3">
          {dados.intervencoes.map((i) => (
            <li key={i.id} className="rounded-lg border border-unooria-neutral-200 p-3">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  opção {i.id}
                </span>
                <Tag variant={i.correta ? "success" : "danger"} size="sm" pill>
                  {ROTULO_DO_DESFECHO[i.desfecho]}
                </Tag>
              </span>
              <p className="mt-1 text-[15px] leading-relaxed text-unooria-neutral-950">
                {i.texto}
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {i.reacoes.map((r) => (
                  <li
                    key={`${i.id}-${r.autor}`}
                    className="text-[13px] leading-relaxed text-unooria-neutral-700"
                  >
                    <span className="font-semibold text-unooria-neutral-800">{r.autor}:</span>{" "}
                    {r.texto}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
