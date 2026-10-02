/**
 * O ESQUELETO fixo da exp06ef1b — o que não é gerado pelo professor.
 *
 * Decisão de 2026-10-02: a missão não nasce com acervo (os dezesseis projetos
 * são da atividade, gerados por IA no preparo). O que vive aqui é a missão em
 * si: os pacotes da curtida (EF06CO07), os blocos da cadeia (EF06CO03), o caso
 * Mariana e os cartões, e as perguntas da plenária. Texto da copy revisada
 * (`design/06-copy-strings-revisada.md`, passada 2), com as correções do plano:
 * uma exclamação só na missão (a do Léo, na experiência).
 *
 * O que é GABARITO aqui (a ordem dos pacotes e dos blocos, o cartão certo)
 * nunca desce: o estudante recebe os itens embaralhados pela sessão, com ids
 * OPACOS, e quem confere é o servidor.
 */

// ------------------------------------------------- EF06CO07: o rastro da curtida

/**
 * A curtida (o voto do estudante) sai do celular em QUATRO pacotes numerados,
 * cada um por um caminho de equipamentos, e chega fora de ordem. A criança
 * remonta a mensagem no destino pela numeração: é a EF06CO07 ("a informação é
 * quebrada em pedaços, transmitida em pacotes através de múltiplos
 * equipamentos, e reconstruída no destino") vivida com o próprio dado.
 *
 * `trecho` é um molde: `{projeto}` e `{hashtag}` saem do voto da sessão.
 */
export const PACOTES_DA_CURTIDA = [
  {
    numero: 1,
    trecho: "De: jurado da sua turma",
    rota: ["Celular", "Wi-Fi da escola", "Provedor de internet", "Servidor da Mostra"],
  },
  {
    numero: 2,
    trecho: "Ação: voto e curtida",
    rota: ["Celular", "Wi-Fi da escola", "Torre de celular", "Provedor de internet", "Servidor da Mostra"],
  },
  {
    numero: 3,
    trecho: "Projeto: {projeto}",
    rota: ["Celular", "Wi-Fi da escola", "Roteador da cidade", "Servidor da Mostra"],
  },
  {
    numero: 4,
    trecho: "Área: {hashtag}",
    rota: ["Celular", "Wi-Fi da escola", "Provedor de internet", "Roteador da cidade", "Servidor da Mostra"],
  },
] as const;

/** Quatro pacotes, quatro vagas na remontagem. */
export const TOTAL_DE_PACOTES = PACOTES_DA_CURTIDA.length;

// ------------------------------------------------------ EF06CO03: a cadeia

/**
 * Os quatro blocos da engrenagem que controlou o feed, na ordem CERTA
 * (Interações → Dados → Algoritmo → Bolha). A ordem certa é gabarito.
 */
export const BLOCOS_DA_CADEIA = [
  { posicao: 1, rotulo: "Interações do jurado (curtidas)" },
  { posicao: 2, rotulo: "Registro de dados e padrões" },
  { posicao: 3, rotulo: "Algoritmo de recomendação" },
  { posicao: 4, rotulo: "Formação de bolha temática" },
] as const;

export const TOTAL_DE_BLOCOS = BLOCOS_DA_CADEIA.length;

// --------------------------------------------------- transferência: Mariana

export const CASO_MARIANA =
  "Na escola de Mariana, vai acontecer a eleição para o Grêmio Estudantil (a equipe de alunos que representa toda a escola). Duas chapas (equipes concorrentes de estudantes) estão disputando: a Chapa A e a Chapa B. Mariana curtiu o primeiro vídeo que viu da Chapa A. Nos dias seguintes, o feed da rede dela só mostrava vídeos e propostas da Chapa A. Mariana foi votar dizendo: \"A Chapa B nem tem projetos nem apoio, a Chapa A já ganhou.\"";

/**
 * Três cartões de MECANISMO e dois de ATITUDE; a criança escolhe um de cada.
 * `certo` é gabarito e não desce. A escolha é gravada para o professor e não
 * vira nota: a evidência da missão está nas três habilidades, não aqui.
 */
export const CARTOES_DE_MECANISMO = [
  {
    id: "m1",
    certo: true,
    texto:
      "O aplicativo usou a curtida como dado para prever preferências, criando uma bolha que ocultou as postagens da Chapa B.",
  },
  {
    id: "m2",
    certo: false,
    texto:
      "A Chapa B teve suas publicações apagadas porque seus projetos escolares não tinham qualidade suficiente para a disputa.",
  },
  {
    id: "m3",
    certo: false,
    texto: "A rede social combinou com a Chapa A de esconder a Chapa B dos celulares da escola.",
  },
] as const;

export const CARTOES_DE_ATITUDE = [
  {
    id: "t1",
    certo: true,
    texto:
      "Fazer buscas ativas pelos canais da Chapa B e conversar com colegas fora da rede antes de votar.",
  },
  {
    id: "t2",
    certo: false,
    texto: "Parar de curtir qualquer vídeo na internet e deixar o aplicativo decidir quem deve vencer.",
  },
] as const;

export const IDS_DE_MECANISMO = CARTOES_DE_MECANISMO.map((c) => c.id);
export const IDS_DE_ATITUDE = CARTOES_DE_ATITUDE.map((c) => c.id);

// --------------------------------------------- a plenária (guia do professor)

/** As quatro perguntas de contraste da mediação, projetadas no painel. */
export const PERGUNTAS_DA_PLENARIA = [
  "Quando vocês rolaram o aplicativo, tiveram a impressão de que estavam vendo todos os projetos da mostra ou apenas uma parte?",
  "Olhem para a lousa: se estávamos todos no mesmo aplicativo da mesma mostra, como a turma votou em áreas tão diferentes?",
  "O aplicativo adivinhou o gosto de vocês por mágica, ou fomos nós que demos pistas para ele a cada toque?",
  "Se duas curtidas esconderam projetos inteiros da nossa tela, o que acontece na vida real quando a gente só curte conteúdos de um mesmo lado?",
] as const;
