"use client";

import { data, dataCurta, dataHora, diaDaPlataforma } from "@edu/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FeedbackAlert,
  LineChart,
  MetricCard,
  ScrollBar,
  SectionHeader,
  Selection,
  SemiDonutChart,
  Table,
  Tag,
  UNOORIA_DATAVIZ_PALETTE,
  type TableColumn,
} from "@edu/ui/ds";
import type { Modalidade, NumerosDoGrupo, PainelDeCustos as Painel } from "./tipos";

/**
 * O PAINEL DE CUSTOS DE IA (ADR-161): quanto a IA desta rede custou à Unooria,
 * em real e em dólar, por dia, produto, modelo, modalidade e escola.
 *
 * O valor principal é em REAL, convertido pela PTAX de venda do Banco Central
 * do próprio dia (a api faz a conta; aqui só se mostra). Sem cotação nenhuma,
 * a tela cai para o dólar e diz por quê — nunca um "R$ 0,00" que pareceria
 * que nada foi gasto.
 */

/** Os períodos que o painel oferece. Intervalo livre é pergunta rara, e os seis cobrem o fechamento do mês. */
const PERIODOS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mes-passado", label: "Mês passado" },
  { value: "ano", label: "Este ano" },
] as const;
type Periodo = (typeof PERIODOS)[number]["value"];

/** Aritmética de calendário sobre `YYYY-MM-DD`, em UTC: o dia já veio no fuso da plataforma. */
function somarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function intervaloDo(periodo: Periodo, hoje: string): { de: string; ate: string } {
  const [ano, mes] = hoje.split("-") as [string, string];
  switch (periodo) {
    case "7":
    case "30":
    case "90":
      return { de: somarDias(hoje, -(Number(periodo) - 1)), ate: hoje };
    case "mes":
      return { de: `${ano}-${mes}-01`, ate: hoje };
    case "mes-passado": {
      const fim = somarDias(`${ano}-${mes}-01`, -1);
      return { de: `${fim.slice(0, 7)}-01`, ate: fim };
    }
    case "ano":
      return { de: `${ano}-01-01`, ate: hoje };
  }
}

/**
 * O DIA (`YYYY-MM-DD`) vai aos formatadores do SDK como meio-dia UTC: meia-noite
 * UTC, no fuso de Brasília, é o dia ANTERIOR — e a tela mostraria o dia 8 para
 * o consumo do dia 9. Meio-dia não muda de dia em fuso nenhum do país.
 */
const doDia = (dia: string) => `${dia}T12:00:00Z`;

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dolares = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const inteiro = new Intl.NumberFormat("pt-BR");
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

const emReais = (v: number | null) => (v === null ? "—" : reais.format(v));
const emDolares = (v: number) => dolares.format(v);
/** "≈" quando a contagem foi estimada (a voz): a Cloud TTS não devolve tokens. */
const aprox = (g: Pick<NumerosDoGrupo, "estimado">) => (g.estimado ? "≈ " : "");

const MODALIDADES: Record<Modalidade, { rotulo: string; cor: string }> = {
  texto: { rotulo: "Texto", cor: UNOORIA_DATAVIZ_PALETTE[0] },
  imagem: { rotulo: "Imagem", cor: UNOORIA_DATAVIZ_PALETTE[6] },
  audio: { rotulo: "Áudio (voz e podcast)", cor: UNOORIA_DATAVIZ_PALETTE[9] },
  video: { rotulo: "Vídeo (avatar)", cor: UNOORIA_DATAVIZ_PALETTE[8] },
};

/** O que cada modelo produz além de token — a unidade que a pessoa reconhece. */
function unidades(g: NumerosDoGrupo): string {
  const partes: string[] = [];
  if (g.imagens > 0) partes.push(`${inteiro.format(g.imagens)} ${g.imagens === 1 ? "imagem" : "imagens"}`);
  if (g.segundos > 0) partes.push(`≈ ${inteiro.format(Math.round(g.segundos / 60))} min de áudio`);
  if (g.minutos > 0) partes.push(`${inteiro.format(Math.round(g.minutos))} min de vídeo`);
  return partes.join(" · ") || "—";
}

