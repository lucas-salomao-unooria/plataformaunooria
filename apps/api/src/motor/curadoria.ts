import type { Perfil } from '../comum/insta/defaults';
import { ordemDeFallback } from '../comum/insta/perfis';
import type { Intensidade, Lado } from '../comum/insta/tipos';

import { dominioDe } from './eventos';
import type { EngineConfig, EngineState, PostMeta } from './tipos';

/**
 * Curadoria por blocos (doc 04 §4). Puro e determinístico quando recebe um
 * gerador `aleatorio` — é assim que os testes do doc 04 §8 conseguem afirmar
 * "só engaja A ⇒ domínio > 0.75 até o bloco 4".
 */

export type Aleatorio = () => number;

export interface ResultadoBloco {
  ids: string[];
  /** Posts marcados como "Sugerido para você" no card (doc 03 §3.1). */
  sugeridos: Set<string>;
}

function embaralhar<T>(itens: T[], aleatorio: Aleatorio): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1));
    // `!`: i e j estão sempre dentro do array (noUncheckedIndexedAccess).
    const temporario = copia[i]!;
    copia[i] = copia[j]!;
    copia[j] = temporario;
  }
  return copia;
}

function sortearPonderado<T>(itens: T[], peso: (item: T) => number, aleatorio: Aleatorio): T | null {
  if (itens.length === 0) return null;
  const total = itens.reduce((soma, item) => soma + Math.max(0.0001, peso(item)), 0);
  let alvo = aleatorio() * total;
  for (const item of itens) {
    alvo -= Math.max(0.0001, peso(item));
    if (alvo <= 0) return item;
  }
  return itens[itens.length - 1] ?? null;
}

/** Categorias com apelo garantido para as duas iscas iniciais. */
const CATEGORIAS_ISCA = ['animais', 'memes', 'humor', 'comida'];

function pareceIsca(meta: PostMeta): boolean {
  const categoria = meta.categoria.toLowerCase();
  return CATEGORIAS_ISCA.some((chave) => categoria.includes(chave));
}

/**
 * Bloco inicial (8 posts, semi-fixo), **já inclinado para o lado semeado**
 * (doc 02 fase 2): 2 iscas neutras de alto apelo + 3 do lado semeado (int.1) +
 * 1 do lado oposto (int.1) + 2 neutros. Iscas nas posições 1 e 4.
 *
 * A inclinação é de **composição**, não de intensidade: os dois lados entram em
 * int.1. Post sensacionalista no primeiro contato quebraria o disfarce.
 *
 * Os 8 posts cobrem os **4 perfis de forma equilibrada**, sem ponderação — é a
 * leitura mais limpa da preferência de linguagem do estudante, antes de o perfil do
 * jogo pesar na escolha.
 *
 * Sem neutros no catálogo, o bloco vira 5 do lado semeado + 3 do oposto, todos
 * int.1 (o custo está registrado no doc 04 §5).
 */
