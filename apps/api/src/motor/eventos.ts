import type { Intensidade, Lado } from '../comum/insta/tipos';

import type { EngineConfig, EngineState, EventoPontuavel, PostMeta } from './tipos';

/**
 * Pontuação dos sinais (doc 04 §2). Função pura: recebe estado + eventos e
 * devolve o novo estado. Roda no servidor a cada pedido de bloco.
 */

const SINAIS_EXPLICITOS = new Set(['curtiu', 'comentou', 'compartilhou', 'salvou', 'seguiu', 'enquete']);

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  // `?? 0` nunca dispara: `meio` está sempre dentro do array (guarda exigida
  // pelo noUncheckedIndexedAccess do monorepo).
  return ordenados.length % 2 === 0
    ? Math.round(((ordenados[meio - 1] ?? 0) + (ordenados[meio] ?? 0)) / 2)
    : (ordenados[meio] ?? 0);
}

function somar(mapa: Record<string, number>, chave: string, valor: number): void {
  mapa[chave] = (mapa[chave] ?? 0) + valor;
}

/** Pontos do dwell segundo a baseline da sessão (doc 04 §2). */
export function pontosDeDwell(
  dwellMs: number,
  baselineMs: number | null,
  config: EngineConfig,
): { pontos: number; dwellNorm: number | null; alto: boolean } {
  if (dwellMs < config.dwell.rolouRetoMs) {
    return { pontos: config.dwell.rolouRetoPontos, dwellNorm: baselineMs ? dwellMs / baselineMs : null, alto: false };
  }
  if (!baselineMs || baselineMs <= 0) return { pontos: 0, dwellNorm: null, alto: false };

  const dwellNorm = dwellMs / baselineMs;
  const faixa = config.dwell.faixas.find((item) => dwellNorm >= item.min);
  return { pontos: faixa?.pontos ?? 0, dwellNorm, alto: dwellNorm >= 2.2 };
}

/**
 * Domínio do lado vencedor: 0.5 quando ainda não há sinal suficiente.
 * `suavizacaoDominio` é um prior que evita o salto para 1.0 assim que o lado
 * oposto fica negativo — a escalada precisa ser gradual (doc 02/04).
 */
export function dominioDe(estado: EngineState, config: EngineConfig): { dominio: number; ladoDominante: Lado } {
  const a = Math.max(0, estado.scoreA);
  const b = Math.max(0, estado.scoreB);
  const soma = a + b;

  if (soma < config.somaMinimaParaDominio) return { dominio: 0.5, ladoDominante: 'neutro' };

  const k = config.suavizacaoDominio ?? 0;
  const dominio = (Math.max(a, b) + k) / (soma + 2 * k);
  return { dominio, ladoDominante: a >= b ? 'A' : 'B' };
}

/** Escada de intensidade (doc 04 §5.4): só destrava com sinal do próprio lado. */
export function recalcularEscada(estado: EngineState, config: EngineConfig): EngineState {
  const proximo = { ...estado, intensityUnlocked: { ...estado.intensityUnlocked } };

  for (const lado of ['A', 'B'] as const) {
    for (const nivel of [1, 2] as const) {
      const destravado = proximo.intensityUnlocked[lado];
      if (destravado !== nivel) continue;

      const sinais = proximo.sinaisPorNivel[lado][String(nivel)] ?? 0;
      const dwellsAltos = proximo.dwellsAltosPorNivel[lado][String(nivel)] ?? 0;

      if (
        sinais >= config.escada.sinaisExplicitosParaDestravar ||
        dwellsAltos >= config.escada.dwellsAltosParaDestravar
      ) {
        proximo.intensityUnlocked[lado] = (nivel + 1) as Intensidade;
      }
    }
  }

  return proximo;
}