/**
 * COMPENSAÇÃO DO DS (0.2.19), marcada para morrer: o `LineChart` e o
 * `BarChart` desenham numa escala CRAVADA em 0–100 (`val / 100 * 230`; o
 * `BarChart` usa 100 como piso do máximo) e o eixo vertical é só texto. Custo de
 * IA em reais vive em centavos e dezenas: a curva saía rente ao chão, com o
 * eixo dizendo 0 a 100. Aqui a série vai em PERCENTUAL de um teto redondo, e o
 * eixo recebe os valores reais desse teto. O tooltip fica desligado porque
 * mostraria o percentual, não o valor. Pedido no storybook-unooria: escala pelo
 * dado (ou `maxValue`) e formatador do valor no tooltip. Registrado no
 * `AGENTS.md` da área.
 */
function tetoRedondo(maximo: number): number {
  if (maximo <= 0) return 1;
  const ordem = 10 ** Math.floor(Math.log10(maximo));
  const passo = [1, 2, 2.5, 5, 10].find((m) => m * ordem >= maximo) ?? 10;
  return passo * ordem;
}

/** Até ~10 rótulos no eixo de datas: com 30 ou 365, os rótulos se atropelam. */
function rotulosEspacados(rotulos: string[]): string[] {
  const salto = Math.max(1, Math.ceil(rotulos.length / 10));
  return rotulos.map((r, i) => (i % salto === 0 || i === rotulos.length - 1 ? r : ""));
}

/** As colunas que toda tabela do painel repete — custo nas duas moedas, tokens, chamadas. */
function colunasDeCusto<T extends NumerosDoGrupo>(): TableColumn<T>[] {
  return [
    { key: "brl", title: "Custo (R$)", align: "right", render: (_, l) => <strong>{emReais(l.brl)}</strong> },
    { key: "usd", title: "Custo (US$)", align: "right", render: (_, l) => emDolares(l.usd) },
    {
      key: "tokensEntrada",
      title: "Tokens de entrada",
      align: "right",
      render: (_, l) => `${aprox(l)}${inteiro.format(l.tokensEntrada)}`,
    },
    {
      key: "tokensSaida",
      title: "Tokens de saída",
      align: "right",
      render: (_, l) => `${aprox(l)}${inteiro.format(l.tokensSaida)}`,
    },
    {
      key: "chamadas",
      title: "Chamadas",
      align: "right",
      render: (_, l) =>
        l.falhas > 0 ? `${inteiro.format(l.chamadas)} (${inteiro.format(l.falhas)} com falha)` : inteiro.format(l.chamadas),
    },
  ];
}

function TabelaDoPainel<T extends NumerosDoGrupo>({
  colunas,
  linhas,
  chave,
}: {
  colunas: TableColumn<T>[];
  linhas: T[];
  chave: (l: T) => string;
}) {
  return (
    <ScrollBar orientation="both" autoHide className="tabela-rolavel">
      <Table<T>
        columns={colunas}
        data={linhas}
        keyExtractor={chave}
        emptyText="Nenhum uso de IA no período."
        size="md"
        theme="light"
      />
    </ScrollBar>
  );
}

const ROTULO_DO_PRODUTO = (l: { nome: string; semPreco: boolean }) => (
  <span className="flex flex-wrap items-center gap-2">
    {l.nome}
    {l.semPreco ? (
      <Tag variant="warning" size="sm">
        preço faltando
      </Tag>
    ) : null}
  </span>
);

/**
 * `recalculos` conta os preços gravados na tabela de baixo: cada um muda o
 * custo (inclusive para trás), e o painel relê o MESMO período em vez de
 * mostrar a conta anterior ao lado da tabela nova.
 */