export function curarBlocoInicial(
  catalogo: PostMeta[],
  aleatorio: Aleatorio = Math.random,
  ladoSemeado: Lado = 'A',
): ResultadoBloco {
  const neutros = catalogo.filter((post) => post.lado === 'neutro');
  const semeado: Lado = ladoSemeado === 'neutro' ? 'A' : ladoSemeado;
  const oposto: Lado = semeado === 'A' ? 'B' : 'A';

  const usados = new Set<string>();

  /** Pega `quantidade` itens cobrindo perfis distintos antes de repetir perfil. */
  const pegarCobrindoPerfis = (
    filtro: (post: PostMeta) => boolean,
    quantidade: number,
  ): PostMeta[] => {
    const disponiveis = embaralhar(
      catalogo.filter((post) => !usados.has(post.id) && filtro(post)),
      aleatorio,
    );
    const escolhidos: PostMeta[] = [];
    const perfisUsados = new Set<string>();

    // Primeira passada: um de cada perfil ainda não coberto.
    for (const post of disponiveis) {
      if (escolhidos.length >= quantidade) break;
      if (perfisUsados.has(post.perfil)) continue;
      perfisUsados.add(post.perfil);
      escolhidos.push(post);
      usados.add(post.id);
    }
    // Segunda passada: completa o que faltar, já sem restrição de perfil.
    for (const post of disponiveis) {
      if (escolhidos.length >= quantidade) break;
      if (usados.has(post.id)) continue;
      escolhidos.push(post);
      usados.add(post.id);
    }
    return escolhidos;
  };

  const temNeutros = neutros.length > 0;

  const iscas = temNeutros
    ? (() => {
        const candidatas = [...neutros]
          .sort((a, b) => {
            const pesoA = (pareceIsca(a) ? 1_000_000 : 0) + a.likesCount;
            const pesoB = (pareceIsca(b) ? 1_000_000 : 0) + b.likesCount;
            return pesoB - pesoA;
          })
          .slice(0, 8);
        const escolhidas = embaralhar(candidatas, aleatorio).slice(0, 2);
        escolhidas.forEach((post) => usados.add(post.id));
        return escolhidas;
      })()
    : [];

  const doSemeado = pegarCobrindoPerfis(
    (post) => post.lado === semeado && post.intensidade === 1,
    temNeutros ? 3 : 5,
  );
  const doOposto = pegarCobrindoPerfis(
    (post) => post.lado === oposto && post.intensidade === 1,
    temNeutros ? 1 : 3,
  );
  const outrosNeutros = temNeutros
    ? pegarCobrindoPerfis((post) => post.lado === 'neutro', 2)
    : [];

  // Posições 1 e 4 são das iscas; o resto embaralha entre elas.
  const meio = embaralhar([...doSemeado, ...doOposto, ...outrosNeutros], aleatorio);
  const ordem: PostMeta[] = [];
  if (iscas[0]) ordem.push(iscas[0]);
  ordem.push(...meio.slice(0, 2));
  if (iscas[1]) ordem.push(iscas[1]);
  ordem.push(...meio.slice(2));

  return { ids: ordem.map((post) => post.id), sugeridos: new Set() };
}

export function mixDoBloco(dominio: number, config: EngineConfig, temNeutros = true) {
  const tabela = temNeutros ? config.mixagem : (config.mixagemSemNeutros ?? config.mixagem);
  // `!`: a tabela de mixagem nunca é vazia (noUncheckedIndexedAccess).
  return tabela.find((faixa) => dominio < faixa.dominioMax) ?? tabela[tabela.length - 1]!;
}

/** Níveis a servir: metade no máximo destravado, metade um abaixo (doc 04 §5.4). */
function niveisParaServir(
  destravado: Intensidade,
  quantidade: number,
  config: EngineConfig,
  aleatorio: Aleatorio,
): Intensidade[] {
  if (destravado === 1) return Array.from({ length: quantidade }, () => 1 as Intensidade);

  const noMaximo = Math.round(quantidade * config.escada.proporcaoNivelMaximo);
  const abaixo = quantidade - noMaximo;
  const niveis: Intensidade[] = [
    ...Array.from({ length: noMaximo }, () => destravado),
    ...Array.from({ length: abaixo }, () => (destravado - 1) as Intensidade),
  ];
  return embaralhar(niveis, aleatorio);
}

/**
 * Escolhe um post entre candidatos, com duas ponderações.
 *
 * 1. **Autor seguido** — bônus de sinal social, como no app real.
 * 2. **Perfil de linguagem** (doc 04 §5.5): com probabilidade `pesoPerfil`, o
 *    sorteio é restrito ao perfil do estudante. Se essa célula esgotou, cai no perfil
 *    **vizinho** no círculo de Schwartz antes do oposto — descer direto para o
 *    oposto seria servir justamente a linguagem que prende menos (doc 10 §3.5).
 *
 * Ponderar, e não filtrar: com 24 células e 60 posts por sessão, filtrar pelo
 * perfil dominante secaria o banco no segundo bloco.
 */
function escolher(
  candidatos: PostMeta[],
  estado: EngineState,
  config: EngineConfig,
  aleatorio: Aleatorio,
): PostMeta | null {
  const porAutor = (post: PostMeta) =>
    estado.followedAuthors.includes(post.authorId) ? config.bonusAutorSeguido : 1;

  const perfilDoEstudante = estado.perfilDominante;
  const peso = config.pesoPerfil ?? 0;

  if (perfilDoEstudante && peso > 0 && aleatorio() < peso) {
    for (const perfil of ordemDeFallback(perfilDoEstudante as Perfil)) {
      const doPerfil = candidatos.filter((post) => post.perfil === perfil);
      if (doPerfil.length > 0) return sortearPonderado(doPerfil, porAutor, aleatorio);
    }
  }

  return sortearPonderado(candidatos, porAutor, aleatorio);
}

