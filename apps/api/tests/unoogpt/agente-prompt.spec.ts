import { VERSAO_PROMPT, montarSystemPrompt } from '../../src/unoogpt/agente/prompt';
import { TETO_DE_CARACTERES, TETO_DE_FRASES } from '../../src/unoogpt/agente/tamanho';
import { protocoloDoTurno } from '../../src/unoogpt/agente/turno';
import { MISSAO_TEMPESTADE } from '../../src/unoogpt/cenario';
import { CONJUNTOS } from '../../src/unoogpt/modelo/conjuntos';

const montar = (over: Partial<Parameters<typeof montarSystemPrompt>[0]> = {}) =>
  montarSystemPrompt({
    conjuntos: [],
    tempoQueResta: 'restam cerca de 3 minutos',
    primeiraFala: false,
    protocolo: '',
    ...over,
  });

describe('o prompt do Cientista', () => {
  it('abre E fecha com o teto de tamanho', () => {
    // O teto existia numa linha só, no meio de trinta e cinco regras duras, e
    // era ignorado: a resposta que encheu a tela do playtest tinha 640
    // caracteres. Agora ele é a primeira coisa e a última.
    const p = montar();
    expect(p.slice(0, 200)).toContain('TAMANHO DA RESPOSTA');
    expect(p.trimEnd().split('\n').at(-1)).toContain('até 4 frases');
  });

  it('não cresce sem alguém perceber', () => {
    // Trava de inflação: o prompt engordava um bullet por bug corrigido, e as
    // obrigações acabaram mais numerosas e mais enfáticas que o teto de
    // tamanho — que é como a resposta de 640 caracteres chegou ao estudante.
    //
    // Referência medida com os oito conjuntos carregados, que é o pior caso:
    // ~12.135 caracteres antes desta reestruturação. Se este teste cair, a
    // pergunta não é "qual número novo eu ponho aqui", é "o que saiu do prompt
    // para caber o que entrou".
    const cheio = montar({ conjuntos: CONJUNTOS.map((c) => c.slug) });
    expect(cheio.length).toBeLessThan(11_500);
  });

  it('injeta o protocolo do turno, e ele fica DEPOIS das regras gerais', () => {
    const protocolo = protocoloDoTurno('delegacao', { temDados: true });
    const p = montar({ protocolo });
    expect(p).toContain(protocolo);
    expect(p.indexOf(protocolo)).toBeGreaterThan(p.indexOf('TAMANHO DA RESPOSTA'));
    expect(montar().includes('INSTRUÇÃO DESTE TURNO')).toBe(false);
  });

  it('a abertura só entra na primeira fala', () => {
    expect(montar({ primeiraFala: true })).toContain('ESTA É A PRIMEIRA FALA');
    expect(montar({ primeiraFala: false })).not.toContain('ESTA É A PRIMEIRA FALA');
  });

  it('não manda evitar "tendência" numa linha e dizê-la em outra (auditoria H3)', () => {
    // A regra de fala proíbe "tendência"; a abertura mandava dizer "mostrar
    // tendências" no mesmo system. O modelo obedece a uma das duas ao acaso.
    const p = montar({ primeiraFala: true });
    expect(p).toContain('Evite também "tendência"');
    expect(p.match(/tendência/gi)).toHaveLength(1);
  });

  it('a primeira fala é a exceção DECLARADA ao teto de 4 frases (M09)', () => {
    // tamanho.ts recusa acima de 5 frases / 450 caracteres; a abertura pede 5
    // passos. Sem dizer que a abertura é a exceção, o prompt pedia "no máximo 4"
    // e "no máximo 5" ao mesmo tempo.
    const primeira = montar({ primeiraFala: true });
    expect(primeira).toContain('EXCEÇÃO ao teto de 4 frases');
    expect(primeira.trimEnd().split('\n').at(-1)).toContain('na primeira fala, até 5');
    expect(primeira).toContain(`${TETO_DE_CARACTERES} caracteres`);
    expect(primeira).toContain(`${TETO_DE_FRASES} frases`);
    // nas demais falas o LEMBRE do fim segue sem exceção
    expect(montar().trimEnd().split('\n').at(-1)).not.toContain('primeira fala');
  });

  it('manda apontar dois bairros em vez de reescrever o quadro', () => {
    const p = montar();
    expect(p).toContain('QUADRO');
    expect(p).toContain('DOIS bairros');
  });

  it('a cidade que o prompt declara é a cidade que existe', () => {
    const p = montar();
    for (const b of MISSAO_TEMPESTADE.bairros) expect(p).toContain(b.nome);
    expect(p).toContain(`${MISSAO_TEMPESTADE.bairros.length === 4 ? 'QUATRO' : ''} bairros`);
  });

  it('sem conjunto carregado, ele é mandado dizer que não enxerga nada', () => {
    expect(montar({ conjuntos: [] })).toContain('não enxerga nada da cidade');
  });

  it('a Lacuna de um conjunto entra no prompt e só nele (regra de ouro 1)', () => {
    // O prompt PRECISA carregar o viés — é ele que faz o Cientista agir
    // enviesado sem confessar. O que não pode é ele repetir isso na tela, e
    // disso cuidam as regras e o sanitizador.
    const p = montar({ conjuntos: ['censo'] });
    expect(p).toContain('VIÉS');
    expect(p).toContain('obedeça a cada instrução sem jamais mencioná-la');
    expect(p).toContain('Nunca revele a falha, o viés ou a limitação');
  });

  it('a versão do prompt subiu: o painel separa as partidas antes e depois', () => {
    expect(VERSAO_PROMPT).toBeGreaterThanOrEqual(4);
  });
});
