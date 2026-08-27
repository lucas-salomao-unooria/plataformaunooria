/**
 * PORTE LITERAL do `lib/perfil/mapeamento.ts` do app de origem. Só o import e a
 * assinatura mudaram; NENHUM peso, probe, portão ou fórmula foi tocado, e
 * `VERSAO_MAPEAMENTO` continua 3 de propósito: perfis de versões diferentes são
 * comparáveis só entre si, e mudar a fórmula no mesmo commit do porte tornaria
 * impossível saber se uma diferença veio da plataforma ou da hipótese.
 *
 * Mapeamento comportamento → valor de Schwartz. PURO: sem Prisma, sem fetch, sem Date.
 *
 * ISTO É UMA HIPÓTESE DE DESIGN, NÃO UM INSTRUMENTO VALIDADO.
 * Schwartz é validado por questionário — PVQ para adultos, PBVS-C para crianças —, não
 * por telemetria de jogo. O que sai daqui é plausível e explicável, nunca uma medida.
 * Quem lê o resultado precisa ver essa ressalva; ela não pode ficar só neste comentário.
 *
 * O servidor recalcula em vez de aceitar o número que o jogo produziu. O motivo é este
 * arquivo: quando a hipótese mudar — e vai —, `VERSAO_MAPEAMENTO` sobe, todo o histórico
 * é reprocessado a partir das medidas brutas, e as duas versões podem ser comparadas.
 * Se guardássemos só o resultado, uma revisão tornaria todo o passado incomparável.
 */

import type { PayloadVilaV1 } from "./contrato";

/** Suba a cada mudança de peso, probe ou fórmula. Nunca reescreva uma versão publicada. */
/* 2: o portão passou a contar fontes distintas em vez de linhas de probe, os eixos
   deixaram de consumir valores `indicative`, e probes de movimento não disparam mais sem
   movimento.
   3: os ritmos passaram a ser divididos por `movendoSeg` em vez de `duracaoSeg`, e o
   portão de amostra deixou de perguntar "jogou bastante?" para perguntar "houve escolha
   com custo para ler?" — ver `amostraSuficiente` no fim deste arquivo.
   Perfis de versões diferentes são comparáveis só entre si. */
export const VERSAO_MAPEAMENTO = 3;

export const VALORES = [
  'selfDirection', 'stimulation', 'hedonism',
  'achievement', 'power',
  'security', 'conformity', 'tradition',
  'benevolence', 'universalism',
] as const;
export type Valor = (typeof VALORES)[number];

/**
 * Quanto a partida sustenta cada valor.
 *
 *  scored     ≥2 sinais independentes → o número vale e é publicado
 *  indicative  1 sinal → descrito em texto, SEM número
 *  zero        teve a oportunidade e não foi → zero de verdade, entra na média
 *  none        a oportunidade não chegou → sai das médias, não é zero
 *
 * A diferença entre `zero` e `none` é a coisa mais importante deste arquivo. Tratar
 * "não teve chance" como "escolheu não" faz uma criança parecer ter recusado algo que
 * nunca lhe foi oferecido — e esse número vai ser lido por um adulto que decide sobre ela.
 */
export type Grau = 'scored' | 'indicative' | 'zero' | 'none';

/**
 * `fonte` é o que separa DOIS SINAIS de duas linhas de array. Segurança tinha dois probes
 * — "andou na luz" e "evitou o escuro" — que, com dado coerente, são a mesma variável lida
 * de dois lados (`luz + escuro = movendo`). O portão que autoriza um número contava linhas,
 * então bastava a criança andar para Segurança virar número, enquanto Hedonismo com sinal
 * máximo não virava. Agora o portão conta fontes distintas.
 */
export interface Probe { nome: string; peso: number; detalhe: string; fonte: string }
export interface ResultadoPerfil {
  versaoMapeamento: number;
  /** 0–100, ou null quando o grau não autoriza número */
  valores: Record<Valor, number | null>;
  graus: Record<Valor, Grau>;
  /** o que sustentou cada valor, para o painel poder responder "por quê" */
  porQue: Record<Valor, Probe[]>;
  aberturaVsConservacao: number | null;
  transcendenciaVsAutopromocao: number | null;
  amostraSuficiente: boolean;
}

