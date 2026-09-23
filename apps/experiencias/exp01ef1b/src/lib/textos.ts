/**
 * As strings da missão — copy FINAL da passada 2 (sheet congelado 2026-09-10).
 *
 * Regras que este arquivo carrega:
 * - Tudo que o estudante lê está em CAIXA ALTA (1º EF, alfabetização inicial).
 * - Toda instrução acionável tem par de áudio (`lib/audio.ts` resolve o id).
 * - A suíte e2e casa por texto EXATO: mudou copy aqui, muda a suíte junto.
 */
export const TEXTO = {
  e1: {
    saudacao: "VOCÊ JÁ REPAROU NAS FOTOS?",
    escolhaMarca: "ESCOLHA A SUA MARCA:",
    marcaCoruja: "CORUJA AZUL",
    marcaEstrela: "ESTRELA AMARELA",
    marcaSol: "SOL LARANJA",
    entrar: "ENTRAR NO MURAL",
    marcaPronta: "TUDO PRONTO PARA COMEÇAR!",
  },
  e2: {
    feedHeader: "@turma_mural",
    botaoCriar: "NOVA PUBLICAÇÃO",
    degenScroll: "ROLE PARA VER MAIS",
  },
  e3: {
    headerCriar: "NOVA PUBLICAÇÃO",
    selecionarFoto: "ESCOLHA UMA FOTO:",
    selecionarLegenda: "ESCOLHA UMA LEGENDA:",
    degenInacao: "QUAL FOTO CONTA A SUA HISTÓRIA?",
    compartilhar: "COMPARTILHAR",
    publicando: "PUBLICANDO...",
  },
  e4: {
    publicadoAgora: "PUBLICADO AGORA",
  },
  e5: {
    rodaConversa: "HORA DA RODA DE CONVERSA!",
    esperaDocente: "OLHE PARA O SEU PROFESSOR.",
  },
  e6: {
    sintese: "O QUE A FOTO MOSTRA?",
    opcaoLupa: "ALGUÉM ESCOLHEU O QUE MOSTRAR",
    opcaoGlobo: "A FOTO MOSTRA TUDO",
    retryGlobo: "LEMBRE DO QUE FICOU FORA!",
    badgeTitulo: "OLHAR DE DETETIVE",
    ouvirPodcast: "OUVIR O RESUMO",
    verMural: "VER MURAL DA TURMA",
  },
  err: {
    conexao: "A INTERNET DEU UMA PISCADA!",
    tentarNovamente: "TENTAR DE NOVO",
    sessao: "HORA DE RECONECTAR O MURAL!",
    reconectar: "RECONECTAR",
  },
} as const;
