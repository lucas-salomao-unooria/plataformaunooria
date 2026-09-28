import { horaComSegundos } from "@edu/sdk";
import { notFound } from "next/navigation";

import { Badge, Card, EmptyState, FeedbackAlert, MetricCard, ScrollBar } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { RotuloDaTrilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  MISSAO_UNOOGPT,
  buscarMissao,
  rotaDaMissao,
} from "@/lib/entre-redes/catalogo";
import {
  cronometro,
  descreverMarco,
  envioEmTexto,
  envioNoCartao,
  faseEmTexto,
  horaDaCidade,
  quandoDoMarco,
} from "@/lib/unoogpt-leitura";
import type { LinhaDeLeitura, RelatorioDoEstudante } from "@/lib/unoogpt-tipos";

/**
 * A linha de UMA criança na Missão Tempestade.
 *
 * DUAS REGRAS QUE ESTA TELA CARREGA, e as duas vêm da app-70:
 *
 * 1. O relatório abre pelo que a missão MEDIU, em GRAUS — e `zero` ("teve a
 *    chance e não foi") nunca se confunde com `none` ("a oportunidade não
 *    chegou"). Número só aparece na variante `scored`; nas outras a api manda
 *    `null` POR TIPO, e a tela fica estruturalmente incapaz de imprimir
 *    "Poder 100" a partir de um sinal só.
 * 2. Só o PROFESSOR da escola chega aqui. Não existe rota de gestor para esta
 *    função — é controller separado na api, não `@Roles` misto com exceção por
 *    método. A transcrição é caixa livre escrita por menor de idade.
 *
 * E uma terceira, desta tela: o NÚMERO DE RESGATE fica aqui, uma criança por
 * vez, nunca na folha da turma — listagem é ordenável, e ordenar crianças por
 * acerto viraria ranking. Tudo o que é TEMPO (quando falou, com quanto relógio
 * carregou fonte, se estourou ao confirmar) vem da trilha gravada pela api com
 * o relógio do instante (ADR-64), não da telemetria.
 */
/**
 * Uma cor por GRAU, e as quatro chaves são obrigatórias: `Record` sobre a união
 * faz o compilador cobrar a variante que faltar. `none` é neutro de propósito —
 * "a oportunidade não chegou" não é um resultado ruim, é a ausência de um.
 */
const COR_DO_GRAU: Record<LinhaDeLeitura["grau"], "success" | "info" | "warning" | "neutral"> = {
  scored: "success",
  indicative: "info",
  zero: "warning",
  none: "neutral",
};

const ROTULO_DO_GRAU: Record<LinhaDeLeitura["grau"], string> = {
  scored: "medido",
  indicative: "indício",
  zero: "teve a chance e não foi",
  none: "a oportunidade não chegou",
};

