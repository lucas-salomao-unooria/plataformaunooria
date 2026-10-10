"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BarChart, Button, Card, FeedbackAlert, Icon, MetricCard, ProgressBar, UNOORIA_DATAVIZ_PALETTE } from "@edu/ui/ds";
import { AVISO_POR_COMPUTADOR, type MembroNoPainel } from "@/lib/equipe-no-painel";
import {
  AREAS,
  INSTRUCAO_DO_GATILHO,
  ROTULO_DA_ETAPA,
  TITULO_DO_PAINEL,
  aulaEmAndamento,
  caminhoDaTurma,
  erroDaResposta,
  mudouAEvidencia,
  percentual,
  rotuloCurtoDaArea,
  rotuloDoBotao,
  textoDaInvisibilidade,
  textoDaRevisao,
  textoDoQueFalta,
  textoDosVotos,
  textoDosVotosDaArea,
  totalDeVotos,
  votosEmPercentual,
  type GateDaTurma,
  type PainelDoJuri,
} from "@/lib/juri-estadual-tipos";

import { ListaDoJuri } from "./lista-do-juri";

/**
 * O PAINEL DA AULA da exp06ef1b (E4-PROF-01) — o botão único, o "X de Y
 * jurados votaram", a lousa do pico e a folha da turma, AO VIVO.
 *
 * **UM botão, e ele diz a etapa de DESTINO.** O rótulo sai de `proximaEtapa`,
 * que a api calcula: "Liberar Auditoria" (PRD v2, E4-PROF-01) abre a Galeria
 * Oculta, e depois nada — da galeria em diante cada computador segue no
 * próprio ritmo. Ele nunca volta (409 `transicao-de-etapa-invalida`).
 *
 * **Duas superfícies, e só UMA vai para o telão.** O cartão "Painel Coletivo
 * de Votos da Turma" não tem nome: são os votos por área (o voto INICIAL,
 * lacrado; e, depois da galeria, o revisado), a contagem de quem votou e a
 * invisibilidade média — o que a lousa do pico precisa. A folha tem nomes, e
 * por isso não vai: e nem ela liga nome a voto (`PROIBIDO_NA_LINHA_DO_PAINEL`).
 *
 * **A invisibilidade média está na lousa desde o pico** (PRD v2, E4-PROF-01:
 * o `MetricCard` ao lado do gráfico). O número é o REAL, calculado pela api;
 * nenhum percentual é cravado aqui.
 *
 * **Consulta LEVE, e não `router.refresh()`.** A página lê cinco rotas;
 * refazê-la a cada 5 s seria cinco chamadas por professor durante a aula. Aqui
 * só o PAINEL é consultado, pelo BFF, só enquanto a aula corre e com a aba
 * visível.
 *
 * A exceção é a EVIDÊNCIA (ADR-146): quando muda o que o painel de
 * habilidades mostra (`mudouAEvidencia` — alguém revisou o voto, montou a
 * cadeia ou concluiu depois das enquetes; ou a
 * atividade/rodada trocou), a página é refeita, e o professor vê o nível
 * chegar sem recarregar. Uma leitura basta: a api marca na MESMA transação do
 * passo que o painel mostra, então quando a folha anda a marca já está lá —
 * não há a segunda volta da A Seleção, cuja IA gradua depois.
 *
 * O `inicial` ainda manda quando a página é refeita de verdade.
 */

const INTERVALO_MS = 5_000;

const CONEXAO_CAIU =
  "Conexão com a sala interrompida. Confira a internet da escola: os votos já lacrados continuam salvos.";
const CONEXAO_VOLTOU = "Conexão restabelecida. O painel da turma foi atualizado.";

type Conexao = "ok" | "caiu" | "voltou";

/** Duas cores da paleta de dados do DS, sem verde nem vermelho: o voto revisado não é "o certo". */
const COR_ANTES = UNOORIA_DATAVIZ_PALETTE[4];
const COR_DEPOIS = UNOORIA_DATAVIZ_PALETTE[0];

