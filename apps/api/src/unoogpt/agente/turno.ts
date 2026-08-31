import { MISSAO_TEMPESTADE } from '../cenario';

/**
 * Que tipo de turno o estudante acabou de abrir. PURO — sem provedor, sem Prisma.
 *
 * Por que isto existe no CÓDIGO e não só no prompt: no playtest o estudante pediu
 * duas vezes que a IA decidisse por ele ("faiz o melior", "manda la"). O
 * Cientista, corretamente, não decide — mas respondeu as duas vezes com outra
 * parede de números e outra pergunta. O estudante respondeu "no melio", o relógio
 * zerou e a Missão terminou sem nenhuma equipe alocada.
 *
 * Confiar só na instrução para reconhecer esses momentos é confiar no modelo
 * justamente onde ele já falhou. Aqui o servidor reconhece o momento e injeta
 * um PROTOCOLO autorado para aquele turno — texto fixo, conferido por teste
 * (regra de ouro 2). O Cientista continua sem decidir nada: o protocolo manda
 * ele ENCURTAR e devolver a escolha, não escolher.
 *
 * A ortografia do estudante de 16 anos sob cronômetro é a do playtest, e é ela que
 * os padrões precisam pegar: "num intindi", "ondi chovi mais", "faiz o melior",
 * "qual melior desisto?", "manda la", "no melio".
 */
export type TipoDeTurno =
  | 'abertura'
  | 'delegacao'
  | 'nao-entendi'
  | 'curto'
  | 'escolha-numerada'
  | 'nomeia-bairro'
  | 'confirmacao'
  | 'pergunta';

export interface ContextoDoTurno {
  /** Alguma equipe já tem destino registrado. Muda "manda ver" de sentido. */
  temDestino: boolean;
  /** Primeira fala da conversa: a abertura tem roteiro próprio. */
  primeiraFala: boolean;
  /** A última fala do Cientista. É nela que "1 ou 2" ganha sentido. */
  ultimaFalaDoAgente: string | null;
}

/** Minúsculas, sem acento, espaço colapsado: a chave de toda comparação. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** O bairro que o estudante nomeou, se nomeou. "vale verde" e "valeverde" valem. */
export function bairroCitado(texto: string): string | null {
  const n = normalizar(texto);
  const semEspaco = n.replace(/ /g, '');
  for (const b of MISSAO_TEMPESTADE.bairros) {
    if (semEspaco.includes(b.slug) || n.includes(normalizar(b.nome))) return b.slug;
  }
  return null;
}

/**
 * Pedir que a IA decida. Não é preguiça: é o estudante dizendo que não sabe como
 * escolher — e é o momento mais importante da Missão para responder CURTO.
 */
const DELEGACAO = [
  /\b(fa[sz]|faiz|faca|faz)\s+(o|u)\s+(melhor|melior|milhor|mior)\b/,
  /\btanto\s+fa[sz]\b/,
  /\b(escolhe|escolha|decide|decida)\s+(voce|vc|tu|ai|por\s+mim)\b/,
  /\bvoce\s+(decide|escolhe|que\s+sabe)\b/,
  /\bqual\s+(o\s+|e\s+|eh\s+)?(melhor|melior|milhor|mior)\b/,
  /\bo\s+que\s+(voce|vc)\s+(faria|acha)\b/,
  /\bnao\s+sei\s+(qual|o\s+que|escolher)\b/,
];

/** Confirmar o envio. Só vale como confirmação se já existe o que confirmar. */
const CONFIRMACAO =
  /\b(confirmo|confirma|pode\s+(mandar|ir|enviar)|manda\s+ver|isso\s+mesmo|vamos\s+nessa|pode\s+enfrentar)\b/;

/** "num intindi", "nao entendi", "n entendi", "como assim". */
const NAO_ENTENDI = /\b(nao|nem|num|nam|n)\s*[ie]nt[ei]nd|\bcomo\s+assim\b|\bhein\b/;

/** "manda la", "manda ai" — só é delegação quando não há bairro na frase. */
const MANDA_SOLTO = /\bmanda\s+(la|ai|logo|pra\s+onde)\b/;

