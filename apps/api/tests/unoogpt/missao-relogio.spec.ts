import {
  RELOGIO,
  RELOGIO_PADRAO,
  cronometroDe,
  estadoDoRelogio,
  faltaTexto,
  horaDaTela,
  horaDoCartao,
  saidaDasEquipes,
} from '../../src/unoogpt/regras/relogio';

/**
 * As funções puras que sobreviveram à passagem do Relógio para a Turma. As
 * quatro fases e o pivô da extensão moram em `relogio-da-turma.test.ts`.
 *
 * `minutosDecorridos`, `segundosAteFechar` e `SEGUNDOS_POR_MINUTO_NARRATIVO`
 * saíram: todas assumiam que cinco minutos de parede valem uma hora da cidade,
 * e essa escala deixou de ser constante quando o professor passou a poder
 * esticar a aula.
 */
describe('o Relógio, o que sobrou dele em conta pura', () => {
  it('a saída das equipes é o minuto da cidade, nunca depois da chuva', () => {
    expect(saidaDasEquipes(0)).toBe(0);
    expect(saidaDasEquipes(12)).toBe(12);
    expect(saidaDasEquipes(59)).toBe(59);
    expect(saidaDasEquipes(999)).toBe(RELOGIO.minutosTotais);
  });

  it('o cronômetro formata SEGUNDOS que faltam, não minutos da cidade', () => {
    expect(cronometroDe(300)).toBe('5:00');
    expect(cronometroDe(220)).toBe('3:40');
    expect(cronometroDe(9)).toBe('0:09');
    expect(cronometroDe(-10)).toBe('0:00');
  });

  it('a hora da cidade é só do painel do professor', () => {
    expect(horaDaTela(0)).toBe('17h00');
    expect(horaDaTela(24)).toBe('17h24');
    expect(horaDaTela(60)).toBe('18h00');
  });

  it('quanto falta, em texto, para o painel', () => {
    expect(faltaTexto(0)).toBe('1 h');
    expect(faltaTexto(28)).toBe('32 min');
    expect(faltaTexto(56)).toBe('4 min');
    expect(faltaTexto(60)).toBe('agora');
  });

  it('a leitura é datada pelo cronômetro — e pela hora da cidade quando não há um', () => {
    const inicio = new Date('2026-08-25T14:00:00.000Z');
    const meio = new Date(inicio.getTime() + 150_000);

    const cronometrado = estadoDoRelogio({ ...RELOGIO_PADRAO, iniciadoEm: inicio }, meio);
    expect(horaDoCartao(cronometrado)).toBe('2:30');

    const livre = estadoDoRelogio({ ...RELOGIO_PADRAO, modo: 'livre', iniciadoEm: inicio }, meio);
    expect(horaDoCartao(livre)).toBe('17h30');
  });
});
