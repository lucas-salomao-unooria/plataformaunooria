"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AlertBox,
  Badge,
  Button,
  Card,
  MetricCard,
  SemiDonutChart,
  StackedProgressBar,
  UNOORIA_DATAVIZ_PALETTE,
} from "@edu/ui/ds";

import { ModalEstudante } from "./modal-estudante";
import { PainelEtapas } from "./painel-etapas";

interface LinhaMonitor {
  runId: string;
  estudante?: { username: string; displayName: string; avatar: string | null };
  aluno?: { username: string; displayName: string; avatar: string | null };
  fase: string;
  postsConsumidos: number;
  blocos: number;
  dominio: number;
  ladoDominante: "A" | "B" | "neutro";
  escada: { A: number; B: number };
  minutos: number;
  minutosDeFeed: number;
  temDossie: boolean;
  /** > 0 quando ele já escreveu a reflexão — o texto está no popup. */
  caracteresDaReflexao: number;
  publicou: boolean;

  // doc 11 §4.1 — a largada, a virada e a imersão parcial
  ladoInicial: "A" | "B";
  ladoOrigem: string;
  inverteu: boolean;
  perfilJogo: string | null;
  perfilOrigem: string;
  concluiu: boolean;
  imersaoParcial: number;
  colecao: {
    total: number;
    doLadoSemeado: number;
    doOutroLado: number;
    neutros: number;
    comentados: number;
  };
  imersaoComponentes: { chave: string; rotulo: string; pontos: number; detalhe: string }[];
  ociosoHaMs: number | null;
  alertaDeOcioso: boolean;
}

interface RespostaMonitor {
  runs: LinhaMonitor[];
  resumo: {
    total: number;
    emFeed: number;
    concluidas: number;
    inverteram: number;
    concluiram: number;
    salvosNaTurma: number;
    salvosDoOutroLado: number;
    porLadoInicial: { A: number; B: number };
    ladoA: number;
    ladoB: number;
    semLado: number;
  };
  limiteDeOciosidadeMs: number;
}

/** Paleta oficial do DS: as cores dos gráficos saem daqui, não de hex solto. */
const PALETA = UNOORIA_DATAVIZ_PALETTE;

/**
 * Cor de cada etapa na barra da turma.
 *
 * Não é `PALETA[indice]`: as quatro primeiras entradas da paleta são tons de azul
 * quase iguais, e lado a lado numa barra empilhada ficam indistinguíveis. Aqui
 * cada etapa recebe uma cor escolhida por CONTRASTE e por significado — laranja
 * onde o professor precisa agir (respondendo), verde no fim (entregando), quase
 * branco em quem nem entrou.
 */
const COR_DA_FASE: Record<string, string> = {
  onboarding: PALETA[0],
  feed: PALETA[1],
  encerramento: PALETA[2],
  conclusao: PALETA[3],
  debate: PALETA[4],
  explicabilidade: PALETA[5],
  perdidos: PALETA[6],
  reflexao: PALETA[7],
  fim: PALETA[8],
  dossie: PALETA[9],
};

const ORIGEM_DO_LADO: Record<string, string> = {
  perfil: "perfil do jogo",
  sorteio: "sorteado",
  redistribuido: "redistribuído",
};

const FASE: Record<
  string,
  { rotulo: string; variante: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  onboarding: { rotulo: "entrando", variante: "neutral" },
  feed: { rotulo: "no feed", variante: "info" },
  encerramento: { rotulo: "encerrando", variante: "warning" },
  conclusao: { rotulo: "respondendo", variante: "info" },
  debate: { rotulo: "no debate", variante: "neutral" },
  explicabilidade: { rotulo: "explicação", variante: "neutral" },
  perdidos: { rotulo: "o que perdeu", variante: "neutral" },
  reflexao: { rotulo: "reflexão", variante: "warning" },
  fim: { rotulo: "terminou", variante: "success" },
  dossie: { rotulo: "no relatório", variante: "success" },
};

/**
 * Monitor da turma ao vivo (doc 07, polling 5s) + reset de sessão por estudante
 * para reutilizar aparelhos. Só o professor vê lado e domínio.
 */
