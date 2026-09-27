"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Button,
  Card,
  FeedbackAlert,
  Icon,
  MetricCard,
  NEWS_MEDIUM_LABELS,
  ProgressBar,
  ScrollBar,
  Table,
  Tag,
  UNOORIA_DATAVIZ_PALETTE,
  type TableColumn,
} from "@edu/ui/ds";
import { AVISO_POR_COMPUTADOR, type MembroNoPainel } from "@/lib/equipe-no-painel";
import {
  ETIQUETA_DO_GABARITO,
  FAIXAS_DO_HISTOGRAMA,
  MEIO_NO_DS,
  MOTIVOS,
  ROTULO_DA_ETAPA,
  ROTULO_DO_MOTIVO,
  aulaEmAndamento,
  destaqueDoRadar,
  erroDaResposta,
  histogramaEmPercentual,
  percentual,
  rotuloDoBotao,
  textoDoDestaque,
  textoDoEnvio,
  textoDoHistograma,
  textoDoTermometro,
  totalDoHistograma,
  type GateDaTurma,
  type MaterialDoJornal,
  type NoticiaNoRadar,
  type PainelDoJornal,
} from "@/lib/jornal-escola-tipos";

import { ListaDoJornal } from "./lista-do-jornal";

/**
 * O PAINEL DA AULA da exp04ef1b (E4-PROF-01) — o botão único, o "X de Y
 * publicaram", o gráfico para projetar, o radar das notícias e a folha da
 * turma, AO VIVO.
 *
 * **UM botão, e ele diz a etapa de DESTINO.** O rótulo sai de `proximaEtapa`,
 * que a api calcula: Liberar resultado → Liberar revisão, e depois nada. Ele
 * avança uma etapa por vez e nunca volta (409 `transicao-de-etapa-invalida`):
 * são os dois portões do professor (decisão de 2026-09-25), com a conversa da
 * turma entre eles. O botão "Liberar Mesa de Revisão e Algoritmo" da copy era o
 * único portão de uma versão anterior e não existe mais.
 *
 * **Três superfícies, e só UMA vai para o telão.** O cartão "Painel em Tempo
 * Real" não tem nome nem gabarito: é o histograma anônimo 0–3 das duas edições
 * e o motivo agregado, o que a copy (§4b) manda projetar. O radar mostra se
 * cada notícia podia ir para a capa — projetado antes da revisão, ele entregaria
 * a resposta. E a folha tem nomes. Os títulos dizem isso.
 *
 * **O radar é CALCULADO.** Os "68% das duplas" do PRD eram ilustração: a frase
 * aqui sai de `destaqueDoRadar`, sobre o que a turma publicou de fato.
 *
 * **Consulta LEVE, e não `router.refresh()`.** A página lê cinco rotas (painel,
 * pacotes, material, equipes, habilidades); refazê-la a cada 5 s seria cinco
 * chamadas por professor durante a aula. Aqui só o PAINEL é consultado, pelo
 * BFF, só enquanto a aula corre (`aulaEmAndamento`) e com a aba visível. O
 * `inicial` ainda manda quando a página é refeita de verdade — depois de
 * homologar um pacote ou zerar a turma.
 */

const INTERVALO_MS = 5_000;

const CONEXAO_CAIU =
  "Conexão com a sala interrompida. Confira a internet da escola: o que os computadores já publicaram continua salvo.";
const CONEXAO_VOLTOU = "Conexão restabelecida. O painel da turma foi atualizado.";

type Conexao = "ok" | "caiu" | "voltou";

/** Duas cores da paleta de dados do DS, sem verde nem vermelho: a 2ª edição não é "a certa". */
const COR_DA_EDICAO_1 = UNOORIA_DATAVIZ_PALETTE[4];
const COR_DA_EDICAO_2 = UNOORIA_DATAVIZ_PALETTE[0];

