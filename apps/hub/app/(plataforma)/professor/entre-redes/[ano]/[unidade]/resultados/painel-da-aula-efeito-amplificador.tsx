"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

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
  Table,
  type TableColumn,
} from "@edu/ui/ds";
import { AVISO_POR_COMPUTADOR, chaveDaLinha } from "@/lib/equipe-no-painel";
import {
  MANCHETES,
  ROTULO_DA_MANCHETE,
  ROTULO_DO_PASSO,
  erroDaApi,
  percentualNaMadrugada,
  rotuloDaFase,
  type PainelDaTurma,
} from "@/lib/efeito-amplificador-tipos";

import { EquipeNaLinha } from "./equipe-na-linha";

const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
/** O estudante lê a fase a cada 3 s; o painel se relê a cada 5 s enquanto a aula anda. */
const INTERVALO_MS = 5_000;

type Acao = "pausar" | "liberar_explicar";

/** Os dois botões são irreversíveis: a fase só anda para a frente. */
const CONFIRMACAO: Readonly<Record<Acao, { botao: string; titulo: string; texto: string }>> = {
  pausar: {
    botao: "Pausar Telas para Debate",
    titulo: "Pausar as telas para o debate?",
    texto:
      "As telas dos estudantes congelam com a mensagem “Aguardando a liberação do orientador do grêmio para avançar...”. Conduza a revelação com a curva da turma e as perguntas abaixo. Não dá para despausar: o próximo passo é liberar a Etapa 5.",
  },
  liberar_explicar: {
    botao: "Liberar Etapa 5",
    titulo: "Liberar a Etapa 5 para a turma?",
    texto:
      "Cada aparelho sai do feed e vai aos bastidores da entrega: o estudante aponta o pico das 02h30 e o tempo de tela, e a tela formaliza a economia da atenção. O feed fecha — o que não foi feito lá fica registrado como não atingido. Não dá para voltar.",
  },
};

type Linha = PainelDaTurma["linhas"][number];

/**
 * A CONDUÇÃO AO VIVO de O Efeito Amplificador (E4-PROF-01): a lousa da turma, os
 * dois botões e a folha.
 *
 * A LOUSA (`resumo`) é o que vai ao projetor, e por isso não tem nome nem nível:
 * quantas publicações, a curva de entrega e as manchetes escolhidas — o
 * desmonte da culpa é "100% das postagens tiveram o pico de madrugada,
 * qualquer que fosse a manchete". A FOLHA, com nomes, é só da tela do professor.
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
  const [confirmando, setConfirmando] = useState<Acao | null>(null);
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

  async function mudar(acao: Acao) {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`${url}/gate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para mudar a etapa agora.").mensagem);
        return;
      }
      setConfirmando(null);
      setPainel((atual) => ({ ...atual, fase: (corpo as { fase: PainelDaTurma["fase"] }).fase }));
      transicionar(() => router.refresh());
    } catch {
      setErro(SEM_REDE);
    } finally {
      setEnviando(false);
    }
  }

  const fase = painel.fase ?? "aberta";
  const r = painel.resumo;
  const naMadrugada = percentualNaMadrugada(r);
  const colunas: TableColumn<Linha>[] = [
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
    { key: "passo", title: "Onde está", minWidth: 180, render: (_, linha) => ROTULO_DO_PASSO[linha.passo] },
    {
      key: "manchete",
      title: "Manchete publicada",
      minWidth: 160,
      render: (_, linha) => (linha.manchete ? ROTULO_DA_MANCHETE[linha.manchete] : "—"),
    },
  ];

  return (
    <div className="flex flex-col gap-6" data-painel-da-aula>
      <Card variant="elevated">
        <div className="flex flex-col gap-4" data-lousa>
          <SectionHeader
            title="Condução da Turma — O Efeito Amplificador"
            description={`${rotuloDaFase(painel.fase)} · Para o projetor: sem nomes e sem níveis.`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard title="Publicaram no Unoovista" value={`${r.publicaram} de ${r.unidades}`} />
            <MetricCard
              title="Posts com pico de entrega entre 01h00 e 03h30"
              value={naMadrugada === null ? "—" : `${naMadrugada}%`}
            />
          </div>
          {/* As manchetes em linha, e não num cartão de métrica: três números com rótulo não cabem num valor só. */}
          <p className="text-[14px] text-unooria-neutral-800" data-manchetes>
            <strong>Manchetes escolhidas:</strong>{" "}
            {MANCHETES.map((m) => `${ROTULO_DA_MANCHETE[m]} ${r.manchetes[m]}`).join(" · ")}
          </p>
          {naMadrugada !== null ? (
            <p className="text-[14px] font-semibold text-unooria-neutral-950" data-desmonte>
              {`${naMadrugada}% das postagens da turma tiveram pico de entrega entre 01h00 e 03h30 da manhã, independentemente da manchete escolhida.`}
            </p>
          ) : null}
          <figure className="flex flex-col gap-2" aria-label="Entrega por faixa de horário">
            <figcaption className="text-[13px] font-semibold text-unooria-neutral-700">Entrega por faixa de horário</figcaption>
            <ul className="flex flex-col gap-1">
              {r.entrega.map((e) => (
                <li key={e.faixa} className="grid grid-cols-[96px_1fr_44px] items-center gap-2 text-[12px] text-unooria-neutral-700">
                  <span>{e.faixa}</span>
                  {/* `block`: a barra mede a largura em % do trilho, e um trilho em linha não tem largura. */}
                  <span className="block h-2 overflow-hidden rounded-full bg-unooria-neutral-100" aria-hidden="true">
                    <span className="block h-2 rounded-full" style={{ width: `${e.percentual}%`, background: "var(--unooria-color-brandnavy-700, #2a3550)" }} />
                  </span>
                  <span className="text-right">{e.percentual}%</span>
                </li>
              ))}
            </ul>
          </figure>
          {podeConduzir ? (
            <div className="flex flex-wrap gap-3" data-botoes-da-aula>
              <Button variant="secondary" size="md" isDisabled={fase !== "aberta"} onClick={() => setConfirmando("pausar")}>
                {CONFIRMACAO.pausar.botao}
              </Button>
              <Button variant="primary" size="md" isDisabled={fase === "explicar"} onClick={() => setConfirmando("liberar_explicar")}>
                {CONFIRMACAO.liberar_explicar.botao}
              </Button>
            </div>
          ) : null}
          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
        </div>
      </Card>

      <Card variant="outlined">
        <div className="flex flex-col gap-3" data-roteiro>
          <SectionHeader title="A revelação — perguntas do debate" description={fase === "explicar" ? painel.roteiro.instrucoes.liberar : painel.roteiro.instrucoes.pausar} />
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
            {painel.roteiro.perguntas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-3" data-folha>
          <SectionHeader
            title="Folha da turma"
            description="Para a sua tela, não para o projetor. O nível de cada habilidade fica no painel de habilidades, abaixo; o que cada estudante escreveu ao UnooriaAI não sai do aparelho dele."
          />
          {painel.porComputador ? <FeedbackAlert type="info" description={AVISO_POR_COMPUTADOR} /> : null}
          <ScrollBar orientation="both" autoHide className="tabela-rolavel">
            <Table<Linha>
              columns={colunas}
              data={[...painel.linhas]}
              keyExtractor={(linha) => chaveDaLinha(linha)}
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
