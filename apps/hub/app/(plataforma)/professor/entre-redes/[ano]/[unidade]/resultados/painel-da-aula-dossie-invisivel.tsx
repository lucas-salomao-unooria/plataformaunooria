"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  BarChart,
  Button,
  Card,
  FeedbackAlert,
  Icon,
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
  BOTOES_DO_GATE,
  CAMINHOS,
  INATIVO_A_PARTIR_DE_SEGUNDOS,
  PASSOS,
  PROJETOS,
  ROTAS_DA_TURMA,
  ROTULO_DO_CAMINHO,
  ROTULO_DO_PAPEL,
  ROTULO_DO_PASSO,
  TRAVAS,
  caminhoDaTurma,
  erroDaApi,
  mudouAEvidencia,
  percentual,
  proximaTrava,
  rotuloDaEtapa,
  somaPorProjeto,
  tempoParado,
  travaFeita,
  type GateDaTurma,
  type PainelDaTurma,
  type ProjetoId,
  type TravaDoGate,
} from "@/lib/dossie-invisivel-tipos";

const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
/** O estudante relê a sessão no polling dele; o painel se relê a cada 5 s enquanto a aula anda. */
const INTERVALO_MS = 5_000;

/** As três travas são irreversíveis: o gate só anda para a frente. */
const CONFIRMACAO: Readonly<Record<TravaDoGate, { titulo: string; texto: string }>> = {
  revelacao: {
    titulo: "Liberar a próxima pauta?",
    texto:
      "Os computadores de quem registrou a escolha abrem os cadernos digitalizados e a tabela de confronto: com os mesmos critérios, o parecer do assistente se inverte. Quem ainda não registrou continua de onde parou e, ao registrar, vai direto para a tabela. Projete a distribuição de votos e conduza o debate. Não dá para voltar.",
  },
  revoto: {
    titulo: "Abrir a revisão da decisão?",
    texto:
      "Depois do debate: cada conselheiro vê a primeira escolha congelada no histórico e decide se mantém ou revisa o projeto, reordenando os critérios. Não dá para voltar.",
  },
  explicar: {
    titulo: "Destravar o Explicar e o Protocolo?",
    texto:
      "Quem confirmou a decisão final recebe a fala de Amara com os conceitos, marca no histórico onde o assistente errou e monta o Editor de Protocolo. Enviar a proposta conclui a missão. Não dá para voltar.",
  },
};

/** Por que a trava está aqui, para quem a aperta — a instrução da copy (`e4.instrucao.painel_debate_guia`) e a do Explicar. */
const QUANDO_APERTAR: Readonly<Record<TravaDoGate | "fim", string>> = {
  revelacao: "Quando a turma tiver registrado a primeira escolha, libere a próxima pauta: os cadernos e a tabela de confronto.",
  revoto: "Projete as decisões da sala e conduza o debate antes de liberar a revisão.",
  explicar: "Com os votos finais registrados, destrave o Explicar: Amara nomeia os conceitos e cada um monta o protocolo.",
  fim: "As três travas foram liberadas. Acompanhe os protocolos enviados pela lousa.",
};

/* As cores da dataviz da plataforma (DS): uma por projeto, sem cor de "certo" ou "errado". */
const COR = UNOORIA_DATAVIZ_PALETTE;
const cor = (i: number) => COR[i % COR.length] ?? "#6B7280";
const COR_DO_PROJETO: Record<ProjetoId, string> = { papel: cor(0), parcial: cor(2), nuvem: cor(4) };
/** O eixo do `BarChart` corta acima de ~8 caracteres: a letra no eixo, o nome na legenda de baixo. */
const LETRA: Record<ProjetoId, string> = { papel: "A", parcial: "B", nuvem: "C" };

type Linha = PainelDaTurma["linhas"][number];

/**
 * A AULA AO VIVO de O Dossiê Invisível (E4-PROF-01 e E5-PROF-01): as três
 * travas no topo, na ordem, com só a próxima habilitada; a lousa (só
 * CONTAGENS, sem nome e sem ranking: pode ir ao projetor) — a "Distribuição de
 * Votos da Turma — 1ª Deliberação" em tipografia grande, os caminhos da
 * investigação (A1/A2/B), a "Consolidação do Segundo Voto e Migração de
 * Escolhas" —, o roteiro do debate e a folha de ritmo com os nomes (só para a
 * tela do professor). O voto e o caminho de cada estudante não vêm da api; o
 * nível de cada um mora na aba Habilidades, que este painel mantém em dia com
 * `router.refresh()` quando a evidência muda (ADR-146).
 */
