// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type { ExperienciaHandle } from "@edu/sdk";
import { App } from "./App";
import { definirExperiencia } from "./lib/api";
import type { Estado, Fase, Passo, Sessao } from "./lib/tipos";
import { PAUSA_NO_FIM_MS, RITMO_MS } from "./telas/Simulacao";

/**
 * FUMAÇA das telas: cada passo do servidor desenha a tela dele, com a copy do
 * Figma, sem quebrar — contra uma sessão falsa no formato do `SessaoSchema`
 * da api (sem gabarito: é o que o cliente recebe). A rede é um handle falso do
 * SDK; nenhuma chamada sai daqui.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chamadas: string[] = [];
const corpos: Record<string, unknown> = {};
let atual: Sessao | null = null;
let resposta: Partial<Estado> = {};

function handleFalso(): ExperienciaHandle {
  const ler = async <T,>(p: string): Promise<T> => {
    chamadas.push(p);
    const s = atual!;
    if (p.endsWith("/gate")) {
      return {
        preparada: s.preparada,
        fase: s.fase,
        rodada: 1,
        atividade: s.atividade,
        passo: s.passo,
        aguardandoProfessor: s.aguardandoProfessor,
        medidor: s.medidor,
        agora: "",
      } as T;
    }
    return s as T;
  };
  const jogar = async <T,>(p: string, corpo?: unknown): Promise<T> => {
    chamadas.push(p);
    corpos[p] = corpo;
    atual = { ...atual!, ...resposta };
    return atual as T;
  };
  return {
    estudante: { id: "e1", nome: "Estudante", serie: "1EM", turmaId: "t1", escolaId: "s1" },
    config: {},
    api: { get: ler, post: jogar, put: jogar, patch: jogar, delete: ler },
    ai: { gerar: vi.fn() },
    track: vi.fn(),
    progresso: { salvar: vi.fn(async () => undefined), carregar: vi.fn(async () => null) },
    concluir: vi.fn(),
    on: vi.fn(),
    enviarEstado: vi.fn(),
    reportarErro: vi.fn(),
  } as unknown as ExperienciaHandle;
}

const FASE_DO_PASSO: Record<Passo, Fase> = {
  "boas-vindas": "testes",
  funcoes: "testes",
  aposta: "testes",
  simulacao: "simulacao",
  confronto: "simulacao",
  fichas: "simulacao",
  classificacao: "explicar",
  algoritmo: "explicar",
  criterios: "explicar",
  reteste: "explicar",
  publicacao: "publicar",
  concluida: "publicar",
};

function sessao(passo: Passo, extra: Partial<Sessao> = {}): Sessao {
  return {
    passo,
    fase: FASE_DO_PASSO[passo],
    preparada: true,
    aguardandoProfessor: false,
    atividade: { pacoteId: "p1", rodada: 1 },
    equipe: null,
    funcoesAbertas: [],
    aposta: ["boas-vindas", "funcoes", "aposta"].includes(passo) ? null : "b",
    apostadaEm: null,
    classificacao: null,
    algoritmo: { aberto: false, marcados: [], concluido: false },
    criterios: { exercicios: "b", duvidas: "b", sugestoes: "a" },
    retestes: 0,
    ultimoReteste: passo === "reteste" ? { equidade: "total", beatrizAvancada: true, thiagoLivre: true } : null,
    publicacao: passo === "concluida" ? { paginaAtiva: true, comunicado: {}, publicadaEm: "2026-10-26T10:00:00.000Z" } : null,
    concluido: passo === "concluida",
    pacote: {
      disciplina: "Língua Portuguesa",
      tema: "Figuras de Linguagem",
      contingencia: false,
      conteudo: {
        versao: 1,
        trilhaAvancada: { titulo: "Trilha Avançada: Análise de Poemas Modernistas", enunciado: "Leia o poema." },
        reforcoBasico: { titulo: "Reforço Básico: Identificação de Figuras", enunciado: "Marque a figura." },
        duvidas: { lucas: "Dúvida do Lucas?", beatriz: "Dúvida da Beatriz?", thiago1: "T1?", thiago2: "T2?", thiago3: "T3?" },
        respostas: { lucas: "Resposta ao Lucas.", beatriz: "Resposta à Beatriz.", thiago1: "R1.", thiago2: "R2.", thiago3: "R3." },
        leitura: { titulo: "Leitura Recomendada: Ironia", resumo: "Guia curto." },
      },
    },
    material: {
      apostas: [
        { id: "a", texto: "Todos receberão o nível Avançado conforme solicitado no cadastro." },
        { id: "b", texto: "Apenas alguns receberão Avançado, pois o assistente fará triagem." },
        { id: "c", texto: "Todos receberão nível Básico até comprovarem proficiência." },
      ],
      fichas: [
        { perfil: "lucas", nome: "Lucas", idade: 15, formulario: "Avançado", horario: "08h30", conexao: "Banda larga", inferencia: null, acao: "Resultado: Avançado" },
        {
          perfil: "beatriz",
          nome: "Beatriz",
          idade: 15,
          formulario: "Avançado",
          horario: "23h45",
          conexao: "Banda larga",
          inferencia: "Acesso noturno / Possível cansaço e baixo rendimento",
          acao: "Rebaixar para Básico",
        },
        {
          perfil: "thiago",
          nome: "Thiago",
          idade: 16,
          formulario: "Avançado",
          horario: "08h30",
          conexao: "Sinal instável",
          inferencia: "Risco de sobrecarga e lentidão",
          acao: "Limitar a 2 mensagens",
        },
      ],
      avisos: {
        beatriz: "Identificamos o seu ritmo de estudos e direcionamos você para o Reforço Básico",
        thiago: "Limite de interações atingido para a sua sessão. Retorne amanhã",
      },
      cartoes: [
        { id: "trilha-avancada", rotulo: "Escolha de Trilha Avançada" },
        { id: "nome-turma", rotulo: "Nome e Turma do Estudante" },
        { id: "horario", rotulo: "Horário de Acesso (23h45)" },
        { id: "sinal-de-rede", rotulo: "Oscilação no Sinal de Rede" },
        { id: "endereco-ip", rotulo: "Endereço IP de Conexão" },
        { id: "modelo-aparelho", rotulo: "Modelo do Dispositivo Utilizado" },
      ],
      passosDoAlgoritmo: [
        { id: 1, rotulo: "Ler mensagem enviada pelo usuário" },
        { id: 2, rotulo: "Checar relógio do sistema local" },
        { id: 3, rotulo: "Calcular pontuação presumida de cansaço" },
        { id: 4, rotulo: "Alterar trilha de estudos por perfil" },
        { id: 5, rotulo: "Enviar resposta formatada ao chat" },
      ],
      criterios: [
        {
          funcao: "exercicios",
          opcoes: [
            { id: "a", rotulo: "Escolha livre pelo estudante" },
            { id: "b", rotulo: "Ajustar automaticamente pelo horário de acesso" },
            { id: "c", rotulo: "Iniciar no básico e liberar avançado após 3 acertos" },
          ],
        },
        {
          funcao: "duvidas",
          opcoes: [
            { id: "a", rotulo: "Limite fixo de 5 perguntas para todos" },
            { id: "b", rotulo: "Ajustar limite pela estabilidade da conexão" },
            { id: "c", rotulo: "Sem limite de perguntas, priorizando respostas curtas e leves em conexões lentas" },
          ],
        },
        {
          funcao: "sugestoes",
          opcoes: [
            { id: "a", rotulo: "Priorizar assuntos escolhidos no cadastro" },
            { id: "b", rotulo: "Ordem fixa para todos" },
            { id: "c", rotulo: "Recomendar por histórico de navegação" },
          ],
        },
      ],
      criteriosIniciais: { exercicios: "b", duvidas: "b", sugestoes: "a" },
      blocos: [
        {
          id: "problema",
          titulo: "1. Defina o problema identificado:",
          inicio: "Identificamos que o assistente estava...",
          opcoes: [
            { id: "x1", texto: "restringindo acessos automaticamente" },
            { id: "y1", texto: "funcionando com lentidão técnica" },
          ],
        },
        {
          id: "inferencia",
          titulo: "2. Aponte a inferência indevida:",
          inicio: "...ao deduzir perfil de estudo a partir de...",
          opcoes: [
            { id: "x2", texto: "metadados de horário e oscilação de rede" },
            { id: "y2", texto: "notas anteriores do boletim" },
          ],
        },
        {
          id: "regra",
          titulo: "3. Defina a regra corrigida:",
          inicio: "Para garantir equidade, estabelecemos que o acesso agora é definido por...",
          opcoes: [
            { id: "x3", texto: "critérios pedagógicos objetivos e escolha do estudante" },
            { id: "y3", texto: "medição automática de tráfego" },
          ],
        },
        {
          id: "salvaguarda",
          titulo: "4. Garanta a salvaguarda LGPD:",
          inicio: "Qualquer estudante tem direito a...",
          opcoes: [
            { id: "x4", texto: "solicitar explicação e revisão humana de decisões automatizadas" },
            { id: "y4", texto: "navegar sem registro de presença" },
          ],
        },
      ],
    },
    medidor: { a: 74, b: 18, c: 8, total: 27 },
    tempos: { pollingMs: 3000 },
    ...extra,
  };
}

let raiz: Root | null = null;
let recipiente: HTMLDivElement | null = null;

async function abrir(s: Sessao) {
  atual = s;
  recipiente = document.createElement("div");
  document.body.appendChild(recipiente);
  const r = createRoot(recipiente);
  raiz = r;
  await act(async () => {
    r.render(<App inicial={s} />);
  });
}

/** O texto do documento inteiro: a folha e as janelas do DS vão por portal ao `body`. */
const texto = () => document.body.textContent ?? "";
const botao = (nome: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>("button")).find((b) => (b.textContent ?? "").includes(nome));
const clicarRotulo = async (nome: string) => {
  const rotulo = Array.from(document.body.querySelectorAll<HTMLElement>("label")).find((l) => (l.textContent ?? "").includes(nome));
  await act(async () => rotulo!.click());
};

