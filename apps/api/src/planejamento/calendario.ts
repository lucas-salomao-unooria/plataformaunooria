import { DIVISOES_DO_ANO, SEMANAS_LETIVAS, type DivisaoDoAno } from "../curriculo/carga-horaria";

/**
 * O calendário do planejamento: transformar "leciono terça e quinta, 5 aulas
 * por semana" em aulas com data e hora, agrupadas em semanas dentro de
 * bimestres.
 *
 * Tudo aqui é PURO — nenhuma consulta, nenhuma data "de hoje". Datas de
 * calendário escolar são o terreno clássico de bug silencioso: um fuso mal
 * resolvido move a aula de segunda para domingo, e o plano continua parecendo
 * certo. Por isso trabalhamos com data civil (`YYYY-MM-DD`) em UTC ao meio-dia,
 * nunca com `new Date()` local: ao meio-dia UTC nenhum fuso do Brasil (UTC-2 a
 * UTC-5) atravessa a meia-noite, então o dia da semana nunca escorrega.
 */

/** `YYYY-MM-DD`. É o formato que entra e sai da api — sem hora, sem fuso. */
export type DataCivil = string;

/** 1 = segunda … 5 = sexta. Sábado e domingo não entram na grade regular. */
export type DiaDaSemana = 1 | 2 | 3 | 4 | 5;

export interface FaixaDeHorario {
  readonly diaDaSemana: DiaDaSemana;
  /** `["07:00", "07:50"]` — uma entrada por aula naquele dia. */
  readonly horarios: readonly string[];
}

/** O meio-dia UTC do dia civil. Ver o comentário do topo. */
export function aoMeioDiaUtc(data: DataCivil): Date {
  const partes = data.split("-").map(Number);
  const [ano = 1970, mes = 1, dia = 1] = partes;
  return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
}

export function paraDataCivil(d: Date): DataCivil {
  return d.toISOString().slice(0, 10);
}

