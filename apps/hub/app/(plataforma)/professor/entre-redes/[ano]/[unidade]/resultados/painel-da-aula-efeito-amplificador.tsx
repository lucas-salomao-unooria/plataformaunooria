"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import {
  BarChart,
  Button,
  Card,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ScrollBar,
  SectionHeader,
  Table,
  Tag,
  UNOORIA_DATAVIZ_PALETTE,
  type TableColumn,
} from "@edu/ui/ds";
import { AVISO_POR_COMPUTADOR, chaveDaLinha } from "@/lib/equipe-no-painel";
import {
  FAIXAS_DA_MADRUGADA,
  HABILIDADES_DA_MATRIZ,
  INATIVO_A_PARTIR_DE_SEGUNDOS,
  MANCHETES,
  ROTULO_DA_HABILIDADE,
  ROTULO_DA_MANCHETE,
  ROTULO_DO_PASSO,
  erroDaApi,
  percentual,
  rotuloDaEtapa,
  tempoParado,
  type GateDaTurma,
  type HabilidadeDaMatriz,
  type PainelDaTurma,
} from "@/lib/efeito-amplificador-tipos";

import { EquipeNaLinha } from "./equipe-na-linha";

const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
/** O estudante lê o gate a cada 3 s; o painel se relê a cada 5 s enquanto a aula anda. */
const INTERVALO_MS = 5_000;

/** O corpo de `POST gate` (API-010): só para a frente. */
type EtapaDoGate = "pausa" | "explicar";

/** Os dois botões são irreversíveis: o gate só anda para a frente. */
const CONFIRMACAO: Readonly<Record<EtapaDoGate, { botao: string; titulo: string; texto: string }>> = {
  pausa: {
    botao: "Pausar Telas para Debate",
    titulo: "Pausar as telas para o debate?",
    texto:
      "As telas dos estudantes congelam com a mensagem “Aguardando a liberação do orientador do grêmio para avançar para a próxima fase...”. Conduza a revelação com a Distribuição Horária Coletiva e o roteiro de perguntas. Não dá para despausar: o próximo passo é avançar a turma para o Explicar.",
  },
  explicar: {
    botao: "Avançar Turma para Explicar",
    titulo: "Avançar a turma para o Explicar?",
    texto:
      "Cada aparelho sai do feed e abre os bastidores da distribuição: o estudante seleciona os dois indicadores que revelam o critério de entrega do algoritmo — o horário de pico e a métrica de retenção. O feed fecha: quem não moderou nem usou as proteções fica com “não atingiu” na EM13CO24 e na EM13CO08. Não dá para voltar.",
  },
};

/* As cores do DS (dataviz da plataforma): a madrugada em destaque, o resto do dia apagado. */
const COR_DESTAQUE = UNOORIA_DATAVIZ_PALETTE[4];
const COR_NEUTRA = UNOORIA_DATAVIZ_PALETTE[3];
const COR_DAS_MANCHETES = [UNOORIA_DATAVIZ_PALETTE[0], UNOORIA_DATAVIZ_PALETTE[6], UNOORIA_DATAVIZ_PALETTE[8]] as const;

type Linha = PainelDaTurma["linhas"][number];
type LinhaDaMatriz = { codigo: HabilidadeDaMatriz } & PainelDaTurma["resumo"]["matriz"][HabilidadeDaMatriz];

/** Os rótulos do eixo Y quando a escala passa de 100 (o `BarChart` do DS escala pelo maior valor, mas rotula 0–100). */
function eixoDaEscala(maior: number): string[] | undefined {
  if (maior <= 100) return undefined;
  return [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(maior * f).toLocaleString("pt-BR"));
}

/**
 * O PAINEL DE CONDUÇÃO EM TEMPO REAL de O Efeito Amplificador (E4-PROF-01): os
 * quatro cartões, o roteiro do debate e os dois botões.
 *
 * Três cartões são AGREGADOS e podem ir ao projetor — o Balanço Editorial, a
 * Distribuição Horária Coletiva (o desmonte da culpa: a MESMA curva para todo
 * post, qualquer que fosse a manchete) e a Matriz Consolidada, que só CONTA
 * quantos em cada nível. O Monitor de Ritmo e Inatividade tem os nomes, e é só
 * da tela do professor. O nível de cada estudante mora na aba Habilidades.
 */