export function aplicarEventos(
  estadoEntrada: EngineState,
  eventos: EventoPontuavel[],
  posts: Map<string, PostMeta>,
  config: EngineConfig,
  /** authorId → lado, para pontuar "seguir" vindo do módulo de sugestões. */
  autores?: Map<string, Lado>,
  /** Coletor opcional: o serviço grava dwellNorm de volta no evento (doc 04 §2). */
  coletorDeDwellNorm?: { eventoId: string; dwellNorm: number }[],
): EngineState {
  const estado: EngineState = {
    ...estadoEntrada,
    neutroScores: { ...estadoEntrada.neutroScores },
    followedAuthors: [...estadoEntrada.followedAuthors],
    vistosPorPost: { ...estadoEntrada.vistosPorPost },
    dwellPorPost: { ...estadoEntrada.dwellPorPost },
    postsConsumidos: [...estadoEntrada.postsConsumidos],
    dwellsIniciais: [...estadoEntrada.dwellsIniciais],
    pendentesDeBaseline: [...estadoEntrada.pendentesDeBaseline],
    sinaisPorNivel: {
      A: { ...estadoEntrada.sinaisPorNivel.A },
      B: { ...estadoEntrada.sinaisPorNivel.B },
    },
    dwellsAltosPorNivel: {
      A: { ...estadoEntrada.dwellsAltosPorNivel.A },
      B: { ...estadoEntrada.dwellsAltosPorNivel.B },
    },
    intensityUnlocked: { ...estadoEntrada.intensityUnlocked },
    perfilScores: { ...(estadoEntrada.perfilScores ?? {}) },
  };

  const creditar = (meta: PostMeta, pontos: number) => {
    if (pontos === 0) return;
    const multiplicador = estado.followedAuthors.includes(meta.authorId) ? config.bonusAutorSeguido : 1;
    const valor = pontos * multiplicador;

    if (meta.lado === 'A') estado.scoreA += valor;
    else if (meta.lado === 'B') estado.scoreB += valor;
    else somar(estado.neutroScores, meta.categoria, valor);

    /**
     * O MESMO sinal pontua o balde de **perfil de linguagem** (doc 04 §2). Vale
     * inclusive para neutros: eles não têm lado, mas têm perfil — e é neles que a
     * leitura da preferência de linguagem fica mais limpa, porque acontece sem o
     * lado interferindo.
     */
    if (meta.perfil) somar(estado.perfilScores!, meta.perfil, valor);
  };

  const registrarSinalExplicito = (meta: PostMeta) => {
    if (meta.lado === 'neutro') return;
    somar(estado.sinaisPorNivel[meta.lado], String(meta.intensidade), 1);
  };

  /** Pontua direto num lado (sem post): é o caso de seguir pelas Sugestões. */
  const creditarLado = (lado: Lado, pontos: number) => {
    if (lado === 'A') estado.scoreA += pontos;
    else if (lado === 'B') estado.scoreB += pontos;
  };

  for (const evento of eventos) {
    if (BigInt(evento.id) <= BigInt(estado.ultimoEventoProcessado)) continue;
    estado.ultimoEventoProcessado = evento.id;

    const meta = evento.postId ? posts.get(evento.postId) : undefined;
    const payload = (evento.payload ?? {}) as { dwellMs?: number; authorId?: string };

    if (evento.tipo === 'seguiu' || evento.tipo === 'deixou_seguir') {
      const authorId = payload.authorId ?? meta?.authorId;

      // Seguir de volta pelo módulo "Sugestões"/notificação vem SEM postId — e é
      // sinal fortíssimo (doc 04 §5). Sem isto valia zero ponto.
      if (!meta && authorId) {
        const lado = autores?.get(authorId);
        if (lado && lado !== 'neutro') {
          const pontos = evento.tipo === 'seguiu' ? config.pesos.seguiu : config.pesos.deixou_seguir;
          creditarLado(lado, pontos ?? 0);
          if (evento.tipo === 'seguiu') {
            somar(estado.sinaisPorNivel[lado], String(estado.intensityUnlocked[lado]), 1);
          }
        }
      }

      // A lista muda DEPOIS da pontuação: o bônus ×1.3 vale para os posts
      // seguintes do autor, não para o ato de seguir (que vale +10 exatos).
      if (evento.tipo === 'seguiu' && meta) {
        creditar(meta, config.pesos.seguiu ?? 0);
        registrarSinalExplicito(meta);
      }
      if (evento.tipo === 'deixou_seguir' && meta) {
        creditar(meta, config.pesos.deixou_seguir ?? 0);
      }

      if (evento.tipo === 'seguiu' && authorId && !estado.followedAuthors.includes(authorId)) {
        estado.followedAuthors.push(authorId);
      }
      if (evento.tipo === 'deixou_seguir' && authorId) {
        estado.followedAuthors = estado.followedAuthors.filter((item) => item !== authorId);
      }

      continue;
    }

    if (!meta) continue;

    switch (evento.tipo) {
      case 'visto': {
        const dwellMs = payload.dwellMs ?? 0;
        const jaVisto = (estado.vistosPorPost[evento.postId!] ?? 0) > 0;

        estado.vistosPorPost[evento.postId!] = (estado.vistosPorPost[evento.postId!] ?? 0) + 1;
        somar(estado.dwellPorPost, evento.postId!, dwellMs);
        if (!estado.postsConsumidos.includes(evento.postId!)) estado.postsConsumidos.push(evento.postId!);

        if (jaVisto) {
          // Revisita: só pontua se o aluno realmente voltou a olhar.
          if (dwellMs >= config.dwell.revisitaMinMs) creditar(meta, config.pesos.rever ?? 4);
          break;
        }

        /** Aplica o dwell de um post já com baseline conhecida. */
        const pontuarDwell = (postMeta: PostMeta, ms: number, eventoId: string) => {
          const { pontos, dwellNorm, alto } = pontosDeDwell(ms, estado.baselineDwellMs, config);
          creditar(postMeta, pontos);
          if (alto && postMeta.lado !== 'neutro') {
            somar(estado.dwellsAltosPorNivel[postMeta.lado], String(postMeta.intensidade), 1);
          }
          if (dwellNorm !== null && coletorDeDwellNorm) {
            coletorDeDwellNorm.push({ eventoId, dwellNorm: Math.round(dwellNorm * 100) / 100 });
          }
        };

        // Sem baseline ainda: guarda e pontua retroativamente quando ela nascer.
        // (Antes, os 7 primeiros posts da sessão só podiam PERDER ponto — o
        // momento mais informativo da sessão era jogado fora.)
        if (estado.baselineDwellMs === null) {
          estado.dwellsIniciais.push(dwellMs);
          estado.pendentesDeBaseline.push({ postId: evento.postId!, dwellMs });

          if (estado.dwellsIniciais.length >= config.bloco.inicial) {
            estado.baselineDwellMs = Math.max(400, mediana(estado.dwellsIniciais));

            for (const pendente of estado.pendentesDeBaseline) {
              const metaPendente = posts.get(pendente.postId);
              if (metaPendente) pontuarDwell(metaPendente, pendente.dwellMs, evento.id);
            }
            estado.pendentesDeBaseline = [];
          }
          break;
        }

        pontuarDwell(meta, dwellMs, evento.id);
        break;
      }

      case 'enquete': {
        const ladoDaOpcao = (evento.payload as { lado?: 'A' | 'B' } | null)?.lado;
        if (ladoDaOpcao) {
          const pontos = config.pesos.enquete ?? 8;
          if (ladoDaOpcao === 'A') estado.scoreA += pontos;
          else estado.scoreB += pontos;
          somar(estado.sinaisPorNivel[ladoDaOpcao], String(meta.intensidade), 1);
        } else {
          creditar(meta, config.pesos.enquete ?? 8);
          registrarSinalExplicito(meta);
        }
        break;
      }

      case 'abriu_perfil':
        break;

      default: {
        const pontos = config.pesos[evento.tipo];
        if (pontos === undefined) break;
        creditar(meta, pontos);
        if (SINAIS_EXPLICITOS.has(evento.tipo)) registrarSinalExplicito(meta);
      }
    }
  }

  return recalcularEscada(estado, config);
}
