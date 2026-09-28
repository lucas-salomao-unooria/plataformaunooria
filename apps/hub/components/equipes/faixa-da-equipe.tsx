import { Icon } from "@edu/ui/ds";
import { textoSuaEquipe } from "@/lib/equipes";

/**
 * A faixa do ESTUDANTE, entre o header e o aparelho: com quem ele divide o
 * computador nesta missão (E13).
 *
 * É chrome do hub, como o header — fica FORA do iframe e fala pela
 * plataforma. Uma linha só e `shrink-0`: a coluna de `app/exp/layout.tsx` tem
 * altura travada, e quem fica com o resto é o `ExpHost` (o `DispositivoFrame`
 * recalcula a escala sozinho). Só primeiros nomes, sem link: a api já devolve
 * os colegas assim.
 */
export function FaixaDaEquipe({ equipe }: { equipe: { nome: string; colegas: string[] } }) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-unooria-neutral-200 bg-unooria-neutral-100 px-6 py-2 text-[14px] text-unooria-neutral-800"
      data-testid="faixa-da-equipe"
    >
      <Icon name="groups" size="xs" color="currentColor" aria-hidden />
      <p className="min-w-0 truncate">{textoSuaEquipe(equipe)}</p>
    </div>
  );
}
