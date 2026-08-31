import { notFound } from "next/navigation";

import { Badge, Card, EmptyState, FeedbackAlert, MetricCard } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  MISSAO_UNOOGPT,
  buscarMissao,
  rotaDaMissao,
  rotuloDaMissao,
} from "@/lib/entre-redes/catalogo";
import type { LinhaDeLeitura, RelatorioDoEstudante } from "@/lib/unoogpt-tipos";

/**
 * A linha de UMA criança na Missão Tempestade.
 *
 * DUAS REGRAS QUE ESTA TELA CARREGA, e as duas vêm da exp-70:
 *
 * 1. O relatório abre pelo que a missão MEDIU, em GRAUS — e `zero` ("teve a
 *    chance e não foi") nunca se confunde com `none` ("a oportunidade não
 *    chegou"). Número só aparece na variante `scored`; nas outras a api manda
 *    `null` POR TIPO, e a tela fica estruturalmente incapaz de imprimir
 *    "Poder 100" a partir de um sinal só.
 * 2. Só o PROFESSOR da escola chega aqui. Não existe rota de gestor para esta
 *    função — é controller separado na api, não `@Roles` misto com exceção por
 *    método. A transcrição é caixa livre escrita por menor de idade.
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
  const { ano, missao } = encontrado;

  const relatorio = await apiDoServidor<RelatorioDoEstudante>(
    `/unoogpt/professor/estudantes/${encodeURIComponent(estudanteId)}`,
  ).catch(async () => {
    return apiDoServidor<RelatorioDoEstudante>(
      `/unoogpt/professor/alunos/${encodeURIComponent(estudanteId)}`,
    );
  });

  const rotaResultados = `${rotaDaMissao(missao)}/resultados`;

  if (!relatorio) {
    return (
      <div className="flex flex-col gap-6">
        <Trilha
          itens={[
            { label: "Início", href: "/professor" },
            { label: "Entre Redes", href: "/professor/entre-redes" },
            { label: rotuloDaMissao(ano, missao), href: rotaDaMissao(missao) },
            { label: "Estudante" },
          ]}
        />
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
  const desfecho = ultima?.desfecho as { totais?: { salvas?: number; emRisco?: number } } | undefined;

  return (
    <div className="flex flex-col gap-6">
      <Trilha
        itens={[
          { label: "Início", href: "/professor" },
          { label: "Entre Redes", href: "/professor/entre-redes" },
          { label: rotuloDaMissao(ano, missao), href: rotaDaMissao(missao) },
          { label: nomeEstudante },
        ]}
      />

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
          value={desfecho?.totais?.salvas?.toLocaleString("pt-BR") ?? "—"}
        />
        <MetricCard title="Falas na conversa" value={relatorio.conversa.length} />
      </div>

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

      <Card variant="elevated" title="A conversa">
        <div className="flex flex-col gap-3">
          {relatorio.conversa.length === 0 ? (
            <p className="text-[14px] text-unooria-neutral-700">
              Esta criança ainda não falou com o assistente.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {relatorio.conversa.map((f, i) => (
                <li
                  key={`${f.criadoEm}-${i}`}
                  className={`rounded-lg p-3 text-[13px] leading-relaxed ${
                    f.papel === "estudante" || (f.papel as string) === "aluno"
                      ? "bg-unooria-neutral-100 text-unooria-neutral-950"
                      : "border border-unooria-neutral-200 text-unooria-neutral-800"
                  }`}
                >
                  <span className="mr-2 text-[11px] uppercase tracking-widest text-unooria-neutral-500">
                    {f.papel === "estudante" || (f.papel as string) === "aluno" ? "estudante" : "assistente"}
                    {f.debitou && " · gastou pergunta"}
                    {relatorio.tentativas.length > 1 && ` · rodada ${f.tentativa}`}
                  </span>
                  {f.texto}
                </li>
              ))}
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
