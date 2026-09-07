import { notFound } from "next/navigation";

import { Badge, Card, EmptyState, FeedbackAlert, ScrollBar } from "@edu/ui/ds";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import { buscarMissaoTransversal, rotaDaTransversal } from "@/lib/entre-redes/catalogo";
import {
  DESCRICAO_BOLHA,
  rotuloDoCartao,
  tempoDecisao,
  type RelatorioDaPartida,
} from "@/lib/vila-tipos";

import { EixosDoCircumplexo } from "./eixos-do-circumplexo";

export const metadata = { title: "Vila do Lume · estudante — Plataforma Unooria" };

const TOM: Record<"bom" | "ruim" | "neutro", "success" | "error" | "disable"> = {
  bom: "success",
  ruim: "error",
  neutro: "disable",
};

function duracao(seg: number | null): string {
  if (seg === null) return "—";
  return `${Math.floor(seg / 60)}min ${String(seg % 60).padStart(2, "0")}s`;
}

/**
 * O relatório de UMA partida de UMA criança.
 *
 * ## As travas de leitura, e por que cada uma existe
 *
 * **Nenhum número aparece sem duas fontes de medida.** A decisão já veio tomada
 * da api: a linha `scored` tem `numero: number`, as outras têm `null` por TIPO.
 * Esta tela não poderia imprimir "Poder 100" a partir de um sinal só nem se
 * alguém tentasse — o `tsc` recusaria.
 *
 * **Os dez valores aparecem sempre, inclusive os sem número.** Mostrar só os
 * quatro que deram número faria a página parecer um retrato completo. O que não
 * foi observado é dito com todas as letras, no mesmo tamanho de letra.
 *
 * **A seção das mensagens abre pelo NÍVEL que ela recebeu**, antes do que ela
 * fez. "Caiu em 2 de 3" sem dizer que era o nível C faz o adulto concluir que a
 * criança é ingênua — e esse é o rótulo que este projeto existe para não
 * produzir.
 *
 * **Amostra insuficiente engole a frase do topo.** Quatro minutos de jogo não
 * sustentam frase nenhuma, e uma frase mal-calibrada no topo é a coisa que o
 * professor vai lembrar depois de fechar a tela.
 */
