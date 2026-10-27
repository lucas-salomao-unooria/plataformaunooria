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
  Tag,
  type TableColumn,
} from "@edu/ui/ds";
import { AVISO_POR_COMPUTADOR, chaveDaLinha } from "@/lib/equipe-no-painel";
import {
  ROTULO_DO_ELEMENTO,
  ROTULO_DO_MOTIVO,
  ROTULO_DO_PASSO,
  erroDaApi,
  mudouAEvidencia,
  rotuloDaFase,
  segundosDaLupa,
  type GateDaTurma,
  type LinhaDoPainel,
  type PainelDaTurma,
} from "@/lib/enigma-capa-tipos";

import { EquipeNaLinha } from "./equipe-na-linha";

const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
/** O aparelho lê a fase a cada 3 s; o painel se relê a cada 5 s enquanto a aula anda. */
const INTERVALO_MS = 5_000;

/**
 * A CONDUÇÃO AO VIVO de O Enigma da Capa da Rádio (ADR-184, ADR-186): quantas crianças
 * aguardam a virada, o botão LIBERAR VIRADA e a folha por criança.
 *
 * **A virada é GERAL da turma e só anda para a frente** (decisão do Lucas,
 * 2026-10-26): um toque, com confirmação, e quem já publicou a capa sai do
 * AGUARDE O PROFESSOR para a comparação. Quem publicar depois passa direto.
 *
 * A FOLHA é o que cada criança FEZ — lupa, capa, objetos iguais, o que marcou
 * fora, par, segunda foto —, pelo NOME, para a conversa individual. O nível
 * de cada habilidade não está aqui: é do painel de habilidades, que o polling
 * mantém em dia (`router.refresh()` quando `mudouAEvidencia`).
 */
