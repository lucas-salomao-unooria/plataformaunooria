/* Porte do gpturia (tests/agente/turno.test.ts). O `expect(valor, rotulo)` do
 * Vitest nao existe no Jest: virou comparacao do par [rotulo, valor], que
 * mantem no diff da falha QUAL fala do laco quebrou. */
import {
  bairroCitado,
  classificarTurno,
  normalizar,
  protocoloDoTurno,
  type ContextoDoTurno,
} from '../../src/unoogpt/agente/turno';

const ctx = (over: Partial<ContextoDoTurno> = {}): ContextoDoTurno => ({
  temDestino: false,
  primeiraFala: false,
  ultimaFalaDoAgente: null,
  ...over,
});

describe('normalizar e reconhecer bairro', () => {
  it('tira acento e caixa', () => {
    expect(normalizar('Ondi  Chovi MAIS?')).toBe('ondi chovi mais?');
    expect(normalizar('Vocês NÃO são iguais')).toBe('voces nao sao iguais');
  });

  it('reconhece o bairro com e sem espaço', () => {
    expect(bairroCitado('manda pro vale verde')).toBe('valeverde');
    expect(bairroCitado('valeverde')).toBe('valeverde');
    expect(bairroCitado('MORRO ALTO agora')).toBe('morroalto');
    expect(bairroCitado('quero a ribeirinha')).toBe('ribeirinha');
    expect(bairroCitado('no melio')).toBeNull();
  });
});

describe('as falas do playtest, uma a uma', () => {
  // Estas oito frases são o que o estudante de 16 anos escreveu de verdade, na
  // ordem em que escreveu. Se o classificador errar aqui, ele erra em sala.
  it('"num intindi" é pedido de socorro, não pergunta', () => {
    expect(classificarTurno('num intindi', ctx())).toBe('nao-entendi');
    expect(classificarTurno('não entendi', ctx())).toBe('nao-entendi');
    expect(classificarTurno('n entendi nada', ctx())).toBe('nao-entendi');
    expect(classificarTurno('como assim?', ctx())).toBe('nao-entendi');
  });

  it('"ondi chovi mais" e "i os acessu?" são perguntas', () => {
    expect(classificarTurno('ondi chovi mais', ctx())).toBe('pergunta');
    expect(classificarTurno('i os acessu?', ctx())).toBe('pergunta');
  });

  it('"qual melior desisto?" e "faiz o melior" são delegação', () => {
    expect(classificarTurno('qual melior desisto?', ctx())).toBe('delegacao');
    expect(classificarTurno('faiz o melior', ctx())).toBe('delegacao');
    expect(classificarTurno('faz o melhor', ctx())).toBe('delegacao');
    expect(classificarTurno('tanto faz', ctx())).toBe('delegacao');
    expect(classificarTurno('escolhe você', ctx())).toBe('delegacao');
  });

  it('"no melio" é curto demais para responder com tabela', () => {
    expect(classificarTurno('no melio', ctx())).toBe('curto');
    expect(classificarTurno('sei la', ctx())).toBe('curto');
  });
});