export function PainelDaAulaJornalEscola({
  turmaId,
  inicial,
  roteiro,
  membros,
}: {
  turmaId: string;
  inicial: PainelDoJornal;
  /** O roteiro da mediação (`GET /jornal-escola/professor/material`). `null` = não carregou. */
  roteiro: MaterialDoJornal["roteiro"] | null;
  membros: Readonly<Record<string, MembroNoPainel[]>>;
}) {
  const [painel, setPainel] = useState(inicial);
  const [inicialVisto, setInicialVisto] = useState(inicial);
  if (inicial !== inicialVisto) {
    setInicialVisto(inicial);
    setPainel(inicial);
  }

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conexao, setConexao] = useState<Conexao>("ok");

  const base = `/api/plataforma/jornal-escola/turmas/${encodeURIComponent(turmaId)}`;

  const atualizar = useCallback(async () => {
    try {
      const r = await fetch(`${base}/painel`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setPainel((await r.json()) as PainelDoJornal);
      // "voltou" fica uma volta na tela e some na seguinte.
      setConexao((c) => (c === "caiu" ? "voltou" : "ok"));
    } catch {
      setConexao("caiu");
    }
  }, [base]);

  const emAndamento = aulaEmAndamento(painel);
  useEffect(() => {
    if (!emAndamento) return;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void atualizar();
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [emAndamento, atualizar]);

  const proxima = painel.proximaEtapa;
  const rotulo = rotuloDoBotao(proxima);
  const { resumo } = painel;
  const y = resumo.computadores.total;
  const publicaram = resumo.computadores.publicaram;
  const pct = percentual(publicaram, y);

  async function avancar() {
    if (!proxima) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`${base}/gate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ para: proxima }),
      });
      if (!r.ok) {
        /* 409 `transicao-de-etapa-invalida`: outra aba (ou outra pessoa)
           avançou antes. A frase da api diz isso; o painel relê e mostra onde
           a turma está de verdade. */
        setErro(erroDaResposta(await r.json().catch(() => null), "Não deu para mudar a etapa agora.").mensagem);
        await atualizar();
        return;
      }
      const gate = (await r.json()) as GateDaTurma;
      setPainel((p) => ({ ...p, etapa: gate.etapa, proximaEtapa: gate.proximaEtapa }));
      await atualizar();
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Card variant="elevated" title="A aula">
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-unooria-neutral-700" data-etapa={painel.etapa}>
            Agora: <strong className="text-unooria-neutral-950">{ROTULO_DA_ETAPA[painel.etapa]}</strong>
            {painel.rodada > 1 ? <span className="text-unooria-neutral-500"> · rodada {painel.rodada}</span> : null}
          </p>

          <ProgressBar
            label={textoDoEnvio(resumo.computadores, resumo.porComputador)}
            value={publicaram}
            max={Math.max(y, 1)}
            valueFormatter={() => `${pct}%`}
            variant={y > 0 && publicaram >= y ? "success" : "brand"}
            data-envio
          />

          {rotulo ? (
            <div className="flex flex-col gap-2">
              {proxima === "resultado" ? (
                <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
                  Libere quando a maioria tiver publicado — o número acima anda sozinho. Quem ainda estiver
                  montando a página continua, e vê o resultado assim que publicar e disser por que escolheu.
                </p>
              ) : null}
              {proxima === "revisao" && roteiro ? (
                <div className="flex flex-col gap-1" data-perguntas-da-mediacao>
                  <p className="text-[13px] font-semibold text-unooria-neutral-950">
                    Antes de liberar a revisão, converse com a turma:
                  </p>
                  <ol className="flex max-w-3xl list-decimal flex-col gap-1 pl-5 text-[13px] leading-relaxed text-unooria-neutral-800">
                    {roteiro.perguntas.map((pergunta) => (
                      <li key={pergunta}>{pergunta}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Icon name="arrow_forward" size={18} />}
                  onClick={() => void avancar()}
                  isDisabled={enviando}
                  data-gate={proxima}
                >
                  {enviando ? "Mudando…" : rotulo}
                </Button>
              </div>
              {/* O gatilho oral da copy revisada (§4b), servido pela api junto do
                  guia: é a frase que o professor diz ao apertar, e ela muda sem
                  republicar o hub. */}
              {roteiro ? (
                <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600" data-gatilho={proxima}>
                  Ao apertar, diga à turma: “{proxima === "resultado" ? roteiro.gatilhoDoResultado : roteiro.gatilhoDaRevisao}”
                </p>
              ) : null}
              <p className="text-[12px] leading-snug text-unooria-neutral-500">
                A turma inteira avança junto, e o botão não volta.
              </p>
            </div>
          ) : (
            <p className="text-[13px] leading-snug text-unooria-neutral-700">
              Os dois portões estão abertos. Cada computador segue no próprio ritmo pela Chave do Editor, pela
              2ª edição e pelo desafio final. Para aplicar de novo, use Zerar a turma, mais abaixo.
            </p>
          )}

          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          {conexao === "caiu" ? <FeedbackAlert type="warning" description={CONEXAO_CAIU} /> : null}
          {conexao === "voltou" ? <FeedbackAlert type="success" description={CONEXAO_VOLTOU} /> : null}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Publicaram a 1ª edição" value={`${publicaram}/${y}`} />
        <MetricCard title="Formaram a Chave do Editor" value={`${resumo.formaramAChave}/${y}`} />
        <MetricCard title="Publicaram a 2ª edição" value={`${resumo.publicaramASegunda}/${y}`} />
        <MetricCard title="Concluíram o desafio final" value={`${resumo.concluiram}/${y}`} />
      </div>
      {resumo.porComputador ? (
        <p className="-mt-2 text-[12px] leading-snug text-unooria-neutral-600">{AVISO_POR_COMPUTADOR}</p>
      ) : null}

      <PainelParaProjetar painel={painel} />
      <RadarDaMesa painel={painel} />

      <Card variant="elevated" title={[painel.turma.nome, painel.turma.serie].filter(Boolean).join(" · ")}>
        <div className="mb-3 flex flex-col gap-1 text-[12px] leading-snug text-unooria-neutral-600">
          <p>
            Esta folha é para a <strong>sua</strong> tela, não para o projetor: ela tem nomes. Não há coluna de
            nível nem de acerto — quantas notícias cada um verificou fica só no gráfico, sem nome, e o nível das
            habilidades fica no painel de habilidades, lá embaixo, com a sua confirmação.
          </p>
          <p>
            “Pistas abertas” conta quantas vezes o computador abriu de onde veio, quando aconteceu ou quem assina.
            Abrir não comprova que entendeu: use o número para puxar a conversa, não para comparar.
          </p>
        </div>
        <ListaDoJornal linhas={painel.linhas} porComputador={resumo.porComputador} membros={membros} />
      </Card>
    </>
  );
}

/**
 * O que vai para o telão (E4-PROF-01): o termômetro, o histograma anônimo 0–3
 * das duas edições e o motivo agregado. Nenhum nome, nenhum gabarito.
 */
function PainelParaProjetar({ painel }: { painel: PainelDoJornal }) {
  const { resumo } = painel;
  const h1 = resumo.histograma.edicao1;
  const h2 = resumo.histograma.edicao2;
  const publicaram1 = totalDoHistograma(h1);
  const publicaram2 = totalDoHistograma(h2);
  const p1 = histogramaEmPercentual(h1);
  const p2 = histogramaEmPercentual(h2);
  const comSegunda = publicaram2 > 0;
  const responderam = MOTIVOS.reduce((soma, m) => soma + resumo.motivos[m], 0);

  return (
    /* O título é o `e4.prof.titulo_painel` da copy; com a 2ª edição no gráfico,
       ele passa a dizer as duas. */
    <Card
      variant="elevated"
      title={comSegunda ? "Painel em Tempo Real: Circulação das Duas Edições" : "Painel em Tempo Real: Circulação da 1ª Edição"}
    >
      <div className="flex flex-col gap-4" data-painel-para-projetar>
        <p className="text-[12px] leading-snug text-unooria-neutral-600">
          Sem nomes e sem a resposta de cada notícia: este cartão pode ir para o projetor.
          {painel.etapa === "exploracao"
            ? " Projete só depois de liberar o resultado — antes, a turma saberia quantas notícias verificou antes de ver os leitores."
            : null}
        </p>
        <p className="text-[15px] font-semibold text-unooria-neutral-950" data-termometro>
          {textoDoTermometro(resumo.computadores, resumo.porComputador)}
        </p>

        {publicaram1 === 0 ? (
          <p className="text-[13px] text-unooria-neutral-700">Ninguém publicou ainda. O gráfico aparece com a primeira edição.</p>
        ) : (
          <div className="flex flex-col gap-2" data-histograma>
            {/* O eixo do `BarChart` do DS é fixo em 0–100: as barras vão em % de
                quem publicou cada edição, e as contagens exatas ficam na linha
                de baixo. */}
            <BarChart
              title="Notícias verificadas em cada capa"
              subtitle={
                comSegunda
                  ? `% dos que publicaram cada edição · 1ª: ${publicaram1} · 2ª: ${publicaram2}`
                  : `% dos que publicaram a 1ª edição · ${publicaram1}`
              }
              data={FAIXAS_DO_HISTOGRAMA.map((faixa, i) => ({
                label: faixa,
                values: comSegunda ? [p1[i] ?? 0, p2[i] ?? 0] : [p1[i] ?? 0],
                colors: comSegunda ? [COR_DA_EDICAO_1, COR_DA_EDICAO_2] : [COR_DA_EDICAO_1],
              }))}
              indicators={
                comSegunda
                  ? [
                      { label: "1ª edição", color: COR_DA_EDICAO_1 },
                      { label: "2ª edição", color: COR_DA_EDICAO_2 },
                    ]
                  : [{ label: "1ª edição", color: COR_DA_EDICAO_1 }]
              }
              height={220}
            />
            <p className="text-[12px] leading-snug text-unooria-neutral-600">
              1ª edição — {textoDoHistograma(h1, resumo.porComputador)}
            </p>
            {comSegunda ? (
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                2ª edição — {textoDoHistograma(h2, resumo.porComputador)}
              </p>
            ) : null}
            <p className="text-[12px] leading-snug text-unooria-neutral-500">
              O número descreve a seleção de cada capa, não a criança: não é nota.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-unooria-neutral-200 pt-4" data-motivos>
          <p className="text-[14px] font-semibold text-unooria-neutral-950">Por que escolheram as notícias da 1ª edição</p>
          {responderam === 0 ? (
            <p className="text-[13px] text-unooria-neutral-700">
              Ninguém respondeu ainda. A pergunta aparece logo depois da publicação.
            </p>
          ) : (
            MOTIVOS.map((m) => (
              <ProgressBar
                key={m}
                label={ROTULO_DO_MOTIVO[m]}
                value={resumo.motivos[m]}
                max={responderam}
                valueFormatter={(v) => `${v}`}
                variant="brand"
                data-motivo={m}
              />
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

interface LinhaDoRadar extends Record<string, unknown>, NoticiaNoRadar {}

const vezes = (n: number) => (n === 0 ? "—" : n === 1 ? "1 capa" : `${n} capas`);

const COLUNAS_DO_RADAR: TableColumn<LinhaDoRadar>[] = [
  {
    key: "manchete",
    title: "Notícia",
    minWidth: 280,
    render: (_, n) => (
      <span className="flex flex-col">
        <span className="font-semibold text-unooria-neutral-950">{n.manchete}</span>
        <span className="text-[11px] text-unooria-neutral-500">{NEWS_MEDIUM_LABELS[MEIO_NO_DS[n.meio]]}</span>
      </span>
    ),
  },
  {
    key: "publicavel",
    title: "Para a capa?",
    width: 190,
    render: (_, n) => (
      <Tag variant={n.publicavel ? "success" : "warning"} size="sm">
        {ETIQUETA_DO_GABARITO[n.publicavel || !n.pilarEmFalta ? "publicavel" : n.pilarEmFalta]}
      </Tag>
    ),
  },
  { key: "naEdicao1", title: "Na 1ª edição", width: 120, render: (_, n) => vezes(n.naEdicao1) },
  { key: "naEdicao2", title: "Na 2ª edição", width: 120, render: (_, n) => vezes(n.naEdicao2) },
];

/**
 * O radar das notícias — só para o professor, porque diz quais podiam ir para
 * a capa. Na ordem da MESA (a que a turma vê), nunca por quantas capas: é do
 * objeto editorial, e a leitura procurada é "a notícia de 2018 foi para 7
 * capas", não quem a escolheu.
 */
function RadarDaMesa({ painel }: { painel: PainelDoJornal }) {
  const { resumo } = painel;
  const destaque = destaqueDoRadar(resumo.radar, resumo.computadores.publicaram);

  return (
    <Card variant="elevated" title="Radar da mesa — só para você">
      <div className="flex flex-col gap-3" data-radar>
        <p className="text-[12px] leading-snug text-unooria-neutral-600">
          <strong>Não projete antes da revisão:</strong> a coluna “Para a capa?” é a resposta. Em quantas capas
          cada notícia entrou — é das notícias, não de quem as escolheu.
        </p>
        {destaque ? (
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-900" data-destaque-do-radar>
            {textoDoDestaque(destaque, resumo.porComputador)}
          </p>
        ) : null}
        <ScrollBar orientation="both" autoHide className="tabela-rolavel">
          <Table<LinhaDoRadar>
            columns={COLUNAS_DO_RADAR}
            data={resumo.radar as LinhaDoRadar[]}
            keyExtractor={(n) => n.noticiaId}
            emptyText="O radar aparece quando a turma tiver um pacote."
            size="md"
            theme="light"
          />
        </ScrollBar>
      </div>
    </Card>
  );
}