export default async function EstudanteDaVilaPage({
  params,
}: {
  params: Promise<{ estudanteId: string }>;
}) {
  const { estudanteId } = await params;
  const missao = buscarMissaoTransversal("vila-do-lume");
  if (!missao) notFound();
  const rota = rotaDaTransversal(missao);

  const resposta = await apiDoServidor<{ relatorio: RelatorioDaPartida | null }>(
    `/vila/professor/estudantes/${encodeURIComponent(estudanteId)}`,
  ).catch(async () => {
    return apiDoServidor<{ relatorio: RelatorioDaPartida | null }>(
      `/vila/professor/estudantes/${encodeURIComponent(estudanteId)}`,
    );
  });
  const relatorio = resposta?.relatorio ?? null;

  const trilha = [
    { label: "Início", href: "/professor" },
    { label: "Entre Redes", href: "/professor/entre-redes" },
    { label: missao.titulo, href: rota },
    { label: "Resultados da turma", href: `${rota}/resultados` },
    { label: "Estudante" },
  ];

  if (!relatorio) {
    return (
      <div className="flex flex-col gap-6">
        <Trilha itens={trilha} />
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Este estudante ainda não terminou uma partida"
          description="O relatório aparece depois da primeira partida concluída."
        />
      </div>
    );
  }

  const { perfil, mensagens } = relatorio;
  const bolha = DESCRICAO_BOLHA[relatorio.bolha];

  const feitos = [
    { rotulo: "Fogueiras acesas", valor: `${relatorio.resumo.fogueirasAcesas}/8` },
    { rotulo: "Aldeões ajudados", valor: `${relatorio.resumo.aldeoesAjudados}/4` },
    { rotulo: "Lampiões acesos", valor: `${relatorio.resumo.lampioesAcesos}/6` },
    { rotulo: "Pedras quebradas", valor: String(relatorio.resumo.pedrasQuebradas) },
    { rotulo: "Dilemas vistos", valor: String(relatorio.resumo.dilemasVistos) },
    { rotulo: "Andou", valor: `${relatorio.resumo.distanciaM} m` },
    { rotulo: "Tempo de jogo", valor: duracao(relatorio.duracaoSeg) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Trilha itens={trilha} />

      <header className="flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          {missao.titulo}
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          Relatório da partida
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-unooria-neutral-600">
          <Badge variant={relatorio.status === "completa" ? "success" : "warning"}>
            {relatorio.status === "completa" ? "Terminou a vila" : "Abandonou no meio"}
          </Badge>
          <span>
            {new Date(relatorio.abertaEm).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span>· {duracao(relatorio.duracaoSeg)} de jogo</span>
        </div>
      </header>

      {/*
        A ressalva vem ANTES de qualquer número, e não é enfeite: o que esta
        página mostra é hipótese de design, não instrumento validado. Schwartz se
        valida por questionário (PVQ, PBVS-C para crianças), não por telemetria
        de jogo.
      */}
      <FeedbackAlert
        type="info"
        title="Isto é uma leitura de uma partida, não um teste"
        description="O mapeamento comportamento → valor é uma hipótese de design: plausível e explicável, nunca uma medida. Descreve o que apareceu nesta partida, e não quem a criança é. Não leia na frente dela."
      />

      <Card variant="elevated" title="O que ela fez na vila">
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {feitos.map((f) => (
            <div key={f.rotulo} className="flex items-baseline justify-between gap-2 border-b border-unooria-neutral-100 py-1.5">
              <span className="text-[13px] text-unooria-neutral-600">{f.rotulo}</span>
              <span className="text-[14px] font-semibold text-unooria-neutral-950">{f.valor}</span>
            </div>
          ))}
        </div>
      </Card>

      {perfil === null ? (
        <EmptyState
          variant="no-data"
          bordered
          fullWidth
          title="Esta partida não gerou retrato de valores"
          description="Ela foi abandonada no meio. Quem larga no meio não escolheu nada que se possa ler — e um retrato a partir de dois minutos de jogo diria mais sobre o cansaço da criança do que sobre valores. Os dados brutos ficaram guardados."
        />
      ) : (
        <>
          {perfil.amostraSuficiente ? (
            <Card variant="elevated">
              <p className="text-[15px] leading-relaxed text-unooria-neutral-900">{perfil.frase}</p>
            </Card>
          ) : (
            <FeedbackAlert
              type="warning"
              title="Partida curta demais para dizer qualquer coisa"
              description="Vale como uma sessão de jogo, não como leitura. Os números abaixo aparecem para registro, e não sustentam conclusão sobre a criança."
            />
          )}

          <Card
            variant="elevated"
            title="Os dez valores"
            /* Os dez, sempre. Mostrar só os que deram número faria a página
               parecer um retrato completo quando ela é parcial por construção. */
          >
            <div className="flex flex-col">
              {perfil.linhas.map((linha) => (
                <div
                  key={linha.valor}
                  className="flex flex-col gap-1 border-b border-unooria-neutral-100 py-2.5 last:border-b-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-[14px] font-semibold text-unooria-neutral-950">
                      {linha.nome}
                    </span>
                    {linha.grau === "scored" ? (
                      <span className="text-[14px] font-bold tabular-nums text-unooria-neutral-950">
                        {linha.numero}
                      </span>
                    ) : (
                      <span className="text-[12px] italic text-unooria-neutral-500">
                        {linha.texto}
                      </span>
                    )}
                  </div>
                  {linha.grau === "scored" ? (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-unooria-neutral-100">
                      {/* Escala FIXA de 0 a 100. Sem ela, cada linha se
                          normalizaria pela maior e um 12 pareceria forte. */}
                      <div
                        className="h-full rounded-full bg-unooria-navy-800"
                        style={{ width: `${linha.numero}%` }}
                      />
                    </div>
                  ) : null}
                  <span className="text-[12px] leading-snug text-unooria-neutral-600">
                    {linha.comportamento}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-unooria-neutral-600">
              Valor com <strong>uma fonte de medida só não recebe número</strong>: um único ato
              num objeto que convida a ser mexido é rótulo, não medida. E{" "}
              <strong>&quot;a oportunidade não chegou&quot; é diferente de zero</strong> — zero é
              ter tido a chance e não ter ido.
            </p>
          </Card>

          <Card variant="elevated" title="Como os valores se opõem">
            <EixosDoCircumplexo
              aberturaVsConservacao={perfil.aberturaVsConservacao}
              transcendenciaVsAutopromocao={perfil.transcendenciaVsAutopromocao}
            />
          </Card>
        </>
      )}

      {/* ---------------- A missão das mensagens ---------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[18px] font-bold text-unooria-neutral-950">
          A Noite Longa — as mensagens
        </h2>

        {/*
          O NÍVEL VEM PRIMEIRO, sempre — antes de qualquer contagem. É a regra que
          atravessa esta seção inteira.
        */}
        <Card variant="outlined">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-unooria-navy-800 text-[12px] font-bold text-white">
                {relatorio.bolha}
              </span>
              <span className="text-[15px] font-semibold text-unooria-neutral-950">
                O golpe que ela recebeu: {bolha.titulo}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-unooria-neutral-700">{bolha.texto}</p>
          </div>
        </Card>

        {mensagens === null ? (
          <EmptyState
            variant="no-data"
            bordered
            fullWidth
            title="As mensagens não chegaram nesta partida"
            /* Isto NÃO é "ela ignorou tudo", e a diferença é a mesma que separa
               zero de não-observado no perfil. */
            description={`A plataforma tinha ${relatorio.cartoesServidos} mensagens preparadas para ela, e nenhuma chegou a aparecer — a partida pode ter sido curta demais para os momentos em que elas entram. Não há nada a ler aqui sobre o julgamento dela.`}
          />
        ) : (
          <>
            <Card variant="elevated">
              <p className="text-[15px] leading-relaxed text-unooria-neutral-900">
                {mensagens.leitura}
              </p>
            </Card>

            <Card variant="elevated" title="Mensagem por mensagem">
              <ScrollBar orientation="both" autoHide className="tabela-rolavel">
                <table className="w-full min-w-[520px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-unooria-neutral-200 text-left text-[12px] uppercase tracking-wider text-unooria-neutral-500">
                      <th className="py-2 pr-3 font-semibold">Quando</th>
                      <th className="py-2 pr-3 font-semibold">Era</th>
                      <th className="py-2 pr-3 font-semibold">O que ela fez</th>
                      <th className="py-2 font-semibold">Decidiu em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mensagens.cartoes.map((cartao) => {
                      const rotulo = rotuloDoCartao(cartao);
                      return (
                        <tr key={cartao.id} className="border-b border-unooria-neutral-100">
                          <td className="py-2.5 pr-3 tabular-nums text-unooria-neutral-600">
                            {Math.floor(cartao.emMs / 60000)}:
                            {String(Math.floor((cartao.emMs % 60000) / 1000)).padStart(2, "0")}
                          </td>
                          <td className="py-2.5 pr-3 text-unooria-neutral-700">
                            {cartao.legitima ? "verdadeira" : "golpe"}
                            {cartao.nivel === "comum" ? "" : ` · nível ${cartao.nivel}`}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge variant={TOM[rotulo.tom]}>{rotulo.texto}</Badge>
                          </td>
                          <td className="py-2.5 tabular-nums text-unooria-neutral-700">
                            {tempoDecisao(cartao.decisaoMs)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollBar>
              <p className="mt-3 text-[12px] leading-relaxed text-unooria-neutral-600">
                <strong>O tempo de decisão é a coluna mais informativa.</strong> Cair em dois
                segundos e cair depois de dez são duas crianças diferentes: a primeira não
                avaliou, a segunda avaliou e foi convencida. E{" "}
                <strong>&quot;nem viu as opções&quot;</strong> não é o mesmo que{" "}
                <strong>&quot;deixou passar&quot;</strong> — na primeira ela nunca teve chance
                real de responder.
              </p>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}
