"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  Button,
  Card,
  FeedbackAlert,
  MetricCard,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ScrollBar,
  SectionHeader,
  StackedProgressBar,
  Table,
  Tag,
  UNOORIA_DATAVIZ_PALETTE,
  type TableColumn,
} from "@edu/ui/ds";
import {
  INATIVO_A_PARTIR_DE_SEGUNDOS,
  PASSOS,
  ROTAS_DA_TURMA,
  ROTULO_DO_PASSO,
  caminhoDaTurma,
  erroDaApi,
  mudouAEvidencia,
  percentual,
  rotuloDaEtapa,
  tempoParado,
  type GateDaTurma,
  type PainelDaTurma,
} from "@/lib/porta-voz-tipos";

const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
/** O estudante relê a sessão a cada 3 s; o painel se relê a cada 5 s enquanto a aula anda. */
const INTERVALO_MS = 5_000;

/** O corpo de `POST gate`: só para a frente. */
type EtapaDoGate = "pausa" | "liberada";

/** Os dois botões são irreversíveis: o gate só anda para a frente. */
const CONFIRMACAO: Readonly<Record<EtapaDoGate, { botao: string; titulo: string; texto: string }>> = {
  pausa: {
    botao: "Pausar para o debate",
    titulo: "Pausar as telas para o debate?",
    texto:
      "As telas de quem ainda não concluiu congelam com a faixa “Sessão pausada pela Coordenação para mediação técnica em sala”: dá para rolar o grupo, mas não publicar. Conduza o debate com as perguntas do roteiro. Não dá para despausar: o próximo passo é liberar a retomada.",
  },
  liberada: {
    botao: "Liberar Retomada da Turma",
    titulo: "Liberar a retomada da turma?",
    texto:
      "As telas voltam a andar. Quem já publicou recebe a oferta da errata (a 2ª publicação) e segue para o laudo e a perícia; quem ainda não publicou continua de onde parou e, ao publicar, vai direto para a errata. Não dá para voltar.",
  },
};

/* As cores da dataviz da plataforma (DS): uma por escala, uma por passo, sem cor de "certo" ou "errado". */
const COR = UNOORIA_DATAVIZ_PALETTE;
const cor = (i: number) => COR[i % COR.length] ?? "#6B7280";

type Linha = PainelDaTurma["linhas"][number];

/**
 * A AULA AO VIVO de O Porta-Voz dos Dados (E4-PROF-01): os dois botões no
 * topo, a lousa (só CONTAGENS, sem nome e sem ranking: pode ir ao projetor), o
 * roteiro do debate e a folha de ritmo com os nomes (só para a tela do
 * professor). A escala, as informações e o parecer de cada estudante não vêm
 * da api; o nível de cada um mora na aba Habilidades, que este painel mantém
 * em dia com `router.refresh()` quando a evidência muda (ADR-146).
 */
