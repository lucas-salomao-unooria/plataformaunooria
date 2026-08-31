import { TETO_DE_CARACTERES, contarFrases, problemasDeTamanho } from '../../src/unoogpt/agente/tamanho';

describe('o tamanho de uma resposta do Cientista', () => {
  it('conta frases terminadas em ponto, exclamação ou interrogação', () => {
    expect(contarFrases('Carreguei a previsão. A Ribeirinha é a maior. Qual você quer?')).toBe(3);
  });

  it('conta cada linha de lista como frase: é assim que o estudante lê', () => {
    // O Cientista não pode usar markdown, então lista com hífen — e quatro
    // linhas de bairro são quatro coisas para ler, com ponto final ou sem.
    const lista = ['Carreguei a previsão do tempo.', '- Ribeirinha', '- Morro Alto'].join('\n');
    expect(contarFrases(lista)).toBe(3);
  });

  it('não conta pontuação repetida nem espaço em branco como frase', () => {
    expect(contarFrases('Pronto...  E aí?\n\n\n')).toBe(2);
    expect(contarFrases('   \n  ')).toBe(0);
  });

  it('a parede do playtest conta como parede', () => {
    const parede = [
      'Carreguei a previsão do tempo para ver a tendência da tempestade.',
      'A tempestade mostra esta tendência de risco por bairro:',
      '- Ribeirinha: entre 56% e 96% de chance, com 2.927 pessoas em risco',
      '- Industrial: entre 55% e 93% de chance, com 1.448 pessoas em risco',
      '- Vale Verde: entre 39% e 66% de chance, com 2.278 pessoas em risco',
      '- Morro Alto: entre 32% e 54% de chance, com 2.734 pessoas em risco',
      'Você pode mandar as equipes para Ribeirinha e Industrial, ou para Ribeirinha e Morro Alto.',
      'Qual dessas opções você quer escolher?',
    ].join('\n');
    expect(contarFrases(parede)).toBeGreaterThan(5);
    expect(parede.length).toBeGreaterThan(450);
  });
});

describe('a guarda de tamanho', () => {
  const BAIRROS = ['Ribeirinha', 'Vale Verde', 'Morro Alto', 'Industrial'];
  const semModelo = { rodouModelo: false, nomesDeBairro: BAIRROS };
  const comModelo = { rodouModelo: true, nomesDeBairro: BAIRROS };

  it('deixa passar a resposta curta que o protocolo pede', () => {
    const boa =
      'Carreguei a previsão do tempo. A Ribeirinha é a mais exposta, com 2.927 pessoas em risco. Olhe o quadro para ver a cidade inteira. Para onde você quer mandar a Alfa?';
    expect(problemasDeTamanho(boa, comModelo)).toEqual([]);
  });

  it('barra a parede do playtest e diz por quê', () => {
    const parede = [
      'Carreguei a previsão do tempo para ver a tendência da tempestade.',
      'A tempestade mostra esta tendência de risco por bairro:',
      '- Ribeirinha: entre 56% e 96% de chance, com 2.927 pessoas em risco',
      '- Industrial: entre 55% e 93% de chance, com 1.448 pessoas em risco',
      '- Vale Verde: entre 39% e 66% de chance, com 2.278 pessoas em risco',
      '- Morro Alto: entre 32% e 54% de chance, com 2.734 pessoas em risco',
      'Você pode mandar as equipes para Ribeirinha e Industrial, ou para Ribeirinha e Morro Alto.',
      'Qual dessas opções você quer escolher?',
    ].join('\n');
    const motivos = problemasDeTamanho(parede, comModelo);
    expect(motivos.length).toBe(3);
    expect(motivos.join(' ')).toContain('caracteres');
    expect(motivos.join(' ')).toContain('frases');
    expect(motivos.join(' ')).toContain('4 bairros');
  });

  it('deixa passar a proposta de duas alternativas, que cita os quatro bairros', () => {
    // Esta é a resposta que o protocolo de delegação PEDE. A primeira versão da
    // guarda rejeitava exatamente ela, e o turno só passava no socorro da
    // terceira tentativa — 29 segundos por resposta.
    const proposta = [
      'Opção 1: Alfa para Industrial, Bravo para Ribeirinha — chega rápido nos de maior risco',
      'Opção 2: Alfa para Vale Verde, Bravo para Morro Alto — cobre mais gente',
      'Qual você quer, 1 ou 2?',
    ].join('\n');
    expect(problemasDeTamanho(proposta, comModelo)).toEqual([]);
  });

  it('citar os quatro bairros SEM número não é recitar a tabela', () => {
    const lista = 'Ribeirinha, Vale Verde, Morro Alto e Industrial são os bairros da cidade.';
    expect(problemasDeTamanho(lista, comModelo)).toEqual([]);
  });

  it('só cobra a recitação quando o quadro está na tela', () => {
    const tabela = 'Ribeirinha 2.927, Vale Verde 2.278, Morro Alto 2.734 e Industrial 625 pessoas.';
    expect(problemasDeTamanho(tabela, comModelo)).toHaveLength(1);
    expect(problemasDeTamanho(tabela, semModelo)).toEqual([]);
  });

  it('o motivo é uma instrução para o modelo, não um código de erro', () => {
    const longa = 'a'.repeat(TETO_DE_CARACTERES + 1);
    expect(problemasDeTamanho(longa, semModelo)[0]).toContain('Corte pela metade');
  });
});
