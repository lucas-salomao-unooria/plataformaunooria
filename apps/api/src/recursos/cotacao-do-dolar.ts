import { Prisma } from "@prisma/client";
import { z } from "zod";
import { logger } from "../observabilidade/logger";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * A COTAÇÃO DO DÓLAR para o painel de custos de IA (ADR-161): a PTAX de VENDA
 * do Banco Central, pela API pública Olinda (sem chave, sem cadastro).
 *
 * **Por que a PTAX de venda**: é a taxa oficial de referência para converter
 * uma fatura em dólar. A de compra fica guardada (vem na mesma resposta), mas
 * a conta usa a de venda.
 *
 * **Cache no banco, não em memória** (`cotacoes_dolar`): a PTAX de um dia não
 * muda depois de publicada, e com `min-instances: 3` um cache por processo
 * seria três cópias e três idas ao BCB. A tabela também é o que mantém o
 * painel convertendo quando o BCB está fora do ar — o custo já gasto não pode
 * sumir da tela porque a fonte da cotação caiu.
 *
 * **Fim de semana e feriado não têm PTAX** e não aparecem na resposta: não é
 * erro. O dia sem linha usa a do último dia útil anterior (mesma regra do BCB).
 */

export const URL_DO_BCB = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata";
/** A página do admin espera esta busca: estourar trava a tela, e o cache cobre. */
const PRAZO_DO_BCB_MS = 5_000;
/** De quanto em quanto tempo o painel tenta trazer a PTAX do dia (publicada por volta das 13h). */
export const RELER_DEPOIS_DE_MS = 60 * 60 * 1000;
/** Margem para trás: o primeiro dia do período pode ser sábado, e a PTAX que vale é a de sexta. */
export const MARGEM_PARA_TRAS_EM_DIAS = 10;

const RespostaDoBcbSchema = z.object({
  value: z.array(
    z.object({
      cotacaoCompra: z.number().positive(),
      cotacaoVenda: z.number().positive(),
      /** `"2026-10-09 13:07:30.746597"`, no horário de Brasília. */
      dataHoraCotacao: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/),
    }),
  ),
});

export interface Cotacao {
  dia: string;
  compra: number;
  venda: number;
  cotadoEm: string;
}

/** `YYYY-MM-DD` → `'MM-DD-YYYY'` com as aspas, que é o formato do OData do BCB. */
export function dataDoBcb(dia: string): string {
  const [ano, mes, d] = dia.split("-");
  return `'${mes}-${d}-${ano}'`;
}

export function urlDoPeriodo(de: string, ate: string): string {
  return (
    `${URL_DO_BCB}/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial=${dataDoBcb(de)}&@dataFinalCotacao=${dataDoBcb(ate)}&$format=json`
  );
}

/**
 * A resposta do BCB vira cotações por DIA. Pura. Quando o mesmo dia aparece
 * duas vezes (não deveria: o fechamento é um por dia), vale a mais tarde.
 *
 * O horário vem SEM fuso e é o de Brasília por definição — é o relógio de
 * publicação do Banco Central, não o fuso da plataforma (ADR-99); o Brasil não
 * tem horário de verão desde 2019, então o deslocamento é fixo.
 */
export function cotacoesDaResposta(bruto: unknown): Cotacao[] {
  const { value } = RespostaDoBcbSchema.parse(bruto);
  const porDia = new Map<string, Cotacao>();
  for (const v of value) {
    const dia = v.dataHoraCotacao.slice(0, 10);
    const cotadoEm = new Date(`${v.dataHoraCotacao.slice(0, 19).replace(" ", "T")}-03:00`).toISOString();
    const atual = porDia.get(dia);
    if (!atual || atual.cotadoEm < cotadoEm) {
      porDia.set(dia, { dia, compra: v.cotacaoCompra, venda: v.cotacaoVenda, cotadoEm });
    }
  }
  return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

/** O que o painel mostra sobre a cotação — inclusive quando ela falhou. */
export interface SituacaoDaCotacao {
  /** A mais recente que o banco tem, depois da tentativa. */
  ultima: Cotacao | null;
  /** A tentativa de agora falhou (BCB fora do ar, resposta fora do formato). */
  falhou: boolean;
}

const diaDe = (d: Date) => d.toISOString().slice(0, 10);
const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);

/**
 * Traz do BCB as PTAX que faltam para o período e devolve a situação. NUNCA
 * lança: sem cotação, o painel mostra o custo em dólar e diz por quê.
 *
 * Vai ao BCB quando o cache não cobre o INÍCIO do período, ou quando a última
 * busca tem mais de uma hora (a PTAX do dia sai por volta das 13h). Fora isso,
 * o painel abre sem rede nenhuma.
 */
export async function atualizarCotacoes(
  prisma: PrismaService,
  de: string,
  ate: string,
  buscar: (url: string) => Promise<unknown> = buscarNoBcb,
  agora: Date = new Date(),
): Promise<SituacaoDaCotacao> {
  let falhou = false;
  try {
    const inicio = diaDe(new Date(dataDoDia(de).getTime() - MARGEM_PARA_TRAS_EM_DIAS * 86_400_000));
    const [cobertura] = await prisma.$queryRaw<Array<{ primeiro: Date | null; buscado: Date | null }>>`
      SELECT min(dia) AS primeiro, max(buscado_em) AS buscado FROM cotacoes_dolar`;
    // Compara com `de`, e não com `inicio`: `inicio` pode cair num sábado, e
    // o primeiro dia útil devolvido é sempre DEPOIS dele — a busca se
    // repetiria a cada abertura. Dez dias para trás sempre trazem um dia útil <= `de`.
    const faltaOInicio = !cobertura?.primeiro || diaDe(cobertura.primeiro) > de;
    const velho = !cobertura?.buscado || agora.getTime() - cobertura.buscado.getTime() > RELER_DEPOIS_DE_MS;

    if (faltaOInicio || velho) {
      const cotacoes = cotacoesDaResposta(await buscar(urlDoPeriodo(inicio, ate)));
      for (const c of cotacoes) {
        const valores = {
          compra: new Prisma.Decimal(c.compra),
          venda: new Prisma.Decimal(c.venda),
          cotadoEm: new Date(c.cotadoEm),
          buscadoEm: agora,
        };
        await prisma.cotacaoDolar.upsert({
          where: { dia: dataDoDia(c.dia) },
          create: { dia: dataDoDia(c.dia), ...valores },
          update: valores,
        });
      }
      // Período sem dia útil novo (domingo de manhã) não grava cotação: sem
      // marcar a busca, cada abertura do painel voltaria ao BCB pela mesma
      // resposta vazia.
      if (cotacoes.length === 0) {
        await prisma.$executeRaw`
          UPDATE cotacoes_dolar SET buscado_em = ${agora}
           WHERE dia = (SELECT max(dia) FROM cotacoes_dolar)`;
      }
    }
  } catch (erro) {
    falhou = true;
    logger.warn({ codigo: "cotacao-dolar-indisponivel", err: erro }, "a PTAX do Banco Central não foi atualizada");
  }

  const ultima = await prisma.cotacaoDolar.findFirst({ orderBy: { dia: "desc" } }).catch(() => null);
  return {
    falhou,
    ultima: ultima
      ? { dia: diaDe(ultima.dia), compra: Number(ultima.compra), venda: Number(ultima.venda), cotadoEm: ultima.cotadoEm.toISOString() }
      : null,
  };
}

async function buscarNoBcb(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(PRAZO_DO_BCB_MS), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`BCB respondeu ${res.status}`);
  return res.json();
}
