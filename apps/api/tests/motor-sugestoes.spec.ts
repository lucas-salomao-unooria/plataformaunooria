import { curarBloco, deveMostrarSugestoes, deveNotificarSeguidor } from '../src/motor/curadoria';
import { estadoInicial } from '../src/motor/estado';
import { CONFIG, catalogoDeTeste, rngComSemente } from './motor-simulador';

/** Doc 04 §5 — sugestões e notificação. Nenhum teste cobria esta seção. */

describe('módulo "Sugestões para você"', () => {
  it('só aparece com domínio ≥ 0.6', () => {
    const estado = { ...estadoInicial(), blocksServed: 5, ultimoBlocoSugestoes: 0 };

    expect(deveMostrarSugestoes(estado, CONFIG, 0.59)).toBe(false);
    expect(deveMostrarSugestoes(estado, CONFIG, 0.6)).toBe(true);
  });

  it('respeita a cadência de 2–3 blocos', () => {
    const base = { ...estadoInicial(), ultimoBlocoSugestoes: 4 };

    expect(deveMostrarSugestoes({ ...base, blocksServed: 5 }, CONFIG, 0.8)).toBe(false);
    expect(deveMostrarSugestoes({ ...base, blocksServed: 6 }, CONFIG, 0.8)).toBe(true);
  });

  it('pede 3 perfis, como manda a spec', () => {
    expect(CONFIG.sugestoes.perfis).toBe(3);
  });
});

describe('notificação "começou a seguir você"', () => {
  it('dispara ao cruzar 0.7 e só uma vez', () => {
    const estado = estadoInicial();

    expect(deveNotificarSeguidor(estado, CONFIG, 0.69)).toBe(false);
    expect(deveNotificarSeguidor(estado, CONFIG, 0.7)).toBe(true);
    expect(deveNotificarSeguidor({ ...estado, notificouSeguidor: true }, CONFIG, 0.95)).toBe(false);
  });
});

describe('rótulo "Sugerido para você"', () => {
  it('marca só parte dos posts do lado dominante, nunca todos', () => {
    const catalogo = catalogoDeTeste();
    const estado = {
      ...estadoInicial(),
      scoreA: 300,
      scoreB: 2,
      blocksServed: 4,
      baselineDwellMs: 2000,
      intensityUnlocked: { A: 3 as const, B: 1 as const },
    };

    let sugeridos = 0;
    let doDominante = 0;

    for (let semente = 1; semente <= 60; semente += 1) {
      const bloco = curarBloco(estado, catalogo, CONFIG, rngComSemente(semente * 7919));
      const metas = bloco.ids.map((id) => catalogo.find((post) => post.id === id)!);

      doDominante += metas.filter((meta) => meta.lado === 'A').length;
      sugeridos += bloco.sugeridos.size;
    }

    expect(doDominante).toBeGreaterThan(100);
    expect(sugeridos).toBeGreaterThan(0);
    // Antes marcava 100% do lado dominante — um marcador visual do algoritmo.
    expect(sugeridos / doDominante).toBeLessThan(0.6);
  });
});
