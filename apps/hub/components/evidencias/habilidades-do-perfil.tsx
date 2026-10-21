import { Card, Tag } from "@edu/ui/ds";
import {
  NAO_AVALIADO,
  ROTULO_DO_STATUS,
  tituloDaAtividadeNoPerfil,
  varianteDoNivel,
  type Nivel,
  type PerfilDoEstudante,
} from "@/lib/evidencias";
import { copyDaMissao } from "@/lib/missoes-do-estudante";
import { rotuloDaUnidade } from "@/lib/painel-de-habilidades";

/** Uma habilidade numa linha: o código, o texto da BNCC e o nível (ou "Não avaliado"). */
function LinhaDaHabilidade({ codigo, descricao, status }: { codigo: string; descricao: string; status: Nivel | null }) {
  return (
    <li className="linha-de-lista flex flex-wrap items-start justify-between gap-3 py-2">
      <span className="min-w-0 flex-1 text-[14px] text-unooria-neutral-700">
        <span className="font-semibold text-unooria-neutral-950">{codigo}</span>
        {descricao ? ` — ${descricao}` : ""}
      </span>
      {status ? (
        <Tag variant={varianteDoNivel(status)} size="sm">
          {ROTULO_DO_STATUS[status]}
        </Tag>
      ) : (
        <Tag variant="outline" size="sm">
          {NAO_AVALIADO}
        </Tag>
      )}
    </li>
  );
}

/**
 * O PERFIL do estudante (E14, H14.7.4): em cada missão — da mais recente para
 * a mais antiga —, o nível de cada habilidade da BNCC: o MELHOR entre as
 * atividades da missão. A habilidade da ficha sem nível aparece como "Não
 * avaliado", com contorno e sem cor: não ter sido observado não é ter falhado.
 *
 * Quando a missão teve mais de uma atividade, cada uma aparece embaixo, com o
 * que ELA mediu (a melhor rodada). A ordem das habilidades é a da ficha —
 * nunca a do nível. Sem origem (de que computador veio), sem ranking e sem
 * comparação com a turma: é o que ESTA criança demonstrou.
 *
 * Os `Tag` ficam no corpo do cartão, e não na prop `tags` do `Card`: com ela o
 * DS desenha um botão "Mais opções" que não abre nada.
 */
export function HabilidadesDoPerfil({ missoes }: { missoes: PerfilDoEstudante["missoes"] }) {
  return (
    <div className="flex flex-col gap-4">
      {missoes.map((missao, indiceDaMissao) => (
        <Card
          key={missao.expId}
          variant="outlined"
          title={`${rotuloDaUnidade(missao.unidade)} · ${copyDaMissao(missao.expId)?.titulo ?? missao.nome}`}
        >
          <div className="flex flex-col gap-4">
            {indiceDaMissao === 0 && missoes.length > 1 ? (
              <span className="self-start">
                <Tag variant="info" size="sm">
                  Mais recente
                </Tag>
              </span>
            ) : null}
            <ul className="flex flex-col">
              {missao.habilidades.map((habilidade) => (
                <LinhaDaHabilidade key={habilidade.codigo} {...habilidade} />
              ))}
            </ul>

            {missao.atividades.length > 1
              ? missao.atividades.map((atividade, indice) => (
                  <section key={atividade.atividadeId} className="flex flex-col gap-2">
                    <h3 className="text-[13px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
                      {tituloDaAtividadeNoPerfil(indice, missao.atividades.length)}
                    </h3>
                    <ul className="flex flex-col">
                      {atividade.habilidades.map((habilidade) => (
                        <LinhaDaHabilidade key={habilidade.codigo} {...habilidade} />
                      ))}
                    </ul>
                  </section>
                ))
              : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
