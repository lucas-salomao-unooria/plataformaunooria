import { Card, Tag } from "@edu/ui/ds";
import { ROTULO_DA_VERACIDADE, type MaterialDoProfessor } from "@/lib/quem-mandou-tipos";

/**
 * As 8 mensagens do grupo COM o gabarito — BLOCO VIVO do guia da exp-05.
 *
 * Vem de `GET /quem-mandou-isso/professor/material` (professor only). Descrever
 * as mensagens em vez de mostrá-las destruiria justamente o que sustenta a
 * lição: **a mensagem falsa não parece malfeita e a verdadeira não parece
 * oficial**. Uma paráfrase ("três verdadeiras, três falsas e duas ambíguas")
 * ensina a heurística errada — a de que dá para separar pela aparência —, que é
 * o oposto do que a aula conclui. Lado a lado, o comunicado longo e chato da
 * coordenação ao lado do boato em caixa alta dizem isso sozinhos.
 */
export function QuemMandouOLote({ dados }: { dados: MaterialDoProfessor | null }) {
  if (!dados) {
    return (
      <div className="guia-bloco">
        <Card variant="outlined" title="As mensagens do grupo não carregaram">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Atualize esta página antes da aula. O debate desta missão parte das mensagens que a
            turma leu na tela — conduzi-lo de memória troca as palavras que elas escolheram, e é
            exatamente nas palavras que está o que fez o dedo repassar.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="elevated" title="As 8 mensagens e o gabarito de cada uma — só para você">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          <strong>Não projete esta lista e não a entregue impressa à turma.</strong> Leia antes
          para conduzir: repare que a mensagem falsa NÃO parece malfeita e a verdadeira NÃO parece
          oficial. O comunicado da coordenação é o texto mais longo e mais chato do grupo de
          propósito — é ele que quase ninguém encaminha. São{" "}
          <strong>{dados.paridade.verdadeira} verdadeiras, {dados.paridade.falsa} falsas e{" "}
          {dados.paridade.ambigua} ambíguas</strong>, e o Mural fecha com no mínimo{" "}
          <strong>{dados.pisoDeEncaminhamentos} encaminhamentos</strong>.
        </p>
        {/* A ressalva que evita a aula conduzida sobre o texto errado: este é o
            banco curado da Unooria, e a professora que gerou um lote próprio
            leu outras oito mensagens com a turma. */}
        <p className="mt-2 text-[12px] leading-relaxed text-unooria-neutral-600">
          Este é o banco curado da Unooria, sobre o tema “{dados.tema}”. <strong>Se você gerou um
          lote próprio para a sua turma</strong>, o que ela leu não é isto — está em A aula e os
          resultados, na preparação da missão, e é de lá que você conduz.
        </p>

        <ol className="mt-4 flex flex-col gap-3">
          {dados.mensagens.map((m, indice) => (
            <li
              key={m.id}
              className="rounded-lg border border-unooria-neutral-200 p-3"
              data-mensagem={m.id}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  {indice + 1}ª · {m.remetente} · {m.hora} · {m.tipo}
                </span>
                <Tag
                  variant={
                    m.veracidade === "verdadeira"
                      ? "success"
                      : m.veracidade === "falsa"
                        ? "danger"
                        : "warning"
                  }
                  size="sm"
                  pill
                >
                  {ROTULO_DA_VERACIDADE[m.veracidade]}
                </Tag>
              </span>
              {m.titulo && (
                <p className="mt-1 text-[13px] font-semibold text-unooria-neutral-950">
                  {m.titulo}
                  {m.fonte ? ` — ${m.fonte}` : ""}
                  {m.data ? ` · ${m.data}` : ""}
                </p>
              )}
              <p className="mt-1 text-[15px] leading-relaxed text-unooria-neutral-950">
                {m.corpo}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-unooria-neutral-700">
                <span className="text-unooria-neutral-500">Por quê:</span> {m.explicacao}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-[13px] font-semibold text-unooria-neutral-950">
          {dados.podcast.titulo}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-unooria-neutral-500">
          O episódio de fechamento, em texto. A turma o lê no fim da missão; você o lê antes, para
          saber com que palavras a conclusão vai chegar nela.
        </p>
        <ol className="mt-2 flex flex-col gap-2">
          {dados.podcast.blocos.map((bloco) => (
            <li key={bloco.rotulo} className="text-[13px] leading-relaxed text-unooria-neutral-800">
              <strong className="block text-unooria-neutral-950">{bloco.rotulo}</strong>
              {bloco.falas.map((fala, i) => (
                <span key={i} className="block">
                  {fala}
                </span>
              ))}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