export function PainelDaAulaJuriEstadual({
  turmaId,
  inicial,
  plenaria,
  membros,
}: {
  turmaId: string;
  inicial: PainelDoJuri;
  /** As quatro perguntas da plenária (`GET /juri-estadual/professor/material`). `null` = não carregou. */
  plenaria: string[] | null;
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
      const novo = (await r.json()) as PainelDoJuri;
      const antes = ultimo.current;
      setPainel(novo);
      if (mudouAEvidencia(antes, novo)) transicionar(() => router.refresh());
      // "voltou" fica uma volta na tela e some na seguinte.
      setConexao((c) => (c === "caiu" ? "voltou" : "ok"));
    } catch {
      setConexao("caiu");
    }
  }, [base, router]);

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
  const votaram = resumo.computadores.votaram;

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
            label={textoDosVotos(resumo.computadores, resumo.porComputador)}
            value={votaram}
            max={Math.max(y, 1)}
            valueFormatter={() => `${percentual(votaram, y)}%`}
            variant={y > 0 && votaram >= y ? "success" : "brand"}
            data-votos
          />

          {rotulo ? (
            <div className="flex flex-col gap-2">
              <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
                Quando a maioria tiver votado, explore a divergência com as perguntas da plenária. Quem ainda estiver
                no feed continua, vota quando terminar e entra na auditoria em seguida.
              </p>
              <p className="max-w-3xl text-[13px] font-semibold leading-snug text-unooria-neutral-900" data-instrucao-do-gatilho>
                {INSTRUCAO_DO_GATILHO}
              </p>
              <div>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Icon name="visibility" size={18} />}
                  onClick={() => void avancar()}
                  isDisabled={enviando}
                  data-gate={proxima}
                >
                  {enviando ? "Liberando…" : rotulo}
                </Button>
              </div>
              <p className="text-[12px] leading-snug text-unooria-neutral-500">
                A turma inteira avança junto, e o botão não volta.
              </p>
            </div>
          ) : (
            <p className="text-[13px] leading-snug text-unooria-neutral-700">
              A auditoria está liberada. Cada computador segue no próprio ritmo pela Galeria Oculta, pela cadeia, pelo
              caso Mariana e pelas enquetes. Depois que a turma concluir a Etapa 4 e o debate da virada, toque o
              podcast de recapitulação, mais abaixo. Para aplicar de novo, use Reiniciar Missão, mais abaixo.
            </p>
          )}

          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          {conexao === "caiu" ? <FeedbackAlert type="warning" description={CONEXAO_CAIU} /> : null}
          {conexao === "voltou" ? <FeedbackAlert type="success" description={CONEXAO_VOLTOU} /> : null}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Entraram na mostra" value={`${resumo.entraram}/${resumo.total}`} />
        <MetricCard title="Lacraram o voto" value={`${votaram}/${y}`} />
        <MetricCard title="Revisaram o voto" value={`${resumo.revisaram}/${y}`} />
        <MetricCard
          title="Parados na cédula"
          value={String(resumo.ociosos)}
          description="Cédula aberta há mais de 1 minuto sem toque. O ícone de alerta aparece ao lado do nome, na folha."
        />
        <MetricCard title="Concluíram a missão" value={`${resumo.concluiram}/${y}`} />
      </div>
      {resumo.porComputador ? (
        <p className="-mt-2 text-[12px] leading-snug text-unooria-neutral-600">{AVISO_POR_COMPUTADOR}</p>
      ) : null}

      <PainelParaProjetar painel={painel} />
      <PerguntasDaPlenaria plenaria={plenaria} />

      <Card variant="elevated" title={[painel.turma.nome, painel.turma.serie].filter(Boolean).join(" · ")}>
        <div className="mb-3 flex flex-col gap-1 text-[12px] leading-snug text-unooria-neutral-600">
          <p>
            Esta folha é para a <strong>sua</strong> tela, não para o projetor: ela tem nomes. Não há coluna de voto,
            de taxa nem de nível — os votos ficam só no gráfico por área, sem nome, e o nível das habilidades fica no
            painel de habilidades, lá embaixo, com a sua confirmação.
          </p>
          <p>
            O ícone de alerta ao lado do nome marca quem está com a cédula aberta e parada há mais de 1 minuto: é a
            hora de passar pela mesa. Ele some sozinho quando o computador volta a mexer.
          </p>
          <p>
            “Busca” diz se o computador usou a busca da Galeria Oculta, e “Categorias buscadas”, por quais hashtags. Buscar não comprova que entendeu: use a folha
            para puxar a conversa, não para comparar.
          </p>
        </div>
        <ListaDoJuri
          linhas={painel.linhas}
          porComputador={resumo.porComputador}
          membros={membros}
          categorias={resumo.votosPorArea}
        />
      </Card>
    </>
  );
}

/**
 * O que vai para o telão (E4-PROF-01): quantos votaram, os votos por área, a
 * invisibilidade média e, depois da galeria, os votos revisados. Nenhum nome.
 */