export function PainelDaAulaDossieInvisivel({
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
  const [confirmando, setConfirmando] = useState<TravaDoGate | null>(null);
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

  async function travar(etapa: TravaDoGate) {
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
        setErro(erroDaApi(corpo, "Não deu para liberar a etapa da turma agora.").mensagem);
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
  const proxima = proximaTrava(painel.etapa);
  /* O rótulo do botão vem da api (`roteiro.botoes`); o espelho do hub é a reserva. */
  const rotuloDoBotao = (t: TravaDoGate) => painel.roteiro.botoes[t] || BOTOES_DO_GATE[t];
  const nomes = painel.atividade?.projetos ?? null;
  const nomeDo = (p: ProjetoId) => nomes?.[p] ?? ROTULO_DO_PAPEL[p];

  const r = painel.resumo;
  const votaram = somaPorProjeto(r.escolhaInicial);
  const revotaram = somaPorProjeto(r.escolhaFinal);
  const investigaram = CAMINHOS.reduce((s, c) => s + r.caminhos[c], 0);
  const migraram = r.migracao.mantiveram + r.migracao.trocaram;
  const inativos = painel.linhas.filter(
    (l) => l.passo !== "abertura" && l.passo !== "concluida" && (l.segundosInativo ?? 0) >= INATIVO_A_PARTIR_DE_SEGUNDOS,
  ).length;

  const colunas: TableColumn<Linha>[] = [
    { key: "nome", title: "Estudante", minWidth: 200, render: (_, linha) => <span className="font-semibold text-unooria-neutral-950">{linha.nome}</span> },
    { key: "passo", title: "Etapa", minWidth: 220, render: (_, linha) => ROTULO_DO_PASSO[linha.passo] },
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
              {/* As três travas na ordem: só a próxima acende; as feitas ficam à vista, desabilitadas. */}
              <div className="flex flex-wrap gap-3" data-botoes-da-aula>
                {TRAVAS.map((t) => (
                  <Button
                    key={t}
                    variant={t === proxima ? "primary" : "outline"}
                    size="md"
                    isDisabled={t !== proxima}
                    leftIcon={travaFeita(painel.etapa, t) ? <Icon name="check" size={18} /> : undefined}
                    onClick={() => setConfirmando(t)}
                    data-acao={`trava-${t}`}
                    data-feita={travaFeita(painel.etapa, t) ? "sim" : "nao"}
                  >
                    {rotuloDoBotao(t)}
                  </Button>
                ))}
              </div>
              <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">{QUANDO_APERTAR[proxima ?? "fim"]}</p>
              {proxima === "revelacao" ? (
                <p className="text-[12px] text-unooria-neutral-600" data-registraram>
                  {`${votaram} de ${r.entraram} registraram a primeira escolha.`}
                </p>
              ) : null}
            </div>
          ) : null}
          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-lousa>
        <MetricCard title="Registraram a 1ª escolha" value={`${votaram}/${r.entraram}`} description="Deliberação inicial registrada." />
        <MetricCard title="Confirmaram a decisão final" value={`${revotaram}/${r.entraram}`} description="Segundo voto registrado." />
        <MetricCard title="Enviaram o protocolo" value={`${r.protocolosEnviados}/${r.entraram}`} description="Concluíram o Editor de Protocolo." />
        <MetricCard title="Concluíram" value={`${r.porPasso.concluida}/${r.entraram}`} description="Missão concluída." />
      </div>

      {/* E4-PROF-01: a tela do telão. Tipografia grande, sem nomes. */}
      <Card variant="elevated">
        <div className="flex flex-col gap-4" data-distribuicao-dos-votos>
          <SectionHeader
            title="Distribuição de Votos da Turma — 1ª Deliberação"
            badge={
              <Tag variant="info" size="sm" pill>
                Projeção telão
              </Tag>
            }
            description="Projete as decisões da sala e conduza o debate antes de liberar a revisão."
          />
          {votaram === 0 ? (
            <p className="text-[14px] text-unooria-neutral-700">Ninguém registrou a escolha ainda. A distribuição aparece com o primeiro voto.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3" data-votos-por-projeto>
                {PROJETOS.map((p) => (
                  <MetricCard
                    key={p}
                    title={`${nomeDo(p)} (${ROTULO_DO_PAPEL[p]})`}
                    value={`${percentual(r.escolhaInicial[p], votaram)}%`}
                    description={`${r.escolhaInicial[p]} ${r.escolhaInicial[p] === 1 ? "voto" : "votos"} de ${votaram}`}
                  />
                ))}
              </div>
              <StackedProgressBar
                title="Votação Inicial da Sala"
                subtitle={`${votaram} ${votaram === 1 ? "voto registrado" : "votos registrados"}`}
                totalValue={votaram}
                segments={PROJETOS.map((p) => ({
                  label: nomeDo(p),
                  value: r.escolhaInicial[p],
                  amountText: `${percentual(r.escolhaInicial[p], votaram)}%`,
                  color: COR_DO_PROJETO[p],
                }))}
              />
            </>
          )}
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-3" data-caminhos>
          <SectionHeader
            title="Caminhos da Investigação"
            description="Quem perguntou pela falta de documentos antes de escolher. Contagem da turma, sem nomes."
          />
          {investigaram === 0 ? (
            <p className="text-[13px] text-unooria-neutral-700">Os caminhos aparecem com a primeira escolha registrada.</p>
          ) : (
            <StackedProgressBar
              title="A1 · A2 · B"
              subtitle={`${investigaram} ${investigaram === 1 ? "conselheiro" : "conselheiros"}`}
              totalValue={investigaram}
              segments={CAMINHOS.map((c, i) => ({
                label: ROTULO_DO_CAMINHO[c],
                value: r.caminhos[c],
                amountText: String(r.caminhos[c]),
                color: cor(i + 1),
              }))}
            />
          )}
        </div>
      </Card>

      {/* E5-PROF-01: a consolidação do segundo voto. Só depois de abrir a revisão. */}
      {travaFeita(painel.etapa, "revoto") ? (
        <Card variant="elevated">
          <div className="flex flex-col gap-4" data-migracao>
            <SectionHeader
              title="Consolidação do Segundo Voto e Migração de Escolhas"
              badge={
                <Tag variant="info" size="sm" pill>
                  Projeção telão
                </Tag>
              }
              description="Sem nomes: pode ir ao projetor."
            />
            {migraram === 0 ? (
              <p className="text-[14px] text-unooria-neutral-700">Ninguém confirmou a decisão final ainda. A migração aparece com o primeiro segundo voto.</p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2" data-mantiveram-trocaram>
                  <MetricCard
                    title="Trocaram de projeto"
                    value={`${percentual(r.migracao.trocaram, migraram)}%`}
                    description={`${r.migracao.trocaram} de ${migraram} no segundo voto`}
                  />
                  <MetricCard
                    title="Mantiveram a escolha"
                    value={`${percentual(r.migracao.mantiveram, migraram)}%`}
                    description={`${r.migracao.mantiveram} de ${migraram} no segundo voto`}
                  />
                </div>
                {r.migracao.trocaram > 0 && (
                  /* O "74% migraram para Mesa Aberta" do protótipo (E5-PROF-01): para ONDE foi quem trocou. */
                  <div className="grid gap-4 md:grid-cols-3" data-migraram-para>
                    {PROJETOS.filter((p) => r.migracao.para[p] > 0).map((p) => (
                      <MetricCard
                        key={p}
                        title={`Migraram para ${nomeDo(p)}`}
                        value={`${percentual(r.migracao.para[p], migraram)}%`}
                        description={`${r.migracao.para[p]} de ${migraram} no segundo voto`}
                      />
                    ))}
                  </div>
                )}
                <BarChart
                  title="1ª deliberação × decisão final"
                  subtitle="% dos votos de cada rodada, por projeto"
                  data={PROJETOS.map((p) => ({
                    label: `Proj. ${LETRA[p]}`,
                    /* `values` + `colors`: o `BarChart` do DS só pinta a forma de várias barras. */
                    values: [percentual(r.escolhaInicial[p], votaram), percentual(r.escolhaFinal[p], revotaram)],
                    colors: [cor(6), cor(0)],
                  }))}
                  indicators={[
                    { label: "1ª deliberação", color: cor(6) },
                    { label: "Decisão final", color: cor(0) },
                  ]}
                  height={220}
                />
                <p className="text-[13px] text-unooria-neutral-700">
                  {PROJETOS.map(
                    (p) =>
                      `Proj. ${LETRA[p]} — ${nomeDo(p)}: ${percentual(r.escolhaInicial[p], votaram)}% → ${percentual(r.escolhaFinal[p], revotaram)}%`,
                  ).join(" · ")}
                </p>
              </>
            )}
          </div>
        </Card>
      ) : null}

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

      <Card variant="outlined">
        <div className="flex flex-col gap-3" data-roteiro>
          <SectionHeader title="Roteiro de Perguntas do Debate Mediado" description="Para a plenária, com a tabela de confronto na tela." />
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
            {painel.roteiro.perguntas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-3" data-monitor-de-ritmo>
          <SectionHeader title="Ritmo da turma" description="Com os nomes: para a sua tela, não para o projetor. Sem voto nem caminho de ninguém." />
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
          <Button variant="primary" size="md" isDisabled={enviando} isLoading={enviando} onClick={() => confirmando && void travar(confirmando)}>
            {confirmando ? rotuloDoBotao(confirmando) : ""}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
