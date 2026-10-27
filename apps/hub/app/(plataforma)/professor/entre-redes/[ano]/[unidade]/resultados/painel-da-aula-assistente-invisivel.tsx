"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import {
  Button,
  Card,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ProgressBar,
  ScrollBar,
  SectionHeader,
  Table,
  Tag,
  type TableColumn,
} from "@edu/ui/ds";
import { BotaoImprimir } from "@/components/guia/botao-imprimir";
import { AVISO_POR_COMPUTADOR } from "@/lib/equipe-no-painel";
import {
  APOSTAS,
  ETIQUETA_DO_MOMENTO,
  PAUSA_FEITA,
  acoesDoMomento,
  momentoDoPainel,
  ROTULO_DA_APOSTA,
  ROTULO_DO_NIVEL,
  ROTULO_DO_PASSO,
  avisoDiscreto,
  criteriosEmTexto,
  erroDaApi,
  mudouAEvidencia,
  percentual,
  type Fase,
  type GateDaTurma,
  type LinhaDoPainel,
  type MomentoDoPainel,
  type Nivel,
  type PainelDaTurma,
} from "@/lib/assistente-invisivel-tipos";

import { EquipeNaLinha } from "./equipe-na-linha";
import "./relatorio-de-homologacao.css";

const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
/** O aparelho lê o gate a cada 3 s; o painel se relê a cada 5 s enquanto a aula anda. */
const INTERVALO_MS = 5_000;
/** O nome da folha de impressão do relatório (`relatorio-de-homologacao.css`). */
const IMPRESSAO = "relatorio-homologacao";

/**
 * As duas barras do gráfico 1A × 1C (E5-PROF-01, literal do Figma): o rótulo
 * e o sentido de cada uma. O 1B NÃO entra no gráfico — o quadro compara as
 * duas estratégias equitativas da sala; quem manteve o 1B aparece nos Avisos
 * Discretos. O percentual é sobre 1A + 1C.
 */
const BARRAS_DO_CRITERIO_1: { opcao: "a" | "c"; rotulo: string; sentido: string }[] = [
  { opcao: "a", rotulo: "Critério 1A (Autonomia / Livre Escolha)", sentido: "Prioriza decisão voluntária do estudante sem barreiras." },
  { opcao: "c", rotulo: "Critério 1C (Progressão por Acertos)", sentido: "Critério pedagógico objetivo sem dedução de cansaço por horário." },
];

/** A instrução dos dois momentos da Mediação 1 (E4-PROF-01 "pausado", literal do Figma). */
const INSTRUCAO_DA_MEDIACAO_1 =
  "A turma concluiu as sessões simuladas. Clique em “Travar Telas da Turma” e inicie o debate de 8 minutos com as perguntas 1 e 2 do roteiro. Concluída a conversa, clique em “Liberar Bancada de Reconstrução” para abrir a Etapa 5.";
/** A instrução dos dois momentos da Mediação 2 (E5-PROF-01 "pausado", literal do Figma). */
const INSTRUCAO_DA_MEDIACAO_2 =
  "A turma retestou as novas regras. Clique em “Pausar para Comparação” e projete no quadro o contraste entre os critérios 1A e 1C durante 5 minutos. Concluída a síntese, clique em “Liberar Publicação e Transparência” para abrir a Etapa 6.";

/** A confirmação de cada botão: são todos só para a frente. */
const CONFIRMACAO: Partial<Record<Fase, { titulo: string; texto: string }>> = {
  testes: {
    titulo: "Liberar o início dos testes para a turma?",
    texto: "As telas saem das boas-vindas para o módulo de teste. Apresente antes o papel da turma como comissão de auditoria.",
  },
  simulacao: {
    titulo: "Liberar o início da simulação?",
    texto: "Todas as apostas estão arquivadas. As telas abrem as sessões de chat do UnooriaAI.",
  },
  "debate-1": {
    titulo: "Travar as telas da turma?",
    texto: "Todas as telas vão para a espera, inclusive de quem ainda está nas fichas. Conduza as perguntas 1 e 2 do roteiro.",
  },
  explicar: {
    titulo: "Liberar a bancada de reconstrução?",
    texto: "Quem concluiu a inspeção passa para a Etapa 5: os cartões, as etapas do algoritmo e o banco de critérios.",
  },
  "debate-2": {
    titulo: "Pausar para a comparação?",
    texto: "As telas da Etapa 5 vão para a espera enquanto você projeta 1A × 1C no quadro.",
  },
  publicar: {
    titulo: "Liberar a publicação e a transparência?",
    texto: "Quem já retestou passa para a Etapa 6: a página de transparência e o comunicado da comissão.",
  },
};