function PainelParaProjetar({ painel }: { painel: PainelDoJuri }) {
  const { resumo, etapa } = painel;
  /* Da galeria em diante: a lousa mostra também os votos revisados. */
  const naGaleria = etapa !== "exploracao";
  const totalAntes = totalDeVotos(resumo.votosPorArea);
  const totalDepois = totalDeVotos(resumo.votosRevisadosPorArea);
  const comRevisao =
    naGaleria && resumo.revisao.trocaram + resumo.revisao.mantiveram > 0;
  const antes = votosEmPercentual(resumo.votosPorArea);
  const depois = votosEmPercentual(resumo.votosRevisadosPorArea);
  const falta = textoDoQueFalta(resumo.computadores, resumo.porComputador);
  const revisao = textoDaRevisao(resumo.revisao, resumo.porComputador);
  const porArea = (lista: PainelDoJuri["resumo"]["votosPorArea"]) =>
    AREAS.map((area) => lista.find((a) => a.area === area)).filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <Card variant="elevated" title={TITULO_DO_PAINEL}>
      <div className="flex flex-col gap-4" data-painel-para-projetar>
        <p className="text-[12px] leading-snug text-unooria-neutral-600">
          Sem nomes: este cartão pode ir para o projetor.
          {naGaleria ? null : " Projete esta tela na lousa antes de liberar a auditoria."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            title={resumo.porComputador ? "Computadores que votaram" : "Jurados que votaram"}
            value={`${resumo.computadores.votaram} de ${resumo.computadores.total}`}
            description={falta ?? "Todos lacraram a urna."}
          />
          <MetricCard
            title="Invisibilidade média da turma"
            value={resumo.invisibilidadeMedia !== null ? `${resumo.invisibilidadeMedia}%` : "—"}
            description={textoDaInvisibilidade(resumo.invisibilidadeMedia)}
          />
        </div>

        {totalAntes === 0 ? (
          <p className="text-[13px] text-unooria-neutral-700">Ninguém votou ainda. O gráfico aparece com o primeiro voto lacrado.</p>
        ) : (
          <div className="flex flex-col gap-2" data-votos-por-area>
            {/* O eixo do `BarChart` do DS é fixo em 0–100: as barras vão em % dos
                votos, e as contagens exatas ficam nas linhas de baixo. O rótulo
                do eixo é curto ("Área A") porque o do DS corta acima de ~8
                caracteres; o nome da área está na legenda. */}
            <BarChart
              title={comRevisao ? "Votos por área: antes e depois da Galeria Oculta" : "Votos por área"}
              subtitle={comRevisao ? `% dos votos · antes: ${totalAntes} · depois: ${totalDepois}` : `% dos votos lacrados · ${totalAntes}`}
              data={AREAS.map((area, i) => ({
                label: rotuloCurtoDaArea(area),
                values: comRevisao ? [antes[i] ?? 0, depois[i] ?? 0] : [antes[i] ?? 0],
                colors: comRevisao ? [COR_ANTES, COR_DEPOIS] : [COR_ANTES],
              }))}
              indicators={
                comRevisao
                  ? [
                      { label: "Voto lacrado", color: COR_ANTES },
                      { label: "Depois da galeria", color: COR_DEPOIS },
                    ]
                  : [{ label: "Voto lacrado", color: COR_ANTES }]
              }
              height={220}
            />
            <ul className="flex flex-col gap-0.5 text-[12px] leading-snug text-unooria-neutral-600">
              {porArea(resumo.votosPorArea).map((a) => (
                <li key={a.area}>{textoDosVotosDaArea(a)}</li>
              ))}
            </ul>
            {comRevisao ? (
              <>
                <p className="text-[12px] font-semibold text-unooria-neutral-800">Depois da galeria</p>
                <ul className="flex flex-col gap-0.5 text-[12px] leading-snug text-unooria-neutral-600">
                  {porArea(resumo.votosRevisadosPorArea).map((a) => (
                    <li key={a.area}>{textoDosVotosDaArea(a)}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {naGaleria && revisao ? (
              <p className="text-[14px] font-semibold text-unooria-neutral-950" data-revisao-da-turma>
                {revisao}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}

/** As quatro perguntas da plenária, verbatim da api (`PERGUNTAS_DA_PLENARIA`). Podem ir para o projetor. */
function PerguntasDaPlenaria({ plenaria }: { plenaria: string[] | null }) {
  return (
    <Card variant="elevated" title="As perguntas da plenária">
      <div className="flex flex-col gap-2" data-perguntas-da-plenaria>
        {plenaria === null ? (
          <p className="text-[13px] text-unooria-neutral-700">
            As perguntas não carregaram. Atualize a página — elas também estão no guia da aula.
          </p>
        ) : (
          <>
            <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
              Com a lousa projetada, antes de liberar a auditoria: explore como a turma se dividiu sem dizer ainda que
              o feed se adaptou. A última leva a conversa para fora da tela e pode voltar no fechamento.
            </p>
            <ol className="flex max-w-3xl list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-900">
              {plenaria.map((pergunta) => (
                <li key={pergunta}>{pergunta}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    </Card>
  );
}
