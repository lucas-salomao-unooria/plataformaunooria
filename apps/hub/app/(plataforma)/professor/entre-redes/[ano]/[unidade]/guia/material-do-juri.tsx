import { Card, Tag } from "@edu/ui/ds";
import { TOTAL_DE_PROJETOS, type MaterialDoJuri } from "@/lib/juri-estadual-tipos";

/**
 * Os BLOCOS VIVOS do guia da exp06ef1b — de `GET /juri-estadual/professor/material`
 * (professor only). UMA chamada, dois blocos, porque são dois momentos da aula:
 *
 * - `GabaritoDoJuri`, no preparo: a REGRA que o feed executou (os pesos e o
 *   limiar do motor) e as peças da regra SE … ENTÃO com a certa marcada
 *   (EF06CO03, ADR-174). O caso Mariana saiu na 0.7.0 (ADR-176);
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
          adaptou; a última leva a conversa para fora da tela. A escada abaixo é para o fechamento, depois da regra
          do feed.
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

  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="elevated" title="A regra do feed e o gabarito — só para você">
        <p className="text-[12px] leading-relaxed text-unooria-neutral-600">
          <strong>Não projete este bloco</strong>: as peças certas da regra são a resposta da etapa final.
        </p>

        <p className="mt-4 text-[13px] font-semibold text-unooria-neutral-950">A regra que o feed executou</p>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-unooria-neutral-800" data-regra-do-feed>
          <li>
            O feed tem {regra.postsNoFeed} publicações e um teto de {regra.minutosNoFeed} minutos, contados pelo servidor
            desde a primeira rolagem; as primeiras são uma de cada área, e a cédula abre quando a última chega ou o
            tempo acaba.
          </li>
          <li>
            Cada curtida soma {regra.pesoDaCurtida} pontos para a área do estande; ficar parado num post por mais de 5
            segundos soma {regra.pesoDaPermanencia}. Descurtir devolve os pontos. Salvar fica registrado, mas não pesa.
            Comentar e compartilhar não contam: o app avisa que estão fechados no julgamento.
          </li>
          <li>
            Quando uma área chega a {regra.limiar} pontos, o resto do feed é só dela — outros projetos da mesma área,
            nenhum repetido, sem aviso nenhum na tela. É a regra “se… então…” que a criança monta depois da galeria.
          </li>
          <li>
            Com {TOTAL_DE_PROJETOS} estandes e {regra.postsNoFeed} publicações, todo computador que chega ao fim do feed
            fica com {TOTAL_DE_PROJETOS - regra.postsNoFeed} estandes fora dele — o número é o mesmo para todos. O que
            muda é QUAIS áreas sumiram: a Galeria Oculta mostra a cada um quantos viu de cada área e o feed que ele
            teria visto “sem as suas curtidas”.
          </li>
        </ul>

        <p className="mt-5 text-[13px] font-semibold text-unooria-neutral-950">A regra SE … ENTÃO, peça por peça</p>
        <p className="mt-1 text-[12px] leading-relaxed text-unooria-neutral-600">
          As peças chegam embaralhadas, em ordem diferente em cada computador. Uma tentativa só: as duas certas
          atingem, uma fica em processo, nenhuma não atinge. Depois do envio, a tela mostra a regra certa ligada ao feed
          da criança.
        </p>
        <div className="mt-2 grid gap-3 lg:grid-cols-2" data-pecas-da-regra>
          {[
            { titulo: "SE — a condição", pecas: dados.pecas.se },
            { titulo: "ENTÃO — a ação", pecas: dados.pecas.entao },
          ].map((lado) => (
            <div key={lado.titulo} className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold text-unooria-neutral-700">{lado.titulo}</span>
              <ul className="flex flex-col gap-2">
                {lado.pecas.map((p) => (
                  <li key={p.texto} className="flex flex-col gap-1 rounded-lg border border-unooria-neutral-200 p-3">
                    <span>
                      <Tag variant={p.certa ? "success" : "neutral"} size="sm">
                        {p.certa ? "a certa" : "distrator"}
                      </Tag>
                    </span>
                    <span className="text-[13px] leading-relaxed text-unooria-neutral-800">{p.texto}</span>
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
