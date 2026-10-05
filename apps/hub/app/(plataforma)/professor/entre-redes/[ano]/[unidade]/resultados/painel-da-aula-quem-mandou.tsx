"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

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
  botoesDaAula,
  deveConsultar,
  duracaoLegivel,
  erroDaApi,
  faseAtingiu,
  mensagemPorId,
  mudouAEvidencia,
  quadranteDe,
  rotuloDaOpcao,
} from "@/lib/quem-mandou-regras";
import {
  ROTULO_DA_FASE,
  ROTULO_DO_PASSO,
  ROTULO_DO_QUADRANTE,
  type AcaoDoGate,
  type LinhaDoPainel,
  type MensagemDoPacote,
  type OpcoesDaMissao,
  type PainelDaTurma,
} from "@/lib/quem-mandou-tipos";

import { EquipeNaLinha } from "./equipe-na-linha";
import { TermometroQuemMandou } from "./termometro-quem-mandou";

const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";

/** A cada quanto o painel se relê enquanto a aula anda. O estudante lê a fase a cada 3 s. */
const INTERVALO_MS = 5_000;

/**
 * A instrução do botão do meio — texto escrito para esta frente (a copy só tem
 * D0-5 para a revelação e a reflexão, e essas duas vêm LITERAIS da api em
 * `painel.roteiro.instrucoes`). À revisão do PO.
 */
const INSTRUCAO_DA_SINTESE =
  "Leva aos aparelhos a síntese da aula — a embalagem da mensagem desarma a checagem — para abrir a roda de conversa. É opcional: depois da revelação, dá para ir direto para a reflexão.";

/** O que cada confirmação diz. Os três botões são irreversíveis: a fase só anda para a frente. */
const CONFIRMACAO: Readonly<Record<AcaoDoGate, { titulo: string; texto: string }>> = {
  liberar_revelacao: {
    titulo: "Liberar a revelação para a turma?",
    texto:
      "Os aparelhos passam a mostrar os dois selos — verdadeira ou falsa, emocional ou neutra — nas 3 mensagens de cada um, e o Termômetro aparece aqui para você projetar. Não dá para desfazer. Quem ainda não confirmou o Mural continua escolhendo e vê a própria revelação quando votar.",
  },
  apresentar_sintese: {
    titulo: "Apresentar a síntese?",
    texto: "Os aparelhos saem da revelação e mostram a síntese da aula. Não dá para voltar à revelação.",
  },
  liberar_reflexao: {
    titulo: "Liberar a reflexão?",
    texto:
      "Cada um volta ao chat da Nina e responde às duas perguntas finais, que registram a EF05CO03 e a EF05CO04. Não dá para desfazer — libere depois da roda de conversa.",
  },
};

/**
 * O PAINEL DA AULA da exp05ef1b (E4-PROF-01, E5-PROF-01, E7-PROF-01): o
 * progresso, os três botões, o Termômetro, o roteiro da roda e a folha da
 * turma.
 *
 * Client component de propósito: a professora aperta no meio da aula, na frente
 * da sala, e a mutação vai pelo BFF (`/api/plataforma/quem-mandou-isso/...`),
 * que assina o token — o client do hub nunca segura bearer.
 *
 * **A TELA ANDA SOZINHA** enquanto a aula acontece: sem isso, "0 de 30
 * votaram" ficaria parado enquanto os trinta votam, e é por esse número que ela
 * decide a hora de liberar a revelação (o defeito da v1). Relê só o PAINEL, a
 * cada 5 s, e para quando não há pacote, quando a turma inteira concluiu ou
 * quando a aba não está à vista. A página inteira (`router.refresh()`, que
 * traz o painel de habilidades junto) só é relida quando muda o que a
 * evidência registra — o Mural fechado, a missão concluída, a rodada.
 *
 * **Esta tela NÃO é para o projetor**: ela tem os selos de cada mensagem e a
 * folha com nomes. O que vai para a parede é "Projetar o Termômetro", uma
 * janela do DS em tela cheia com só a conta da turma.
 */