/**
 * Mandar a equipe. É o verbo que transforma o nome de um bairro em ORDEM.
 *
 * Sem isto, citar um bairro bastava — e "quantas pessoas moram na Ribeirinha?"
 * era lida como ordem de alocação. O estudante perguntava e a equipe saía.
 *
 * Fora da lista de propósito: "leva", "vai", "põe" — aparecem em pergunta
 * ("quanto tempo a equipe LEVA pro Industrial?") tanto quanto em ordem.
 */
const ORDEM_DE_ALOCACAO =
  /\b(manda|mande|mandar|envia|envie|enviar|aloca|aloque|alocar|coloca|coloque|destina|destine)\b/;

/**
 * Sinais de que a fala PERGUNTA em vez de mandar. Interrogativo, ponto de
 * interrogação, ou pedido de informação ("me fala do Vale Verde").
 */
const PERGUNTA_SOBRE =
  /\?|\b(qual|quais|quanto|quantos|quantas|onde|ondi|quem|como|quando|porque|pq|cade|cadê|fala|fale|conta|conte|mostra|mostre|diz|diga|explica|explique|compara|compare|tem|ha|há)\b|\bo que\b|\bpor que\b/;

/** "1", "2", "opcao 2", "a primeira". */
const ESCOLHA = /^(opcao\s*)?([12])$|\ba\s+(primeira|segunda)\b/;

/** O Cientista pôs opções numeradas na mesa na fala anterior? */
function ofereceuOpcoes(fala: string | null): boolean {
  if (!fala) return false;
  const n = normalizar(fala);
  return /\bopcao\s*1\b/.test(n) || (/\b1\s*[-—:]/.test(n) && /\b2\s*[-—:]/.test(n));
}

export function classificarTurno(texto: string, ctx: ContextoDoTurno): TipoDeTurno {
  const n = normalizar(texto);
  const palavras = n.split(' ').filter(Boolean);

  // A primeira fala só é ABERTURA quando não traz conteúdo — "oi", "vamos".
  // Antes ela era abertura sempre, e quem abria a conversa perguntando algo de
  // verdade ganhava a resposta de graça: o orçamento virava quatro perguntas,
  // não três. Quem abre perguntando recebe o roteiro de boas-vindas pelo prompt
  // (montarSystemPrompt) e a resposta pelo protocolo do turno — as duas coisas.
  if (ctx.primeiraFala && !PERGUNTA_SOBRE.test(n) && !bairroCitado(texto)) return 'abertura';

  // ORDEM IMPORTA. "manda la pra ribeirinha" nomeia um bairro e não é
  // delegação; "manda la", sozinho, é. Nomear vem primeiro por isso.
  //
  // Mas nomear um bairro NÃO é, por si, uma ordem: "quantas pessoas moram na
  // Ribeirinha?" é pergunta. Tratar as duas do mesmo jeito mandava a equipe
  // para o bairro sobre o qual o estudante só queria saber — e ainda deixava a
  // pergunta de graça, porque ordem não debita orçamento.
  if (bairroCitado(texto)) {
    if (ORDEM_DE_ALOCACAO.test(n)) return 'nomeia-bairro';
    // Bairro solto ("ribeirinha") é escolha: é assim que se responde a "qual
    // você quer?". Bairro dentro de uma pergunta é pergunta.
    if (!PERGUNTA_SOBRE.test(n)) return 'nomeia-bairro';
  }
  if (ESCOLHA.test(n) && ofereceuOpcoes(ctx.ultimaFalaDoAgente)) return 'escolha-numerada';
  if (ctx.temDestino && CONFIRMACAO.test(n)) return 'confirmacao';
  if (DELEGACAO.some((r) => r.test(n))) return 'delegacao';
  if (!ctx.temDestino && MANDA_SOLTO.test(n)) return 'delegacao';
  if (NAO_ENTENDI.test(n)) return 'nao-entendi';
  // Duas palavras e nenhuma pergunta: "no melio", "sei la", "ta". Responder
  // isso com tabela é o que fez o estudante parar de ler.
  if (palavras.length <= 2 && !n.includes('?')) return 'curto';
  return 'pergunta';
}