export function somarDias(data: DataCivil, dias: number): DataCivil {
  const d = aoMeioDiaUtc(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraDataCivil(d);
}

/** 0 = domingo … 6 = sábado, lido em UTC (por isso estável). */
export function diaDaSemanaDe(data: DataCivil): number {
  return aoMeioDiaUtc(data).getUTCDay();
}

/** A segunda-feira da semana em que a data cai. Domingo pertence à semana anterior. */
export function segundaDaSemana(data: DataCivil): DataCivil {
  const dow = diaDaSemanaDe(data);
  const recuo = dow === 0 ? 6 : dow - 1;
  return somarDias(data, -recuo);
}

// ------------------------------------------------------ períodos de avaliação

export interface PeriodoDeAvaliacao {
  /** 1 = 1º bimestre. */
  readonly ordem: number;
  readonly rotulo: string;
  readonly inicio: DataCivil;
  readonly fim: DataCivil;
}

/**
 * Divide o ano letivo nos períodos de avaliação da escola.
 *
 * Divide em SEMANAS, não em dias corridos: um bimestre de "dez semanas" que
 * termina numa quarta-feira produz uma semana partida, e a semana partida é
 * justamente onde o professor não sabe em qual bimestre lançar a aula. Cada
 * período começa numa segunda e termina num domingo.
 *
 * O resto da divisão vai para o ÚLTIMO período — 40 semanas em 3 trimestres dá
 * 13, 13 e 14. Empurrar a sobra para o fim é o que as redes fazem, porque o
 * último período absorve a recuperação final.
 */
export function periodosDoAnoLetivo(
  inicioDoAno: DataCivil,
  divisao: DivisaoDoAno,
  semanasLetivas = SEMANAS_LETIVAS,
): readonly PeriodoDeAvaliacao[] {
  const { periodos, rotulo } = DIVISOES_DO_ANO[divisao];
  const base = Math.floor(semanasLetivas / periodos);
  const sobra = semanasLetivas - base * periodos;

  const lista: PeriodoDeAvaliacao[] = [];
  let cursor = segundaDaSemana(inicioDoAno);

  for (let i = 0; i < periodos; i++) {
    const semanas = base + (i === periodos - 1 ? sobra : 0);
    const inicio = cursor;
    const fim = somarDias(inicio, semanas * 7 - 1);
    lista.push({ ordem: i + 1, rotulo: `${i + 1}º ${rotulo}`, inicio, fim });
    cursor = somarDias(fim, 1);
  }
  return lista;
}

// ---------------------------------------------------- semanas de planejamento

export interface SemanaDePlanejamento {
  /** 1 = primeira semana do ano letivo. */
  readonly ordem: number;
  readonly inicio: DataCivil;
  readonly fim: DataCivil;
  /** A qual período de avaliação a semana pertence. */
  readonly periodoDeAvaliacao: number;
  readonly rotulo: string;
}

/**
 * As semanas que o professor vai planejar. O passo é SEMPRE de sete dias.
 *
 * Houve uma periodicidade configurável (semanal ou quinzenal) e ela saiu em
 * 2026-09-07 (ADR-76). O que a quinzena resolvia era a ENTREGA — a escola que
 * recolhe planejamento de duas em duas semanas —, e isso hoje é um recorte de
 * EXPORTAÇÃO: o professor planeja semana a semana e baixa duas juntas. Como
 * passo de planejamento ela custava caro, porque a `ordem` mudava de
 * significado: a 3ª quinzena não é a 3ª semana, e trocar o passo depois de
 * planejar deixava planos gravados cujas datas mentiam sobre as aulas que
 * continham.
 *
 * A semana é classificada no período de avaliação em que seu INÍCIO cai — e
 * como `periodosDoAnoLetivo` divide o ano em semanas fechadas (segunda a
 * domingo), nenhuma semana atravessa a virada do bimestre.
 */
export function semanasDoAnoLetivo(
  periodos: readonly PeriodoDeAvaliacao[],
): readonly SemanaDePlanejamento[] {
  if (!periodos.length) return [];
  const passo = 7;

  const primeiroPeriodo = periodos[0];
  const ultimoPeriodo = periodos[periodos.length - 1];
  if (!primeiroPeriodo || !ultimoPeriodo) return [];
  const primeiro = primeiroPeriodo.inicio;
  const ultimo = ultimoPeriodo.fim;

  const semanas: SemanaDePlanejamento[] = [];
  let cursor = primeiro;
  let ordem = 1;

  while (cursor <= ultimo) {
    const fim = somarDias(cursor, passo - 1);
    const periodo = periodos.find((p) => cursor >= p.inicio && cursor <= p.fim);
    semanas.push({
      ordem,
      inicio: cursor,
      // A última semana não passa do fim do ano letivo.
      fim: fim > ultimo ? ultimo : fim,
      periodoDeAvaliacao: periodo?.ordem ?? ultimoPeriodo.ordem,
      rotulo: rotuloDaSemana(ordem),
    });
    cursor = somarDias(cursor, passo);
    ordem++;
  }
  return semanas;
}

/**
 * Como a semana se chama em toda superfície: tela, documento exportado e
 * resposta da api.
 *
 * Existe como função porque o rótulo era montado em DOIS lugares e eles
 * divergiram: o calendário dizia "3ª Semana" e o mapeador do plano gravado
 * dizia "3ª janela" — que é jargão interno. O professor então lia "3ª Semana"
 * na lista, abria, e o cabeçalho do .doc que ele entrega à coordenação saía
 * com a outra palavra.
 */
export function rotuloDaSemana(ordem: number): string {
  return `${ordem}ª Semana`;
}

// ------------------------------------------------------------ aulas da semana

export interface HorarioDeAula {
  readonly numero: number;
  readonly data: DataCivil;
  readonly diaDaSemana: DiaDaSemana;
  readonly horario: string;
}

const NOME_DO_DIA = ["", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira"];

export function nomeDoDia(dia: DiaDaSemana): string {
  return NOME_DO_DIA[dia] ?? "";
}

/**
 * As aulas que existem dentro de uma semana, datadas e na ordem cronológica.
 *
 * É a função que dá ao plano granular o seu esqueleto: sem ela a IA teria de
 * inventar quantas aulas cabem na semana, e inventaria — normalmente cinco,
 * porque é o número redondo, quando o professor de Arte do 7º ano tem uma.
 *
 * `feriados` remove a data do resultado em vez de deslocar a aula. Deslocar
 * seria pior: empurraria o plano inteiro e desalinharia todas as semanas
 * seguintes. A aula perdida no feriado é uma decisão pedagógica do professor
 * (repor, condensar, seguir), não uma conta que o sistema deva fazer por ele.
 */
export function aulasDaSemana(
  semana: SemanaDePlanejamento,
  grade: readonly FaixaDeHorario[],
  feriados: readonly DataCivil[] = [],
): readonly HorarioDeAula[] {
  const semAula = new Set(feriados);
  const porDia = new Map<number, readonly string[]>();
  for (const faixa of grade) porDia.set(faixa.diaDaSemana, faixa.horarios);

  const aulas: HorarioDeAula[] = [];
  let numero = 1;

  for (let data = semana.inicio; data <= semana.fim; data = somarDias(data, 1)) {
    const dow = diaDaSemanaDe(data);
    if (dow < 1 || dow > 5) continue;
    if (semAula.has(data)) continue;
    const horarios = porDia.get(dow);
    if (!horarios?.length) continue;

    for (const horario of [...horarios].sort()) {
      aulas.push({ numero: numero++, data, diaDaSemana: dow as DiaDaSemana, horario });
    }
  }
  return aulas;
}

/**
 * Confere se a grade declarada bate com as aulas semanais da configuração.
 *
 * Uma divergência aqui é o erro mais comum da tela de configuração: o professor
 * digita "5 aulas por semana" e depois marca só terça e quinta com uma aula
 * cada. Se ninguém avisar, o plano anual dimensiona 200 aulas no ano e o plano
 * de período entrega 2 por semana — e a incoerência só aparece em setembro,
 * quando o conteúdo não fecha.
 */
export function conferirGrade(
  grade: readonly FaixaDeHorario[],
  aulasSemanais: number,
): { total: number; coerente: boolean } {
  const total = grade.reduce((t, f) => t + f.horarios.length, 0);
  return { total, coerente: total === aulasSemanais };
}
