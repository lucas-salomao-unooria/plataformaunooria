import { Card, NEWS_MEDIUM_LABELS, Tag } from "@edu/ui/ds";
import {
  ETIQUETA_DO_GABARITO,
  MEIO_NO_DS,
  ROTULO_DA_PISTA,
  TIPOS_DE_PISTA,
  escolhaDoGabarito,
  type MaterialDoJornal,
} from "@/lib/jornal-escola-tipos";

/**
 * Os BLOCOS VIVOS do guia da exp04ef1b — de `GET /jornal-escola/professor/material`
 * (professor only). UMA chamada, três blocos, porque são três momentos da aula:
 *
 * - `BotoesDoJornal`, no roteiro: os dois portões e o que DIZER à turma ao
 *   apertar cada um (os gatilhos orais da copy revisada, §4b). É a mesma frase
 *   que o painel da aula mostra ao lado do botão — uma fonte, dois lugares.
 * - `PerguntasDoJornal`, no debate: as três perguntas da mediação (§4b),
 *   verbatim.
 * - `MesaDoJornal`, no preparo: as oito notícias do banco padrão COM o gabarito
 *   e a reação do leitor, e os seis blocos da Chave, com as iscas marcadas.
 *
 * Nada disso vira texto no guia (`guias/exp04ef1b.ts`): as perguntas e os
 * gatilhos moram na api para que corrigir uma frase não exija republicar o hub,
 * e as notícias são o que a turma LÊ na tela — descrever também é copiar
 * (`guias/tipos.ts`).
 */

function NaoCarregou({ titulo }: { titulo: string }) {
  return (
    <div className="guia-bloco">
      <Card variant="outlined" title={titulo}>
        <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
          Atualize esta página antes da aula. Este bloco vem da plataforma, com as frases e as notícias exatas
          que a turma e o painel usam — conduzir de memória troca as palavras, e a conversa do resultado depende
          delas.
        </p>
      </Card>
    </div>
  );
}

export function BotoesDoJornal({ dados }: { dados: MaterialDoJornal | null }) {
  if (!dados) return <NaoCarregou titulo="Os botões da aula não carregaram" />;

  return (
    <div className="guia-bloco">
      <Card variant="elevated" title="Os dois portões da aula, e o que dizer em cada um">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          É um botão só, em A aula e os resultados, que mostra sempre a próxima etapa. Ele avança uma etapa por
          vez e <strong>não volta</strong> — a turma inteira anda junto.
        </p>
        <ol className="mt-3 flex list-decimal flex-col gap-3 pl-5 text-[13px] leading-relaxed text-unooria-neutral-800">
          <li>
            <strong className="text-unooria-neutral-950">Liberar resultado</strong>, quando a maioria tiver
            publicado. Ao apertar, projete o gráfico da turma e diga: “{dados.roteiro.gatilhoDoResultado}”
          </li>
          <li>
            <strong className="text-unooria-neutral-950">Liberar revisão</strong>, depois da conversa com as três
            perguntas. Ao apertar, diga: “{dados.roteiro.gatilhoDaRevisao}”
          </li>
        </ol>
      </Card>
    </div>
  );
}

export function PerguntasDoJornal({ dados }: { dados: MaterialDoJornal | null }) {
  if (!dados) return <NaoCarregou titulo="As perguntas da mediação não carregaram" />;

  return (
    <div className="guia-bloco">
      <Card variant="elevated" title="As três perguntas do resultado — entre os dois botões">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          Com o gráfico anônimo projetado e as reações dos leitores na tela de cada computador. A escada abaixo é
          para o fechamento, depois da 2ª edição.
        </p>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-900">
          {dados.roteiro.perguntas.map((pergunta) => (
            <li key={pergunta}>{pergunta}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

export function MesaDoJornal({ dados }: { dados: MaterialDoJornal | null }) {
  if (!dados) return <NaoCarregou titulo="A mesa do banco padrão não carregou" />;

  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="elevated" title="A mesa do banco padrão, com o gabarito — só para você">
        {/* A ressalva que evita a aula conduzida sobre o texto errado: este é o
            banco padrão, e quem aprovou um pacote próprio tem outras oito
            notícias na mesa da turma. */}
        <p className="text-[12px] leading-relaxed text-unooria-neutral-600">
          Este é o banco padrão da Unooria, “{dados.tema}” ({dados.disciplina}). <strong>Se você aprovou um
          pacote próprio</strong>, o que a turma lê não é isto — está em A aula e os resultados, no preparo, com o
          gabarito de cada notícia. <strong>Não projete esta lista</strong>: a coluna da capa é a resposta.
        </p>
        <ul className="mt-3 grid gap-3 lg:grid-cols-2">
          {dados.noticias.map((n) => {
            const escolha = escolhaDoGabarito(n.gabarito);
            return (
              <li key={n.id} className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3" data-noticia={n.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-unooria-neutral-600">
                    {NEWS_MEDIUM_LABELS[MEIO_NO_DS[n.meio]]} · {n.veiculo}
                  </span>
                  <Tag variant={escolha === "publicavel" ? "success" : "warning"} size="sm">
                    {ETIQUETA_DO_GABARITO[escolha]}
                  </Tag>
                </div>
                <p className="text-[14px] font-semibold leading-snug text-unooria-neutral-950">{n.manchete}</p>
                <p className="text-[13px] leading-relaxed text-unooria-neutral-800">{n.gabarito.explicacao}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px] leading-snug text-unooria-neutral-700">
                  {TIPOS_DE_PISTA.map((tipo) => (
                    <div key={tipo} className="contents">
                      <dt className="font-semibold">{ROTULO_DA_PISTA[tipo]}:</dt>
                      <dd>{n.pistas[tipo]}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[12px] leading-snug text-unooria-neutral-600">
                  Se for para a capa, {n.consequencia.leitor}: “{n.consequencia.fala}”
                </p>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 text-[13px] font-semibold text-unooria-neutral-950">A Chave do Editor: seis blocos, três certos</p>
        <p className="mt-1 text-[12px] leading-relaxed text-unooria-neutral-600">
          A Chave se forma com os três pilares, em qualquer ordem. As iscas voltam para a bandeja quando entram — e
          cada envio conta uma tentativa no painel de habilidades. A ordem da bandeja muda de computador para
          computador.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {dados.blocos.map((b) => (
            <li key={b.id} className="flex flex-col gap-1 rounded-lg border border-unooria-neutral-200 p-2" data-bloco={b.id}>
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-unooria-neutral-950">{b.rotulo}</span>
                <Tag variant={b.pilar ? "success" : "neutral"} size="sm">
                  {b.pilar ? "pilar" : "isca"}
                </Tag>
              </span>
              <span className="text-[12px] text-unooria-neutral-600">{b.legenda}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