/**
 * O que o Cientista faz NESTE turno. Texto autorado, injetado no fim do prompt
 * de sistema — onde a atenção do modelo é maior — e conferido por teste.
 *
 * Nenhum protocolo escolhe bairro. Todos encurtam.
 */
export function protocoloDoTurno(tipo: TipoDeTurno, ctx: { temDados: boolean }): string {
  const cabeca = 'INSTRUÇÃO DESTE TURNO — ela vale mais que qualquer regra acima.';

  if (tipo === 'delegacao') {
    return ctx.temDados
      ? [
          cabeca,
          'Ele pediu que VOCÊ decida. Você não decide — e também NÃO repete os números: o quadro',
          'ao lado da sua fala já mostra a tabela inteira.',
          'Responda em três linhas, nada além disso:',
          'Opção 1: Alfa para <bairro>, Bravo para <bairro> — <o que isso ganha, até seis palavras>',
          'Opção 2: Alfa para <bairro>, Bravo para <bairro> — <o que isso ganha, até seis palavras>',
          'Qual você quer, 1 ou 2? Se preferir, toque no bairro no mapa e mande a equipe por lá.',
        ].join('\n')
      : [
          cabeca,
          'Ele pediu que VOCÊ decida, e você ainda não olhou nada da cidade.',
          'Uma frase dizendo isso, e duas saídas concretas, uma por linha:',
          '1 — vejo onde mora mais gente',
          '2 — vejo onde a chuva bate mais forte',
          'Termine perguntando qual dos dois ele quer. Sem número nenhum nesta resposta.',
        ].join('\n');
  }

  if (tipo === 'nao-entendi' || tipo === 'curto') {
    return [
      cabeca,
      'Ele não entendeu, ou escreveu pouco demais para você saber o que ele quer.',
      'UMA frase curta, com palavras do dia a dia, dizendo de novo o que você acabou de dizer.',
      'Depois UMA pergunta com duas saídas ligadas por "ou" — por exemplo: "Quer que eu veja onde',
      'mora mais gente, ou por onde a equipe chega mais rápido?".',
      'Sem número nenhum. Sem lista de bairro. Duas frases no total.',
    ].join('\n');
  }

  if (tipo === 'escolha-numerada') {
    return [
      cabeca,
      'Ele escolheu uma das opções que VOCÊ pôs na mesa na sua última fala.',
      'Chame alocar_equipe com os dois bairros daquela opção e confirme em UMA frase.',
      'Não reapresente números e não ofereça uma terceira opção.',
    ].join('\n');
  }

  if (tipo === 'nomeia-bairro') {
    return [
      cabeca,
      'Ele nomeou bairro: isso é uma ordem, não uma pergunta. Chame alocar_equipe.',
      'Se ele não disse qual equipe, pergunte só isso, em uma frase.',
      'Confirme o que ficou registrado em uma frase e pare. Sem tabela, sem alternativa nova.',
    ].join('\n');
  }

  if (tipo === 'confirmacao') {
    return [
      cabeca,
      'Ele está confirmando o envio. Se as duas equipes já têm destino, chame confirmar_alocacao',
      'nesta mesma resposta. Se falta destino para alguma, diga em uma frase qual falta e pergunte.',
      'Não repita aviso que você já deu: repetir prende o estudante na tela.',
    ].join('\n');
  }

  if (tipo === 'pergunta') {
    return [
      cabeca,
      'Responda a pergunta dele. Se você NÃO conseguir responder, não peça para ele reformular no',
      'vazio: diga em uma frase qual dos três é o problema — a pergunta é sobre outra coisa, está',
      'vaga demais, ou não existe informação sobre isso na cidade — e ofereça uma saída concreta.',
      'Nomear o problema é o que ensina a fazer a pergunta seguinte melhor.',
      'Se você cruzou os dados nesta resposta, cite no máximo DOIS bairros e mande ele olhar o',
      'quadro: a tabela inteira já está lá.',
    ].join('\n');
  }

  return '';
}
