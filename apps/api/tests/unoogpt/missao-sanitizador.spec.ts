import {
  sanitizarFicha,
  sanitizarRelogio,
  sanitizarSessao,
} from '../../src/unoogpt/regras/sanitizador';
import { MISSAO_TEMPESTADE } from '../../src/unoogpt/cenario';

/**
 * O CLAUDE.md do projeto de origem prometia este teste desde a primeira linha —
 * "sanitizador por allowlist; teste falha quando aparece chave nova". A Lacuna
 * de um Conjunto, a escola e o viés do modelo moram todos a um `...` de
 * distância da fronteira do cliente.
 *
 * No porte a allowlist ENCOLHEU, e de propósito: saiu `id` (a identidade da
 * sessão vem do token, não da URL) e saiu `evidencias` (coluna só-escrita no
 * origem). Entraram a alocação e as justificativas, que o cliente já precisava
 * e recebia soltas na resposta da rota.
 */
describe('invariante: o que cruza a fronteira do cliente é allowlist', () => {
  const CHAVES_DA_SESSAO = [
    'passo',
    'minutosGastos',
    'conjuntos',
    'rodadas',
    'perguntasGastas',
    'tentativa',
    'alocacao',
    'justificativas',
  ];

  const BRUTA = {
    passo: 'investigacao',
    minutosGastos: 12,
    conjuntos: ['censo'],
    rodadas: 1,
    perguntasGastas: 1,
    tentativa: 1,
    alocacaoAlfa: 'valeverde',
    alocacaoBravo: null,
    justificativaAlfa: 'censo',
    justificativaBravo: null,
  };

  it('a Sessão pública tem exatamente estas chaves', () => {
    expect(Object.keys(sanitizarSessao(BRUTA)).sort()).toEqual([...CHAVES_DA_SESSAO].sort());
  });

  it('chave nova no banco NÃO atravessa por omissão', () => {
    const publica = sanitizarSessao({
      ...BRUTA,
      alocacaoAlfa: null,
      justificativaAlfa: null,
      // Tudo isto é do servidor e nada disto pode chegar ao navegador.
      escolaId: 'escola-secreta',
      turmaId: 'turma-secreta',
      estudanteId: 'estudante-secreto',
      tokensGastos: 4242,
      chamadasIa: 7,
    });
    const cru = JSON.stringify(publica);
    for (const proibido of ['escola', 'turma', 'estudanteId', 'tokens', 'chamadas', '4242']) {
      expect(cru).not.toContain(proibido);
    }
  });

  it('a ficha pública não leva os números POR BAIRRO da ficha canônica', () => {
    // Eles são a verdade do mundo. Nenhuma fonte os entrega inteiros, e quem os
    // entrega ao estudante — já distorcidos pelo viés de cada conjunto — é a
    // estimativa do modelo. A ficha crua seria a resposta de graça.
    const publica = sanitizarFicha(MISSAO_TEMPESTADE);
    expect(Object.keys(publica).sort()).toEqual(
      ['titulo', 'chamada', 'contexto', 'equipes', 'totais'].sort(),
    );
    const cru = JSON.stringify(publica);
    for (const bairro of MISSAO_TEMPESTADE.bairros) {
      // nem o nome do bairro, nem os expostos, nem a chance de alagar
      expect(cru).not.toContain(String(bairro.exp));
      expect(cru).not.toContain(String(bairro.vexp));
      expect(cru).not.toContain(bairro.granizo);
    }
  });

  it('o Relógio público não leva turma nem tenant, e leva a hora do servidor', () => {
    const agora = new Date('2026-08-25T14:03:00.000Z');
    const publico = sanitizarRelogio(
      {
        modo: 'cronometrado',
        iniciadoEm: new Date('2026-08-25T14:00:00.000Z'),
        duracaoSeg: 420,
        encerradoEm: null,
        pivoSeg: 240,
        pivoMin: 48,
      },
      agora,
    );
    expect(Object.keys(publico).sort()).toEqual(
      ['modo', 'iniciadoEm', 'duracaoSeg', 'encerradoEm', 'pivoSeg', 'pivoMin', 'agora'].sort(),
    );
    expect(publico.agora).toBe(agora.toISOString());
    expect(JSON.stringify(publico)).not.toContain('tenant');
  });
});