beforeAll(() => {
  definirExperiencia(handleFalso());
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

afterEach(async () => {
  const r = raiz;
  if (r) await act(async () => r.unmount());
  recipiente?.remove();
  document.body.innerHTML = "";
  raiz = null;
  chamadas.length = 0;
  resposta = {};
  vi.useRealTimers();
});

describe("cada passo do servidor desenha a sua tela, com a copy do Figma", () => {
  test.each<[Passo, string[]]>([
    ["boas-vindas", ["Unooria · Comissão", "Nossa missão na comissão", "Abrir Módulo de Teste"]],
    ["funcoes", ["Função 1: Apresentar Exercícios", "Função 3: Sugerir Conteúdos", "Ir para Bateria de Testes"]],
    ["aposta", ["Beatriz (15 anos)", "[Fornecido no cadastro]", "Preferência declarada: Trilha Avançada", "Disparar Simulação"]],
    ["simulacao", ["UnooriaAI", "Sessão de Teste 1/3: Lucas"]],
    ["confronto", ["Flagrante da Triagem", "Você previu: 'Apenas alguns receberão Avançado, pois o assistente fará triagem'.", "Na sua turma: 74%", "Abrir Fichas de Auditoria de Acesso"]],
    ["fichas", ["Relatório Comparativo", "Ação do Sistema", "Inferência: Acesso noturno / Possível cansaço e baixo rendimento → Rebaixar para Básico", "Concluir Inspeção de Metadados"]],
    ["classificacao", ["Dados Fornecidos", "Dados Observados", "Cartão 1", "Cartões da Sessão Técnica:"]],
    ["algoritmo", ["[Opcional / Aprofundamento] Ver etapas de processamento do assistente", "Pular Etapa"]],
    ["criterios", ["Função 1 (Exercícios)", "Critério 1B: Ajustar automaticamente pelo horário de acesso [Ativo]", "Critério 3A: Priorizar assuntos escolhidos no cadastro [Ativo]", "Executar Novo Teste de Homologação"]],
    ["reteste", ["Equidade Homologada", "Beatriz acessou o nível Avançado", "Resposta à Beatriz.", "Avançar para Homologação e Transparência"]],
    ["publicacao", ["Página Pública de Transparência do UnooriaAI", "▶ Comece aqui", "Publicar Transparência e Comunicado"]],
    ["concluida", ["Certificado de Homologação Ética Escolar", "Salvaguarda Ativa: Direito à Explicação e Revisão Humana (LGPD)", "Pular Desafio Extra e Encerrar"]],
  ])("%s", async (passo, esperados) => {
    await abrir(sessao(passo));
    for (const t of esperados) expect(texto()).toContain(t);
  });

  test("sem medidor (menos de 3 apostas), o confronto não mostra percentual", async () => {
    await abrir(sessao("confronto", { medidor: null }));
    expect(texto()).not.toContain("Na sua turma");
  });

  test("com equipe: o cabeçalho da bancada e a instrução no plural, sem cortar a tela", async () => {
    await abrir(sessao("aposta", { equipe: { nome: "Estação 04" } }));
    expect(texto()).toContain("Unooria · Bancada");
    expect(texto()).toContain("Bancada da Comissão: Estação 04");
    expect(texto()).toContain("Debatam em equipe e registrem a previsão consensual da estação.");
    expect(texto()).toContain("Thiago (16 anos)");
  });

  test("E3-SIS-01: o pacote de contingência acende a faixa", async () => {
    const s = sessao("aposta");
    await abrir({ ...s, pacote: { ...s.pacote!, contingencia: true } });
    expect(texto()).toContain("Carregando versão de contingência da rede escolar");
    expect(texto()).toContain("Pacote Padrão");
  });

  test("a aposta travada espera a turma: 'Previsão arquivada' e 'Iniciando Simulação de Chat...'", async () => {
    await abrir(sessao("simulacao", { fase: "testes", aguardandoProfessor: true, aposta: "a" }));
    expect(texto()).toContain("Estado Latch Gravado");
    expect(texto()).toContain("Previsão arquivada: Todos receberão o nível Avançado conforme solicitado no cadastro.");
    expect(texto()).toContain("Iniciando Simulação de Chat...");
  });

  test("a Trava 1 depois das fichas: a camada de espera da mediação", async () => {
    await abrir(sessao("classificacao", { fase: "simulacao", aguardandoProfessor: true }));
    expect(texto()).toContain("Pausa para Mediação");
    expect(texto()).toContain("Aguardando autorização da mediação docente para liberar a próxima fase da auditoria");
    expect(texto()).toContain("Roda de conversa coletiva em andamento com o professor (8 min).");
  });

  test("a Trava 2 depois do reteste: a camada da comparação no quadro", async () => {
    await abrir(sessao("publicacao", { fase: "debate-2", aguardandoProfessor: true }));
    expect(texto()).toContain("Comparação de soluções no quadro com o professor (5 min).");
    expect(texto()).not.toContain("Publicar Transparência e Comunicado");
  });

  test("o alerta de viés oferece revisar ou avançar", async () => {
    await abrir(sessao("reteste", { ultimoReteste: { equidade: "parcial", beatrizAvancada: false, thiagoLivre: true } }));
    expect(texto()).toContain("Alerta de Viés Mantido");
    expect(texto()).toContain("Revisar Critérios");
    expect(texto()).toContain("Avançar para Publicação");
    expect(texto()).toContain("Aviso de Sistema: Identificamos o seu ritmo de estudos");
  });

  test("sem pacote no ar: a espera, sem a Zara", async () => {
    await abrir(sessao("boas-vindas", { preparada: false, pacote: null }));
    expect(texto()).toContain("Aguardando autorização da mediação docente");
    expect(texto()).not.toContain("Abrir Módulo de Teste");
  });
});

describe("os gestos que vão à api", () => {
  test("E2: o botão só acende com uma função expandida", async () => {
    await abrir(sessao("funcoes"));
    expect(botao("Ir para Bateria de Testes")!.disabled).toBe(true);
    const cabecalho = document.body.querySelector<HTMLElement>("[aria-expanded]")!;
    await act(async () => cabecalho.click());
    expect(texto()).toContain("Função 1: Apresentar Exercícios ✓");
    expect(botao("Ir para Bateria de Testes")!.disabled).toBe(false);
    await act(async () => botao("Ir para Bateria de Testes")!.click());
    expect(chamadas).toContain("/assistente-invisivel/navegar");
    expect(corpos["/assistente-invisivel/navegar"]).toEqual({ abertas: ["exercicios"], atividade: { pacoteId: "p1", rodada: 1 } });
  });

  test("E3: a dica some ao escolher e 'Disparar Simulação' grava o latch", async () => {
    await abrir(sessao("aposta"));
    expect(texto()).toContain("Para iniciar a homologação, registre a previsão");
    expect(botao("Disparar Simulação")!.disabled).toBe(true);
    await clicarRotulo("Todos receberão nível Básico");
    expect(texto()).not.toContain("Para iniciar a homologação, registre a previsão");
    await act(async () => botao("Disparar Simulação")!.click());
    expect(corpos["/assistente-invisivel/aposta"]).toEqual({ aposta: "c", atividade: { pacoteId: "p1", rodada: 1 } });
  });

  test("E4-ALU-01: as falas aparecem em sequência e a simulação se conclui sozinha", async () => {
    vi.useFakeTimers();
    resposta = { passo: "confronto" };
    await abrir(sessao("simulacao"));
    expect(texto()).not.toContain("Dúvida do Lucas?");
    const campo = () => document.body.querySelector<HTMLElement>("[placeholder]")?.getAttribute("placeholder");
    expect(campo()).toBe("Entrada bloqueada durante a execução da bateria de testes...");
    /* Uma fala por vez: cada uma agenda a seguinte depois de desenhada. */
    for (let i = 0; i < 15; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(RITMO_MS + 10);
      });
    }
    expect(texto()).toContain("Aviso de Sistema: Limite de interações atingido para a sua sessão. Retorne amanhã");
    expect(campo()).toBe("Sessões concluídas. Relatório de auditoria gerado...");
    expect(chamadas).not.toContain("/assistente-invisivel/simulacao/concluir");
    await act(async () => {
      vi.advanceTimersByTime(PAUSA_NO_FIM_MS + 10);
    });
    expect(chamadas).toContain("/assistente-invisivel/simulacao/concluir");
  });

  test("E5-ALU-01: tocar o cartão e a coluna o coloca; o envio vai como está", async () => {
    await abrir(sessao("classificacao"));
    const cartao = botao("Horário de Acesso (23h45)")!;
    await act(async () => cartao.click());
    await act(async () => botao("Colocar em Dados Observados")!.click());
    expect(texto()).toContain("Dados Observados (1)");
    expect(texto()).toContain("A classificação dos dados da sessão ainda não foi concluída.");
    await act(async () => botao("Concluir Classificação")!.click());
    expect(corpos["/assistente-invisivel/cartoes"]).toEqual({ classificacao: { horario: "observados" }, atividade: { pacoteId: "p1", rodada: 1 } });
  });

  test("E5-ALU-02: o rótulo é do estudante, e a otimização conta 5 − marcados", async () => {
    await abrir(sessao("algoritmo"));
    const cabecalho = document.body.querySelector<HTMLElement>("[aria-expanded]")!;
    await act(async () => cabecalho.click());
    expect(chamadas).toContain("/assistente-invisivel/algoritmo/abrir");
    await clicarRotulo("Passo 2: Checar relógio do sistema local");
    expect(texto()).toContain("Passo 2: Checar relógio do sistema local (Inferência dispensável)");
    expect(texto()).toContain("Passo 1: Ler mensagem enviada pelo usuário (Essencial)");
    expect(texto()).toContain("Otimização: de 5 para 4 passos essenciais");
    expect(corpos["/assistente-invisivel/algoritmo/marcar"]).toEqual({ marcados: [2], atividade: { pacoteId: "p1", rodada: 1 } });
  });

  test("E6-ALU-01: publicar é sempre habilitado; bloco em branco só avisa; o toggle nasce desligado", async () => {
    await abrir(sessao("publicacao"));
    expect(botao("Publicar Transparência e Comunicado")!.disabled).toBe(false);
    await clicarRotulo("restringindo acessos automaticamente");
    expect(texto()).toContain("O comunicado da comissão precisa articular todos os quatro pontos");
    await act(async () => botao("Publicar Transparência e Comunicado")!.click());
    expect(corpos["/assistente-invisivel/publicar"]).toEqual({ paginaAtiva: false, comunicado: { problema: "x1" }, atividade: { pacoteId: "p1", rodada: 1 } });
  });
});