/**
 * Ordena o bloco sem entregar a curadoria: nunca 3 do mesmo lado seguidos
 * enquanto o domínio é baixo. O guloso ingênuo (pegar o primeiro que serve)
 * emitia trincas na cauda do bloco; escolher sempre o lado com MAIS itens
 * restantes elimina o caso, porque nenhum lado passa de metade do bloco nas
 * faixas de domínio em que a regra vale.
 */
function ordenarBloco(posts: PostMeta[], dominio: number, aleatorio: Aleatorio): PostMeta[] {
  const embaralhado = embaralhar(posts, aleatorio);
  if (dominio >= 0.75) return embaralhado;

  const porLado = new Map<Lado, PostMeta[]>();
  for (const post of embaralhado) {
    const fila = porLado.get(post.lado) ?? [];
    fila.push(post);
    porLado.set(post.lado, fila);
  }

  const resultado: PostMeta[] = [];

  while (resultado.length < embaralhado.length) {
    const doisAnteriores = resultado.slice(-2);
    // `!`: guardado pelo `length === 2` (noUncheckedIndexedAccess).
    const bloqueado =
      doisAnteriores.length === 2 && doisAnteriores[0]!.lado === doisAnteriores[1]!.lado
        ? doisAnteriores[0]!.lado
        : null;

    const candidatos = [...porLado.entries()]
      .filter(([lado, fila]) => fila.length > 0 && lado !== bloqueado)
      .sort((a, b) => b[1].length - a[1].length);

    // Se só resta o lado bloqueado, troca com um item anterior de outro lado
    // para não emitir a trinca.
    if (candidatos.length === 0) {
      const restante = [...porLado.entries()].find(([, fila]) => fila.length > 0);
      if (!restante) break;

      const post = restante[1].shift()!;
      const alvo = resultado.findIndex(
        (item, indice) =>
          item.lado !== post.lado &&
          resultado[indice - 1]?.lado !== post.lado &&
          resultado[indice + 1]?.lado !== post.lado,
      );

      if (alvo >= 0) {
        // `!`: alvo veio de um findIndex bem-sucedido (noUncheckedIndexedAccess).
        const deslocado = resultado[alvo]!;
        resultado[alvo] = post;
        resultado.push(deslocado);
      } else {
        resultado.push(post);
      }
      continue;
    }

    // `!`: candidatos.length > 0 foi verificado acima (noUncheckedIndexedAccess).
    resultado.push(candidatos[0]![1].shift()!);
  }

  return resultado;
}