export function PainelDaAulaQuemMandou({
  turmaId,
  inicial,
  mensagens,
  opcoes,
  podeConduzir,
}: {
  turmaId: string;
  inicial: PainelDaTurma;
  /** As mensagens do pacote ATIVO, para nomear as escolhas da folha (vazio se não houver). */
  mensagens: readonly MensagemDoPacote[];
  /** Os rótulos da enquete, como a criança os leu (vêm da api). */
  opcoes: OpcoesDaMissao;
  /** Só o professor aperta os botões (a api recusaria o resto). */
  podeConduzir: boolean;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const idDoTituloDaConfirmacao = useId();
  const idDoTituloDaProjecao = useId();

  /* O `router.refresh()` entrega um `inicial` novo: a tela passa a mostrá-lo
     (o ajuste de estado durante o render que o React recomenda para prop que
     muda — o mesmo desenho do painel de habilidades). */
  const [painel, setPainel] = useState(inicial);
  const [inicialVisto, setInicialVisto] = useState(inicial);
  if (inicial !== inicialVisto) {
    setInicialVisto(inicial);
    setPainel(inicial);
  }

  const [confirmando, setConfirmando] = useState<AcaoDoGate | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [projetando, setProjetando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const url = `/api/plataforma/quem-mandou-isso/turmas/${encodeURIComponent(turmaId)}`;

  const ultimo = useRef(painel);
  useEffect(() => {
    ultimo.current = painel;
  }, [painel]);

  const atualizar = useCallback(async () => {
    try {
      const r = await fetch(`${url}/painel`, { cache: "no-store" });
      if (!r.ok) return;
      const novo = (await r.json()) as PainelDaTurma;
      const antes = ultimo.current;
      setPainel(novo);
      if (mudouAEvidencia(antes, novo)) transicionar(() => router.refresh());
    } catch {
      /* Rede oscilou: a próxima volta tenta de novo, e a tela fica com o último número bom. */
    }
  }, [url, router]);

  const consultar = deveConsultar(painel);
  useEffect(() => {
    if (!consultar) return;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void atualizar();
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [consultar, atualizar]);

  async function mudarFase(acao: AcaoDoGate) {
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
      await atualizar();
      transicionar(() => router.refresh());
    } catch {
      setErro(SEM_REDE);
    } finally {
      setEnviando(false);
    }
  }

  const { progresso, fase, porComputador } = painel;
  const botoes = botoesDaAula(fase);
  const revelada = faseAtingiu(fase, "revelacao");
  const deQuantos = (n: number) => `${n}/${progresso.unidades}`;
  const instrucaoDe: Record<AcaoDoGate, string> = {
    liberar_revelacao: painel.roteiro.instrucoes.revelacao,
    apresentar_sintese: INSTRUCAO_DA_SINTESE,
    liberar_reflexao: painel.roteiro.instrucoes.reflexao,
  };

  return (
    <section className="flex flex-col gap-6" data-painel-da-aula data-fase={fase ?? "sem-pacote"}>
      <Card variant="elevated">
        <div className="flex flex-col gap-4">
          <SectionHeader
            title="A aula"
            description={fase ? `Agora: ${ROTULO_DA_FASE[fase]}` : "Sem pacote aprovado para esta turma."}
          />

          {!painel.atividade ? (
            <FeedbackAlert
              type="warning"
              description="Aprove um pacote acima antes de conduzir: sem ele a turma não entra no grupo, e não há o que revelar."
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Entraram no grupo" value={deQuantos(progresso.entraram)} />
            <MetricCard title="Confirmaram o Mural" value={deQuantos(progresso.confirmaram)} />
            <MetricCard title="Votaram na enquete" value={deQuantos(progresso.votaram)} />
            <MetricCard title="Concluíram" value={deQuantos(progresso.concluiram)} />
          </div>
          {porComputador ? <p className="text-[12px] text-unooria-neutral-600">{AVISO_POR_COMPUTADOR}</p> : null}

          {podeConduzir && painel.atividade ? (
            <ol className="flex flex-col gap-4">
              {botoes.map((botao) => (
                <li key={botao.acao} className="flex flex-col gap-1" data-gate={botao.acao} data-estado={botao.estado}>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant={botao.proximo ? "primary" : "secondary"}
                      size="md"
                      isDisabled={botao.estado !== "disponivel" || enviando}
                      onClick={() => {
                        setErro(null);
                        setConfirmando(botao.acao);
                      }}
                    >
                      {botao.rotulo}
                    </Button>
                    {botao.estado === "feito" ? (
                      <Tag variant="success" size="sm">
                        Feito
                      </Tag>
                    ) : null}
                    {botao.acao === "liberar_revelacao" && botao.estado === "disponivel" ? (
                      <span className="text-[12px] text-unooria-neutral-600">
                        {progresso.votaram} de {progresso.unidades} já votaram
                      </span>
                    ) : null}
                  </div>
                  <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">{instrucaoDe[botao.acao]}</p>
                </li>
              ))}
            </ol>
          ) : null}

          {erro && !confirmando ? <FeedbackAlert type="error" description={erro} /> : null}
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-4">
          <SectionHeader
            title="Termômetro da Turma — Como a sala compartilhou"
            description={
              revelada
                ? `${painel.turma.nome}. Projete pela janela abaixo: nela só aparece a conta da turma.`
                : "Aparece aqui quando você liberar a revelação — antes dela, só o progresso acima."
            }
            actions={
              revelada && painel.termometro ? (
                <Button variant="secondary" size="sm" onClick={() => setProjetando(true)} data-acao="projetar-termometro">
                  Projetar o Termômetro
                </Button>
              ) : undefined
            }
          />
          {revelada && painel.termometro ? (
            <TermometroQuemMandou termometro={painel.termometro} motivos={opcoes.motivos} porComputador={porComputador} />
          ) : null}
        </div>
      </Card>

      {revelada ? (
        <Card variant="outlined">
          <div className="flex flex-col gap-3" data-roteiro>
            <SectionHeader title="Roda de Conversa — Roteiro de Perguntas" description="Sugestão: de 5 a 7 minutos." />
            <ul className="flex flex-col gap-2 text-[15px] leading-relaxed text-unooria-neutral-900">
              {painel.roteiro.perguntas.map((pergunta) => (
                <li key={pergunta}>{pergunta}</li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      <FolhaDaTurma linhas={painel.linhas} mensagens={mensagens} opcoes={opcoes} porComputador={porComputador} />

      <Modal
        isOpen={confirmando !== null}
        onClose={() => (enviando ? undefined : setConfirmando(null))}
        size="sm"
        theme="light"
        aria-labelledby={idDoTituloDaConfirmacao}
      >
        <ModalHeader showCloseButton={false}>
          <ModalTitle id={idDoTituloDaConfirmacao}>{confirmando ? CONFIRMACAO[confirmando].titulo : ""}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
              {confirmando ? CONFIRMACAO[confirmando].texto : ""}
            </p>
            {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" isDisabled={enviando} onClick={() => setConfirmando(null)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            isDisabled={enviando}
            isLoading={enviando}
            onClick={() => (confirmando ? void mudarFase(confirmando) : undefined)}
          >
            {confirmando ? (botoes.find((b) => b.acao === confirmando)?.rotulo ?? "Confirmar") : "Confirmar"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* O TELÃO: uma janela do DS no maior tamanho, e não uma rota — uma página
          de tela cheia herdaria a trilha e o layout da área (o mesmo desenho de
          "Mostrar equipes"). Só a conta da turma entra aqui. */}
      <Modal
        isOpen={projetando && painel.termometro !== null}
        onClose={() => setProjetando(false)}
        size="full"
        theme="light"
        aria-labelledby={idDoTituloDaProjecao}
      >
        <ModalHeader showCloseButton={false}>
          <ModalTitle id={idDoTituloDaProjecao}>Termômetro da Turma — Como a sala compartilhou</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {painel.termometro ? (
            <TermometroQuemMandou
              termometro={painel.termometro}
              motivos={opcoes.motivos}
              porComputador={porComputador}
              grande
            />
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" size="md" onClick={() => setProjetando(false)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </section>
  );
}

/**
 * E7-PROF-01 — a FOLHA DA TURMA, com os rótulos de coluna da copy. É para a
 * tela da professora, nunca para o projetor: tem nome e a regra que cada
 * criança escreveu.
 *
 * O que ela NÃO tem, de propósito: coluna de nível ou de acerto (o nível por
 * habilidade é do painel de habilidades, logo abaixo, onde ela também o
 * ajusta), coluna ordenável (ordenar crianças por escolha vira ranking) e
 * "Exportar" (não há exportação nesta versão). As escolhas aparecem com o
 * quadrante porque é o que ela precisa para ler a regra e ajustar a EF05CO08;
 * o Termômetro, que vai para a parede, não tem nome nenhum.
 *
 * O texto da regra é TEXTO LIVRE DE MENOR: a api o manda só para quem leciona
 * na turma e devolve `null` para os outros — a tela cai no aviso sem ramo por
 * papel.
 */
function FolhaDaTurma({
  linhas,
  mensagens,
  opcoes,
  porComputador,
}: {
  linhas: readonly LinhaDoPainel[];
  mensagens: readonly MensagemDoPacote[];
  opcoes: OpcoesDaMissao;
  porComputador: boolean;
}) {
  const colunas: TableColumn<LinhaDoPainel>[] = [
    {
      key: "nome",
      title: porComputador ? "Estudante ou equipe" : "Estudante",
      minWidth: 200,
      render: (_, linha) =>
        linha.equipe ? (
          <EquipeNaLinha equipe={linha.equipe} representante={linha.nome} entrou={linha.passo !== "abertura"} />
        ) : (
          <span className="font-semibold text-unooria-neutral-950">{linha.nome}</span>
        ),
    },
    {
      key: "passo",
      title: "Onde está",
      minWidth: 160,
      render: (_, linha) => ROTULO_DO_PASSO[linha.passo],
    },
    {
      key: "selecao",
      title: "Mensagens Encaminhadas",
      minWidth: 240,
      render: (_, linha) =>
        linha.selecao ? (
          <ul className="flex flex-col gap-1">
            {linha.selecao.map((id) => {
              const achada = mensagemPorId(mensagens, id);
              return (
                <li key={id} className="flex flex-wrap items-center gap-1 text-[12px]">
                  <span>{achada ? `${achada.posicao} · ${achada.mensagem.remetente}` : id}</span>
                  {achada ? (
                    <Tag variant={achada.mensagem.veracidade === "verdadeira" ? "success" : "danger"} size="sm">
                      {ROTULO_DO_QUADRANTE[quadranteDe(achada.mensagem)]}
                    </Tag>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          "—"
        ),
    },
    {
      key: "motivo",
      title: "Motivo Declarado",
      minWidth: 180,
      render: (_, linha) => rotuloDaOpcao(opcoes.motivos, linha.motivo) ?? "—",
    },
    {
      key: "tempoFeedSegundos",
      title: "Tempo no grupo",
      align: "right",
      render: (_, linha) => duracaoLegivel(linha.tempoFeedSegundos),
    },
  ];

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-3" data-folha>
        <SectionHeader
          title="Diário de Bordo — Relatório Formativo da Turma"
          description="Para a sua tela, não para o projetor: aqui estão os nomes e o que cada um encaminhou. O nível de cada habilidade fica no painel de habilidades, abaixo."
        />
        <ScrollBar orientation="both" autoHide className="tabela-rolavel">
          <Table<LinhaDoPainel>
            columns={colunas}
            data={[...linhas]}
            keyExtractor={(linha) => chaveDaLinha(linha)}
            emptyText="A turma ainda não tem estudantes."
            size="md"
            theme="light"
          />
        </ScrollBar>
      </div>
    </Card>
  );
}