export function PainelDeCustos({ inicial, recalculos }: { inicial: Painel; recalculos: number }) {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [painel, setPainel] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (p: Periodo) => {
    setPeriodo(p);
    setCarregando(true);
    setErro(null);
    const falhou = "O período novo não carregou. Os números abaixo ainda são do período anterior.";
    try {
      const { de, ate } = intervaloDo(p, diaDaPlataforma());
      const r = await fetch(`/api/plataforma/recursos/custos-de-ia?de=${de}&ate=${ate}`, { cache: "no-store" });
      /* O painel ANTERIOR fica: "nada gasto" e "a api não respondeu" seriam a
         mesma tela vazia, e a primeira leitura é a errada. */
      if (!r.ok) {
        setErro(falhou);
        return;
      }
      setPainel((await r.json()) as Painel);
    } catch {
      setErro(falhou);
    } finally {
      setCarregando(false);
    }
  }, []);

  const periodoAtual = useRef(periodo);
  periodoAtual.current = periodo;
  useEffect(() => {
    if (recalculos > 0) void carregar(periodoAtual.current);
  }, [recalculos, carregar]);

  const { totais, cotacao } = painel;
  const temReais = totais.brl !== null;

  /* Um ponto por dia do período, com ZERO nos dias sem uso: a curva com buraco
     ligaria a sexta à segunda e esconderia o fim de semana parado. */
  const serieDiaria = useMemo(() => {
    const porDia = new Map(painel.porDia.map((d) => [d.dia, d]));
    const dias: string[] = [];
    for (let d = painel.periodo.de; d <= painel.periodo.ate; d = somarDias(d, 1)) dias.push(d);
    const valores = dias.map((d) => {
      const linha = porDia.get(d);
      return linha ? (temReais ? (linha.brl ?? 0) : linha.usd) : 0;
    });
    const teto = tetoRedondo(Math.max(...valores, 0));
    // Teto abaixo de 1: três casas, senão 0,075 vira "0,08" e o eixo mente.
    const moeda = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: temReais ? "BRL" : "USD",
      minimumFractionDigits: teto < 1 ? 3 : 2,
      maximumFractionDigits: teto < 1 ? 3 : 2,
    });
    return {
      categorias: rotulosEspacados(dias.map((d) => dataCurta(doDia(d)))),
      percentuais: valores.map((v) => (v / teto) * 100),
      eixo: [1, 0.75, 0.5, 0.25, 0].map((f) => moeda.format(teto * f)),
    };
  }, [painel, temReais]);

  const algumEstimado = painel.porModelo.some((m) => m.estimado);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Custos de IA"
        description="Quanto a IA desta rede custou à Unooria: texto, imagem, voz, podcast, o agente do professor e a Ajuda em vídeo. Os tokens são os que o fornecedor mediu em cada chamada; o preço é o da tabela abaixo, no dia do uso; o real sai da PTAX de venda do Banco Central do mesmo dia."
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-[260px]">
          <Selection
            id="custos-periodo"
            label="Período"
            value={periodo}
            options={PERIODOS.map((p) => ({ value: p.value, label: p.label }))}
            onChange={(v) => void carregar(String(v) as Periodo)}
          />
        </div>
        <p className="pb-2 text-[13px] text-unooria-neutral-600">
          {data(doDia(painel.periodo.de))} a {data(doDia(painel.periodo.ate))}
          {carregando ? " · carregando…" : ""}
        </p>
        {cotacao.ultima ? (
          <div className="pb-1">
            <Tag variant="info" size="sm">
              {`Dólar (PTAX de venda, ${data(doDia(cotacao.ultima.dia))}): ${reais.format(cotacao.ultima.venda)}`}
            </Tag>
          </div>
        ) : null}
      </div>

      {erro ? <FeedbackAlert type="error" title="Não carregou" description={erro} /> : null}

      {!cotacao.ultima ? (
        <FeedbackAlert
          type="warning"
          title="Sem cotação do dólar"
          description="O Banco Central não respondeu e ainda não há cotação guardada nesta rede. Os custos aparecem só em dólar até a primeira cotação chegar."
        />
      ) : cotacao.falhou ? (
        <FeedbackAlert
          type="info"
          title="Cotação de hoje não atualizada"
          description={`O Banco Central não respondeu agora. A conversão usa as cotações já guardadas — a mais recente é de ${data(doDia(cotacao.ultima.dia))}.`}
        />
      ) : null}

      {painel.modelosSemPreco.length > 0 ? (
        <FeedbackAlert
          type="warning"
          title="Há consumo sem preço"
          description={`${painel.modelosSemPreco.join(", ")}: houve uso no período, mas a tabela não tem preço vigente para ${painel.modelosSemPreco.length === 1 ? "este modelo" : "estes modelos"}. O custo está contado como zero — cadastre o preço abaixo e o painel recalcula, inclusive para trás.`}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Custo total (R$)"
          value={emReais(totais.brl)}
          description={temReais ? "convertido dia a dia pela PTAX" : "sem cotação: veja o valor em dólar"}
        />
        <MetricCard title="Custo total (US$)" value={emDolares(totais.usd)} description="preço de tabela × consumo" />
        <MetricCard
          title="Tokens de entrada"
          value={compacto.format(totais.tokensEntrada)}
          description={`${inteiro.format(totais.tokensEntrada)} tokens`}
        />
        <MetricCard
          title="Tokens de saída"
          value={compacto.format(totais.tokensSaida)}
          description={`${inteiro.format(totais.tokensSaida)} tokens, com o raciocínio do modelo`}
        />
        <MetricCard
          title="Chamadas de IA"
          value={inteiro.format(totais.chamadas)}
          description={
            totais.falhas > 0
              ? `${inteiro.format(totais.falhas)} falharam (o que foi pago antes da falha conta)`
              : "nenhuma falhou"
          }
        />
        <MetricCard title="Imagens geradas" value={inteiro.format(totais.imagens)} description="arte das missões" />
        <MetricCard
          title="Áudio gerado"
          value={`${inteiro.format(Math.round(totais.segundosDeAudio / 60))} min`}
          description="voz e podcast (estimado pelo tamanho do arquivo)"
        />
        <MetricCard
          title="Vídeo do avatar"
          value={`${inteiro.format(Math.round(totais.minutosDeVideo))} min`}
          description="a Ajuda em vídeo, cobrada por minuto"
        />
      </div>

      {/* `min-w-0` nos dois: o card do DS não encolhe abaixo do conteúdo, e sem
          ele a grade vazava a coluna (o donut passava da borda, visto no print). */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
        <LineChart
          title={temReais ? "Custo por dia (R$)" : "Custo por dia (US$)"}
          subtitle="dias sem uso aparecem como zero"
          categories={serieDiaria.categorias}
          series={[
            {
              id: "custo",
              name: temReais ? "Custo (R$)" : "Custo (US$)",
              data: serieDiaria.percentuais,
              color: UNOORIA_DATAVIZ_PALETTE[4],
            },
          ]}
          isArea
          yAxisLabels={serieDiaria.eixo}
          showTooltip={false}
          height={260}
          theme="light"
        />
        <SemiDonutChart
          title="Por modalidade"
          subtitle="% do custo do período"
          /* Em PERCENTUAL inteiro: o card escreve o número cru, e "0.1" (ponto,
             sem moeda) não é número em pt-BR. O valor em moeda está nas tabelas. */
          data={painel.porModalidade.map((m) => ({
            label: MODALIDADES[m.modalidade].rotulo,
            value: totais.usd > 0 ? Math.round((m.usd / totais.usd) * 100) : 0,
            color: MODALIDADES[m.modalidade].cor,
          }))}
          size={180}
          theme="light"
        />
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Por produto" description="O produto é a parte da plataforma que chamou a IA. O mais caro primeiro." />
        <TabelaDoPainel
          linhas={painel.porRecurso}
          chave={(l) => l.recurso}
          colunas={[
            { key: "nome", title: "Produto", render: (_, l) => ROTULO_DO_PRODUTO(l) },
            ...colunasDeCusto<Painel["porRecurso"][number]>(),
          ]}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Por modelo"
          description={
            algumEstimado
              ? "O que cada modelo consumiu. “≈” marca a voz: a síntese não devolve contagem de tokens, e ela é estimada pela duração do áudio (25 tokens por segundo)."
              : "O que cada modelo consumiu, com a unidade que ele produz."
          }
        />
        <TabelaDoPainel
          linhas={painel.porModelo}
          chave={(l) => `${l.modelo}|${l.modalidade}`}
          colunas={[
            {
              key: "modelo",
              title: "Modelo",
              render: (_, l) => ROTULO_DO_PRODUTO({ nome: l.modelo, semPreco: l.semPreco }),
            },
            { key: "modalidade", title: "Modalidade", render: (_, l) => MODALIDADES[l.modalidade].rotulo },
            { key: "unidades", title: "Produziu", render: (_, l) => unidades(l) },
            ...colunasDeCusto<Painel["porModelo"][number]>(),
          ]}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Por escola"
          description="As contas do contrato (gestão da rede, a Unooria) não têm escola no acesso e aparecem juntas numa linha."
        />
        <TabelaDoPainel
          linhas={painel.porEscola}
          chave={(l) => l.escolaId || "sem-escola"}
          colunas={[{ key: "nome", title: "Escola" }, ...colunasDeCusto<Painel["porEscola"][number]>()]}
        />
      </section>

      {cotacao.ultima ? (
        <p className="text-[12px] text-unooria-neutral-500">
          Fonte do câmbio: {cotacao.fonte}, publicada em {dataHora(cotacao.ultima.cotadoEm)}. Dia sem cotação (fim de
          semana, feriado) usa a do último dia útil.
        </p>
      ) : null}
    </div>
  );
}