export function PainelDaAulaEfeitoAmplificador({
  turmaId,
  inicial,
  podeConduzir,
}: {
  turmaId: string;
  inicial: PainelDaTurma;
  podeConduzir: boolean;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const idDoTitulo = useId();
  const [painel, setPainel] = useState(inicial);
  const [inicialVisto, setInicialVisto] = useState(inicial);
  if (inicial !== inicialVisto) {
    setInicialVisto(inicial);
    setPainel(inicial);
  }
  const [confirmando, setConfirmando] = useState<EtapaDoGate | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const url = `/api/plataforma/efeito-amplificador/turmas/${encodeURIComponent(turmaId)}`;
  const todosConcluiram = painel.linhas.length > 0 && painel.linhas.every((l) => l.passo === "concluida");

  useEffect(() => {
    if (!painel.atividade || todosConcluiram) return;
    const id = setInterval(() => {
      void fetch(`${url}/painel`, { cache: "no-store" })
        .then(async (r) => (r.ok ? ((await r.json()) as PainelDaTurma) : null))
        .then((novo) => {
          if (novo) setPainel(novo);
        })
        .catch(() => undefined);
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [url, painel.atividade, todosConcluiram]);

  async function mudar(etapa: EtapaDoGate) {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`${url}/gate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ etapa }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para mudar a etapa da turma agora.").mensagem);
        return;
      }
      setConfirmando(null);
      setPainel((atual) => ({ ...atual, etapa: (corpo as GateDaTurma).etapa }));
      transicionar(() => router.refresh());
    } catch {
      setErro(SEM_REDE);
    } finally {
      setEnviando(false);
    }
  }

  const etapa = painel.etapa ?? "exploracao";
  const r = painel.resumo;
  const maiorEntrega = Math.max(0, ...r.entrega.map((e) => e.impressoes));
  const noFeed = painel.linhas.filter((l) => l.passo === "feed").length;
  const inativos = painel.linhas.filter(
    (l) => l.passo !== "abertura" && l.passo !== "concluida" && (l.segundosInativo ?? 0) >= INATIVO_A_PARTIR_DE_SEGUNDOS,
  ).length;

  const colunasDoMonitor: TableColumn<Linha>[] = [
    {
      key: "nome",
      title: painel.porComputador ? "Estudante ou equipe" : "Estudante",
      minWidth: 200,
      render: (_, linha) =>
        linha.equipe ? (
          <EquipeNaLinha equipe={linha.equipe} representante={linha.nome} entrou={linha.passo !== "abertura"} />
        ) : (
          <span className="font-semibold text-unooria-neutral-950">{linha.nome}</span>
        ),
    },
    { key: "passo", title: "Passo", minWidth: 170, render: (_, linha) => ROTULO_DO_PASSO[linha.passo] },
    {
      key: "manchete",
      title: "Manchete",
      minWidth: 130,
      render: (_, linha) => (linha.manchete ? ROTULO_DA_MANCHETE[linha.manchete] : "—"),
    },
    {
      key: "segundosInativo",
      title: "Tempo parado",
      minWidth: 140,
      render: (_, linha) => {
        const parado =
          linha.passo !== "abertura" && linha.passo !== "concluida" && (linha.segundosInativo ?? 0) >= INATIVO_A_PARTIR_DE_SEGUNDOS;
        return (
          <span className="flex flex-wrap items-center gap-2">
            <span>{linha.passo === "concluida" ? "—" : tempoParado(linha.segundosInativo)}</span>
            {parado ? (
              <Tag variant="warning" size="sm" pill>
                Inativo
              </Tag>
            ) : null}
          </span>
        );
      },
    },
  ];

  const colunasDaMatriz: TableColumn<LinhaDaMatriz>[] = [
    { key: "codigo", title: "Habilidade", minWidth: 190, render: (_, linha) => ROTULO_DA_HABILIDADE[linha.codigo] },
    { key: "atingiu", title: "Atingiu", minWidth: 90 },
    { key: "em_processo", title: "Em processo", minWidth: 110 },
    { key: "nao_atingiu", title: "Não atingiu", minWidth: 110 },
  ];
  const linhasDaMatriz: LinhaDaMatriz[] = HABILIDADES_DA_MATRIZ.map((codigo) => ({ codigo, ...r.matriz[codigo] }));

  return (
    <div className="flex flex-col gap-6" data-painel-da-aula>
      <SectionHeader title="Painel de Condução em Tempo Real" description={`${rotuloDaEtapa(painel.etapa)} · ${r.publicaram} de ${r.unidades} publicaram no Unoovista`} />

      {/* Um cartão por linha: a coluna do professor tem ~770 px, e em meia coluna o gráfico das dez
          faixas cortava as últimas e as tabelas cortavam a última coluna. */}
      <div className="grid gap-4">
        <Card variant="elevated">
          <div className="flex flex-col gap-3" data-balanco-editorial>
            <SectionHeader title="Balanço Editorial da Turma" />
            {r.publicaram === 0 ? (
              <p className="text-[13px] text-unooria-neutral-700">Ninguém publicou ainda. O balanço aparece com a primeira publicação.</p>
            ) : (
              <>
                {/* Uma categoria só, com as três manchetes lado a lado: o eixo do DS corta rótulo acima de ~8
                    caracteres, então o nome de cada manchete vai na legenda. Barras em % das publicações. */}
                <BarChart
                  title="Manchetes escolhidas"
                  subtitle={`% das publicações · ${r.publicaram}`}
                  data={[
                    {
                      label: "Turma",
                      values: MANCHETES.map((m) => percentual(r.manchetes[m], r.publicaram)),
                      colors: [...COR_DAS_MANCHETES],
                    },
                  ]}
                  indicators={MANCHETES.map((m, i) => ({ label: ROTULO_DA_MANCHETE[m], color: COR_DAS_MANCHETES[i] ?? COR_NEUTRA }))}
                  height={200}
                />
                <p className="text-[12px] text-unooria-neutral-600">
                  {MANCHETES.map((m) => `${ROTULO_DA_MANCHETE[m]}: ${percentual(r.manchetes[m], r.publicaram)}% (${r.manchetes[m]})`).join(" · ")}
                </p>
              </>
            )}
          </div>
        </Card>

        <Card variant="elevated">
          <div className="flex flex-col gap-3" data-distribuicao-horaria>
            <SectionHeader title="Distribuição Horária Coletiva (Pico: 01h00–03h30)" />
            <BarChart
              title="Impressões por faixa de horário"
              subtitle={r.publicaram > 0 ? `${r.percentualNoturno}% das publicações com pico entre 01h00 e 03h30` : "A mesma curva para toda publicação"}
              data={r.entrega.map((e) => ({
                label: e.faixa,
                /* `values` + `colors`, e não `value` + `color`: o `BarChart` do DS (0.2.24) aceita
                   `color` no tipo do ponto e o ignora — só a forma de várias barras pinta a barra. */
                values: [e.impressoes],
                colors: [FAIXAS_DA_MADRUGADA.includes(e.faixa) ? COR_DESTAQUE : COR_NEUTRA],
              }))}
              yAxisLabels={eixoDaEscala(maiorEntrega)}
              height={200}
            />
            {r.publicaram > 0 ? (
              <p className="text-[14px] font-semibold text-unooria-neutral-950" data-desmonte>
                {`${r.percentualNoturno}% das publicações da turma tiveram pico de entrega entre 01h00 e 03h30, independentemente da manchete escolhida.`}
              </p>
            ) : null}
          </div>
        </Card>

        <Card variant="elevated">
          <div className="flex flex-col gap-3" data-monitor-de-ritmo>
            <SectionHeader
              title="Monitor de Ritmo e Inatividade"
              description={`${noFeed} no feed · ${inativos} ${inativos === 1 ? "inativo" : "inativos"} · Para a sua tela, não para o projetor.`}
            />
            {painel.porComputador ? <FeedbackAlert type="info" description={AVISO_POR_COMPUTADOR} /> : null}
            <ScrollBar orientation="both" autoHide className="tabela-rolavel">
              <Table<Linha>
                columns={colunasDoMonitor}
                data={[...painel.linhas]}
                keyExtractor={(linha) => chaveDaLinha(linha)}
                emptyText="A turma ainda não tem estudantes."
                size="md"
                theme="light"
              />
            </ScrollBar>
          </div>
        </Card>

        <Card variant="elevated">
          <div className="flex flex-col gap-3" data-matriz-de-evidencias>
            <SectionHeader
              title="Matriz Consolidada de Evidências (CO24, CO14, CO26, CO08)"
              description="Quantos estudantes em cada nível. O nível de cada um fica na aba Habilidades."
            />
            <ScrollBar orientation="horizontal" autoHide>
              <Table<LinhaDaMatriz>
                columns={colunasDaMatriz}
                data={linhasDaMatriz}
                keyExtractor={(linha) => linha.codigo}
                size="md"
                theme="light"
              />
            </ScrollBar>
          </div>
        </Card>
      </div>

      <Card variant="outlined">
        <div className="flex flex-col gap-3" data-roteiro>
          <SectionHeader
            title="Roteiro de Perguntas do Debate"
            description={etapa === "explicar" ? painel.roteiro.instrucoes.liberar : painel.roteiro.instrucoes.pausar}
          />
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
            {painel.roteiro.perguntas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      </Card>

      {podeConduzir ? (
        <div className="flex flex-wrap justify-end gap-3" data-botoes-da-aula>
          <Button variant="outline" size="md" isDisabled={etapa !== "exploracao"} onClick={() => setConfirmando("pausa")}>
            {CONFIRMACAO.pausa.botao}
          </Button>
          <Button variant="primary" size="md" isDisabled={etapa === "explicar"} onClick={() => setConfirmando("explicar")}>
            {CONFIRMACAO.explicar.botao}
          </Button>
        </div>
      ) : null}
      {erro ? <FeedbackAlert type="error" description={erro} /> : null}

      <Modal isOpen={confirmando !== null} onClose={() => !enviando && setConfirmando(null)} size="sm" theme="light" aria-labelledby={idDoTitulo}>
        <ModalHeader showCloseButton={false}>
          <ModalTitle id={idDoTitulo}>{confirmando ? CONFIRMACAO[confirmando].titulo : ""}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-700">{confirmando ? CONFIRMACAO[confirmando].texto : ""}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" isDisabled={enviando} onClick={() => setConfirmando(null)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" isDisabled={enviando} isLoading={enviando} onClick={() => confirmando && void mudar(confirmando)}>
            {confirmando ? CONFIRMACAO[confirmando].botao : ""}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
