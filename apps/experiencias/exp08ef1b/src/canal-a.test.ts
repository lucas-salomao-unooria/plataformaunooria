import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { desvioDaFase, type SituacaoDasTarefas } from './lib/canal-a';
import {
  PONTE_DO_RAIO_X,
  REVELACAO_FIXA,
  TELA_DO_REGISTRO,
  TELA_DOS_TERMOS,
  TELA_FINAL,
  origemDoPostNaPonte,
  telasDaRevelacao,
} from './lib/copy-da-revelacao';

/**
 * O Canal A no aparelho (ADR-167): o desvio por fase e a revelação de dez telas.
 */

const s = (parcial: Partial<SituacaoDasTarefas>): SituacaoDasTarefas => ({
  revelacaoConcluida: false,
  raioX: 'indisponivel',
  termos: 'aguardando',
  envio: 'aguardando',
  ...parcial,
});

describe('o desvio por fase', () => {
  test('o Raio-x pendente vem antes da revelação — inclusive para quem foi puxado adiante', () => {
    expect(desvioDaFase('explicabilidade', s({ raioX: 'pendente' }))).toBe('raio-x');
    expect(desvioDaFase('perdidos', s({ raioX: 'pendente' }))).toBe('raio-x');
    /* Na resposta e no debate, o Raio-x não toma a tela: ele mora na resposta. */
    expect(desvioDaFase('conclusao', s({ raioX: 'pendente' }))).toBeNull();
    expect(desvioDaFase('debate', s({ raioX: 'pendente' }))).toBeNull();
  });

  test('quem foi puxado adiante vê a revelação antes do cinza e das tarefas', () => {
    expect(desvioDaFase('perdidos', s({ raioX: 'enviada' }))).toBe('revelacao');
    expect(desvioDaFase('reflexao', s({ raioX: 'indisponivel' }))).toBe('revelacao');
    expect(desvioDaFase('explicabilidade', s({ raioX: 'enviada' }))).toBeNull();
  });

  test('tarefa pendente vem antes da reflexão; no cinza, o cinza vem primeiro', () => {
    const fim = s({ revelacaoConcluida: true, raioX: 'enviada', termos: 'pendente', envio: 'pendente' });
    expect(desvioDaFase('reflexao', fim)).toBe('tarefas');
    expect(desvioDaFase('fim', { ...fim, termos: 'enviada' })).toBe('tarefas');
    expect(desvioDaFase('perdidos', fim)).toBeNull();
    expect(desvioDaFase('reflexao', { ...fim, termos: 'enviada', envio: 'enviada' })).toBeNull();
  });

  test('quem não teve feed com lado não recebe tarefa', () => {
    const semFeed = s({ revelacaoConcluida: true, termos: 'indisponivel', envio: 'indisponivel' });
    expect(desvioDaFase('reflexao', semFeed)).toBeNull();
  });

  test('sem a situação, a tela é a da fase', () => {
    expect(desvioDaFase('reflexao', null)).toBeNull();
  });
});

describe('a revelação', () => {
  test('dez telas para quem fez o Raio-x, nove para quem não fez, nesta ordem', () => {
    const com = telasDaRevelacao('sorteio', { comPonte: true });
    expect(com).toHaveLength(10);
    expect(com.slice(0, 4)).toEqual(REVELACAO_FIXA);
    expect(com[4]).toBe(PONTE_DO_RAIO_X);
    expect(com[5]).toBe(TELA_DOS_TERMOS);
    expect(com[6]).toBe(TELA_DO_REGISTRO);
    expect(com[9]).toBe(TELA_FINAL);
    expect(telasDaRevelacao('sorteio')).toHaveLength(9);
  });

  test('a primeira tela não promete mais do que é verdade, e o lado de partida não cita o menu', () => {
    expect(REVELACAO_FIXA[0]!.complemento).toBe('Nenhum dado seu foi para rede social nenhuma.');
    expect(JSON.stringify(telasDaRevelacao('perfil'))).not.toContain('Por que estou vendo isto');
  });

  test('a ponte fala do post, nunca do estudante', () => {
    expect(origemDoPostNaPonte('A', { A: 'Lado A', B: 'Lado B' })).toBe('escrito para defender Lado A');
    expect(origemDoPostNaPonte('neutro', { A: 'Lado A', B: 'Lado B' })).toBe('escrito para informar, sem defender lado');
  });

  test('a cópia gêmea do hub é IDÊNTICA a esta, fora do cabeçalho que diz qual é qual', () => {
    const corpo = (caminho: string) => {
      const texto = readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8');
      return texto.slice(texto.indexOf('export interface TelaDaRevelacao'));
    };
    expect(corpo('../../../hub/lib/insta/copy-da-revelacao.ts')).toBe(corpo('./lib/copy-da-revelacao.ts'));
  });
});
