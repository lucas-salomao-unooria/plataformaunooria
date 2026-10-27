/**
 * O CATÁLOGO da exp01em1b — O Assistente Invisível: Dados que viram decisões
 * (1ª série EM, unidade 1, ADR-185): vocabulários, os três perfis controlados,
 * o gabarito da bancada (cartões, passos do algoritmo, critérios, blocos do
 * comunicado) e o pacote padrão de Língua Portuguesa.
 *
 * Fontes, nesta ordem (decisão do Lucas, 2026-10-26):
 *   1. o Figma `9QyrVdEBJZkOS64ZauPfmk` (63 telas) — a referência de TELA e de copy;
 *   2. as respostas do Vinicius no card do Notion e o one-pager do PO v1.5
 *      (`artefatos_exp01em1b/produto/00-material-anexado.md`) — mecânica e régua.
 *
 * Puro — sem Nest e sem Prisma. A experiência e o hub espelham os TIPOS de
 * `contrato-de-rotas.ts`; o gabarito daqui (`COLUNA_DO_CARTAO`,
 * `PASSOS_DISPENSAVEIS`, `CRITERIOS_EQUITATIVOS`, `OPCAO_CERTA_DO_BLOCO`) NUNCA
 * desce ao cliente (regra 3).
 */

export const EXP_ID = "exp01em1b";

/** Gravada em cada sessão: o histórico se reprocessa pela versão que o mediu. */
export const VERSAO_DO_INSTRUMENTO = "1.0.0";

// ──────────────────────────────────────────── vocabulários (CHECK na migration)

/**
 * O componente curricular do recorte (E0-PROF-02, "Disciplina Escolar"): TODA a
 * Formação Geral Básica da 1ª série (`curriculo/componentes.ts#componentesDoAno("1EM")`,
 * na ordem e com os rótulos do catálogo), mais Computação (o complemento de
 * 2022 à BNCC) e o projeto interdisciplinar no fim — a regra que o #223 deu às
 * missões (a 2ª série faz igual, `efeito-amplificador/conteudo.ts`). Os slugs
 * são os do catálogo SEM o sufixo `-em`. `tests/assistente-invisivel-regras.spec.ts`
 * confere a lista e os rótulos contra o catálogo.
 */
