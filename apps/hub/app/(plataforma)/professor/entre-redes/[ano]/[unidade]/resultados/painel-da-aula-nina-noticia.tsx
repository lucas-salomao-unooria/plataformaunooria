"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Button,
  Card,
  FeedbackAlert,
  Icon,
  MetricCard,
  ScrollBar,
  SectionHeader,
  Table,
  Tag,
  type TableColumn,
} from "@edu/ui/ds";
import { AVISO_POR_COMPUTADOR, chaveDaLinha, type MembroNoPainel } from "@/lib/equipe-no-painel";
import {
  COPY_DO_PAINEL,
  POLLING_DO_PAINEL_MS,
  ROTEIRO_DE_MEDIACAO,
  ROTULO_DA_ETAPA,
  ROTULO_DO_PASSO,
  alertasDaSala,
  caminhoDaTurma,
  erroDaResposta,
  gatilhosDaEtapa,
  mudouAEvidencia,
  ordenarLinhas,
  progressoDaAula,
  rotuloDoBotao,
  textosDasEscolhas,
  todosConcluiram,
  type AcaoDoGate,
  type GateDaTurma,
  type LinhaDoPainel,
  type PainelDaTurma,
} from "@/lib/nina-noticia-tipos";

import { EquipeNaLinha } from "./equipe-na-linha";

type Conexao = "ok" | "caiu";

/**
 * O PAINEL DA AULA da exp03ef1b (E4-PROF-01, "Painel da Sala em Tempo Real")
 * — os portões, a pausa, os cartões da turma, o roteiro de mediação e a folha,
 * AO VIVO.
 *
 * **Dois portões, e o botão diz o de DESTINO.** O rótulo sai de `proximaEtapa`,
 * que a api calcula: "Liberar Filtro" (Etapa 2 → 3) e depois "Liberar Inspeção"
 * (Etapa 3 → 4). Só avança; fora de ordem a api responde 409
 * `transicao-de-etapa-invalida`, e o painel relê para mostrar onde a turma está.
 *
 * **"Pausar Turma" congela TODAS as telas** com o "Momento de conversar com a
 * turma!" (a flag `pausada`), e o painel vira o quadro "Sala pausada" do print 24
 * até "Retomar Turma". O roteiro de mediação continua à vista: é a hora dele.
 *
 * **Quatro números, não seis** (2026-10-29): Entraram, Travaram a escolha
 * (o que o "Liberar Filtro" espera), Viram a notícia sumir (a conversa antes
 * do "Liberar Inspeção") e Concluíram — `progressoDaAula`. Um cartão por
 * etapa espremia o painel e não dizia o que o portão espera; onde cada um
 * está, etapa a etapa, é a folha.
 *
 * **A linha diz progresso e alerta, NUNCA acerto** (`PROIBIDO_NA_LINHA_DO_PAINEL`,
 * na api). As "Escolhas da Etapa 2" e os alertas vivem só no agregado, sem nome:
 * esses cartões podem ir para o projetor; a folha, não. O nível de cada
 * habilidade é do painel de habilidades — o polling relê a página quando a
 * evidência muda (`mudouAEvidencia`, ADR-146).
 *
 * **Consulta leve a cada 5 s**, pelo BFF, só do painel, com a aba visível e
 * enquanto alguém não concluiu.
 */
