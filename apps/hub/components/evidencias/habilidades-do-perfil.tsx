import { Card, Tag } from "@edu/ui/ds";
import {
  ROTULO_DO_STATUS,
  tituloDaAtividadeNoPerfil,
  varianteDoNivel,
  type PerfilDoEstudante,
} from "@/lib/evidencias";
import { copyDaMissao } from "@/lib/missoes-do-estudante";

/**
 * O PERFIL do estudante (E14): em cada missão, em cada atividade, o nível de
 * cada habilidade da BNCC — a melhor rodada, só com o que vale.
 *
 * Só níveis: a api não manda origem (quem lê o perfil quer saber o que a
 * criança demonstrou, não de que computador veio), nem "Não avaliado", nem
 * "Não participou", nem a aula projetada que ainda não foi confirmada. A ordem
 * das habilidades é a da ficha, que é a do painel — nunca a do nível.
 *
 * Os `Tag` ficam no corpo do cartão, e não na prop `tags` do `Card`: com ela o
 * DS desenha um botão "Mais opções" que não abre nada.
 */
export function HabilidadesDoPerfil({ missoes }: { missoes: PerfilDoEstudante["missoes"] }) {
  return (
    <div className="flex flex-col gap-4">
      {missoes.map((missao) => (
        <Card key={missao.expId} variant="outlined" title={copyDaMissao(missao.expId)?.titulo ?? missao.nome}>
          <div className="flex flex-col gap-4">
            {missao.atividades.map((atividade, indice) => {
              const titulo = tituloDaAtividadeNoPerfil(indice, missao.atividades.length);
              return (
                <section key={atividade.atividadeId} className="flex flex-col gap-2">
                  {titulo ? (
                    <h3 className="text-[13px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
                      {titulo}
                    </h3>
                  ) : null}
                  <ul className="flex flex-col">
                    {atividade.habilidades.map((habilidade) => (
                      <li
                        key={habilidade.codigo}
                        className="linha-de-lista flex flex-wrap items-start justify-between gap-3 py-2"
                      >
                        <span className="min-w-0 flex-1 text-[14px] text-unooria-neutral-700">
                          <span className="font-semibold text-unooria-neutral-950">{habilidade.codigo}</span>
                          {habilidade.descricao ? ` — ${habilidade.descricao}` : ""}
                        </span>
                        <Tag variant={varianteDoNivel(habilidade.status)} size="sm">
                          {ROTULO_DO_STATUS[habilidade.status]}
                        </Tag>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
