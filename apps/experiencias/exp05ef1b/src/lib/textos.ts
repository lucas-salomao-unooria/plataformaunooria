import type { Polaridade, Veracidade } from "./tipos";

/**
 * A copy da TELA, verbatim do sheet congelado da missão (passada 2).
 *
 * O que NÃO está aqui: o conteúdo do grupo. As oito mensagens, o tema, os
 * remetentes e as explicações dos selos vêm da api — a professora homologa o
 * lote antes da aula, e corrigir uma palavra dela não pode exigir republicar um
 * caminho imutável no bucket.
 *
 * Tudo em pt-BR (ADR-91). E, dentro do disfarce, nada pode dizer "atividade",
 * "experimento" ou "gabarito": o estudante acha que abriu um grupo da turma, e
 * é essa premissa que a missão mede. A régua está em
 * `apps/api/src/quem-mandou-isso/invariantes.ts`.
 */

export const TEXTOS = {
  // ──────────────────────────────────────────── Etapa 1: a abertura (escola)
  contexto: {
    saudacao: (nome: string) => `Olá, ${nome}.`,
    nina:
      "A diretora pediu pra gente organizar as mensagens do grupo. Sua tarefa: leia tudo que chegou e encaminhe pro grupo 'Mural da Turma' só o que for importante de verdade pra todo mundo ficar sabendo.",
    cardTitulo: "Turma 5ºB · Canal de Comunicação",
    entrar: "Entrar no grupo",
  },

  /**
   * A missão NASCE VAZIA. Sem lote homologado não há grupo — e a frase não pode
   * culpar a professora nem denunciar o exercício: ela diz que falta pouco.
   */
  preparo: {
    titulo: "O grupo ainda está sendo organizado",
    corpo:
      "Sua turma vai começar em instantes. Deixe esta tela aberta: ela abre sozinha quando o grupo estiver pronto.",
  },

  // ─────────────────────────────────────── Etapas 2 e 3: o grupo (clone)
  grupo: {
    bannerFixo: "Leia o grupo e encaminhe para o 'Mural da Turma' o que for importante.",
    tarjaDeAdmin: "Apenas administradores podem enviar mensagens neste grupo",

    lerTranscricao: "Ler transcrição",
    ocultarTranscricao: "Ocultar transcrição",
    abrirMateria: "Abrir matéria",
    fecharMateria: "Fechar matéria",

    selecionadas: (n: number) => (n === 1 ? "1 selecionada" : `${n} selecionadas`),
    cancelarSelecao: "Cancelar seleção",
    encaminharPara: "Encaminhar para...",
    encaminhada: "Encaminhada",
    cancelar: "Cancelar",
    /**
     * O aviso de criptografia do topo do chat.
     *
     * O `EncryptionNotice` do pacote traz o texto em INGLÊS por padrão — é a
     * fala do arquivo do Figma. O WhatsApp brasileiro escreve esta frase, e é
     * ela que vale (ADR-91: dentro do disfarce, o nome que o app REAL usa em
     * português). **E ele não diz como selecionar**: ensinar o gesto aqui
     * mataria o balão de inação dos 4 minutos, que é o que mede quem travou.
     */
    avisoDeCriptografia:
      "As mensagens e as chamadas são criptografadas de ponta a ponta. Ninguém fora desta conversa pode lê-las, nem mesmo o aplicativo.",

    /** O botão inferior. Três estados, e cada um diz o que FALTA, não "não pode". */
    faltaPiso: "Selecione pelo menos 3 mensagens para abrir o Mural da Turma.",
    faltaRolagem:
      "Dê uma olhada no resto do grupo antes de decidir — ainda há mensagens mais recentes abaixo!",
    verMural: (selecionadas: number) => `Ver Mural da Turma (${selecionadas} selecionadas)`,

    /** Só depois de 4 min sem encaminhar nada. Ensina o GESTO, nunca a escolha. */
    scaffolding:
      "Você precisa escolher pelo menos 3 mensagens importantes para o Mural da Turma poder ser publicado. Toque e segure uma mensagem para começar a encaminhar.",
  },

  // ─────────────────────────────────────────────── Etapa 3: o Mural (clone)
  mural: {
    voltar: "Voltar para Turma 5ºB",
    apagar: "Apagar para todos",
    vazio:
      "Seu Mural ficou vazio desta vez. Olhe para o telão: é a escolha da turma inteira que está lá.",

    /** O card de sistema do PICO — o último momento em que dá para voltar atrás. */
    pico: "Você selecionou essas mensagens como as mais importantes. Quer confirmar o envio pro mural definitivo ou quer revisar?",
    /**
     * O caminho degenerado. Não é trava: quem quiser confirmar as oito confirma.
     * O atrito só nomeia o custo — um mural em que tudo é importante não informa
     * ninguém, e é essa a descoberta que a missão quer que ela faça sozinha.
     */
    atritoDeTudo:
      "Você encaminhou absolutamente todas as 8 mensagens do grupo. O mural da escola vai ficar lotado e confuso se tudo for importante. Tem certeza ou quer revisar antes de bater o martelo?",
    confirmar: "Confirmar envio",
    revisar: "Revisar seleção",
  },

  // ─────────────────────────────────────────── Etapa 4: a espera ativa (clone)
  espera: {
    nina:
      "Enquanto a turma termina: releia suas mensagens escolhidas. Se você tivesse que defender a mais confiável delas para a diretora agora, qual escolheria e qual detalhe nela prova isso?",
    rodape: "Aguardando o professor liberar a revelação coletiva...",
  },

  // ───────────────────────────────────────────── Etapa 5: a revelação (clone)
  revelacao: {
    selo: {
      verdadeira: "Confirmada",
      falsa: "Falsa ou distorcida",
      ambigua: "Parcialmente verdadeira",
    } satisfies Record<Veracidade, string>,

    /**
     * O denominador é quem CONFIRMOU o Mural, não a turma inteira: quem não
     * fechou a curadoria a tempo não entra na conta, porque a escolha dele
     * ainda podia ser desfeita (é o mesmo recorte de `contaDaTurma`, na api).
     * Dizer "de N estudantes" fazia a fita afirmar um denominador que a turma
     * consegue conferir na sala — trinta crianças presentes, "de 22
     * estudantes" na tela — e a professora perdia a linha do telão explicando
     * um número que o produto tinha contado errado.
     */
    metricaSocial: (x: number, confirmados: number) =>
      `Encaminhada por ${x} de ${confirmados} que confirmaram o Mural`,

    sinteseTitulo: "O que a turma escolheu",
    barraEmocionais: "Mensagens com tom de urgência",
    barraInformativas: "Comunicados informativos",

    rodape: "Aguardando o professor liberar a próxima etapa no painel da turma...",
    irParaReflexao: "Responder a última pergunta",
    /**
     * O telão acendeu antes de ela confirmar. É a única recusa desta missão que
     * a criança NÃO resolve sozinha — a janela é reaberta pela professora, com
     * "Voltar para a exploração" no painel. A frase é a mesma da api
     * (`curadoria-nao-confirmada`) de propósito: duas redações para o mesmo
     * estado fariam a tela e o servidor contarem histórias diferentes.
     */
    semConfirmacao:
      "Seu envio para o Mural não chegou a ser confirmado. Chame o professor para reabrir a seleção.",
  },

  /**
   * O card de síntese tem TRÊS redações, e isso não é enfeite.
   *
   * A redação canônica afirma que a urgência venceu. Quando a sala filtrou bem,
   * afirmá-la mesmo assim seria o card contando um resultado que não aconteceu
   * na frente da turma que produziu o contrário — e a criança que filtrou
   * direito aprenderia que a tela não olha para ela. O servidor devolve a
   * polaridade; aqui só se escolhe a frase.
   */
  sintese: (polaridade: Polaridade): string => {
    switch (polaridade) {
      case "urgencia-venceu":
        return "Mensagens com tom de urgência e emoção forte costumam ser mais encaminhadas, mesmo quando não são verdadeiras. Isso acontece porque a gente encaminha antes de checar.";
      case "informativas-venceram":
        return "Nesta turma, os comunicados calmos foram mais encaminhados que as mensagens com tom de urgência. Vocês seguraram o dedo — e isso é raro. Fora daqui, a mensagem que assusta costuma correr mais, porque a maioria encaminha antes de checar.";
      case "empate":
        return "Nesta turma, as mensagens com tom de urgência e os comunicados calmos foram encaminhados na mesma medida. Fora daqui, a que assusta costuma correr mais — porque a gente encaminha antes de checar.";
    }
  },

  // ───────────────────────────────────── Etapa 6: o dilema e o fim (escola)
  reflexao: {
    titulo: "Uma última pergunta",
    /** O rótulo do campo. O `placeholder` não serve: ele some ao digitar. */
    rotuloDoCampo: "Sua resposta",
    contador: (chars: number, teto: number, piso: number) =>
      `${chars}/${teto} caracteres (mínimo de ${piso} caracteres)`,
    placeholder: "Escreva aqui o que você faria nessa situação...",
    concluir: "Concluir Missão",
  },

  fim: {
    titulo: "Missão Concluída!",
    corpo: "Agora você sabe: antes de encaminhar, a gente checa.",
    suaResposta: "O que você respondeu",
  },

  /**
   * Os erros de abertura, na voz da FICÇÃO. Nada de "erro 500" nem "falha na
   * API": quem fala aqui é um app de mensagens, e o estudante não fez nada
   * errado em nenhum dos três casos.
   */
  erros: {
    rede: "Conectando… Sem conexão com o servidor. Suas ações serão sincronizadas assim que o sinal voltar.",
    naoLiberada: "Este grupo ainda não abriu para a sua turma. Volte daqui a pouco.",
    generico: "Estas conversas não estão disponíveis agora.",
    /**
     * A tarja que aparece DENTRO da missão quando uma ação não foi.
     *
     * Fala na voz do mensageiro, nunca na da plataforma: a criança acha que
     * está num app de conversa, e "erro 500" ou "falha na API" quebrariam a
     * ficção que a missão está medindo. `conflito` é o 409 — a professora mexeu
     * no relógio da turma enquanto ela decidia —, e ele NÃO manda tentar de
     * novo, porque tentar de novo daria o mesmo 409: o que resolve é a tela
     * andar sozinha no próximo ciclo do polling.
     */
    acaoFalhou: "Não deu para enviar agora. Toque de novo em alguns instantes.",
    conflito: "Esta conversa mudou. Aguarde um momento — a tela se atualiza sozinha.",
  },
} as const;