export const DISCIPLINAS = [
  "lingua-portuguesa",
  "lingua-inglesa",
  "arte",
  "educacao-fisica",
  "matematica",
  "biologia",
  "fisica",
  "quimica",
  "filosofia",
  "geografia",
  "historia",
  "sociologia",
  "computacao",
  "projeto-interdisciplinar",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

export const ROTULO_DA_DISCIPLINA: Readonly<Record<Disciplina, string>> = {
  "lingua-portuguesa": "Língua Portuguesa e suas Literaturas",
  "lingua-inglesa": "Língua Inglesa",
  arte: "Arte",
  "educacao-fisica": "Educação Física",
  matematica: "Matemática",
  biologia: "Biologia",
  fisica: "Física",
  quimica: "Química",
  filosofia: "Filosofia",
  geografia: "Geografia",
  historia: "História",
  sociologia: "Sociologia",
  computacao: "Computação",
  "projeto-interdisciplinar": "Projeto Interdisciplinar",
};

export const ORIGENS = ["padrao", "ia"] as const;
export type Origem = (typeof ORIGENS)[number];

/** O tema (≤ 60, E0-PROF-02), os tópicos (3 a 5) e o contexto regional opcional (≤ 120). */
export const TEMA = { min: 3, max: 60 } as const;
export const TOPICOS = { min: 3, max: 5, maxCaracteres: 80 } as const;
export const CONTEXTO_MAX = 120;

/**
 * As fases da TURMA, que o professor move — só para a frente. São as cinco
 * liberações do Figma mais as duas pausas opcionais:
 *
 *   aguardando-inicio →(E1-PROF-01 "Liberar Início dos Testes")→ testes (E1–E3)
 *   →(E3-PROF-01 "Liberar Início da Simulação", 100% das apostas)→ simulacao (E4)
 *   →(E4-PROF-01 "Travar Telas da Turma", opcional)→ debate-1
 *   →(E4-PROF-01 "Liberar Bancada de Reconstrução")→ explicar (E5)
 *   →(E5-PROF-01 "Pausar para Comparação", opcional)→ debate-2
 *   →(E5-PROF-01 "Liberar Publicação e Transparência")→ publicar (E6)
 *
 * A pausa pula: de `simulacao` direto a `explicar` vale (o professor não
 * travou), e de `explicar` direto a `publicar` também.
 */
export const FASES = ["aguardando-inicio", "testes", "simulacao", "debate-1", "explicar", "debate-2", "publicar"] as const;
export type Fase = (typeof FASES)[number];

/** A aposta da E3 (o LATCH 1): (A) todos Avançado, (B) só alguns, (C) todos Básico. */
export const APOSTAS = ["a", "b", "c"] as const;
export type Aposta = (typeof APOSTAS)[number];

export const TEXTO_DA_APOSTA: Readonly<Record<Aposta, string>> = {
  a: "Todos receberão o nível Avançado conforme solicitado no cadastro.",
  b: "Apenas alguns receberão Avançado, pois o assistente fará triagem.",
  c: "Todos receberão nível Básico até comprovarem proficiência.",
};

/** O medidor da turma (TC-12) só aparece com pelo menos isto de apostas — abaixo, daria para deduzir a de um colega. */
export const MEDIDOR_MINIMO = 3;

// ──────────────────────────────────────────── os três perfis (variáveis CONTROLADAS)

/**
 * Só horário e conexão variam (decisão do Vinicius; o banco da esteira tinha
 * inventado aparelhos diferentes e uma inferência para o Lucas — saíram). O
 * Lucas é o controle: "Resultado: Avançado", sem inferência.
 */
export const PERFIS = ["lucas", "beatriz", "thiago"] as const;
export type Perfil = (typeof PERFIS)[number];

export interface FichaDoPerfil {
  nome: string;
  idade: number;
  formulario: string;
  horario: string;
  conexao: string;
  /** `null` no Lucas: nenhuma inferência. */
  inferencia: string | null;
  acao: string;
}

export const FICHAS: Readonly<Record<Perfil, FichaDoPerfil>> = {
  lucas: {
    nome: "Lucas",
    idade: 15,
    formulario: "Avançado",
    horario: "08h30",
    conexao: "Banda larga",
    inferencia: null,
    acao: "Resultado: Avançado",
  },
  beatriz: {
    nome: "Beatriz",
    idade: 15,
    formulario: "Avançado",
    horario: "23h45",
    conexao: "Banda larga",
    inferencia: "Acesso noturno / Possível cansaço e baixo rendimento",
    acao: "Rebaixar para Básico",
  },
  thiago: {
    nome: "Thiago",
    idade: 16,
    formulario: "Avançado",
    horario: "08h30",
    conexao: "Sinal instável",
    inferencia: "Risco de sobrecarga e lentidão",
    acao: "Limitar a 2 mensagens",
  },
};

/** As mensagens de sistema do UnooriaAI (E4-ALU-01) — fixas, iguais em todo pacote. */
export const AVISO_DE_SISTEMA = {
  beatriz: "Identificamos o seu ritmo de estudos e direcionamos você para o Reforço Básico",
  thiago: "Limite de interações atingido para a sua sessão. Retorne amanhã",
} as const;

// ──────────────────────────────────────────── E5, parte 1: os 6 cartões (GABARITO)

export const COLUNAS = ["fornecidos", "observados"] as const;
export type Coluna = (typeof COLUNAS)[number];

export const CARTOES = ["trilha-avancada", "nome-turma", "horario", "sinal-de-rede", "endereco-ip", "modelo-aparelho"] as const;
export type Cartao = (typeof CARTOES)[number];

/** A ordem e o rótulo da tela (E5-ALU-01). Desce ao cliente — a COLUNA certa não. */
export const ROTULO_DO_CARTAO: Readonly<Record<Cartao, string>> = {
  "trilha-avancada": "Escolha de Trilha Avançada",
  "nome-turma": "Nome e Turma do Estudante",
  horario: "Horário de Acesso (23h45)",
  "sinal-de-rede": "Oscilação no Sinal de Rede",
  "endereco-ip": "Endereço IP de Conexão",
  "modelo-aparelho": "Modelo do Dispositivo Utilizado",
};

/** GABARITO: o que o estudante digitou × o que o sistema gravou sozinho. */
export const COLUNA_DO_CARTAO: Readonly<Record<Cartao, Coluna>> = {
  "trilha-avancada": "fornecidos",
  "nome-turma": "fornecidos",
  horario: "observados",
  "sinal-de-rede": "observados",
  "endereco-ip": "observados",
  "modelo-aparelho": "observados",
};

// ──────────────────────────────────────────── E5, parte 2: as 5 etapas do algoritmo (GABARITO)

export const PASSOS_DO_ALGORITMO = [1, 2, 3, 4, 5] as const;
export type PassoDoAlgoritmo = (typeof PASSOS_DO_ALGORITMO)[number];

export const ROTULO_DO_PASSO_DO_ALGORITMO: Readonly<Record<PassoDoAlgoritmo, string>> = {
  1: "Ler mensagem enviada pelo usuário",
  2: "Checar relógio do sistema local",
  3: "Calcular pontuação presumida de cansaço",
  4: "Alterar trilha de estudos por perfil",
  5: "Enviar resposta formatada ao chat",
};

/** GABARITO (EM13CO03): os passos adicionados pela inferência — consomem processamento sem atender o pedido. */
export const PASSOS_DISPENSAVEIS: readonly PassoDoAlgoritmo[] = [2, 3, 4];

/**
 * GABARITO: o passo que AGE sobre o estudante a partir da inferência ("Alterar
 * trilha de estudos por perfil"). O Figma (E5-ALU-02 "marcado") o rotula
 * "(Ação enviesada)" quando o estudante o marca; o rótulo vem do SERVIDOR
 * (`estado.algoritmo.enviesados`), e só para o passo já marcado — o bundle não
 * sabe qual é (decisão do Lucas, 2026-10-26).
 */
export const PASSOS_DE_ACAO_ENVIESADA: readonly PassoDoAlgoritmo[] = [4];

// ──────────────────────────────────────────── E5, parte 3: o banco de critérios 3×3 (GABARITO)

export const FUNCOES = ["exercicios", "duvidas", "sugestoes"] as const;
export type Funcao = (typeof FUNCOES)[number];
export const OPCOES_DE_CRITERIO = ["a", "b", "c"] as const;
export type OpcaoDeCriterio = (typeof OPCOES_DE_CRITERIO)[number];

export type Criterios = Readonly<Record<Funcao, OpcaoDeCriterio>>;

/** A configuração no ar quando o estudante chega: B-B-A ("[Ativo]" na tela, decisão do Vinicius). */
export const CRITERIOS_INICIAIS: Criterios = { exercicios: "b", duvidas: "b", sugestoes: "a" };

export const ROTULO_DO_CRITERIO: Readonly<Record<Funcao, Readonly<Record<OpcaoDeCriterio, string>>>> = {
  exercicios: {
    a: "Escolha livre pelo estudante",
    b: "Ajustar automaticamente pelo horário de acesso",
    c: "Iniciar no básico e liberar avançado após 3 acertos",
  },
  duvidas: {
    a: "Limite fixo de 5 perguntas para todos",
    b: "Ajustar limite pela estabilidade da conexão",
    c: "Sem limite de perguntas, priorizando respostas curtas e leves em conexões lentas",
  },
  sugestoes: {
    a: "Priorizar assuntos escolhidos no cadastro",
    b: "Ordem fixa para todos",
    c: "Recomendar por histórico de navegação",
  },
};

/**
 * GABARITO (EM13CO01): os critérios que não restringem por dado observado. A
 * função 3 (sugestões) NÃO entra na régua — o §12a do PO só mede 1 e 2; o 3C
 * ("histórico de navegação") aparece só no painel do professor.
 */
export const CRITERIOS_EQUITATIVOS: Readonly<Record<"exercicios" | "duvidas", readonly OpcaoDeCriterio[]>> = {
  exercicios: ["a", "c"],
  duvidas: ["a", "c"],
};

// ──────────────────────────────────────────── E6: o comunicado em 4 blocos (GABARITO)

export const BLOCOS = ["problema", "inferencia", "regra", "salvaguarda"] as const;
export type Bloco = (typeof BLOCOS)[number];

export const OPCOES_DO_BLOCO = {
  problema: ["restringindo", "lentidao"],
  inferencia: ["metadados", "boletim"],
  regra: ["criterios-pedagogicos", "trafego"],
  salvaguarda: ["revisao-humana", "sem-registro"],
} as const satisfies Record<Bloco, readonly [string, string]>;
export type OpcaoDoBloco<B extends Bloco = Bloco> = (typeof OPCOES_DO_BLOCO)[B][number];

/** O texto da tela (E6-ALU-01): o começo de cada bloco e as duas opções. Desce ao cliente — a certa não. */
export const TEXTO_DO_BLOCO: Readonly<Record<Bloco, { titulo: string; inicio: string; opcoes: Readonly<Record<string, string>> }>> = {
  problema: {
    titulo: "1. Defina o problema identificado:",
    inicio: "Identificamos que o assistente estava...",
    opcoes: { restringindo: "restringindo acessos automaticamente", lentidao: "funcionando com lentidão técnica" },
  },
  inferencia: {
    titulo: "2. Aponte a inferência indevida:",
    inicio: "...ao deduzir perfil de estudo a partir de...",
    opcoes: { metadados: "metadados de horário e oscilação de rede", boletim: "notas anteriores do boletim" },
  },
  regra: {
    titulo: "3. Defina a regra corrigida:",
    inicio: "Para garantir equidade, estabelecemos que o acesso agora é definido por...",
    opcoes: { "criterios-pedagogicos": "critérios pedagógicos objetivos e escolha do estudante", trafego: "medição automática de tráfego" },
  },
  salvaguarda: {
    titulo: "4. Garanta a salvaguarda LGPD:",
    inicio: "Qualquer estudante tem direito a...",
    opcoes: { "revisao-humana": "solicitar explicação e revisão humana de decisões automatizadas", "sem-registro": "navegar sem registro de presença" },
  },
};

/** GABARITO (EM13CO20): a opção que mantém a cadeia causal. */
export const OPCAO_CERTA_DO_BLOCO: Readonly<Record<Bloco, string>> = {
  problema: "restringindo",
  inferencia: "metadados",
  regra: "criterios-pedagogicos",
  salvaguarda: "revisao-humana",
};

// ──────────────────────────────────────────── o pacote (o que a IA gera e o professor cura)

/**
 * O pacote didático do preparo (E0-PROF-04). A camada parametrizável do PO
 * (§3): disciplina, tema, enunciados, as dúvidas do chat e a leitura. A
 * dúvida do Lucas e as respostas do assistente também são do pacote (decisão
 * do Vinicius, 2026-10-26). O que NÃO muda com o pacote: os perfis, os
 * avisos de sistema, a bancada e a régua.
 *
 * Fluxo do chat (E4-ALU-01): Lucas pergunta → assistente responde com a
 * Trilha Avançada; Beatriz pergunta → aviso de rebaixamento e o Reforço
 * Básico; Thiago pergunta duas vezes (com resposta) e na terceira recebe o
 * limite. No reteste com equidade, a Beatriz recebe a resposta avançada e o
 * Thiago, a terceira resposta.
 */
export interface ConteudoDoPacote {
  versao: 1;
  trilhaAvancada: { titulo: string; enunciado: string };
  reforcoBasico: { titulo: string; enunciado: string };
  duvidas: { lucas: string; beatriz: string; thiago1: string; thiago2: string; thiago3: string };
  respostas: { lucas: string; beatriz: string; thiago1: string; thiago2: string; thiago3: string };
  leitura: { titulo: string; resumo: string };
}

/** Os itens que o professor edita ou regenera um a um ("Editar Texto" / "Regenerar Este Item"). */
export const ITENS_DO_PACOTE = [
  "trilhaAvancada",
  "reforcoBasico",
  "duvidas.lucas",
  "duvidas.beatriz",
  "duvidas.thiago1",
  "duvidas.thiago2",
  "duvidas.thiago3",
  "respostas.lucas",
  "respostas.beatriz",
  "respostas.thiago1",
  "respostas.thiago2",
  "respostas.thiago3",
  "leitura",
] as const;
export type ItemDoPacote = (typeof ITENS_DO_PACOTE)[number];

/** Limites de texto do pacote: a régua da homologação e o schema da IA usam os mesmos. */
export const LIMITES = { titulo: 80, enunciado: 280, duvida: 200, resposta: 400, resumo: 280 } as const;

/**
 * O banco padrão da rede (§9a: "banco padrão com temas pré-configurados de
 * Língua Portuguesa"), o mesmo exemplo do §3 do PO ("Figuras de Linguagem e
 * Ironia na Literatura", trilha "Análise de Poemas Modernistas"). É também a
 * reserva quando a IA está sem saldo ou fora do ar.
 */
export const PACOTE_PADRAO: { disciplina: Disciplina; tema: string; topicos: string[]; conteudo: ConteudoDoPacote } = {
  disciplina: "lingua-portuguesa",
  tema: "Figuras de Linguagem e Ironia na Literatura",
  topicos: ["Metáfora", "Ironia", "Antítese", "Poesia modernista"],
  conteudo: {
    versao: 1,
    trilhaAvancada: {
      titulo: "Trilha Avançada: Análise de Poemas Modernistas",
      enunciado:
        "Leia o poema e explique como a ironia e a metáfora constroem a crítica ao cotidiano da cidade. Use dois versos do texto para sustentar a sua interpretação.",
    },
    reforcoBasico: {
      titulo: "Reforço Básico: Identificação de Figuras",
      enunciado: "Leia as frases e marque qual figura de linguagem aparece em cada uma: metáfora, comparação ou antítese.",
    },
    duvidas: {
      lucas: "Como eu mostro que um verso é irônico sem só dizer que ele quer dizer o contrário?",
      beatriz: "No poema, a metáfora da cidade como máquina é crítica ou elogio? Como eu decido?",
      thiago1: "Qual a diferença entre ironia e sarcasmo num poema?",
      thiago2: "Uma antítese pode aparecer dentro de uma metáfora?",
      thiago3: "Pode me dar outro exemplo de ironia num poema modernista?",
    },
    respostas: {
      lucas:
        "Mostre o contraste entre o que o verso diz e o contexto do poema: aponte a palavra que destoa e explique o efeito que ela cria no leitor. Sua trilha avançada já está liberada.",
      beatriz:
        "Repare no tom dos versos ao redor: se a máquina aparece apagando as pessoas, a metáfora critica. Procure os verbos que mostram esse apagamento.",
      thiago1:
        "A ironia diz o contrário do que quer dizer e pede que o leitor perceba o desvio; o sarcasmo é uma ironia mais agressiva, que quer ferir o alvo.",
      thiago2: "Pode, sim: uma imagem pode juntar ideias opostas, como \"a multidão solitária\", e ainda assim ser uma metáfora da cidade.",
      thiago3: "Em muitos poemas modernistas, o eu lírico elogia o progresso com palavras tão exageradas que o elogio vira crítica. Esse exagero é a pista da ironia.",
    },
    leitura: {
      titulo: "Leitura Recomendada: A Ironia na Poesia Modernista",
      resumo: "Guia curto sobre como os poetas modernistas usaram a ironia e a metáfora para comentar a vida na cidade, com exemplos comentados.",
    },
  },
};

// ──────────────────────────────────────────── os ids dos marcadores (a ficha)

export const MARCADOR_CO20 = "comunicado-de-transparencia";
export const MARCADOR_CO01 = "criterios-reutilizados";
export const MARCADOR_CO18 = "ciclo-da-auditoria";
export const MARCADOR_CO03 = "etapas-do-algoritmo";

// ──────────────────────────────────────────── o roteiro do professor (painel e guia)

/**
 * As quatro perguntas do roteiro de debate (one-pager §9a) e o card de
 * transferência (E6). As perguntas 1 e 2 são as do E4-PROF-01, literais; as 3
 * e 4 são as do E6-PROF-01, na forma curta do Figma (que vence o one-pager).
 */
export const ROTEIRO = {
  perguntas: [
    "Olhando as fichas de Beatriz e Lucas, os dois preencheram o mesmo formulário pedindo nível avançado. O que exatamente o sistema analisou para decidir que a Beatriz deveria ir para o reforço básico?",
    "Estudar às 23h45 significa necessariamente que um estudante não tem capacidade para resolver exercícios difíceis? Quais motivos reais podem levar alguém a acessar a plataforma nesse horário?",
    "Quem costuma ter conexões mais instáveis ou usar pacotes de dados limitados? Se a IA bloqueia essas pessoas, que tipo de desigualdade ela reforça?",
    "Por que a LGPD proíbe caixas-pretas e garante o direito de pedir revisão humana?",
  ],
  transferencia:
    "Um aplicativo de transporte urbano passou a analisar o modelo do celular e o bairro de embarque de passageiros para estimar o poder de compra e cobrar tarifas dinâmicas mais altas, sem informar os usuários.",
} as const;

/** O intervalo do polling do gate (a tela relê a fase da turma). */
export const POLLING_MS = 3_000;
