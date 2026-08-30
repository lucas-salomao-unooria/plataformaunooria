import { notFound } from "next/navigation";

import { Badge, Card } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  MISSAO_ATUAL,
  buscarMissao,
  rotaDaMissao,
  rotuloDaMissao,
} from "@/lib/entre-redes/catalogo";
import { antagonismoSchema, type Antagonismo } from "@/lib/insta-tipos";
import { statusDaAtividade } from "@/lib/status-atividade";

import { LimparSessoes } from "./limpar-sessoes";
import { PainelAntagonismo } from "./painel-antagonismo";
import { PainelMonitor } from "./painel-monitor";
import { PainelPerfis } from "./painel-perfis";
import { PainelProgresso } from "./painel-progresso";
import { PainelRevisao } from "./painel-revisao";

/**
 * Shape esperado de `GET /atividades/:id` na api — os MESMOS campos que o
 * select do prisma da página original pedia. A api escopa por professor a
 * partir do token (o middleware protege a rota; a sessão não é lida aqui).
 */
interface AtividadeDetalhe {
  id: string;
  titulo: string;
  disciplina: string;
  recorte: string;
  perguntaChave: string;
  status: string;
  qtdPostsTese: number;
  estiloVisual: string;
  categoriasNeutras: string[];
  neutrosNoTema: string[];
  /** JSON de `activities.proporcoes` (doc 06) — validado localmente. */
  proporcoes: unknown;
  /** JSON do antagonismo aprovado — validado com `antagonismoSchema`. */
  antagonismo: unknown;
  /** A turma desta atividade. `null` = atividade anterior à coluna `turma_id`:
   *  ela vale para a escola inteira. */
  turma: { id: string; nome: string; serie: string } | null;
  _count: { runs: number };
}

/**
 * Lê a configuração de neutros de `activities.proporcoes` (doc 06) com defaults
 * seguros: atividade antiga pode não ter o bloco, e o painel não pode explodir
 * por isso.
 */
function neutrosDaAtividade(bruto: unknown): {
  ativo: boolean;
  modo: string;
  proporcao: number;
} {
  const neutros = (bruto as { neutros?: Record<string, unknown> } | null)?.neutros;
  return {
    ativo: typeof neutros?.ativo === "boolean" ? neutros.ativo : true,
    modo: typeof neutros?.modo === "string" ? neutros.modo : "ambos",
    proporcao: typeof neutros?.proporcao === "number" ? neutros.proporcao : 0.4,
  };
}

export default async function AtividadePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const resposta = await apiDoServidor<{ atividade: AtividadeDetalhe }>(
    `/atividades/${id}`,
  );

  if (!resposta) notFound();
  const { atividade } = resposta;

  const status = statusDaAtividade(atividade.status);

  // MISSÃO ÚNICA: toda atividade nasce da Unidade 1 do 8º ano enquanto ela for a
  // única publicada (nota de modelagem em lib/entre-redes/catalogo.ts).
  const missaoDaAtividade = buscarMissao(
    MISSAO_ATUAL.anoSlug,
    MISSAO_ATUAL.unidadeSlug,
  );
  const parse = antagonismoSchema.safeParse(atividade.antagonismo);
  const antagonismo: Antagonismo | null = parse.success ? parse.data : null;

  return (
    <div className="flex flex-col gap-6">
      <Trilha
        itens={[
          { label: "Início", href: "/professor" },
          { label: "Entre Redes", href: "/professor/entre-redes" },
          ...(missaoDaAtividade
            ? [
                {
                  label: rotuloDaMissao(
                    missaoDaAtividade.ano,
                    missaoDaAtividade.missao,
                  ),
                  href: rotaDaMissao(missaoDaAtividade.missao),
                },
              ]
            : []),
          { label: atividade.titulo },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-unooria-neutral-950">
            {atividade.titulo}
          </h1>
          <p className="text-[14px] text-unooria-neutral-500">
            {atividade.disciplina} · {atividade.recorte} · imagens em{" "}
            {atividade.estiloVisual}
          </p>
        </div>
        <Badge variant={status.variante}>{status.rotulo}</Badge>
      </div>

      {atividade.status === "gerando" ||
      atividade.status === "revisao" ||
      atividade.status === "ativa" ? (
        <Card
          variant="outlined"
          title="Pergunta-chave"
          description={atividade.perguntaChave}
        />
      ) : null}

      {atividade.status === "rascunho" || atividade.status === "antagonismo" ? (
        <PainelAntagonismo
          activityId={atividade.id}
          perguntaChaveInicial={atividade.perguntaChave}
          antagonismoInicial={antagonismo}
          qtdPostsTese={atividade.qtdPostsTese}
          categoriasIniciais={atividade.categoriasNeutras}
          neutrosNoTemaIniciais={atividade.neutrosNoTema}
          neutros={neutrosDaAtividade(atividade.proporcoes)}
        />
      ) : null}

      {/*
        Distribuição da turma (doc 04 §3.1). Aparece a partir de `revisao`: antes
        disso não existe conteúdo.
        Em `encerrada` ela CONTINUA aparecendo, em leitura: a partida da Vila
        pode acontecer depois de a atividade começar (é o que o comentário do
        `importarDaVila` já previa), e o professor precisa poder conferir de onde
        veio o lado de cada aluno quando for ler o relatório. O que some ali é a
        ação — não há o que redistribuir numa atividade encerrada.
      */}
      {atividade.status === "revisao" ||
      atividade.status === "ativa" ||
      atividade.status === "encerrada" ? (
        <PainelPerfis
          activityId={atividade.id}
          ladoALabel={antagonismo?.ladoA.label ?? "Lado A"}
          ladoBLabel={antagonismo?.ladoB.label ?? "Lado B"}
          turma={atividade.turma}
          somenteLeitura={atividade.status === "encerrada"}
        />
      ) : null}

      {atividade.status === "gerando" ? (
        <PainelProgresso activityId={atividade.id} />
      ) : null}

      {atividade.status === "ativa" || atividade.status === "encerrada" ? (
        <PainelMonitor
          activityId={atividade.id}
          ladoALabel={antagonismo?.ladoA.label ?? "Lado A"}
          ladoBLabel={antagonismo?.ladoB.label ?? "Lado B"}
        />
      ) : null}

      {atividade.status === "revisao" ||
      atividade.status === "ativa" ||
      atividade.status === "encerrada" ? (
        <PainelRevisao
          activityId={atividade.id}
          status={atividade.status}
          qtdPostsTese={atividade.qtdPostsTese}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <LinkButton
          href={
            missaoDaAtividade
              ? rotaDaMissao(missaoDaAtividade.missao)
              : "/professor"
          }
          variant="outline"
        >
          Voltar para a missão
        </LinkButton>
        {/*
          A análise da turma (doc 11 §4.2) fica numa tela própria, não numa aba
          desta: ela é para DEPOIS da aula, e misturá-la com o monitor ao vivo
          convidaria o professor a olhar resultado enquanto devia olhar a sala.
        */}
        <LinkButton href={`/professor/atividades/${atividade.id}/analise`} variant="primary">
          Ver análise da turma
        </LinkButton>
        {/*
          Limpar fica no fim da coluna, longe das ações do dia a dia: é destrutivo
          e serve a um momento específico — reaproveitar a atividade com outra
          turma. Excluir a atividade inteira não mora aqui, e sim no card dela
          dentro da missão.
        */}
        <LimparSessoes
          activityId={atividade.id}
          sessoes={atividade._count.runs}
        />
      </div>
    </div>
  );
}