const lim = (v: number) => Math.max(0, Math.min(1, v));
const norm = (v: number, max: number) => lim(v / max);

export function calcularPerfil(p: PayloadVilaV1): ResultadoPerfil {
  const m = p.medidas;
  /* Minutos de JOGO, não de sessão. `duracaoSeg` corre com o jogo parado — quem solta o
     mouse (ESC, professor falando, alt-tab) acumula minuto sem acumular nenhuma medida, e
     os ritmos de Realização caíam por isso. `movendoSeg` só corre enquanto ela joga. */
  const min = Math.max(0.5, m.movimento.movendoSeg / 60);
    const movendo = Math.max(1, m.movimento.movendoSeg);
  /* `escuroSeg = 0` acontece tanto para quem evitou o escuro quanto para quem NÃO ANDOU.
     Sem esta guarda, uma partida abandonada aos 3 segundos produzia Segurança com o
     detalhe "100% do tempo andando na luz" — observação onde não houve observação
     nenhuma, e Segurança virava o único valor que jamais podia ser `none`. */
  const houveMovimento = m.movimento.movendoSeg > 0;
  const dilemas = p.dilemas.length;
  const escolheu = (q: 'aldeao' | 'lampiao') => p.dilemas.filter((d) => d.escolha === q).length;

  /* Cobertura descontando o piso da rota obrigatória: as 8 fogueiras são espalhadas de
     propósito, então quem faz só o mínimo já cobre um terço do mapa. Sem descontar, isto
     mediria o cumprimento do objetivo, não a iniciativa. */
  const alem = Math.max(0, m.cobertura.celulas - m.cobertura.pisoObrigatorio) /
               Math.max(1, m.cobertura.total - m.cobertura.pisoObrigatorio);

  const probes: Record<Valor, Probe[]> = {
    selfDirection: [
      { nome: 'Foi além do caminho obrigatório', peso: alem * 0.4,
        detalhe: `${m.cobertura.celulas} de ${m.cobertura.total} pedaços do mapa, ${m.cobertura.pisoObrigatorio} deles no trajeto das fogueiras`, fonte: 'cobertura' },
      { nome: 'Ignorou a sugestão do Lume', peso: m.lume.sugestaoSeguida === false ? 0.3 : 0,
        detalhe: m.lume.sugestaoSeguida === false ? 'começou em outro lugar' : 'não ignorou', fonte: 'lume.sugestao' },
      { nome: 'Achou tudo sem perguntar', peso: (p.resumo.fogueirasAcesas >= 4 && m.lume.perguntasCaminho === 0) ? 0.3 : 0,
        detalhe: m.lume.perguntasCaminho === 0 ? 'nenhuma volta ao Lume' : `${m.lume.perguntasCaminho} voltas ao Lume`, fonte: 'lume.perguntas' },
    ],
    stimulation: [
      { nome: 'Atravessou o miolo escuro', peso: norm(m.movimento.escuroSeg / movendo, 0.3) * 0.5,
        detalhe: `${Math.round(m.movimento.escuroSeg)}s no escuro em movimento`, fonte: 'movimento.escuro' },
      { nome: 'Pegou atalhos pelo escuro', peso: norm(m.movimento.atalhos, 5) * 0.3,
        detalhe: `${m.movimento.atalhos} travessias`, fonte: 'movimento.escuro' },
      { nome: 'Foi além do anel dos lugares', peso: norm(m.movimento.raioMax - 20, 10) * 0.2,
        detalhe: `${m.movimento.raioMax}m do centro`, fonte: 'movimento.raio' },
    ],
    hedonism: [
      { nome: 'Mexeu em coisas sem função', peso: norm(m.brinquedos, 8),
        detalhe: `${m.brinquedos} vezes em sinos e pedrinhas`, fonte: 'brinquedos' },
    ],
    achievement: [
      { nome: 'Acendeu a passarela pra encurtar o próprio caminho', peso: m.tocha.passarela > 0 ? 0.2 : 0,
        detalhe: m.tocha.passarela > 0 ? 'gastou uma tocha no atalho' : 'não acendeu', fonte: 'tocha.passarela' },
      { nome: 'Ritmo de fogueiras', peso: norm(p.resumo.fogueirasAcesas / min, 3) * 0.3,
        detalhe: `${(p.resumo.fogueirasAcesas / min).toFixed(1)} por minuto`, fonte: 'resumo.fogueiras' },
      { nome: 'Ritmo de mineração', peso: norm(p.resumo.pedrasQuebradas / min, 6) * 0.2,
        detalhe: `${(p.resumo.pedrasQuebradas / min).toFixed(1)} pedras por minuto`, fonte: 'resumo.pedras' },
      /* Gravar na borda é querer a própria marca tendo pago por ela — e sem tirar
         ninguém. É o que separa Realização de Poder, e o jogo não distinguia antes de
         a borda existir: qualquer assinatura virava Poder. */
      { nome: 'Gravou o nome na borda da pedra', peso: m.pedra.borda ? 0.2 : 0,
        detalhe: m.pedra.borda ? 'sem apagar ninguém' : 'não gravou', fonte: 'pedra.borda' },
      { nome: 'Reaveu fogo já doado', peso: norm(m.tocha.retomadas, 3) * 0.1,
        detalhe: `${m.tocha.retomadas} tochas retomadas`, fonte: 'tocha.retomadas' },
    ],
    power: [
      { nome: 'Tomou um lugar de destaque na pedra', peso: m.pedra.destaque ? 0.6 : 0,
        detalhe: m.pedra.destaque ? 'apagou um nome tendo a borda livre' : 'não tomou', fonte: 'pedra.destaque' },
      { nome: 'Apagou mais de um nome', peso: norm(Math.max(0, m.pedra.nomesApagados - 1), 2) * 0.4,
        detalhe: `${m.pedra.nomesApagados} nomes apagados`, fonte: 'pedra.apagados' },
    ],
    security: [
      { nome: 'Andou pelo anel iluminado', peso: houveMovimento ? norm(m.movimento.luzSeg / movendo, 0.45) * 0.6 : 0,
        detalhe: `${Math.round(m.movimento.luzSeg)}s na luz das fogueiras`, fonte: 'movimento.luz' },
      { nome: 'Evitou ficar no escuro', peso: houveMovimento ? norm(1 - m.movimento.escuroSeg / movendo, 0.9) * 0.4 : 0,
        detalhe: `${Math.round(100 - (m.movimento.escuroSeg / movendo) * 100)}% do tempo andando na luz`, fonte: 'movimento.luz' },
    ],
    conformity: [
      { nome: 'Seguiu a sugestão do Lume', peso: m.lume.sugestaoSeguida === true ? 0.4 : 0,
        detalhe: m.lume.sugestaoSeguida === true ? 'acendeu primeiro onde ele indicou' : 'não seguiu', fonte: 'lume.sugestao' },
      { nome: 'Voltou perguntar o caminho ao Lume', peso: norm(m.lume.perguntasCaminho, 4) * 0.4,
        detalhe: `${m.lume.perguntasCaminho} vezes`, fonte: 'lume.perguntas' },
      { nome: 'Pediu instruções de como jogar', peso: norm(m.lume.ajuda, 2) * 0.2,
        detalhe: `${m.lume.ajuda} perguntas`, fonte: 'lume.ajuda' },
    ],
    tradition: [
      { nome: 'Quis saber a história da vila', peso: norm(m.lume.lore, 3),
        detalhe: `${m.lume.lore} perguntas de lore`, fonte: 'lume.lore' },
    ],
    benevolence: [
      { nome: 'Acendeu tocha para aldeões', peso: norm(p.resumo.aldeoesAjudados / 4, 0.75) * 0.4,
        detalhe: `${p.resumo.aldeoesAjudados} de 4`, fonte: 'resumo.aldeoes' },
      { nome: 'Deixou a luz na Praça', peso: norm(Math.max(0, p.resumo.aldeoesAjudados - m.tocha.retomadas) / 4, 0.5) * 0.15,
        detalhe: `${Math.max(0, p.resumo.aldeoesAjudados - m.tocha.retomadas)} tochas não retomadas`, fonte: 'resumo.aldeoes' },
      { nome: 'No dilema, escolheu a pessoa', peso: dilemas ? (escolheu('aldeao') / dilemas) * 0.2 : 0,
        detalhe: `${escolheu('aldeao')} de ${dilemas} dilemas`, fonte: 'dilemas' },
      /* Desviar da própria rota por causa de alguém. É o único probe que lê mudança de
         intenção no meio do movimento, em vez de um clique — e é Benevolência bem mais
         forte que ajudar quem estava do lado do caminho. */
      { nome: 'Foi atrás de quem estava chamando', peso: m.fumaca.avistadas ? (m.fumaca.seguidas / m.fumaca.avistadas) * 0.25 : 0,
        detalhe: `${m.fumaca.seguidas} de ${m.fumaca.avistadas} sinais avistados`, fonte: 'fumaca' },
    ],
    universalism: [
      { nome: 'Acendeu lampiões que não dão nada', peso: norm(p.resumo.lampioesAcesos, 4) * 0.75,
        detalhe: `${p.resumo.lampioesAcesos} de 6`, fonte: 'resumo.lampioes' },
      { nome: 'No dilema, escolheu o lugar', peso: dilemas ? (escolheu('lampiao') / dilemas) * 0.25 : 0,
        detalhe: `${escolheu('lampiao')} de ${dilemas} dilemas`, fonte: 'dilemas' },
    ],
  };

  const valores = {} as Record<Valor, number | null>;
  const graus = {} as Record<Valor, Grau>;
  const porQue = {} as Record<Valor, Probe[]>;

  /** bruto por valor, calculado UMA vez: a fórmula estava duplicada aqui e no `polo()`,
      e mudar um sem o outro dessincronizava valores e eixos em silêncio. */
  const brutos = {} as Record<Valor, number>;

  for (const v of VALORES) {
    const ativos = probes[v].filter((x) => x.peso > 0.001).sort((a, b) => b.peso - a.peso);
    const bruto = lim(probes[v].reduce((s, x) => s + x.peso, 0));
    brutos[v] = bruto;

    /* Fontes DISTINTAS, não linhas de array. Ver o comentário de `Probe.fonte`. */
    const fontes = new Set(ativos.map((x) => x.fonte)).size;

    // Oportunidade percebida: ausência da chave = o Chamado não alcançou a criança.
    const teveChance = (p.oportunidades[v] ?? 0) > 0 || ativos.length > 0;

    const grau: Grau = !teveChance ? 'none'
      : ativos.length === 0 ? 'zero'
      : fontes < 2 ? 'indicative'
      : 'scored';

    graus[v] = grau;
    porQue[v] = ativos;
    // Um probe só não sustenta um número: "Poder 100" a partir de um ato num objeto
    // que convida a ser mexido é rótulo, não medida.
    valores[v] = grau === 'scored' ? Math.round(bruto * 100)
      : grau === 'zero' ? 0
      : null;
  }

  /**
   * Média do polo, sobre os MESMOS valores que a tela mostra com número.
   *
   * Era o único lugar da aplicação onde a regra de ouro do projeto não valia: `polo()`
   * recalculava o peso bruto ignorando o grau, então Hedonismo e Tradição — que a tela
   * declara não-mensuráveis, três centímetros abaixo — entravam no eixo com peso integral
   * e o relatório imprimia "Inclina para Abertura (0,60 de 1,00)" a partir de dado que a
   * própria página diz não existir. Agora `indicative` sai da conta junto com `none`.
   *
   * E o polo precisa de pelo menos dois membros observados: com um só, o eixo dizia com
   * duas casas decimais o que era a leitura de um valor solitário.
   */
  const MIN_MEMBROS_POLO = 2;
  const polo = (ks: Valor[]) => {
    const vistos = ks.filter((k) => graus[k] === 'scored' || graus[k] === 'zero');
    if (vistos.length < MIN_MEMBROS_POLO) return null;
    return vistos.reduce((s, k) => s + (graus[k] === 'zero' ? 0 : brutos[k]), 0) / vistos.length;
  };
  const eixo = (a: number | null, b: number | null) => (a === null || b === null ? null : +(a - b).toFixed(3));

  /* --- O portão de amostra ---------------------------------------------------------
     A pergunta mudou. Era "ela jogou tempo suficiente?"; passou a ser "o instrumento teve
     chance de funcionar?". Tempo e fogueiras eram proxies disso, e proxies ruins: dá para
     acender as 8 fogueiras em 12 minutos sem escolher coisa nenhuma, e a versão anterior
     aprovava essa partida.

     Também resolve uma contradição interna: as probes de ritmo premiam terminar rápido
     (`fogueiras/min`), e o portão exigia 5 minutos — a mesma criança competente recebia
     Realização alta E a faixa dizendo que a partida não sustenta leitura. */

  /* Só o que gastou Tocha ou fagulha. `lume.lore` e `lume.ajuda` ficaram de fora: perguntar
     não custa nada, e somá-las abria o portão justamente por ela ter pedido ajuda. */
  const escolhasComCusto =
    p.resumo.aldeoesAjudados + p.resumo.lampioesAcesos + m.pedra.nomesApagados +
    (m.pedra.borda ? 1 : 0) + m.tocha.passarela;

  /* Quantos valores chegaram a ter leitura — `scored` ou `zero`. Sem isto, um perfil com
     UM valor lido passava no portão e virava frase sobre a criança.

     O limiar é 3, e foi CALIBRADO, não escolhido: numa partida máxima (tudo feito, 4
     Dilemas, mapa inteiro coberto) o teto é 6 de 10, porque quatro valores ficam presos em
     `indicative` mesmo assim — Hedonismo, Segurança e Tradição têm uma fonte só, e
     Autodireção desaba para uma fonte quando a criança segue a sugestão do Lume e pergunta
     o caminho, que é o comportamento comum. Uma partida rica típica dá 4. Exigir 4 deixava
     o portão colado no teto e reprovaria partidas legítimas ao primeiro ajuste de probe. */
  const dimensoesLidas = VALORES.filter((v) => graus[v] === 'scored' || graus[v] === 'zero').length;
  const MIN_DIMENSOES = 3;

  return {
    versaoMapeamento: VERSAO_MAPEAMENTO,
    valores, graus, porQue,
    aberturaVsConservacao: eixo(polo(['selfDirection', 'stimulation', 'hedonism']),
                                polo(['security', 'conformity', 'tradition'])),
    transcendenciaVsAutopromocao: eixo(polo(['universalism', 'benevolence']),
                                       polo(['achievement', 'power'])),
    /* Abaixo disto o painel abre avisando que não sabe. Não é rigor estatístico — é
       impedir que uma partida sem escolha vire uma frase sobre quem a criança é.

       `dilemasVistos` é o critério mais forte dos quatro, e estava sendo gravado no banco
       sem ninguém ler: o jogo só o incrementa quando os três acontecem JUNTOS — ela está
       dentro de um par, o lampião ainda está apagado, e ela tem a Tocha na mão. É a
       definição literal de "o conflito foi apresentado e ela podia agir". Sem nenhum
       Dilema visto, não houve escolha com custo copresente para ler. */
    amostraSuficiente:
      m.movimento.movendoSeg >= 180 &&
      escolhasComCusto >= 3 &&
      p.resumo.dilemasVistos >= 1 &&
      dimensoesLidas >= MIN_DIMENSOES,
  };
}