export function PainelDaAulaPortaVoz({
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
  /* O último painel lido pelo polling: é contra ele que a mudança de evidência se mede. */
  const ultimo = useRef(inicial);
  const [confirmando, setConfirmando] = useState<EtapaDoGate | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const url = `/api/plataforma${caminhoDaTurma(turmaId)}`;
  const todosConcluiram = painel.linhas.length > 0 && painel.linhas.every((l) => l.passo === "concluida");

  useEffect(() => {
    if (!painel.atividade || todosConcluiram) return;
    const id = setInterval(() => {
      void fetch(`${url}${ROTAS_DA_TURMA.painel}`, { cache: "no-store" })
        .then(async (r) => (r.ok ? ((await r.json()) as PainelDaTurma) : null))
        .then((novo) => {
          if (!novo) return;
          const antes = ultimo.current;
          ultimo.current = novo;
          setPainel(novo);
          /* A aba Habilidades é do servidor: relê a página quando um gesto que a ficha marca acontece. */
          if (mudouAEvidencia(antes, novo)) transicionar(() => router.refresh());
        })
        .catch(() => undefined);
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [url, painel.atividade, todosConcluiram, router]);

  async function mudar(etapa: EtapaDoGate) {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`${url}${ROTAS_DA_TURMA.gate}`, {
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
  const publicaram = r.primeiraPublicacao.escala0 + r.primeiraPublicacao.escala80;
  const decidiramErrata = r.errata.publicaram + r.errata.pularam;
  const decidiramPericia = r.pericia.emitiram + r.pericia.pularam;
  const inativos = painel.linhas.filter(
    (l) => l.passo !== "abertura" && l.passo !== "concluida" && (l.segundosInativo ?? 0) >= INATIVO_A_PARTIR_DE_SEGUNDOS,
  ).length;

  const colunas: TableColumn<Linha>[] = [
    { key: "nome", title: "Estudante", minWidth: 200, render: (_, linha) => <span className="font-semibold text-unooria-neutral-950">{linha.nome}</span> },
    { key: "passo", title: "Etapa", minWidth: 200, render: (_, linha) => ROTULO_DO_PASSO[linha.passo] },
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

  return (
    <div className="flex flex-col gap-6" data-painel-da-aula>
      {/* O controle da missão vem PRIMEIRO, como nas outras missões: no fim da página o professor achava que os botões não existiam. */}
      <Card variant="elevated">
        <div className="flex flex-col gap-4" data-controle-da-missao data-etapa={etapa}>
          <SectionHeader
            title="Sessão em Andamento · Monitoramento em Tempo Real"
            description={`${rotuloDaEtapa(painel.etapa)} · ${r.entraram} de ${r.estudantes} entraram${painel.atividade ? ` · ${painel.atividade.rodada}ª rodada` : ""}`}
          />
          {podeConduzir ? (
            <div className="flex flex-col items-start gap-2">
              <div className="flex flex-wrap gap-3" data-botoes-da-aula>
                <Button variant="outline" size="md" isDisabled={etapa !== "exploracao"} onClick={() => setConfirmando("pausa")} data-acao="pausar-debate">
                  {CONFIRMACAO.pausa.botao}
                </Button>
                <Button variant="primary" size="md" isDisabled={etapa === "liberada"} onClick={() => setConfirmando("liberada")} data-acao="liberar-retomada">
                  {CONFIRMACAO.liberada.botao}
                </Button>
              </div>
              <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
                {etapa === "exploracao"
                  ? "Pause quando os gráficos da escola rival aparecerem no grupo e a turma estiver pronta para o debate."
                  : etapa === "pausa"
                    ? "Faça as perguntas do roteiro com as telas pausadas. Terminada a conversa, libere a retomada: a errata, o laudo e a perícia."
                    : "A turma está na errata, no laudo e na perícia. Acompanhe a conclusão pela lousa."}
              </p>
            </div>
          ) : null}
          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-lousa>
        <MetricCard title="Pausados agora" value={r.pausados} description="Estudantes com a tela pausada, aguardando a mediação coletiva." />
        <MetricCard title="Abriram o anexo" value={`${r.abriramAnexo}/${r.entraram}`} description="Consultaram a nota técnica." />
        <MetricCard title="Publicaram" value={`${publicaram}/${r.entraram}`} description="Já enviaram a 1ª publicação ao grupo." />
        <MetricCard title="Concluíram" value={`${r.porPasso.concluida}/${r.entraram}`} description="Emitiram o parecer ou seguiram sem ele." />
      </div>

      <div className="grid gap-4">
        <Card variant="elevated">
          <div className="flex flex-col gap-3" data-distribuicao-das-escalas>
            <SectionHeader title="Distribuição de Escolha de Escala na 1ª Publicação" description="Sem nomes: pode ir ao projetor." />
            {publicaram === 0 ? (
              <p className="text-[13px] text-unooria-neutral-700">Ninguém publicou ainda. A divisão aparece com a primeira publicação.</p>
            ) : (
              <StackedProgressBar
                title="Onde o eixo começa"
                subtitle={`Eixo em 0%: ${percentual(r.primeiraPublicacao.escala0, publicaram)}% · Eixo em 80%: ${percentual(r.primeiraPublicacao.escala80, publicaram)}%`}
                totalValue={publicaram}
                segments={[
                  { label: "Escala 0–100%", value: r.primeiraPublicacao.escala0, amountText: String(r.primeiraPublicacao.escala0), color: cor(0) },
                  { label: "Escala 80–100%", value: r.primeiraPublicacao.escala80, amountText: String(r.primeiraPublicacao.escala80), color: cor(4) },
                ]}
              />
            )}
          </div>
        </Card>

        <Card variant="elevated">
          <div className="flex flex-col gap-3" data-por-etapa>
            <SectionHeader title="Onde a turma está" description={`${inativos} ${inativos === 1 ? "inativo" : "inativos"} há mais de ${INATIVO_A_PARTIR_DE_SEGUNDOS} s.`} />
            <StackedProgressBar
              title="Estudantes por etapa"
              subtitle={`${r.entraram} de ${r.estudantes} entraram`}
              totalValue={r.estudantes}
              segments={PASSOS.map((passo, i) => ({
                label: ROTULO_DO_PASSO[passo],
                value: r.porPasso[passo],
                amountText: String(r.porPasso[passo]),
                color: cor(i),
              }))}
            />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card variant="elevated">
            <div className="flex flex-col gap-3" data-errata>
              <SectionHeader title="A errata" description={`${decidiramErrata} de ${publicaram} decidiram`} />
              <StackedProgressBar
                title="Depois da retomada"
                subtitle="Contagem da turma, sem nomes"
                totalValue={decidiramErrata}
                segments={[
                  { label: "Publicaram a errata", value: r.errata.publicaram, amountText: String(r.errata.publicaram), color: cor(1) },
                  { label: "Seguiram sem errata", value: r.errata.pularam, amountText: String(r.errata.pularam), color: cor(3) },
                ]}
              />
            </div>
          </Card>
          <Card variant="elevated">
            <div className="flex flex-col gap-3" data-pericia>
              <SectionHeader title="A perícia técnica" description={`${decidiramPericia} decidiram`} />
              <StackedProgressBar
                title="Os cartões eleitorais"
                subtitle="Contagem da turma, sem acerto nem ranking"
                totalValue={decidiramPericia}
                segments={[
                  { label: "Emitiram o parecer", value: r.pericia.emitiram, amountText: String(r.pericia.emitiram), color: cor(2) },
                  { label: "Seguiram sem parecer", value: r.pericia.pularam, amountText: String(r.pericia.pularam), color: cor(3) },
                ]}
              />
            </div>
          </Card>
        </div>
      </div>

      <Card variant="outlined">
        <div className="flex flex-col gap-3" data-roteiro>
          <SectionHeader title="Roteiro de Perguntas do Debate" description="Para a roda, com as telas pausadas." />
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
            {painel.roteiro.perguntas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-3" data-monitor-de-ritmo>
          <SectionHeader title="Ritmo da turma" description="Com os nomes: para a sua tela, não para o projetor." />
          <ScrollBar orientation="both" autoHide className="tabela-rolavel">
            <Table<Linha>
              columns={colunas}
              data={[...painel.linhas]}
              keyExtractor={(linha) => linha.estudanteId}
              emptyText="A turma ainda não tem estudantes."
              size="md"
              theme="light"
            />
          </ScrollBar>
        </div>
      </Card>

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