/** Blocos seguintes (6 posts): mixagem por domínio + escada de intensidade. */
export function curarBloco(
  estado: EngineState,
  catalogo: PostMeta[],
  config: EngineConfig,
  aleatorio: Aleatorio = Math.random,
): ResultadoBloco {
  const servidos = new Set(estado.servedPostIds);
  const disponiveis = catalogo.filter((post) => !servidos.has(post.id));

  const { dominio, ladoDominante } = dominioDe(estado, config);
  const temNeutros = catalogo.some((post) => post.lado === 'neutro');
  const mix = mixDoBloco(dominio, config, temNeutros);

  /**
   * Enquanto o domínio é 0.5 (soma de scores abaixo do mínimo), `ladoDominante`
   * vem 'neutro'. Nesse caso o dominante do bloco é o **lado semeado** — é ele
   * que o perfil indicou, e é ele que o bloco deve inclinar. Sortear aqui, como
   * antes, jogaria fora a semente nos primeiros blocos.
   */
  const dominante: Lado =
    ladoDominante === 'neutro'
      ? (estado.ladoInicial ?? (aleatorio() < 0.5 ? 'A' : 'B'))
      : ladoDominante;
  const oposto: Lado = dominante === 'A' ? 'B' : 'A';

  const escolhidos: PostMeta[] = [];
  const jaEscolhidos = new Set<string>();

  const sugeridos = new Set<string>();

  /**
   * Serve um post do lado pedido. O teto da escada é INVIOLÁVEL: se o nível
   * esgotou, desce (doc 04 §5.5) — nunca sobe. É o que garante "nunca servir
   * int.3 no primeiro contato" mesmo com catálogo pequeno.
   */
  const consumir = (lado: Lado, intensidade: Intensidade, sugerido: boolean): PostMeta | null => {
    const teto = Math.min(intensidade, estado.intensityUnlocked[lado === 'A' ? 'A' : 'B']);

    for (let nivel = teto; nivel >= 1; nivel -= 1) {
      const candidatos = disponiveis.filter(
        (post) => !jaEscolhidos.has(post.id) && post.lado === lado && post.intensidade === nivel,
      );
      const escolhido = escolher(candidatos, estado, config, aleatorio);
      if (!escolhido) continue;

      jaEscolhidos.add(escolhido.id);
      escolhidos.push(escolhido);
      if (sugerido) sugeridos.add(escolhido.id);
      return escolhido;
    }
    return null;
  };

  const consumirNeutro = (): PostMeta | null => {
    const candidatos = disponiveis.filter((post) => post.lado === 'neutro' && !jaEscolhidos.has(post.id));
    const escolhido = sortearPonderado(
      candidatos,
      (post) => 1 + Math.max(0, estado.neutroScores[post.categoria] ?? 0),
      aleatorio,
    );
    if (!escolhido) return null;
    jaEscolhidos.add(escolhido.id);
    escolhidos.push(escolhido);
    return escolhido;
  };

  // Lado dominante: escada de intensidade. O rótulo "Sugerido para você" entra
  // em só parte dos posts — marcar 100% do lado dominante daria ao estudante um
  // marcador visual da curadoria antes da revelação (e destoa do padrão do IG).
  const niveisDominante = niveisParaServir(estado.intensityUnlocked[dominante], mix.dominante, config, aleatorio);
  const fracaoSugeridos = config.proporcaoSugeridos ?? 0.34;
  for (const nivel of niveisDominante) {
    const sugerido = dominio >= config.sugestoes.dominioMinimo && aleatorio() < fracaoSugeridos;
    consumir(dominante, nivel, sugerido);
  }

  // Lado oposto: sempre no nível mais suave (não é o que a bolha reforça).
  for (let i = 0; i < mix.oposto; i += 1) consumir(oposto, 1, false);

  // Neutros: sorteio ponderado pelos baldes de categoria (bolha nos neutros).
  for (let i = 0; i < mix.neutro; i += 1) {
    if (!consumirNeutro()) break;
  }

  // Se algum lado esgotou dentro do teto da escada, o bloco se completa com
  // neutros (e, em último caso, com o próprio lado dominante) — jamais
  // furando a escada de intensidade.
  const alvo = mix.dominante + mix.oposto + mix.neutro;
  while (escolhidos.length < alvo) {
    if (consumirNeutro()) continue;
    if (consumir(dominante, estado.intensityUnlocked[dominante], false)) continue;
    if (consumir(oposto, 1, false)) continue;
    break;
  }

  const ordenados = ordenarBloco(escolhidos, dominio, aleatorio);
  return { ids: ordenados.map((post) => post.id), sugeridos };
}

/**
 * Gatilho de encerramento (doc 04 §6), com duas correções de realidade:
 * o relógio conta do início do FEED (o onboarding não consome a cota de 12 min)
 * e há um piso de tempo — rolar muito rápido não encerra a sessão em 2 min,
 * fora da janela de 8–12 min do doc 02.
 */
export function deveEncerrar(
  estado: EngineState,
  config: EngineConfig,
  iniciadoEm: Date,
  agora: Date = new Date(),
): boolean {
  const inicioDoFeed = estado.feedIniciadoEm ? new Date(estado.feedIniciadoEm) : iniciadoEm;
  const minutos = (agora.getTime() - inicioDoFeed.getTime()) / 60_000;

  if (minutos >= config.encerramento.maxMinutos) return true;

  const pisoOk = minutos >= (config.encerramento.minMinutos ?? 0);
  return pisoOk && estado.postsConsumidos.length >= config.encerramento.maxPosts;
}

/** Módulo "Sugestões para você": 1× a cada 2–3 blocos com domínio ≥ 0.6. */
export function deveMostrarSugestoes(estado: EngineState, config: EngineConfig, dominio: number): boolean {
  if (dominio < config.sugestoes.dominioMinimo) return false;
  return estado.blocksServed - estado.ultimoBlocoSugestoes >= config.sugestoes.cadaNBlocos;
}

/** Notificação "começou a seguir você": uma vez, ao cruzar o gatilho. */
export function deveNotificarSeguidor(estado: EngineState, config: EngineConfig, dominio: number): boolean {
  return !estado.notificouSeguidor && dominio >= config.notificacaoSeguidor.dominioGatilho;
}