describe('o mesmo texto muda de sentido com o estado da Missão', () => {
  it('"manda la" sem destino é delegação; com destino não é', () => {
    expect(classificarTurno('manda la', ctx({ temDestino: false }))).toBe('delegacao');
    expect(classificarTurno('manda la', ctx({ temDestino: true }))).not.toBe('delegacao');
  });

  it('"manda ver" só é confirmação quando há o que confirmar', () => {
    expect(classificarTurno('manda ver', ctx({ temDestino: true }))).toBe('confirmacao');
    expect(classificarTurno('confirmo', ctx({ temDestino: true }))).toBe('confirmacao');
    expect(classificarTurno('confirmo', ctx({ temDestino: false }))).not.toBe('confirmacao');
  });

  it('nomear bairro vence delegação: "manda la pra ribeirinha" é uma ordem', () => {
    expect(classificarTurno('manda la pra ribeirinha', ctx())).toBe('nomeia-bairro');
  });

  it('PERGUNTAR sobre um bairro não é mandar equipe para lá', () => {
    // Este era o defeito: bastava o nome do bairro aparecer para a fala virar
    // ordem de alocação. Duas consequências, e a segunda é a grave — o estudante
    // perguntava "quantas pessoas moram na Ribeirinha?" e (1) a pergunta não
    // debitava o orçamento, porque ordem não debita, e (2) o Cientista recebia
    // o protocolo "isso é uma ordem, chame alocar_equipe" e mandava a equipe.
    for (const fala of [
      'quantas pessoas moram na Ribeirinha?',
      'qual o risco do Morro Alto?',
      'a Ribeirinha alaga muito?',
      'quanto tempo a equipe leva pro Industrial?',
      'compara a Ribeirinha com o Morro Alto',
      'me fala do Vale Verde',
      'onde tem mais gente, na Ribeirinha ou no Vale Verde?',
    ]) {
      expect([fala, classificarTurno(fala, ctx())]).toEqual([fala, 'pergunta']);
    }
  });

  it('mandar equipe continua sendo ordem, com verbo ou com o bairro sozinho', () => {
    for (const fala of [
      'manda a alfa pra ribeirinha',
      'envia a bravo para o morro alto',
      'aloca alfa no industrial',
      'coloca a bravo no vale verde',
      // Bairro solto é como se responde a "qual você quer?".
      'ribeirinha',
      'Vale Verde',
    ]) {
      expect([fala, classificarTurno(fala, ctx())]).toEqual([fala, 'nomeia-bairro']);
    }
  });

  it('"1" só é escolha se o Cientista tiver oferecido opções', () => {
    const comOpcoes = ctx({
      ultimaFalaDoAgente: 'Opção 1: Alfa para a Ribeirinha…\nOpção 2: Alfa para o Industrial…',
    });
    expect(classificarTurno('1', comOpcoes)).toBe('escolha-numerada');
    expect(classificarTurno('a primeira', comOpcoes)).toBe('escolha-numerada');
    expect(classificarTurno('1', ctx())).not.toBe('escolha-numerada');
  });

  it('a primeira fala tem roteiro próprio — só quando não traz conteúdo', () => {
    for (const f of ['oi', 'vamos', 'bora']) {
      expect([f, classificarTurno(f, ctx({ primeiraFala: true }))]).toEqual([f, 'abertura']);
    }
  });

  it('quem ABRE perguntando gasta pergunta como qualquer um', () => {
    // Abertura nunca debita. Enquanto toda primeira fala era abertura, quem
    // começava a conversa com uma pergunta de verdade ganhava a resposta de
    // graça — o orçamento virava quatro, não três. O roteiro de boas-vindas
    // continua vindo pelo prompt; o que muda é o tipo do turno.
    for (const f of [
      'como sau os barrios?',
      'onde chove mais?',
      'quantas pessoas na Ribeirinha?',
    ]) {
      expect([f, classificarTurno(f, ctx({ primeiraFala: true }))]).toEqual([f, 'pergunta']);
    }
  });
});

describe('os protocolos são texto autorado e nenhum deles decide', () => {
  const tipos = [
    'delegacao',
    'nao-entendi',
    'curto',
    'escolha-numerada',
    'nomeia-bairro',
    'confirmacao',
    'pergunta',
  ] as const;

  it('todo protocolo existe e cabe em poucas linhas', () => {
    for (const t of tipos) {
      for (const temDados of [true, false]) {
        const p = protocoloDoTurno(t, { temDados });
        expect(p.length).toBeGreaterThan(0);
        expect(p.split('\n').length).toBeLessThanOrEqual(8);
      }
    }
  });

  it('nenhum protocolo nomeia um bairro: quem escolhe é o estudante', () => {
    for (const t of tipos) {
      for (const temDados of [true, false]) {
        expect(bairroCitado(protocoloDoTurno(t, { temDados }))).toBeNull();
      }
    }
  });

  it('a delegação com dados devolve duas opções e a escolha, sem repetir a tabela', () => {
    const p = protocoloDoTurno('delegacao', { temDados: true });
    expect(p).toContain('Opção 1');
    expect(p).toContain('Opção 2');
    expect(p).toContain('1 ou 2');
    expect(p).toContain('NÃO repete os números');
  });

  it('sem dado carregado, a delegação não inventa número', () => {
    expect(protocoloDoTurno('delegacao', { temDados: false })).toContain('Sem número nenhum');
  });

  it('"não entendi" nunca vira lista de bairro', () => {
    const p = protocoloDoTurno('nao-entendi', { temDados: true });
    expect(p).toContain('Sem lista de bairro');
    expect(p).toContain('Duas frases no total');
  });
});