export default async function EstudantePage({
  params,
}: {
  params: Promise<{ ano: string; unidade: string; estudanteId: string }>;
}) {
  const { ano: anoSlug, unidade: unidadeSlug, estudanteId } = await params;
  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  if (!encontrado || encontrado.missao.expId !== MISSAO_UNOOGPT.expId) notFound();
  const { missao } = encontrado;

  const relatorio = await apiDoServidor<RelatorioDoEstudante>(
    `/unoogpt/professor/estudantes/${encodeURIComponent(estudanteId)}`,
  ).catch(async () => {
    return apiDoServidor<RelatorioDoEstudante>(
      `/unoogpt/professor/estudantes/${encodeURIComponent(estudanteId)}`,
    );
  });

  const rotaResultados = `${rotaDaMissao(missao)}/resultados`;

  if (!relatorio) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos abrir este estudante"
          description="Confira se ele é da sua escola e tente de novo."
        />
        <div>
          <LinkButton href={rotaResultados} variant="secondary">
            Voltar para a turma
          </LinkButton>
        </div>
      </div>
    );
  }

  const nomeEstudante = relatorio.estudante!.nome;
  const ultima = relatorio.tentativas[relatorio.tentativas.length - 1];
  const rodadas = relatorio.rodadas ?? [];
  // A PRIMEIRA rodada com fala é o "abriu a missão" que o pedido mede; as
  // seguintes começam com a criança já sabendo o que perguntar.
  const primeiraComFala = rodadas.find((r) => r.ateAPrimeiraFala !== null);
  const ateAPrimeiraFala = primeiraComFala?.ateAPrimeiraFala ?? null;
  const ultimaRodada = rodadas[rodadas.length - 1];
  const ultimoEnvio = [...rodadas].reverse().find((r) => r.envio !== null)?.envio ?? null;
  const recomecos = rodadas.filter((r) => r.recomeco !== null).length;
  const varias = rodadas.length > 1;

  return (
    <div className="flex flex-col gap-6">
      {/* A trilha vem do layout; o nome do estudante só existe nesta leitura.
          Na saída sem relatório ele não existe, e o item fica "Estudante". */}
      <RotuloDaTrilha valor={nomeEstudante} />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          {missao.titulo}
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          {nomeEstudante}
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          {relatorio.resumo}
        </p>
      </header>

      {/* O NÍVEL antes do que ela fez: sem isto o adulto conclui coisa sobre a
          criança que o instrumento não mediu. */}
      <FeedbackAlert
        type="info"
        title="Como ler este relatório"
        description="Isto NÃO é nota. A missão sorteia o desfecho, e a mesma decisão dá números diferentes a cada rodada — por isso 'resgatados' aqui é contexto, não desempenho. O que a missão mede é conduta: em que ordem ela olhou as coisas, e se decidiu com dado ou sem."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Rodadas enfrentadas" value={relatorio.tentativas.length} />
        <MetricCard
          title="Resgatados na última"
          value={ultima?.salvas.toLocaleString("pt-BR") ?? "—"}
        />
        <MetricCard title="Falas na conversa" value={relatorio.conversa.length} />
        {/* Dois relógios, e a tela escolhe o da LARGADA: antes dela o campo
            está bloqueado, então "desde o Começar" mediria o professor. Sem
            largada registrada, cai no outro e diz isso. */}
        <MetricCard
          title="Até a primeira fala"
          value={
            ateAPrimeiraFala?.desdeALargada != null
              ? cronometro(ateAPrimeiraFala.desdeALargada)
              : ateAPrimeiraFala?.desdeOComecar != null
                ? `${cronometro(ateAPrimeiraFala.desdeOComecar)}*`
                : "—"
          }
        />
        <MetricCard
          title="Mudanças de destino"
          value={ultimaRodada ? ultimaRodada.mudancasDeDestino : "—"}
        />
        {/* `envioNoCartao`, e não `envioEmTexto`: o valor do `MetricCard` é
            `nowrap` a 36px, e a frase inteira VAZA para fora do cartão. O
            motivo de o tempo ter acabado fica na nota abaixo e, por extenso,
            em "Como usou o tempo". */}
        <MetricCard
          title="Ao confirmar"
          value={ultimoEnvio ? envioNoCartao(ultimoEnvio) : "—"}
        />
      </div>
      <p className="-mt-3 text-[12px] leading-snug text-unooria-neutral-500">
        “Até a primeira fala” conta da largada do professor; com asterisco, do clique em
        Começar (a turma não tinha largada registrada). “Ao confirmar” é o que o relógio
        marcava no envio: o tempo que faltava, “esgotado” se ele já tinha fechado, ou
        “sem relógio” no modo livre. Ele e “Mudanças de destino” são da última rodada; o
        detalhe de cada uma — inclusive por que o tempo acabou — está em “Como usou o tempo”.
      </p>

      <Card variant="elevated" title="O que a missão mediu">
        <ul className="flex flex-col gap-3">
          {relatorio.linhas.map((l) => (
            <li key={l.conduta} className="flex flex-col gap-1 border-b border-unooria-neutral-100 pb-3 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-unooria-neutral-950">{l.nome}</span>
                <Badge variant={COR_DO_GRAU[l.grau]}>{ROTULO_DO_GRAU[l.grau]}</Badge>
                {/* Número SÓ na variante `scored`. Nas outras a api manda null. */}
                {l.grau === "scored" && l.numero !== null && (
                  <span className="font-mono text-[14px] font-bold tabular-nums text-unooria-neutral-950">
                    {l.numero}
                  </span>
                )}
              </div>
              <p className="text-[13px] leading-relaxed text-unooria-neutral-700">{l.texto}</p>
              {l.porQue.length > 0 && (
                <p className="text-[12px] leading-relaxed text-unooria-neutral-500">
                  {l.porQue.join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
        <p className="pt-3 text-[12px] leading-snug text-unooria-neutral-500">
          Leitura versão {relatorio.versaoLeitura}. “Teve a chance e não foi” entra na conta; “a
          oportunidade não chegou” fica de fora — é a distinção mais importante do modelo.
        </p>
      </Card>

      {relatorio.justificativas && (
        <Card variant="outlined" title="Por que cada equipe foi para lá">
          <dl className="grid gap-3 sm:grid-cols-2 text-[14px]">
            <div>
              <dt className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
                Equipe Alfa
              </dt>
              <dd className="text-unooria-neutral-950">{relatorio.justificativas.alfa}</dd>
            </div>
            <div>
              <dt className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
                Equipe Bravo
              </dt>
              <dd className="text-unooria-neutral-950">{relatorio.justificativas.bravo}</dd>
            </div>
          </dl>
          <p className="pt-3 text-[12px] leading-snug text-unooria-neutral-500">
            “Intuição, sem dado” está sempre disponível de propósito: sem essa saída a pergunta
            viraria pegadinha e o estudante aprenderia a mentir para o formulário. Não há resposta certa
            aqui — o software não julga.
          </p>
        </Card>
      )}

      {/* COMO USOU O TEMPO — uma rodada por vez, enfrentada ou não. O relógio
          de cada marco é o que a criança VIA ("faltavam 1:40"), gravado no
          instante pela api; sem ele (modo livre, marco antigo) vale a hora da
          cidade. Quem recomeçou no meio aparece: não há simulação, mas há rastro. */}
      <Card variant="elevated" title="Como usou o tempo">
        {rodadas.length === 0 ? (
          <p className="text-[14px] text-unooria-neutral-700">Esta criança ainda não começou a Missão.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {rodadas.map((r) => {
              const marcos = relatorio.trilha.filter((m) => m.tentativa === r.tentativa);
              return (
                <section
                  key={r.tentativa}
                  data-rodada={r.tentativa}
                  className="flex flex-col gap-2 border-b border-unooria-neutral-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-unooria-neutral-950">
                      Rodada {r.tentativa}
                    </span>
                    <Badge variant={r.enfrentou ? "success" : "neutral"}>
                      {r.enfrentou ? "enfrentou a tempestade" : "não chegou a enviar"}
                    </Badge>
                    {r.recomeco && <Badge variant="warning">recomeçou</Badge>}
                  </div>
                  <dl className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-[11px] uppercase tracking-widest text-unooria-neutral-500">
                        Até a primeira fala
                      </dt>
                      <dd className="text-unooria-neutral-950">
                        {r.ateAPrimeiraFala
                          ? r.ateAPrimeiraFala.desdeALargada != null
                            ? `${cronometro(r.ateAPrimeiraFala.desdeALargada)} da largada`
                            : r.ateAPrimeiraFala.desdeOComecar != null
                              ? `${cronometro(r.ateAPrimeiraFala.desdeOComecar)} do Começar`
                              : "sem referência"
                          : "não falou"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-widest text-unooria-neutral-500">
                        Mudanças de destino
                      </dt>
                      <dd className="text-unooria-neutral-950">
                        {r.mudancasDeDestino}
                        {r.mudancasDeDestino === 0 && r.enfrentou ? " (manteve a primeira escolha)" : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-widest text-unooria-neutral-500">
                        Ao confirmar
                      </dt>
                      <dd className="text-unooria-neutral-950">
                        {r.envio ? `${envioEmTexto(r.envio)} · ${horaDaCidade(r.envio.minuto)} na cidade` : "não confirmou"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-widest text-unooria-neutral-500">
                        Recomeço
                      </dt>
                      <dd className="text-unooria-neutral-950">
                        {r.recomeco
                          ? `${
                              r.recomeco.origem === "resultado"
                                ? "“Tentar de novo”"
                                : r.recomeco.origem === "investigacao"
                                  ? "pela lixeira"
                                  : "sim"
                            }, ${faseEmTexto(r.recomeco)}`
                          : "não"}
                      </dd>
                    </div>
                  </dl>
                  {marcos.length > 0 && (
                    <ol className="mt-1 flex flex-col gap-1 border-l-2 border-unooria-neutral-200 pl-3 text-[13px]">
                      {marcos.map((m) => (
                        <li key={`${m.tentativa}-${m.ordem}`} className="flex flex-wrap gap-x-2">
                          <span className="min-w-[9.5rem] font-mono text-[12px] tabular-nums text-unooria-neutral-500">
                            {quandoDoMarco(m)}
                          </span>
                          <span className="text-unooria-neutral-800">{descreverMarco(m)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>
        )}
        <p className="pt-3 text-[12px] leading-snug text-unooria-neutral-500">
          Quem carrega fonte é o assistente, em resposta ao que a criança perguntou — ela não escolhe
          fonte num painel. “Mudanças de destino” conta combinações distintas antes de enviar, não
          cliques: escolher as duas equipes de uma vez é uma decisão, e justificar não muda o destino.
          {recomecos > 0 && " O professor não libera recomeço: o que ele controla é o relógio, e é ele que aparece ao lado."}
        </p>
      </Card>

      {/* O DESFECHO por tentativa. Aqui, e só aqui, aparece o número de resgate:
          uma criança por vez, com a faixa da mesma decisão ao lado — para o
          professor ler "acima da média" como sorte da rodada, não como mérito. */}
      {relatorio.tentativas.length > 0 && (
        <Card variant="elevated" title="O desfecho de cada tentativa">
          <ScrollBar orientation="both" autoHide className="tabela-rolavel">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-unooria-neutral-500">
                  <th className="py-2 pr-3 font-medium">Rodada</th>
                  <th className="py-2 pr-3 font-medium">Saída</th>
                  <th className="py-2 pr-3 font-medium">Resgatados</th>
                  <th className="py-2 pr-3 font-medium">Em risco</th>
                  <th className="py-2 pr-3 font-medium">Risco coberto</th>
                  <th className="py-2 pr-3 font-medium">Na faixa da decisão</th>
                  <th className="py-2 pr-3 font-medium">Por quê (Alfa · Bravo)</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.tentativas.map((t) => (
                  <tr key={t.ordem} data-tentativa={t.ordem} className="border-t border-unooria-neutral-100">
                    <td className="py-2 pr-3 font-semibold text-unooria-neutral-950">{t.ordem}</td>
                    <td className="py-2 pr-3 text-unooria-neutral-800">{horaDaCidade(t.minutoDaSaida)}</td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-unooria-neutral-950">
                      {t.salvas.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-unooria-neutral-800">
                      {t.emRisco.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-3 text-unooria-neutral-800">
                      {t.coberturaDoRisco === null ? "—" : `${t.coberturaDoRisco}%`}
                    </td>
                    <td className="py-2 pr-3 text-unooria-neutral-800">
                      {`percentil ${t.posicao.percentil} · ${t.posicao.dentroDaFaixa ? "dentro" : "fora"} de ${t.esperado.faixa[0].toLocaleString("pt-BR")}–${t.esperado.faixa[1].toLocaleString("pt-BR")}`}
                    </td>
                    <td className="py-2 pr-3 text-unooria-neutral-800">
                      {t.justificativas ? `${t.justificativas.alfa} · ${t.justificativas.bravo}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBar>
          <p className="pt-3 text-[12px] leading-snug text-unooria-neutral-500">
            “Risco coberto” é a medida da decisão: quanto do risco da cidade os dois bairros escolhidos
            cobriam — a sorte da rodada mexe no resgate, não nisto. “Na faixa” compara com corridas
            da MESMA decisão: fora dela é sorte ou azar visível, não mérito nem culpa.
          </p>
        </Card>
      )}

      <Card variant="elevated" title="A conversa">
        <div className="flex flex-col gap-3">
          {relatorio.conversa.length === 0 ? (
            <p className="text-[14px] text-unooria-neutral-700">
              Esta criança ainda não falou com o assistente.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {relatorio.conversa.map((f, i) => {
                const anterior = relatorio.conversa[i - 1];
                const abreRodada = varias && (!anterior || anterior.tentativa !== f.tentativa);
                const estudante = f.papel === "estudante";
                return (
                  <li key={`${f.criadoEm}-${i}`} className="flex flex-col gap-2">
                    {abreRodada && (
                      <p className="pt-2 text-[11px] uppercase tracking-widest text-unooria-neutral-500">
                        Rodada {f.tentativa}
                      </p>
                    )}
                    <div
                      className={`rounded-lg p-3 text-[13px] leading-relaxed ${
                        estudante
                          ? "bg-unooria-neutral-100 text-unooria-neutral-950"
                          : "border border-unooria-neutral-200 text-unooria-neutral-800"
                      }`}
                    >
                      <span className="mr-2 text-[11px] uppercase tracking-widest text-unooria-neutral-500">
                        {estudante ? "estudante" : "assistente"}
                        {/* A hora de ENVIO, pelo relógio da aula: "aos 0:42". */}
                        {f.segundosDesdeALargada !== null
                          ? ` · aos ${cronometro(f.segundosDesdeALargada)}`
                          : ` · ${horaComSegundos(f.criadoEm)}`}
                        {f.debitou && " · gastou pergunta"}
                      </span>
                      {f.texto}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <p className="pt-3 text-[12px] leading-snug text-unooria-neutral-500">
          Esta transcrição não vai a log nem à telemetria, e nenhuma rota de gestor a alcança.
        </p>
      </Card>

      <div>
        <LinkButton href={rotaResultados} variant="secondary">
          Voltar para a turma
        </LinkButton>
      </div>
    </div>
  );
}
