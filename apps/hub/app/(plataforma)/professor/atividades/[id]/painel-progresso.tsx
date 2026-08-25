"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  AlertBox,
  Card,
  MetricCard,
  ProgressBar,
  Stepper,
  Tag,
} from "@edu/ui/ds";
import type { ProgressoGeracao } from "@/lib/insta-tipos";

type Etapa = ProgressoGeracao["etapa"];

/** Ordem real do pipeline (doc 05): cada etapa só começa quando a anterior fecha. */
const ETAPAS: { chave: Etapa; rotulo: string; apoio: string }[] = [
  { chave: "personas", rotulo: "Perfis", apoio: "personas fictícias" },
  { chave: "posts", rotulo: "Posts", apoio: "legendas e comentários" },
  { chave: "imagens", rotulo: "Imagens", apoio: "uma por publicação" },
  { chave: "validacao", rotulo: "Revisão", apoio: "proporções e guardrails" },
];

const ROTULO_ETAPA: Record<Etapa, string> = {
  personas: "Criando os perfis fictícios",
  posts: "Escrevendo os posts",
  imagens: "Gerando as imagens",
  validacao: "Validando o conteúdo",
  concluido: "Concluído",
};

/**
 * Texto da barra. Precisa concordar com o número que a barra mostra: dizer
 * "iniciando a etapa" com 100% preenchido (o caso de uma etapa de um único
 * job) fazia o painel se contradizer na cara do professor.
 */
function rotuloDaEtapa(feitos: number, total: number): string {
  if (total === 0) return "organizando a fila";
  if (feitos >= total) return "etapa concluída";
  if (total === 1) return "em execução";
  return `${feitos} de ${total} nesta etapa`;
}

/**
 * Progresso da geração, com polling de 2s (doc 07).
 *
 * O feedback é deliberadamente redundante — barra, etapas e números —, porque a
 * geração leva minutos e a dúvida do professor não é "quanto falta", é "isto
 * ainda está andando?". Por isso a barra tem um pulso de atividade e há um
 * carimbo de última atualização: um número que muda prova movimento; uma barra
 * parada em 40%, não.
 */
export function PainelProgresso({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [progresso, setProgresso] = useState<ProgressoGeracao | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [segundosParado, setSegundosParado] = useState(0);
  const ultimaMudanca = useRef<{ marca: string; quando: number }>({
    marca: "",
    quando: Date.now(),
  });

  useEffect(() => {
    let ativo = true;

    async function consultar() {
      try {
        const resposta = await fetch(`/api/plataforma/atividades/${activityId}/geracao/progresso`, {
          cache: "no-store",
        });
        if (!resposta.ok) throw new Error("progresso indisponível");
        const dados = (await resposta.json()) as ProgressoGeracao;
        if (!ativo) return;

        // Marca de movimento: qualquer contador que ande reinicia o relógio.
        const marca = `${dados.etapa}|${dados.feitos}|${dados.postsCriados}|${dados.imagensOk}`;
        if (marca !== ultimaMudanca.current.marca) {
          ultimaMudanca.current = { marca, quando: Date.now() };
        }
        setSegundosParado(
          Math.round((Date.now() - ultimaMudanca.current.quando) / 1000),
        );

        setProgresso(dados);
        setFalhou(false);
        if (dados.status !== "gerando") router.refresh();
      } catch {
        if (ativo) setFalhou(true);
      }
    }

    void consultar();
    const intervalo = setInterval(() => void consultar(), 2000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [activityId, router]);

  const total = progresso?.total ?? 0;
  const feitos = progresso?.feitos ?? 0;
  const porcentagem = total > 0 ? Math.round((feitos / total) * 100) : 0;
  const etapaAtual = progresso?.etapa;
  const indiceAtual = ETAPAS.findIndex((etapa) => etapa.chave === etapaAtual);

  const passos = ETAPAS.map((etapa, indice) => ({
    id: etapa.chave,
    label: etapa.rotulo,
    description: etapa.apoio,
    status:
      etapaAtual === "concluido" || (indiceAtual >= 0 && indice < indiceAtual)
        ? ("completed" as const)
        : indice === indiceAtual
          ? ("selected" as const)
          : ("default" as const),
  }));

  // Sem total conhecido (a etapa acabou de virar), a barra pulsa em vez de
  // mentir 0%: indeterminado é a informação honesta nesse instante.
  const indeterminada = total === 0;

  return (
    <div className="flex flex-col gap-4">
      {falhou ? (
        <AlertBox
          theme="light"
          variant="warning"
          device="auto"
          description="Perdemos o contato com o progresso. Continuamos tentando."
        />
      ) : null}

      <Card variant="elevated" className="plataforma-largura-cheia">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[16px] font-semibold text-unooria-neutral-950">
              {etapaAtual ? ROTULO_ETAPA[etapaAtual] : "Preparando a geração"}
            </h2>
            <Tag variant={segundosParado > 90 ? "warning" : "info"} size="sm">
              {segundosParado > 90
                ? `sem novidade há ${segundosParado}s`
                : "em andamento"}
            </Tag>
          </div>

          <Stepper steps={passos} orientation="horizontal" size="sm" />

          <ProgressBar
            value={indeterminada ? undefined : porcentagem}
            max={100}
            indeterminate={indeterminada}
            animated
            striped
            variant="brand"
            showValue={!indeterminada}
            valuePosition="inline"
            label={rotuloDaEtapa(feitos, total)}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              title="Posts criados"
              value={String(progresso?.postsCriados ?? 0)}
            />
            <MetricCard
              title="Imagens prontas"
              value={String(progresso?.imagensOk ?? 0)}
            />
            <MetricCard
              title="Na fila"
              value={String(progresso?.imagensPendentes ?? 0)}
            />
            <MetricCard
              title="Arte procedural"
              value={String(progresso?.imagensFallback ?? 0)}
            />
          </div>

          <p className="text-[12px] text-unooria-neutral-500">
            Você pode fechar esta página: a geração continua no servidor e o
            progresso é retomado quando você voltar.
          </p>
        </div>
      </Card>

      {progresso && progresso.erros.length > 0 ? (
        <Card
          variant="outlined"
          title="Itens que falharam"
          className="plataforma-largura-cheia"
        >
          <ul className="flex flex-col gap-1">
            {progresso.erros.map((erro, indice) => (
              <li key={indice} className="text-[12px] text-unooria-neutral-700">
                {erro}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-unooria-neutral-500">
            Imagens que falharam duas vezes viram arte procedural — o feed nunca
            quebra.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