/**
 * A CONDUÇÃO AO VIVO de O Assistente Invisível (ADR-185): a aba "Aula ao vivo"
 * do template (ADR-182), com os estados do Figma por MOMENTO da turma
 * (`momentoDoPainel`: cada momento desenha só o que o quadro dele desenha) —
 * E1-PROF-01 (Liberar Início dos Testes), E3-PROF-01 (as apostas da sala e o
 * botão que só acende com 100%), E4-PROF-01 (Travar Telas / Liberar Bancada,
 * perguntas 1 e 2), E5-PROF-01 (1A × 1C, Avisos Discretos, Pausar /
 * Liberar Publicação) e E6-PROF-01 (o relatório formativo final, com a
 * exportação para impressão).
 *
 * **Os botões só andam para a frente** (`ACOES_DA_FASE`, o espelho de
 * `PROXIMAS_FASES` da api), com confirmação. Na pausa, o botão dela fica à
 * vista e desabilitado (`PAUSA_FEITA`), como o quadro "pausado" desenha. O painel se relê a cada 5 s e
 * chama `router.refresh()` quando a evidência muda (ADR-146) — as marcas vão
 * na publicação.
 */
export function PainelDaAulaAssistenteInvisivel({
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
  const [painel, setPainel] = useState(inicial);
  const [inicialVisto, setInicialVisto] = useState(inicial);
  if (inicial !== inicialVisto) {
    setInicialVisto(inicial);
    setPainel(inicial);
  }
  const [confirmando, setConfirmando] = useState<{ para: Fase; rotulo: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const url = `/api/plataforma/assistente-invisivel/turmas/${encodeURIComponent(turmaId)}`;
  const todosConcluiram = painel.linhas.length > 0 && painel.linhas.every((l) => l.passo === "concluida");

  useEffect(() => {
    if (!painel.atividade || (painel.fase === "publicar" && todosConcluiram)) return;
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
  }, [url, inicial, painel.atividade, painel.fase, todosConcluiram, router]);

  async function mudarFase(para: Fase) {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`${url}/gate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ para }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para mudar a etapa da turma agora.").mensagem);
        /* 409: outra tela já andou, ou ainda falta aposta. Relê para mostrar o estado certo. */
        if (r.status === 409) transicionar(() => router.refresh());
        return;
      }
      setConfirmando(null);
      setPainel((atual) => ({ ...atual, fase: (corpo as GateDaTurma).fase ?? para }));
      void fetch(`${url}/painel`, { cache: "no-store" })
        .then(async (resposta) => (resposta.ok ? ((await resposta.json()) as PainelDaTurma) : null))
        .then((novo) => novo && setPainel(novo))
        .catch(() => undefined);
    } catch {
      setErro(SEM_REDE);
    } finally {
      setEnviando(false);
    }
  }

  const fase = painel.fase;
  const r = painel.resumo;
  const momento = fase ? momentoDoPainel(fase, r) : null;
  const acoes = fase && momento ? acoesDoMomento(fase, momento) : [];
  const pausaFeita = fase ? PAUSA_FEITA[fase] : undefined;
  const confirmacao = confirmando ? CONFIRMACAO[confirmando.para] : undefined;

  return (
    <div className="flex flex-col gap-6" data-painel-da-aula data-fase-da-turma={fase ?? "sem-atividade"}>
      <Card variant="elevated">
        <div className="flex flex-col gap-5" data-lousa>
          <SectionHeader
            title="Painel ao Vivo"
            badge={
              momento ? (
                <Tag variant="info" size="sm" pill>
                  {ETIQUETA_DO_MOMENTO[momento]}
                </Tag>
              ) : undefined
            }
            description={
              painel.atividade
                ? `${painel.atividade.tema} · ${painel.atividade.disciplina} · rodada ${painel.atividade.rodada} · ${r.sessoes} ${
                    r.sessoes === 1 ? "sessão aberta" : "sessões abertas"
                  }`
                : "Sem atividade no ar"
            }
          />

          {momento ? <BlocoDoMomento painel={painel} momento={momento} /> : null}

          {podeConduzir && acoes.length > 0 ? (
            <div className="flex flex-col items-start gap-2" data-botoes-da-aula>
              <div className="flex flex-wrap gap-3">
                {pausaFeita ? (
                  <Button variant={pausaFeita.variante} size="md" isDisabled data-acao="pausa-feita">
                    {pausaFeita.rotulo}
                  </Button>
                ) : null}
                {acoes.map((acao) => {
                  const esperaApostas = acao.para === "simulacao" && !r.todosApostaram;
                  return (
                    <Button
                      key={acao.para}
                      variant={acao.variante}
                      size="md"
                      isDisabled={enviando || esperaApostas || !painel.atividade}
                      onClick={() => setConfirmando(acao)}
                      data-acao={`fase-${acao.para}`}
                    >
                      {acao.rotulo}
                    </Button>
                  );
                })}
              </div>
              {fase === "testes" ? (
                <p className="text-[12px] leading-snug text-unooria-neutral-600">
                  {r.todosApostaram
                    ? "Todas as apostas foram registradas e arquivadas."
                    : "O botão é liberado quando 100% da turma registrar a aposta."}
                </p>
              ) : null}
            </div>
          ) : null}
          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
        </div>
      </Card>

      {momento === "relatorio" ? <RelatorioFinal painel={painel} /> : null}

      <FolhaDaTurma painel={painel} />

      <Modal isOpen={confirmando !== null} onClose={() => !enviando && setConfirmando(null)} size="sm" theme="light">
        <ModalHeader showCloseButton={false}>
          <ModalTitle>{confirmacao?.titulo ?? confirmando?.rotulo}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-700">
            <p>{confirmacao?.texto}</p>
            <p className="text-[13px] text-unooria-neutral-600">Vale para a turma toda, e não volta.</p>
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
            onClick={() => confirmando && void mudarFase(confirmando.para)}
            data-acao="confirmar-fase"
          >
            {confirmando?.rotulo}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

/** "Status da Condução: …" e a instrução do Figma. */
function Status({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-[16px] font-bold text-unooria-neutral-950">{titulo}</h3>
      <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">{children}</p>
    </div>
  );
}

/** Uma barra do Figma ("[barra de gráfico] rótulo — N%"): o `ProgressBar` do DS com o percentual. */
function Barra({ rotulo, parte, total, sucesso }: { rotulo: string; parte: number; total: number; sucesso?: boolean }) {
  const pct = percentual(parte, total);
  return (
    <ProgressBar
      label={rotulo}
      value={parte}
      max={Math.max(total, 1)}
      valueFormatter={() => `${pct}%`}
      variant={sucesso && total > 0 && parte >= total ? "success" : "brand"}
    />
  );
}

function DistribuicaoDasApostas({ painel, titulo }: { painel: PainelDaTurma; titulo: string }) {
  const a = painel.resumo.apostas;
  const total = APOSTAS.reduce((s, k) => s + a[k], 0);
  return (
    <div className="flex flex-col gap-3" data-distribuicao-das-apostas>
      <h4 className="text-[14px] font-semibold text-unooria-neutral-950">{titulo}</h4>
      {APOSTAS.map((k) => (
        <Barra key={k} rotulo={ROTULO_DA_APOSTA[k]} parte={a[k]} total={total} />
      ))}
    </div>
  );
}

function Pergunta({ numero, texto }: { numero: number; texto: string | undefined }) {
  if (!texto) return null;
  return (
    <div className="flex flex-col gap-1" data-pergunta={numero}>
      <h4 className="text-[14px] font-semibold text-unooria-neutral-950">{`Pergunta ${numero} do Roteiro`}</h4>
      <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-800">{`“${texto}”`}</p>
    </div>
  );
}

/** O conteúdo da lousa em cada momento — cada um desenha só o que o quadro dele desenha no Figma. */
function BlocoDoMomento({ painel, momento }: { painel: PainelDaTurma; momento: MomentoDoPainel }) {
  const r = painel.resumo;
  const apostaram = APOSTAS.reduce((s, k) => s + r.apostas[k], 0);
  const perguntas = painel.roteiro.perguntas;

  switch (momento) {
    case "inicio":
      return (
        <Status titulo="Status da Condução: Papel da Turma">
          Apresente o papel da turma como comissão de auditoria de tecnologia da escola. Quando todos estiverem
          prontos, clique em “Liberar Início dos Testes”.
        </Status>
      );

    case "apostas":
      return (
        <div className="flex flex-col gap-4">
          <Status titulo={`Status da Condução: ${r.todosApostaram ? "Apostas Registradas" : "Aguardando Apostas"}`}>
            {r.todosApostaram
              ? "Todos registraram a aposta comprometida. Libere o início da simulação para a turma."
              : "Acompanhe o registro das apostas da turma. Segure o avanço no fim da Etapa 3 até todos registrarem sua aposta comprometida."}
          </Status>
          <DistribuicaoDasApostas painel={painel} titulo="Distribuição das Apostas da Sala" />
          <Barra rotulo="Apostas registradas pela turma" parte={apostaram} total={r.sessoes} sucesso />
          {r.faltamApostar.length > 0 ? (
            <div className="flex flex-col gap-2" data-faltam-apostar>
              <p className="text-[13px] font-semibold text-unooria-neutral-700">
                {`${painel.porComputador ? "Ainda não apostaram (por computador)" : "Ainda não apostaram"}:`}
              </p>
              <div className="flex flex-wrap gap-2">
                {r.faltamApostar.map((nome) => (
                  <Tag key={nome} variant="warning" size="sm" pill>
                    {nome}
                  </Tag>
                ))}
              </div>
              <p className="text-[12px] text-unooria-neutral-600">
                Conta quem abriu a missão nesta rodada: quem entrou e saiu também segura o botão.
              </p>
            </div>
          ) : null}
        </div>
      );

    /* E4-PROF-01 "pausado": o mesmo quadro antes e depois de travar — muda o título e o botão da pausa. */
    case "simulacao":
    case "telas-travadas":
      return (
        <div className="flex flex-col gap-4">
          <Status titulo={`Status da Condução: ${momento === "telas-travadas" ? "Telas Travadas" : "Sessões Simuladas"}`}>
            {INSTRUCAO_DA_MEDIACAO_1}
          </Status>
          <DistribuicaoDasApostas painel={painel} titulo="Distribuição das Apostas da Sala" />
          <Barra rotulo="Estudantes que concluíram as 3 sessões de chat" parte={r.simulacoesConcluidas} total={r.sessoes} sucesso />
          <Pergunta numero={1} texto={perguntas[0]} />
          <Pergunta numero={2} texto={perguntas[1]} />
        </div>
      );

    /* E4-PROF-01 "liberado": só a confirmação e as apostas consolidadas — a projeção e os botões da E5 ainda não. */
    case "bancada-liberada":
      return (
        <div className="flex flex-col gap-4">
          <FeedbackAlert
            type="success"
            title="Mediação 1 Concluída ✓"
            description="As telas dos estudantes foram desbloqueadas para a bancada de reconstrução na Etapa 5."
          />
          <DistribuicaoDasApostas painel={painel} titulo="Apostas Consolidadas da Sala" />
          <Barra rotulo="Estudantes na bancada de reconstrução" parte={r.naBancada} total={r.sessoes} sucesso />
        </div>
      );

    /* E5-PROF-01 "pausado": a projeção, antes e depois de pausar. */
    case "projecao":
    case "projecao-pausada":
      return <ProjecaoDeSolucoes painel={painel} />;

    /* E5-PROF-01 "liberado": só a confirmação — o relatório final vem com a primeira publicação. */
    case "publicacao-liberada":
      return (
        <FeedbackAlert
          type="success"
          title="Mediação 2 Concluída ✓"
          description="As telas dos estudantes foram desbloqueadas para a publicação da transparência na Etapa 6."
        />
      );

    case "relatorio":
      return null;
  }
}

/**
 * E5-PROF-01 "Projeção de Soluções": o gráfico 1A × 1C (SÓ as duas barras do
 * quadro, o percentual sobre 1A + 1C) e os Avisos Discretos. Antes e depois de
 * pausar, o mesmo texto do Figma; quem muda é o botão da pausa.
 */
function ProjecaoDeSolucoes({ painel }: { painel: PainelDaTurma }) {
  const c = painel.resumo.criterioExercicios;
  const total = c.a + c.c;
  const avisos = painel.linhas.flatMap((l) => {
    const aviso = avisoDiscreto(l);
    return aviso ? [`${l.equipe?.nome ?? l.nome} ${aviso}.`] : [];
  });

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-unooria-neutral-200 p-4" data-projecao-de-solucoes>
      <SectionHeader title="Projeção de Soluções" />
      <Status titulo="Comparação de Soluções no Quadro">{INSTRUCAO_DA_MEDIACAO_2}</Status>
      <div className="flex flex-col gap-3" data-criterios-1a-1c>
        <h4 className="text-[14px] font-semibold text-unooria-neutral-950">Critérios Escolhidos pela Sala: 1A × 1C</h4>
        {BARRAS_DO_CRITERIO_1.map((b) => (
          <div key={b.opcao} className="flex flex-col gap-1">
            <Barra rotulo={b.rotulo} parte={c[b.opcao]} total={total} />
            <p className="text-[13px] leading-snug text-unooria-neutral-700">{b.sentido}</p>
          </div>
        ))}
      </div>
      {avisos.length > 0 ? (
        <div data-avisos-discretos>
          <FeedbackAlert
            type="warning"
            title="Avisos Discretos"
            description={
              <span className="flex flex-col gap-1">
                <span>{`${painel.porComputador ? "Equipes" : "Estudantes"} que avançaram mantendo regras restritivas:`}</span>
                <ul className="list-disc pl-5">
                  {avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </span>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

const HABILIDADES_DO_RELATORIO = [
  { chave: "co20", codigo: "EM13CO20 (Foco)", descricao: "Criação de transparência e salvaguarda LGPD", sufixo: "Atingiu" },
  { chave: "co01", codigo: "EM13CO01", descricao: "Reutilização de critérios do repositório escolar", sufixo: "Atingiu" },
  { chave: "co18", codigo: "EM13CO18", descricao: "Gestão do ciclo completo de auditoria", sufixo: "Atingiu" },
  { chave: "co03Participou", codigo: "EM13CO03", descricao: "Decomposição de passos do algoritmo (Opcional)", sufixo: "Participou" },
] as const;

type LinhaDaMatriz = { codigo: string; descricao: string; resultado: string };

function TagDoNivel({ nivel }: { nivel: Nivel }) {
  const n = ROTULO_DO_NIVEL[nivel];
  return (
    <Tag variant={n.variante} size="sm" pill>
      {n.rotulo}
    </Tag>
  );
}

/**
 * E6-PROF-01 "Relatório Formativo Final": a conclusão da homologação, a matriz
 * BNCC, as perguntas 3 e 4, os níveis por estudante e os comunicados.
 * "Exportar Relatório de Homologação Ética" imprime SÓ este bloco
 * (`relatorio-de-homologacao.css`); o PDF sai do diálogo do navegador.
 *
 * Sem ranking: a ordem é a da api (alfabética, a equipe junta).
 */
function RelatorioFinal({ painel }: { painel: PainelDaTurma }) {
  const r = painel.resumo;
  const pctPagina = percentual(r.paginasAtivas, r.sessoes);
  const finalizada = r.sessoes > 0 && r.publicaram >= r.sessoes;
  const quem = painel.porComputador ? "das bancadas ativas" : "dos estudantes ativos";
  const matriz: LinhaDaMatriz[] = HABILIDADES_DO_RELATORIO.map((h) => ({
    codigo: h.codigo,
    descricao: h.descricao,
    resultado: `${r.habilidades[h.chave]}% ${h.sufixo}`,
  }));
  const colunasDaMatriz: TableColumn<LinhaDaMatriz>[] = [
    { key: "codigo", title: "Habilidade", minWidth: 150 },
    { key: "descricao", title: "Descrição Sintética", minWidth: 260 },
    { key: "resultado", title: "Resultado da Turma", minWidth: 150 },
  ];
  const colunasDosNiveis: TableColumn<LinhaDoPainel>[] = [
    {
      key: "nome",
      title: painel.porComputador ? "Estudante ou equipe" : "Estudante",
      minWidth: 180,
      render: (_, l) => (l.equipe ? `${l.equipe.nome} (${l.equipe.membros.map((m) => m.nome).join(", ")})` : l.nome),
    },
    { key: "co20", title: "EM13CO20 (Foco)", minWidth: 130, render: (_, l) => <TagDoNivel nivel={l.niveis!.co20} /> },
    { key: "co01", title: "EM13CO01", minWidth: 120, render: (_, l) => <TagDoNivel nivel={l.niveis!.co01} /> },
    { key: "co18", title: "EM13CO18", minWidth: 120, render: (_, l) => <TagDoNivel nivel={l.niveis!.co18} /> },
    { key: "co03", title: "EM13CO03 (Opcional)", minWidth: 150, render: (_, l) => <TagDoNivel nivel={l.niveis!.co03} /> },
  ];
  const comunicados = painel.linhas.filter((l) => l.publicacao);
  /* "Níveis por Estudante" lista SÓ quem já tem nível (publicou, ou a missão foi encerrada), como o quadro E6-PROF-01:
     nenhuma célula "Não avaliado" aqui — esse estado continua no painel de habilidades. */
  const comNivel = painel.linhas.filter((l) => l.niveis !== null);

  return (
    <section className="relatorio-homologacao flex flex-col gap-6" data-relatorio-final aria-label="Relatório Formativo Final">
      <Card variant="elevated">
        <div className="flex flex-col gap-5">
          <SectionHeader
            title="Relatório Formativo Final"
            badge={
              <Tag variant={finalizada ? "success" : "info"} size="sm" pill>
                {`${percentual(r.publicaram, r.sessoes)}% Homologado`}
              </Tag>
            }
            description={painel.atividade ? `${painel.turma.nome} · ${painel.atividade.tema} · rodada ${painel.atividade.rodada}` : painel.turma.nome}
          />
          <Status titulo={`Status da Turma: ${finalizada ? "Homologação Finalizada" : "Homologação em Andamento"}`}>
            {`Homologação ${finalizada ? "finalizada" : "em andamento"}: ${pctPagina}% ${quem} publicaram a página de transparência com canal de revisão humana.`}
          </Status>

          <div className="flex flex-col gap-3">
            <h4 className="text-[14px] font-semibold text-unooria-neutral-950">Conclusão da Homologação</h4>
            <Barra rotulo="Estudantes que publicaram a página de transparência" parte={r.paginasAtivas} total={r.sessoes} sucesso />
            <Barra rotulo="Estudantes que publicaram o comunicado" parte={r.publicaram} total={r.sessoes} sucesso />
          </div>

          <div className="flex flex-col gap-3" data-matriz-bncc>
            <h4 className="text-[14px] font-semibold text-unooria-neutral-950">Matriz de Habilidades BNCC Aferidas (Canal A)</h4>
            <ScrollBar orientation="both" autoHide>
              <Table<LinhaDaMatriz> columns={colunasDaMatriz} data={matriz} keyExtractor={(l) => l.codigo} size="md" theme="light" />
            </ScrollBar>
          </div>

          <div className="flex flex-col gap-2" data-fechamento>
            <h4 className="text-[14px] font-semibold text-unooria-neutral-950">Roteiro de Fechamento Coletivo (7 Minutos)</h4>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
              {painel.roteiro.perguntas[2] ? <li>{`Pergunta 3: “${painel.roteiro.perguntas[2]}”`}</li> : null}
              {painel.roteiro.perguntas[3] ? <li>{`Pergunta 4: “${painel.roteiro.perguntas[3]}”`}</li> : null}
            </ul>
          </div>
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-3" data-niveis-por-estudante>
          <SectionHeader
            title="Níveis por Estudante (Canal A)"
            description="Níveis registrados automaticamente pelo servidor a partir das ações dos estudantes; não há nota nem ordenação entre estudantes."
          />
          {painel.porComputador ? <FeedbackAlert type="info" description="Com equipe, o nível do computador vai para cada integrante." /> : null}
          <ScrollBar orientation="both" autoHide className="tabela-rolavel">
            <Table<LinhaDoPainel>
              columns={colunasDosNiveis}
              data={comNivel}
              keyExtractor={(l) => l.unidadeId}
              emptyText="Ninguém publicou ainda: o nível aparece quando o estudante publica."
              size="md"
              theme="light"
            />
          </ScrollBar>
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-3" data-comunicados>
          <SectionHeader title="Comunicados Aprovados pelos Estudantes" />
          {comunicados.length === 0 ? (
            <p className="text-[14px] text-unooria-neutral-600">Nenhum comunicado publicado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {comunicados.map((l) => (
                <li key={l.unidadeId} className="flex flex-col items-start gap-2" data-comunicado={l.unidadeId}>
                  <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
                    <strong className="text-unooria-neutral-950">{`${l.equipe?.nome ?? l.nome} · Comunicado publicado:`}</strong>{" "}
                    {l.publicacao?.texto}
                  </p>
                  <Tag variant={l.publicacao?.paginaAtiva ? "success" : "neutral"} size="sm" pill>
                    {`Página de transparência: ${l.publicacao?.paginaAtiva ? "Ativada" : "Desativada"}`}
                  </Tag>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="relatorio-fora-do-papel flex flex-wrap items-center gap-3" data-exportar-relatorio>
        <BotaoImprimir rotulo="Exportar Relatório de Homologação Ética" variante="primary" impressao={IMPRESSAO} />
        <p className="text-[12px] text-unooria-neutral-600">Abre a impressão só com este relatório; para PDF, escolha “Salvar como PDF”.</p>
      </div>
    </section>
  );
}

/** O que cada estudante (ou computador) fez, para a sua tela — não para o projetor. */
function FolhaDaTurma({ painel }: { painel: PainelDaTurma }) {
  const colunas: TableColumn<LinhaDoPainel>[] = [
    {
      key: "nome",
      title: painel.porComputador ? "Estudante ou equipe" : "Estudante",
      minWidth: 180,
      render: (_, l) =>
        l.equipe ? (
          <EquipeNaLinha equipe={l.equipe} representante={l.nome} entrou={l.passo !== "boas-vindas"} />
        ) : (
          <span className="font-semibold text-unooria-neutral-950">{l.nome}</span>
        ),
    },
    {
      key: "passo",
      title: "Onde está",
      minWidth: 200,
      render: (_, l) =>
        l.aguardandoProfessor ? (
          <span className="flex flex-col items-start gap-1">
            <span>{ROTULO_DO_PASSO[l.passo]}</span>
            <Tag variant="warning" size="sm" pill>
              Aguarda a sua liberação
            </Tag>
          </span>
        ) : (
          ROTULO_DO_PASSO[l.passo]
        ),
    },
    { key: "aposta", title: "Aposta (E3)", minWidth: 100, render: (_, l) => (l.aposta ? `(${l.aposta.toUpperCase()})` : "—") },
    {
      key: "cartoes",
      title: "Cartões (E5)",
      minWidth: 140,
      render: (_, l) => (l.cartoes ? `${l.cartoes.acertos} de 6 certos${l.cartoes.completa ? "" : " · incompleta"}` : "—"),
    },
    {
      key: "algoritmo",
      title: "Etapas do algoritmo",
      minWidth: 170,
      render: (_, l) =>
        !l.algoritmo.aberto
          ? "Não abriu"
          : l.algoritmo.marcados.length === 0
            ? "Abriu, sem marcar"
            : `Marcou ${l.algoritmo.marcados.join(", ")} · ${l.algoritmo.correto ? "certo" : "outro conjunto"}`,
    },
    {
      key: "criterios",
      title: "Critérios (último reteste)",
      minWidth: 190,
      render: (_, l) =>
        l.criterios
          ? `${criteriosEmTexto(l.criterios)} · ${l.retestes} ${l.retestes === 1 ? "reteste" : "retestes"}${
              l.equidade === "total" ? " · equidade" : l.equidade ? " · viés mantido" : ""
            }`
          : "—",
    },
    {
      key: "publicacao",
      title: "Publicação (E6)",
      minWidth: 170,
      render: (_, l) =>
        l.publicacao ? `Publicou · página ${l.publicacao.paginaAtiva ? "ativada" : "desativada"}` : l.avancouComVies ? "Avançou com viés" : "—",
    },
  ];

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-3" data-folha>
        <SectionHeader
          title="Folha da turma"
          description="Para a sua tela, não para o projetor: o que cada um fez, para a conversa. Os níveis ficam no relatório final e na aba Habilidades."
        />
        {painel.porComputador ? <FeedbackAlert type="info" description={AVISO_POR_COMPUTADOR} /> : null}
        <ScrollBar orientation="both" autoHide className="tabela-rolavel">
          <Table<LinhaDoPainel>
            columns={colunas}
            data={[...painel.linhas]}
            keyExtractor={(l) => l.unidadeId}
            emptyText="A turma ainda não tem estudantes."
            size="md"
            theme="light"
          />
        </ScrollBar>
      </div>
    </Card>
  );
}