export function PainelMonitor({
  activityId,
  ladoALabel,
  ladoBLabel,
}: {
  activityId: string;
  ladoALabel: string;
  ladoBLabel: string;
}) {
  const [dados, setDados] = useState<RespostaMonitor | null>(null);
  const [erro, setErro] = useState(false);
  const [resetando, setResetando] = useState<string | null>(null);
  const [estudanteAberto, setEstudanteAberto] = useState<{ runId: string; nome: string } | null>(null);

  const buscar = useCallback(async () => {
    try {
      const resposta = await fetch(`/api/plataforma/atividades/${activityId}/monitor`, {
        cache: "no-store",
      });
      if (!resposta.ok) throw new Error("monitor indisponível");
      setDados((await resposta.json()) as RespostaMonitor);
      setErro(false);
    } catch {
      setErro(true);
    }
  }, [activityId]);

  useEffect(() => {
    void buscar();
    const intervalo = setInterval(() => void buscar(), 5000);
    return () => clearInterval(intervalo);
  }, [buscar]);

  const rotuloLado = (lado: "A" | "B" | "neutro") =>
    lado === "A" ? ladoALabel : lado === "B" ? ladoBLabel : "sem lado ainda";

  /**
   * A distribuição por etapa, na ORDEM da aula — não por tamanho. Uma barra que
   * reordena a cada 5 segundos é ilegível para quem está de olho na sala.
   */
  const ORDEM_DAS_FASES = [
    "onboarding",
    "feed",
    "encerramento",
    "conclusao",
    "debate",
    "explicabilidade",
    "perdidos",
    "reflexao",
    "fim",
  ];

  const porEtapa = ORDEM_DAS_FASES.map((fase) => ({
    label: FASE[fase]?.rotulo ?? fase,
    value: (dados?.runs ?? []).filter((linha) => linha.fase === fase).length,
    color: COR_DA_FASE[fase] ?? PALETA[0],
  })).filter((segmento) => segmento.value > 0);

  /**
   * Quem está parado, do mais parado para o menos. É a única lista desta tela
   * que pede ação na hora (doc 11 §4.1).
   */
  const ociosos = (dados?.runs ?? [])
    .filter((linha) => linha.alertaDeOcioso)
    .sort((a, b) => (b.ociosoHaMs ?? 0) - (a.ociosoHaMs ?? 0));

  return (
    <div className="flex flex-col gap-4">
      {erro ? (
        <AlertBox
          theme="light"
          variant="warning"
          device="auto"
          description="Perdemos o contato com o monitor. Continuamos tentando."
        />
      ) : null}

      {/*
        A turma num relance. Três perguntas, três respostas visuais — e nada de
        parágrafo. A ordem é a das perguntas que o professor faz de fato: onde
        estão, como largaram, e o que a turma coletou.
      */}
      <Card variant="elevated">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-semibold text-unooria-neutral-950">
              A turma agora
            </h2>
            <span className="text-[12px] text-unooria-neutral-500">
              atualiza a cada 5s
            </span>
          </div>

          {/* onde a turma está: uma barra só, legível de longe */}
          {/*
            `subtitle` é obrigatório na prática: sem ele o componente do DS mostra
            o subtítulo de exemplo ("Distribuição de solicitações por status"), que
            não tem nada a ver com uma sala de aula.
          */}
          <StackedProgressBar
            title="Onde a turma está"
            subtitle="cada cor é um momento da aula"
            segments={porEtapa}
            totalLabel="estudantes"
            totalValue={dados?.resumo.total ?? 0}
          />

          {/*
            O `MetricCard` do DS declara `description` mas não renderiza — a
            marcação só tem título, valor e tag. Então o contexto dos três números
            vem numa linha só embaixo, o que também é menos texto na tela.
          */}
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard title="Responderam" value={dados?.resumo.concluiram ?? 0} />
            <MetricCard title="Viraram o jogo" value={dados?.resumo.inverteram ?? 0} />
            <MetricCard title="Posts salvos" value={dados?.resumo.salvosNaTurma ?? 0} />
          </div>
          <p className="-mt-2 text-[12px] leading-snug text-unooria-neutral-600">
            de {dados?.resumo.total ?? 0} na atividade · quem virou o jogo terminou no lado oposto ao
            que recebeu · {dados?.resumo.salvosDoOutroLado ?? 0} dos posts salvos são do outro lado
          </p>

          {/* como largaram: o equilíbrio da turma, que decide se vale redistribuir */}
          <div className="grid gap-3 sm:grid-cols-2">
            <SemiDonutChart
              title="Como o feed de cada um nasceu"
              subtitle="o lado vem do perfil do Ato 1"
              data={[
                {
                  label: ladoALabel,
                  value: dados?.resumo.porLadoInicial.A ?? 0,
                  color: PALETA[0],
                },
                {
                  label: ladoBLabel,
                  value: dados?.resumo.porLadoInicial.B ?? 0,
                  color: PALETA[1],
                },
              ]}
              size={150}
            />
            <SemiDonutChart
              title="Onde a bolha fechou"
              subtitle="lado dominante no fim da investigação"
              data={[
                { label: ladoALabel, value: dados?.resumo.ladoA ?? 0, color: PALETA[0] },
                { label: ladoBLabel, value: dados?.resumo.ladoB ?? 0, color: PALETA[1] },
                { label: 'sem lado', value: dados?.resumo.semLado ?? 0, color: PALETA[4] },
              ]}
              size={150}
            />
          </div>
        </div>
      </Card>


      {/*
        O relógio da aula vem primeiro: é o único card desta tela em que o
        professor AGE sobre a turma. O resto é leitura.
      */}
      <PainelEtapas activityId={activityId} />

      {/*
        O alerta de ociosidade vem antes da tabela porque é o único elemento
        desta tela que pede ação imediata na sala (doc 11 §4.1). Todo o resto é
        informação para depois.
      */}
      {ociosos.length > 0 ? (
        <AlertBox
          theme="light"
          variant="warning"
          device="auto"
          title={`${ociosos.length} estudante(s) parado(s) há mais de ${Math.round((dados?.limiteDeOciosidadeMs ?? 120000) / 60000)} min`}
          description={ociosos
            .map((linha) => `${(linha.estudante ?? linha.aluno)?.displayName} (${Math.round((linha.ociosoHaMs ?? 0) / 60000)} min)`)
            .join(" · ")}
        />
      ) : null}

      <ModalEstudante
        activityId={activityId}
        runId={estudanteAberto?.runId ?? null}
        nome={estudanteAberto?.nome ?? ""}
        aoFechar={() => setEstudanteAberto(null)}
      />

      <div className="overflow-x-auto rounded-xl border border-unooria-neutral-200">
        <table className="w-full min-w-[980px] border-collapse text-left">
          {/*
            Sete colunas, não dez. Domínio, escalada e contagem de posts saíram
            para o popup do estudante: são leitura de detalhe, e numa tabela de 40
            linhas competiam com o que se lê de relance. O que ficou responde
            "quem é, onde está, o que coletou e quanto se envolveu".
          */}
          <thead className="bg-unooria-neutral-100">
            <tr className="text-[12px] text-unooria-neutral-700">
              <th className="px-3 py-2 font-semibold">Estudante</th>
              <th className="px-3 py-2 font-semibold">Fase</th>
              <th className="px-3 py-2 font-semibold">Largada</th>
              <th className="px-3 py-2 font-semibold">Coleção</th>
              <th className="px-3 py-2 font-semibold">Bolha agora</th>
              <th className="px-3 py-2 font-semibold">Envolvimento</th>
              <th className="px-3 py-2 font-semibold">Min</th>
              <th className="px-3 py-2 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(dados?.runs ?? []).map((linha) => {
              const fase = FASE[linha.fase] ?? {
                rotulo: linha.fase,
                variante: "neutral" as const,
              };
              const infoEstudante = linha.estudante ?? linha.aluno;
              return (
                <tr
                  key={linha.runId}
                  className="border-t border-unooria-neutral-200 text-[13px]"
                >
                  <td className="px-3 py-2">
                    <span className="font-semibold text-unooria-neutral-950">
                      {infoEstudante?.displayName}
                    </span>
                    <span className="block text-[11px] text-unooria-neutral-500">
                      {infoEstudante?.username}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={fase.variante} size="sm">
                      {fase.rotulo}
                    </Badge>
                    {/*
                      Que EXISTE reflexão escrita, não o que ela diz. Texto livre
                      de criança não passeia por listagem — mas o professor
                      precisava saber que havia o que ler: a reflexão só aparecia
                      dentro do popup, e ninguém abre 40 popups para descobrir.
                      É a única leitura possível de um campo sem moderação.
                    */}
                    {linha.caracteresDaReflexao > 0 ? (
                      <span
                        className="mt-1 block text-[11px] text-unooria-navy-800"
                        title="Abra o estudante para ler o que ele escreveu"
                      >
                        escreveu {linha.caracteresDaReflexao} caracteres
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-[12px] text-unooria-neutral-800">
                      {rotuloLado(linha.ladoInicial)}
                    </span>
                    <span className="block text-[11px] text-unooria-neutral-500">
                      {ORIGEM_DO_LADO[linha.ladoOrigem] ?? linha.ladoOrigem}
                      {linha.perfilJogo ? ` · ${linha.perfilJogo}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-[13px] font-semibold text-unooria-neutral-900">
                      {linha.colecao.total}
                    </span>
                    {linha.colecao.doOutroLado > 0 ? (
                      <span className="block text-[11px] text-unooria-navy-800">
                        {linha.colecao.doOutroLado} do outro lado
                      </span>
                    ) : null}
                    {linha.colecao.comentados > 0 ? (
                      <span className="block text-[11px] text-unooria-neutral-500">
                        {linha.colecao.comentados} comentado(s)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-[12px] text-unooria-neutral-800">
                      {rotuloLado(linha.ladoDominante)}
                    </span>
                    {linha.inverteu ? (
                      <span className="block text-[11px] font-semibold text-unooria-coral-600">
                        virou o jogo
                      </span>
                    ) : null}
                  </td>
                  {/*
                    As 5 barras, e SÓ elas (ADR-44). O total vinha junto e, numa
                    coluna de tabela, virava nota de estudante — ordenável, comparável,
                    lida como ranking. O aviso "nunca leia o total sozinho" já
                    estava escrito no código e a tela o mostrava sozinho mesmo
                    assim. Passe o mouse para ver eixo por eixo; o número segue no
                    popup do estudante, que é uma criança por vez.
                  */}
                  <td className="px-3 py-2">
                    <span className="flex gap-0.5">
                      {linha.imersaoComponentes.map((componente) => (
                        <span
                          key={componente.chave}
                          title={`${componente.rotulo}: ${componente.pontos}/20 — ${componente.detalhe}`}
                          className="h-3 w-1.5 overflow-hidden rounded-sm bg-unooria-neutral-200"
                        >
                          <span
                            className="block w-full bg-unooria-navy-800"
                            style={{
                              height: `${Math.round((componente.pontos / 20) * 100)}%`,
                              marginTop: `${100 - Math.round((componente.pontos / 20) * 100)}%`,
                            }}
                          />
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-unooria-neutral-800">
                    {/* Run aberta e sem encerrar acumula minutos para sempre —
                        marcar como inativa evita confundir o professor em sala. */}
                    {linha.fase !== "dossie" &&
                    linha.fase !== "revelacao" &&
                    linha.minutos > 30 ? (
                      <span className="text-unooria-neutral-500">inativa</span>
                    ) : (
                      linha.minutos
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {/*
                        Antes isto era um link para `/api/runs/:id/dossier`, que
                        abria um JSON de milhares de linhas em aba nova. Agora abre
                        o popup com o que o estudante tocou — que é o que o professor
                        precisa ler, e durante a aula, não depois.
                      */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEstudanteAberto({
                            runId: linha.runId,
                            nome: infoEstudante?.displayName ?? "",
                          })
                        }
                      >
                        abrir
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={resetando === linha.runId}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Zerar a sessão de ${infoEstudante?.displayName}?`,
                            )
                          )
                            return;
                          setResetando(linha.runId);
                          await fetch(`/api/plataforma/runs/${linha.runId}/reset`, {
                            method: "POST",
                          }).catch(() => undefined);
                          setResetando(null);
                          void buscar();
                        }}
                      >
                        Zerar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {dados && dados.runs.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-[13px] text-unooria-neutral-500"
                >
                  Ninguém entrou ainda. Assim que a turma fizer login, aparece
                  aqui.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