export function PainelDaAulaNinaNoticia({
  turmaId,
  inicial,
  membros,
  podeConduzir,
}: {
  turmaId: string;
  inicial: PainelDaTurma;
  membros: Readonly<Record<string, MembroNoPainel[]>>;
  podeConduzir: boolean;
}) {
  const [painel, setPainel] = useState(inicial);
  const [inicialVisto, setInicialVisto] = useState(inicial);
  if (inicial !== inicialVisto) {
    setInicialVisto(inicial);
    setPainel(inicial);
  }
  const [enviando, setEnviando] = useState<AcaoDoGate | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conexao, setConexao] = useState<Conexao>("ok");

  const base = `/api/plataforma${caminhoDaTurma(turmaId)}`;
  const router = useRouter();
  const [, transicionar] = useTransition();
  const ultimo = useRef(painel);
  useEffect(() => {
    ultimo.current = painel;
  }, [painel]);

  const atualizar = useCallback(async () => {
    try {
      const r = await fetch(`${base}/painel`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const novo = (await r.json()) as PainelDaTurma;
      const antes = ultimo.current;
      setPainel(novo);
      setConexao("ok");
      if (mudouAEvidencia(antes, novo)) transicionar(() => router.refresh());
    } catch {
      setConexao("caiu");
    }
  }, [base, router]);

  const terminou = todosConcluiram(painel);
  useEffect(() => {
    if (terminou) return;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void atualizar();
    }, POLLING_DO_PAINEL_MS);
    return () => clearInterval(id);
  }, [terminou, atualizar]);

  async function acionar(acao: AcaoDoGate) {
    setEnviando(acao);
    setErro(null);
    try {
      const corpo = acao === "liberar" && painel.proximaEtapa ? { acao, para: painel.proximaEtapa } : { acao };
      const r = await fetch(`${base}/gate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) {
        setErro(erroDaResposta(await r.json().catch(() => null), COPY_DO_PAINEL.falhaDoPortao).mensagem);
        await atualizar();
        return;
      }
      const gate = (await r.json()) as GateDaTurma;
      setPainel((p) => ({ ...p, etapa: gate.etapa, pausada: gate.pausada, proximaEtapa: gate.proximaEtapa }));
      await atualizar();
    } catch {
      setErro(COPY_DO_PAINEL.falhaDoPortao);
    } finally {
      setEnviando(null);
    }
  }

  const { resumo } = painel;
  const rotulo = rotuloDoBotao(painel.proximaEtapa);
  const escolhas = textosDasEscolhas(resumo.escolhas, resumo.porComputador);
  const alertas = alertasDaSala(resumo.alertas);
  const gatilhos = gatilhosDaEtapa(painel.etapa);
  const progresso = progressoDaAula(painel);

  const colunas: TableColumn<LinhaDoPainel>[] = [
    {
      key: "nome",
      title: resumo.porComputador ? "Equipe" : "Estudante",
      minWidth: 200,
      render: (_, linha) =>
        linha.equipe ? (
          <EquipeNaLinha
            equipe={{ ...linha.equipe, membros: membros[linha.equipe.id] ?? [] }}
            representante={linha.nome}
            entrou={linha.entrou}
          />
        ) : (
          <span className="font-semibold text-unooria-neutral-950">{linha.nome}</span>
        ),
    },
    {
      key: "etapa",
      title: "Etapa",
      minWidth: 90,
      render: (_, linha) => (linha.entrou ? `Etapa ${linha.etapaVisivel}` : "—"),
    },
    {
      key: "passo",
      title: "Onde está",
      minWidth: 220,
      render: (_, linha) =>
        !linha.entrou ? (
          "Ainda não entrou"
        ) : linha.aguardando ? (
          <span className="flex flex-col items-start gap-1">
            <span>{ROTULO_DO_PASSO[linha.passo]}</span>
            <Tag variant="warning" size="sm" pill>
              Aguarda você
            </Tag>
          </span>
        ) : (
          ROTULO_DO_PASSO[linha.passo]
        ),
    },
    {
      key: "alertas",
      title: "Alertas",
      minWidth: 260,
      render: (_, linha) =>
        linha.alertas.semParada || linha.alertas.uniformes ? (
          <span className="flex flex-col items-start gap-1">
            {linha.alertas.semParada ? (
              <Tag variant="warning" size="sm">
                Repetição sem parada
              </Tag>
            ) : null}
            {linha.alertas.uniformes ? (
              <Tag variant="warning" size="sm">
                Carimbos uniformes
              </Tag>
            ) : null}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  const botaoDaPausa = podeConduzir ? (
    painel.pausada ? (
      <Button
        variant="primary"
        size="md"
        leftIcon={<Icon name="play_arrow" size={18} />}
        onClick={() => void acionar("retomar")}
        isDisabled={enviando !== null}
        isLoading={enviando === "retomar"}
        data-acao="retomar-turma"
      >
        {COPY_DO_PAINEL.retomar}
      </Button>
    ) : (
      <Button
        variant="outline"
        size="md"
        leftIcon={<Icon name="pause" size={18} />}
        onClick={() => void acionar("pausar")}
        isDisabled={enviando !== null}
        isLoading={enviando === "pausar"}
        data-acao="pausar-turma"
      >
        {COPY_DO_PAINEL.pausar}
      </Button>
    )
  ) : null;

  return (
    <div className="flex flex-col gap-6" data-painel-da-aula data-etapa={painel.etapa} data-pausada={painel.pausada ? "sim" : "nao"}>
      <Card variant="elevated">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[18px] font-bold text-unooria-neutral-950">{COPY_DO_PAINEL.titulo}</h2>
              {painel.pausada ? (
                <Tag variant="neutral" size="sm" data-sala-pausada>
                  {COPY_DO_PAINEL.salaPausada}
                </Tag>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {botaoDaPausa}
              {podeConduzir && rotulo && !painel.pausada ? (
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Icon name="lock_open" size={18} />}
                  onClick={() => void acionar("liberar")}
                  isDisabled={enviando !== null}
                  isLoading={enviando === "liberar"}
                  data-gate={painel.proximaEtapa ?? undefined}
                >
                  {rotulo}
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-[13px] text-unooria-neutral-700">
            Agora: <strong className="text-unooria-neutral-950">{ROTULO_DA_ETAPA[painel.etapa]}</strong>
            {painel.rodada > 1 ? <span className="text-unooria-neutral-500"> · rodada {painel.rodada}</span> : null}
          </p>
          {podeConduzir && gatilhos.length > 0 && !painel.pausada ? (
            <ul className="flex max-w-3xl flex-col gap-1 text-[13px] font-semibold leading-snug text-unooria-neutral-900" data-gatilhos>
              {gatilhos.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : null}
          {podeConduzir && rotulo ? (
            <p className="text-[12px] leading-snug text-unooria-neutral-500">A turma inteira avança junto, e o portão não volta.</p>
          ) : null}
          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          {conexao === "caiu" ? <FeedbackAlert type="warning" description={COPY_DO_PAINEL.semConexao} /> : null}
        </div>
      </Card>

      {painel.pausada ? (
        /* Print 24: o quadro do centro, enquanto as telas estão congeladas. */
        <Card variant="outlined">
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center" data-quadro-da-pausa>
            <p className="max-w-md text-[18px] font-bold leading-snug text-unooria-neutral-950">{COPY_DO_PAINEL.congeladas}</p>
            <p className="max-w-md text-[14px] leading-relaxed text-unooria-neutral-600">{COPY_DO_PAINEL.aproveite}</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-progresso-da-aula>
            {progresso.map((c) => (
              <MetricCard key={c.titulo} title={c.titulo} value={c.valor} description={c.descricao} />
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <MetricCard title={COPY_DO_PAINEL.escolhas} value={escolhas.valor} description={escolhas.linhas.join(" ")} />
            <Card variant="outlined">
              <div className="flex flex-col gap-2" data-alertas-da-sala>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-600">{COPY_DO_PAINEL.alertas}</p>
                {alertas.length === 0 ? (
                  <p className="text-[14px] text-unooria-neutral-700">{COPY_DO_PAINEL.semAlertas}</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-[14px] font-semibold text-unooria-neutral-950">
                    {alertas.map((a) => (
                      <li key={a} className="flex items-center gap-2">
                        <Icon name="warning" size={18} /> {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
          {resumo.porComputador ? (
            <p className="-mt-2 text-[12px] leading-snug text-unooria-neutral-600">{AVISO_POR_COMPUTADOR}</p>
          ) : null}
        </>
      )}

      <Card variant="outlined">
        <div className="flex flex-col gap-3" data-roteiro-de-mediacao>
          <SectionHeader title={COPY_DO_PAINEL.roteiro} description="Leia em voz alta. O cuidado de cada pergunta é só para você." />
          <ol className="flex max-w-3xl list-decimal flex-col gap-3 pl-5 text-[14px] leading-relaxed text-unooria-neutral-900">
            {ROTEIRO_DE_MEDIACAO.map(({ pergunta, cuidado }) => (
              <li key={pergunta} className="flex flex-col gap-1">
                <span className="italic">“{pergunta}”</span>
                <span className="text-[12px] not-italic text-unooria-neutral-600">{cuidado}</span>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-3" data-folha>
          <SectionHeader
            title={[painel.turma.nome, painel.turma.serie].filter(Boolean).join(" · ")}
            description="Para a sua tela, não para o projetor: tem nomes. Mostra onde cada computador está e os alertas — nunca se acertou. O nível de cada habilidade fica na aba Habilidades."
          />
          <ScrollBar orientation="both" autoHide className="tabela-rolavel">
            <Table<LinhaDoPainel>
              columns={colunas}
              data={ordenarLinhas(painel.linhas)}
              keyExtractor={(linha) =>
                chaveDaLinha({ estudanteId: linha.estudanteId, equipe: linha.equipe ? { ...linha.equipe, membros: [] } : null })
              }
              emptyText="A turma ainda não tem estudantes."
              size="md"
              theme="light"
            />
          </ScrollBar>
        </div>
      </Card>
    </div>
  );
}
