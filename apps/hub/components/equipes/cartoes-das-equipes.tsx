import { Card, Tag } from "@edu/ui/ds";
import type { EquipeSalva, PessoaDaEquipe } from "@/lib/equipes";

/**
 * As equipes salvas, uma por cartão, com o nome COMPLETO de cada estudante —
 * é a tela do professor (e da coordenação, que só lê). O que vai para a turma
 * projetada é outra coisa: `MostrarEquipes`, só com o primeiro nome.
 *
 * Os `Tag` ficam no corpo do cartão, e não na prop `tags` do `Card`: com ela o
 * DS desenha um botão "Mais opções" que não abre nada.
 */
export function CartoesDasEquipes({
  equipes,
  semEquipe,
  ausentes,
}: {
  equipes: readonly EquipeSalva[];
  semEquipe: readonly PessoaDaEquipe[];
  ausentes: readonly string[];
}) {
  const faltou = new Set(ausentes);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...equipes]
        .sort((a, b) => a.ordem - b.ordem)
        .map((equipe) => (
          <Card key={equipe.id} variant="outlined" title={equipe.nome}>
            <ul className="flex flex-col gap-1 text-[14px] text-unooria-neutral-800">
              {equipe.membros.map((pessoa) => (
                <li key={pessoa.id}>{pessoa.nome}</li>
              ))}
            </ul>
          </Card>
        ))}
      {semEquipe.length > 0 ? (
        <Card variant="outlined" title={`Sem equipe (${semEquipe.length})`}>
          <ul className="flex flex-col gap-1 text-[14px] text-unooria-neutral-700">
            {semEquipe.map((pessoa) => (
              <li key={pessoa.id} className="flex flex-wrap items-center gap-2">
                {pessoa.nome}
                {faltou.has(pessoa.id) ? <Tag size="sm">faltou</Tag> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