export function PainelDaAulaEnigmaCapa({
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
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const url = `/api/plataforma/enigma-capa/turmas/${encodeURIComponent(turmaId)}`;
  const todosConcluiram = painel.linhas.length > 0 && painel.linhas.every((l) => l.passo === "concluida");

  useEffect(() => {
    if (!painel.atividade || todosConcluiram) return;
    /* A última leitura, para comparar a evidência: começa no que o servidor
       renderizou (o `refresh` traz um `inicial` novo e recria o laço). */
    let ultimo = inicial;
    const id = setInterval(() => {
      void fetch(`${url}/painel`, { cache: "no-store" })
        .then(async (r) => (r.ok ? ((await r.json()) as PainelDaTurma) : null))
        .then((novo) => {
          if (!novo) return;
          const mudou = mudouAEvidencia(ultimo, novo);
          ultimo = novo;
          setPainel(novo);
          if (mudou) transicionar(() => router.refresh());
        })
        .catch(() => undefined);
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [url, inicial, painel.atividade, todosConcluiram, router]);

  async function liberarVirada() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`${url}/gate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ para: "virada" }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para liberar a virada agora.").mensagem);
        return;
      }
      setConfirmando(false);
      setPainel((atual) => ({ ...atual, fase: (corpo as GateDaTurma).fase ?? "virada" }));
      transicionar(() => router.refresh());
    } catch {
      setErro(SEM_REDE);
    } finally {
      setEnviando(false);
    }
  }

  const virada = painel.fase === "virada";
  const r = painel.resumo;
  const colunas: TableColumn<LinhaDoPainel>[] = [
    {
      key: "nome",
      title: painel.porComputador ? "Estudante ou equipe" : "Estudante",
      minWidth: 180,
      render: (_, linha) =>
        linha.equipe ? (
          <EquipeNaLinha equipe={linha.equipe} representante={linha.nome} entrou={linha.passo !== "inicio"} />
        ) : (
          <span className="font-semibold text-unooria-neutral-950">{linha.nome}</span>
        ),
    },
    {
      key: "passo",
      title: "Onde está",
      minWidth: 190,
      render: (_, linha) =>
        linha.aguardandoVirada ? (
          <Tag variant="warning" size="sm" pill>
            Aguarda a virada
          </Tag>
        ) : linha.passo === "inicio" ? (
          "Ainda não entrou"
        ) : (
          ROTULO_DO_PASSO[linha.passo]
        ),
    },
    { key: "lupa", title: "Lupa nos 2 objetos, por foto (E2)", minWidth: 260, render: (_, linha) => textoDaLupa(linha) },
    { key: "capa", title: "Capa (E3)", minWidth: 220, render: (_, linha) => textoDaCapa(linha) },
    { key: "invariantes", title: "2 coisas iguais (E4)", minWidth: 190, render: (_, linha) => textoDosInvariantes(linha) },
    { key: "fora", title: "Marcou fora da foto (E4)", minWidth: 220, render: (_, linha) => textoDoFora(linha) },
    {
      key: "par",
      title: "Par (E5)",
      minWidth: 170,
      render: (_, linha) =>
        linha.par ? `${ROTULO_DO_MOTIVO[linha.par.motivo]} · ${linha.par.correto ? "mesma atividade" : "juntou pela cor"}` : "—",
    },
    {
      key: "segunda",
      title: "Segunda foto (E5)",
      minWidth: 190,
      render: (_, linha) =>
        linha.segundaFoto
          ? `${ROTULO_DO_ELEMENTO[linha.segundaFoto.elemento]} · ${linha.segundaFoto.essencialVisivel ? "a leitura aparece" : "a leitura ficou fora"}`
          : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6" data-painel-da-aula>
      <Card variant="elevated">
        <div className="flex flex-col gap-4" data-lousa>
          <SectionHeader
            title="Condução da Turma — O Enigma da Capa da Rádio"
            description={`${rotuloDaFase(painel.fase)}${painel.atividade ? ` · ${painel.atividade.espaco}` : ""}`}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard title="Entraram" value={`${r.entraram} de ${r.unidades}`} />
            <MetricCard title="Publicaram a capa" value={`${r.publicaram}`} />
            <MetricCard title="Aguardam a virada" value={virada ? "—" : `${r.aguardandoVirada}`} />
            <MetricCard title="Marcaram algo fora da foto" value={`${r.marcaramFora}`} />
            <MetricCard title="Concluíram" value={`${r.concluiram}`} />
          </div>
          {podeConduzir ? (
            <div className="flex flex-col items-start gap-2" data-botoes-da-aula>
              <Button variant="primary" size="md" isDisabled={virada || !painel.atividade} onClick={() => setConfirmando(true)} data-acao="liberar-virada">
                {virada ? "Virada liberada" : "LIBERAR VIRADA"}
              </Button>
              <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
                {virada ? painel.roteiro.liberar : `Antes, converse com quem publicou: “${painel.roteiro.pausa}”`}
              </p>
            </div>
          ) : null}
          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
        </div>
      </Card>

      <Card variant="outlined">
        <div className="flex flex-col gap-3" data-roteiro>
          <SectionHeader title="A conversa individual" description={`Em todo arraste: “${painel.roteiro.regraDoArraste}”`} />
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            <strong>Na pausa:</strong> {painel.roteiro.pausa}
          </p>
          <div className="flex flex-wrap items-center gap-2" data-cartoes>
            <span className="text-[13px] font-semibold text-unooria-neutral-700">Os cartões, depois da virada:</span>
            {painel.roteiro.cartoes.map((c) => (
              <Tag key={c} variant="info" size="sm" pill>
                {c}
              </Tag>
            ))}
          </div>
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
            description="Para a sua tela, não para o projetor: o que cada criança fez, para a conversa. O nível de cada habilidade fica na aba Habilidades."
          />
          {painel.porComputador ? <FeedbackAlert type="info" description={AVISO_POR_COMPUTADOR} /> : null}
          <ScrollBar orientation="both" autoHide className="tabela-rolavel">
            <Table<LinhaDoPainel>
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

      <Modal isOpen={confirmando} onClose={() => !enviando && setConfirmando(false)} size="sm" theme="light" aria-labelledby={idDoTitulo}>
        <ModalHeader showCloseButton={false}>
          <ModalTitle id={idDoTitulo}>Liberar a virada para a turma toda?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-700">
            <p>
              {r.aguardandoVirada === 1
                ? "1 estudante aguarda a virada agora."
                : `${r.aguardandoVirada} estudantes aguardam a virada agora.`}{" "}
              A tela de quem já publicou divide em SUA FOTO e OUTRA FOTO, e quem publicar depois passa direto para a
              comparação.
            </p>
            <p className="text-[13px] text-unooria-neutral-600">
              É um botão só, para a turma toda, e não volta. Converse antes: “{painel.roteiro.pausa}”
            </p>
            {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" isDisabled={enviando} onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" isDisabled={enviando} isLoading={enviando} onClick={() => void liberarVirada()}>
            LIBERAR VIRADA
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

/**
 * O tempo com a lupa sobre cada um dos dois objetos do fundo EM CADA foto (o
 * piso é 3 s em cada um dos quatro — achar na foto 1 não acha na 2, ADR-188)
 * e os alertas OLHE O FUNDO.
 */
function textoDaLupa(l: LinhaDoPainel): string {
  if (!l.lupa) return "—";
  const t = l.lupa.tempos;
  const tempos = `foto 1: ${segundosDaLupa(t["inv-1:foto-1"])} e ${segundosDaLupa(t["inv-2:foto-1"])} · foto 2: ${segundosDaLupa(t["inv-1:foto-2"])} e ${segundosDaLupa(t["inv-2:foto-2"])}`;
  const alertas = l.lupa.alertas === 0 ? "sem alerta" : l.lupa.alertas === 1 ? "1 alerta" : `${l.lupa.alertas} alertas`;
  return `${tempos} · ${alertas}${l.lupa.liberada ? "" : " · explorando"}`;
}

/** "Marcou X de Y" (Y = o que ficou fora de verdade), com os nomes do que marcou. */
function textoDoFora(l: LinhaDoPainel): string {
  if (!l.fora) return "—";
  const n = l.fora.itens.length;
  const marcou = `marcou ${n} de ${l.fora.possiveis}`;
  return n > 0 ? `${marcou}: ${l.fora.itens.map((i) => i.nome).join(", ")}` : marcou;
}

function textoDaCapa(l: LinhaDoPainel): string {
  if (!l.capa) return "—";
  const foto = l.capa.fotoId === "foto-1" ? "FOTO 1" : "FOTO 2";
  return `${foto} · selo ${l.capa.seloCoerente ? "combina" : "não combina"} · “${l.capa.visitante}”`;
}

function textoDosInvariantes(l: LinhaDoPainel): string {
  if (!l.invariantes) return "—";
  const i = l.invariantes;
  const achados = i.completo ? "achou os 2 nas 2 fotos" : `${i.encontrados} de 4 toques certos`;
  const erros = i.erros === 1 ? "1 erro" : `${i.erros} erros`;
  return `${achados} · ${erros}${i.ajuda ? ` · com a ajuda (${i.errosPosAjuda} depois)` : ""}`;
}
