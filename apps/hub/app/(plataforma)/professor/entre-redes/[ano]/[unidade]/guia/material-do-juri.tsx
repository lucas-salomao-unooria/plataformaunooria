import { Card, Tag } from "@edu/ui/ds";
import type { MaterialDoJuri } from "@/lib/juri-estadual-tipos";

/**
 * Os BLOCOS VIVOS do guia da exp06ef1b — de `GET /juri-estadual/professor/material`
 * (professor only). UMA chamada, dois blocos, porque são dois momentos da aula:
 *
 * - `GabaritoDoJuri`, no preparo: a REGRA que o feed executou (os pesos e o
 *   limiar do motor, os mesmos que a cadeia ensina), a ordem da cadeia e os
 *   cartões do caso Mariana COM o certo marcado (os pacotes da curtida saíram
 *   com a EF06CO07, a pedido do PO);
 * - `PlenariaDoJuri`, no debate: as quatro perguntas da plenária do pico,
 *   verbatim — as mesmas que o painel da aula mostra ao lado do botão.
 *
 * Nada disso vira texto no guia (`guias/exp06ef1b.ts`): a regra e o gabarito
 * são o que a turma vive e monta na tela, e a pergunta mora na api para que
 * corrigir uma frase não exija republicar o hub (`guias/tipos.ts`).
 */

function NaoCarregou({ titulo }: { titulo: string }) {
  return (
    <div className="guia-bloco">
      <Card variant="outlined" title={titulo}>
        <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
          Atualize esta página antes da aula. Este bloco vem da plataforma, com a regra e as frases exatas que a
          turma vive e que o painel mostra — conduzir de memória troca as palavras, e a plenária depende delas.
        </p>
      </Card>
    </div>
  );
}

export function PlenariaDoJuri({ dados }: { dados: MaterialDoJuri | null }) {
  if (!dados) return <NaoCarregou titulo="As perguntas da plenária não carregaram" />;

  return (
    <div className="guia-bloco">
      <Card variant="elevated" title="As quatro perguntas da plenária — entre o voto e a galeria">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          Com o painel de votação projetado e as telas em espera. Explore a divergência sem dizer ainda que o feed se
          adaptou; a última leva a conversa para fora da tela. A escada abaixo é para o fechamento, depois do caso
          Mariana.
        </p>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-900" data-plenaria>
          {dados.plenaria.map((pergunta) => (
            <li key={pergunta}>{pergunta}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

export function GabaritoDoJuri({ dados }: { dados: MaterialDoJuri | null }) {
  if (!dados) return <NaoCarregou titulo="A regra do feed e o gabarito não carregaram" />;
  const { regra } = dados;
  const blocos = [...dados.blocos].sort((a, b) => a.posicao - b.posicao);

  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="elevated" title="A regra do feed e o gabarito — só para você">
        <p className="text-[12px] leading-relaxed text-unooria-neutral-600">
          <strong>Não projete este bloco</strong>: a ordem da cadeia e os cartões certos são a resposta das
          etapas finais.
        </p>

        <p className="mt-4 text-[13px] font-semibold text-unooria-neutral-950">A regra que o feed executou</p>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-unooria-neutral-800" data-regra-do-feed>
          <li>O feed tem {regra.postsNoFeed} publicações; as primeiras são uma de cada área, e a cédula abre quando a última chega.</li>
          <li>
            Cada curtida soma {regra.pesoDaCurtida} pontos para a área do estande; ficar parado num post por alguns
            segundos soma {regra.pesoDaPermanencia}. Descurtir devolve os pontos da curtida.
          </li>
          <li>
            Quando uma área chega a {regra.limiar} pontos, o resto do feed é só dela — sem aviso nenhum na tela. É a
            regra “se… então…” que a cadeia e a terceira enquete pedem para descrever.
          </li>
        </ul>

        <p className="mt-5 text-[13px] font-semibold text-unooria-neutral-950">A cadeia do feed, na ordem certa</p>
        <p className="mt-1 text-[12px] leading-relaxed text-unooria-neutral-600">
          Os blocos chegam fora de ordem, e a ordem de chegada muda de computador para computador. Cada envio conta
          uma tentativa no painel de habilidades.
        </p>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-relaxed text-unooria-neutral-800" data-cadeia>
          {blocos.map((b) => (
            <li key={b.posicao}>{b.rotulo}</li>
          ))}
        </ol>

        <p className="mt-5 text-[13px] font-semibold text-unooria-neutral-950">O caso Mariana</p>
        <p className="mt-1 text-[13px] leading-relaxed text-unooria-neutral-800">{dados.mariana.caso}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-unooria-neutral-600">
          A criança escolhe um cartão de cada grupo. A escolha fica registrada, mas não vira nota nem evidência: a
          tela não diz qual era o certo.
        </p>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          {[
            { titulo: "O que aconteceu com o feed dela", cartoes: dados.mariana.mecanismos },
            { titulo: "O que fazer", cartoes: dados.mariana.atitudes },
          ].map((grupo) => (
            <div key={grupo.titulo} className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold text-unooria-neutral-700">{grupo.titulo}</span>
              <ul className="flex flex-col gap-2">
                {grupo.cartoes.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 rounded-lg border border-unooria-neutral-200 p-3" data-cartao={c.id}>
                    <span>
                      <Tag variant={c.certo ? "success" : "neutral"} size="sm">
                        {c.certo ? "o esperado" : "distrator"}
                      </Tag>
                    </span>
                    <span className="text-[13px] leading-relaxed text-unooria-neutral-800">{c.texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
