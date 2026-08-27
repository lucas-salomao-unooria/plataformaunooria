import {
  CHAMADA_DESTRAVAR,
  PERGUNTAS_PRONTAS,
  TURNOS_ATE_DESTRAVAR,
  estaTravado,
} from '../../src/unoogpt/regras/destravar';

const agente = (tipo?: string) => ({ papel: 'agente', anexo: tipo ? { tipo } : null });
const aluno = { papel: 'aluno', anexo: null };

describe('as três perguntas prontas', () => {
  it('são de tipos diferentes, não três versões da mesma', () => {
    // O post-it do board é explícito: quem, onde, quanto tempo. Três formas de
    // querer saber, não três formas de perguntar a mesma coisa.
    expect(PERGUNTAS_PRONTAS.map((p) => p.tipo)).toEqual(['quem', 'onde', 'quanto tempo']);
    expect(new Set(PERGUNTAS_PRONTAS.map((p) => p.texto)).size).toBe(3);
  });

  it('nenhuma delas nomeia uma fonte: quem escolhe o que consultar é o Cientista', () => {
    // Se a pergunta pronta dissesse "carregue o censo", ela seria o painel de
    // fontes que o ADR-0009 recusou, entrando pela porta dos fundos.
    const proibidos = ['censo', 'satélite', 'satelite', 'sensor', 'cadastro', 'estudo', 'previsão'];
    for (const p of PERGUNTAS_PRONTAS) {
      for (const t of proibidos) expect(p.texto.toLowerCase()).not.toContain(t);
    }
  });

  it('a chamada convida sem dar a resposta', () => {
    expect(CHAMADA_DESTRAVAR).toBe('Não sabe o que perguntar? Comece por uma destas:');
  });
});

describe('quando o aluno está travado', () => {
  it('dois turnos seguidos sem leitura nenhuma destravam a ajuda', () => {
    // A sequência do playtest: "num intindi" e depois "no melio". Dois turnos
    // em que ele não recebeu nada da cidade.
    expect(estaTravado([aluno, agente(), aluno, agente()])).toBe(true);
  });

  it('um turno só não basta: perguntar e não achar acontece', () => {
    expect(estaTravado([aluno, agente()])).toBe(false);
    expect(estaTravado([])).toBe(false);
  });

  it('leitura na tela destrava: quem recebeu dado não está perdido', () => {
    expect(estaTravado([aluno, agente(), aluno, agente('tendencia')])).toBe(false);
    expect(estaTravado([aluno, agente(), aluno, agente('opcoes')])).toBe(false);
  });

  it('quem já está alocando não está travado, está decidindo', () => {
    expect(estaTravado([aluno, agente(), aluno, agente('alocacao')])).toBe(false);
    expect(estaTravado([aluno, agente(), aluno, agente('desfecho')])).toBe(false);
  });

  it('a leitura antiga não conta: o que vale são os últimos turnos', () => {
    const historico = [aluno, agente('tendencia'), aluno, agente(), aluno, agente()];
    expect(historico.filter((f) => f.papel === 'agente')).toHaveLength(3);
    expect(estaTravado(historico)).toBe(true);
    expect(TURNOS_ATE_DESTRAVAR).toBe(2);
  });
});
