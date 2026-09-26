import { Card, Tag } from "@edu/ui/ds";
import {
  ROTULO_DA_LENTE,
  rotuloDoPost,
  type Enquadramento,
  type MaterialDaSelecao,
} from "@/lib/a-selecao-tipos";

/**
 * Os BLOCOS VIVOS do guia da exp07ef1b — de `GET /a-selecao/professor/material`
 * (professor only).
 *
 * Dois blocos, em duas seções, porque são dois momentos da aula:
 *
 * - `GatilhosDaSelecao`, no roteiro: QUANDO apertar cada um dos três botões
 *   (`prof.gatilho.*` do sheet). É a frase que o painel da aula também mostra
 *   ao lado do botão — uma fonte, dois lugares.
 * - `RoteiroDaSelecao`, no debate: o aviso de proteção do gap, as três
 *   perguntas da Etapa 4, as seleções pré-gravadas do Tomás e da Malu e os 12
 *   posts do banco curado COM as fichas.
 *
 * Nada disso vira texto no guia (`guias/exp07ef1b.ts`): as perguntas e os
 * gatilhos são verbatim do sheet e moram na api para que corrigir uma frase
 * não exija republicar o hub; os posts são o que a turma LÊ na tela, e descrever
 * também é copiar (`guias/tipos.ts`).
 */

const LENTES: readonly Enquadramento[] = ["institucional", "comunitario", "estatistico"];

function NaoCarregou({ titulo }: { titulo: string }) {
  return (
    <div className="guia-bloco">
      <Card variant="outlined" title={titulo}>
        <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
          Atualize esta página antes da aula. Este bloco vem da plataforma, com as frases exatas
          que a turma e o painel usam — conduzir de memória troca as palavras, e o Mural depende
          delas.
        </p>
      </Card>
    </div>
  );
}

export function GatilhosDaSelecao({ dados }: { dados: MaterialDaSelecao | null }) {
  if (!dados) return <NaoCarregou titulo="Os botões da aula não carregaram" />;

  return (
    <div className="guia-bloco">
      <Card variant="elevated" title="Os três botões da aula, e quando apertar cada um">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          É um botão só, em A aula e os resultados, que mostra sempre a próxima etapa. Ele avança
          uma etapa por vez e <strong>não volta</strong> — a turma inteira anda junto.
        </p>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-relaxed text-unooria-neutral-800">
          <li>{dados.gatilhos.mural}</li>
          <li>{dados.gatilhos.fichas}</li>
          <li>{dados.gatilhos.explicacao}</li>
        </ol>
      </Card>
    </div>
  );
}

export function RoteiroDaSelecao({ dados }: { dados: MaterialDaSelecao | null }) {
  if (!dados) return <NaoCarregou titulo="O roteiro da Etapa 4 não carregou" />;

  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="elevated" title="O roteiro da Etapa 4 — só para você">
        {/* O aviso vem antes das perguntas, e em destaque: lidas antes do Mural,
            elas dizem à turma o que procurar no feed. */}
        <p className="text-[13px] font-semibold leading-relaxed text-unooria-neutral-950" data-aviso-do-gap>
          {dados.roteiroDaEtapa4.aviso}
        </p>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-900">
          {dados.roteiroDaEtapa4.perguntas.map((pergunta) => (
            <li key={pergunta}>{pergunta}</li>
          ))}
        </ol>

        <p className="mt-5 text-[13px] font-semibold text-unooria-neutral-950">
          Os colegas virtuais: Tomás e Malu
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-unooria-neutral-600">
          Seleções pré-gravadas. Recebe uma delas — a que mais contrasta — quem sobra numa sala
          ímpar, quem publica depois do Mural aberto, quem não tem par de escolha diferente e a sala
          de um computador só. Com um tema seu, os posts deles são os da mesma posição no seu lote.
        </p>
        <ul className="mt-2 flex flex-col gap-3">
          {dados.colegasVirtuais.map((colega) => (
            <li key={colega.id} className="rounded-lg border border-unooria-neutral-200 p-3" data-colega-virtual={colega.id}>
              <p className="text-[13px] font-semibold text-unooria-neutral-950">{colega.nome}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-unooria-neutral-900">“{colega.legenda}”</p>
              <ul className="mt-2 flex flex-col gap-0.5 text-[12px] leading-snug text-unooria-neutral-600">
                {colega.selecao.map((id) => (
                  <li key={id}>{rotuloDoPost(id, dados.posts)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-[13px] font-semibold text-unooria-neutral-950">
          Os 12 posts e as fichas técnicas
        </p>
        {/* A ressalva que evita a aula conduzida sobre o texto errado: este é o
            banco curado, e a professora que aprovou uma cobertura própria leu
            outros doze posts com a turma. */}
        <p className="mt-1 text-[12px] leading-relaxed text-unooria-neutral-600">
          Este é o banco curado da Unooria, sobre “{dados.tema}”. <strong>Se você aprovou uma
          cobertura própria</strong>, o que a turma leu não é isto — está em A aula e os resultados,
          no preparo, com as fichas de cada post. <strong>Não projete esta lista</strong>: as fichas
          são a revelação.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {LENTES.map((lente) => (
            <div key={lente} className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                {ROTULO_DA_LENTE[lente]}
              </p>
              {dados.posts
                .filter((p) => p.enquadramento === lente)
                .map((p) => (
                  <div key={p.id} className="rounded-lg border border-unooria-neutral-200 p-3" data-post={p.id}>
                    <p className="text-[12px] font-semibold text-unooria-neutral-700">{p.perfil}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-unooria-neutral-900">{p.legenda}</p>
                    <span className="mt-2 flex flex-col gap-1">
                      <Tag variant="info" size="sm">
                        Fonte ouvida: {p.tagFonte}
                      </Tag>
                      <Tag variant="info" size="sm">
                        Ângulo da imagem: {p.tagAngulo}
                      </Tag>
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
