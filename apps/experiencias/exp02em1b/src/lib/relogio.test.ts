import { describe, expect, it } from 'vitest';
import { segundosRestantes } from './relogio';
import type { EstadoDoRelogio, RelogioPublico } from './tipos';

/**
 * O contrato que este teste guarda não é de aritmética: é de RENDER.
 *
 * `useContagem` guarda o retorno de `segundosRestantes` em estado do React e
 * amostra de 500 em 500 ms. Enquanto a função devolvia float com resolução de
 * milissegundo, duas amostras nunca eram iguais, o `useState` nunca fazia
 * bail-out e a missão inteira re-renderizava 2×/s. Dentro de um `Modal` do
 * design system (que mantém `onClose` nas dependências do efeito de foco) cada
 * render devolvia o foco para fora do modal e fechava o `<select>` nativo que o
 * estudante tinha acabado de abrir.
 *
 * Por isso a asserção é "duas leituras dentro do mesmo segundo dão o MESMO
 * número", e não "o número está certo".
 */
const RELOGIO: RelogioPublico = {
  modo: 'cronometrado',
  iniciadoEm: '2026-09-01T20:00:00.000Z',
  duracaoSeg: 1200,
  encerradoEm: null,
  pivoSeg: 0,
  pivoMin: 0,
  agora: '2026-09-01T20:00:00.000Z',
  fechamentoAberto: false,
};

const CORRENDO: EstadoDoRelogio = {
  fase: 'correndo',
  aberta: true,
  segundosAteFechar: 300,
  minutosGastos: 0,
  motivoDoFim: null,
};

const ANCORA = Date.parse(RELOGIO.agora);

describe('a contagem do relógio da turma', () => {
  it('não muda entre duas amostras do mesmo segundo', () => {
    // As quatro amostras que o intervalo de 500 ms tira ao longo de um segundo.
    const leituras = [0, 500, 999, 1].map((ms, i) =>
      segundosRestantes(RELOGIO, CORRENDO, ANCORA + (i === 3 ? 250 : ms)),
    );
    expect(new Set(leituras).size).toBe(1);
  });

  it('desce de um em um, em inteiros', () => {
    const em = (ms: number) => segundosRestantes(RELOGIO, CORRENDO, ANCORA + ms);
    expect(em(0)).toBe(300);
    expect(em(1_000)).toBe(299);
    expect(em(2_000)).toBe(298);
    // Arredonda para CIMA: com 1,4 s no relógio o estudante ainda tem "2".
    // Com `floor` o "1" apareceria por uma fração de segundo e o zero chegaria
    // antes de o tempo acabar de verdade.
    expect(em(298_600)).toBe(2);
  });

  it('nunca fica negativo depois do fim', () => {
    expect(segundosRestantes(RELOGIO, CORRENDO, ANCORA + 999_000)).toBe(0);
  });

  it('fora do "correndo", devolve o que a api mandou, sem descontar nada', () => {
    // Quem ainda espera a largada vê o cronômetro cheio e PARADO — a conta local
    // só vale depois que o professor abre a partida.
    const aguardando: EstadoDoRelogio = { ...CORRENDO, fase: 'aguardando' };
    expect(segundosRestantes(RELOGIO, aguardando, ANCORA + 60_000)).toBe(300);
  });

  it('sem prazo (modo livre), não há número para mostrar', () => {
    const livre: EstadoDoRelogio = { ...CORRENDO, segundosAteFechar: null };
    expect(segundosRestantes(RELOGIO, livre, ANCORA)).toBeNull();
  });
});
