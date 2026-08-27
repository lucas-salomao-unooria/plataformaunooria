import { validarOpcoes } from '../../src/unoogpt/regras/opcoes';

const cruzou = { jaCruzou: true };
const par = (alfa: string, bravo: string) => ({ alfa, bravo });

describe('as opções que o Cientista põe na mesa', () => {
  it('aceita dois pares de bairros que existem', () => {
    const r = validarOpcoes(
      { opcoes: [par('ribeirinha', 'valeverde'), par('industrial', 'morroalto')] },
      cruzou,
    );
    expect(r).toEqual({
      aceito: true,
      opcoes: [
        { alfa: 'ribeirinha', bravo: 'valeverde' },
        { alfa: 'industrial', bravo: 'morroalto' },
      ],
    });
  });

  it('recusa propor sem nenhuma leitura por trás: opção sem dado é chute', () => {
    const r = validarOpcoes(
      { opcoes: [par('ribeirinha', 'valeverde'), par('industrial', 'morroalto')] },
      { jaCruzou: false },
    );
    expect(r.aceito).toBe(false);
    expect(r.aceito === false && r.motivo).toContain('usar_dados');
  });

  it('descarta bairro que não existe na cidade', () => {
    const r = validarOpcoes(
      { opcoes: [par('centro', 'jardim'), par('ribeirinha', 'valeverde')] },
      cruzou,
    );
    expect(r.aceito).toBe(false);
  });

  it('descarta as duas equipes no mesmo bairro e opção repetida', () => {
    expect(
      validarOpcoes(
        { opcoes: [par('ribeirinha', 'ribeirinha'), par('industrial', 'morroalto')] },
        cruzou,
      ).aceito,
    ).toBe(false);
    expect(
      validarOpcoes(
        { opcoes: [par('ribeirinha', 'valeverde'), par('ribeirinha', 'valeverde')] },
        cruzou,
      ).aceito,
    ).toBe(false);
  });

  it('corta na segunda: três opções viram menu', () => {
    const r = validarOpcoes(
      {
        opcoes: [
          par('ribeirinha', 'valeverde'),
          par('industrial', 'morroalto'),
          par('morroalto', 'ribeirinha'),
        ],
      },
      cruzou,
    );
    expect(r.aceito === true && r.opcoes).toHaveLength(2);
  });

  it('nenhum número da LLM entra: o par só tem os dois slugs', () => {
    const r = validarOpcoes(
      {
        opcoes: [
          { ...par('ribeirinha', 'valeverde'), pessoas: 9999, recomendada: true },
          par('industrial', 'morroalto'),
        ],
      },
      cruzou,
    );
    expect(r.aceito === true && Object.keys(r.opcoes[0]).sort()).toEqual(['alfa', 'bravo']);
  });

  it('aguenta lixo sem quebrar', () => {
    expect(validarOpcoes({}, cruzou).aceito).toBe(false);
    expect(validarOpcoes({ opcoes: 'ribeirinha' }, cruzou).aceito).toBe(false);
    expect(validarOpcoes({ opcoes: [null, 7] }, cruzou).aceito).toBe(false);
  });
});
