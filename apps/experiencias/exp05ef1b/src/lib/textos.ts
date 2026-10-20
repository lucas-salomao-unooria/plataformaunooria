/**
 * A copy que a TELA escreve, verbatim de `design/06-copy-strings-revisada.md`
 * (a canônica, passada 2) — a chave do sheet vai no comentário de cada uma.
 *
 * O que NÃO está aqui, de propósito, porque vem da api:
 *
 * - o conteúdo do grupo (as oito mensagens, o tema, os remetentes) — é o pacote
 *   que o professor aprovou, e corrigir uma palavra dele não pode exigir
 *   republicar um caminho imutável no bucket;
 * - as falas da Nina que dependem do servidor (o convite leva o `{tema}`), o
 *   encerramento, o desafio do tio, os rótulos dos motivos e o callback do
 *   motivo — a api é quem sabe o motivo gravado;
 * - os pedidos do alerta e os rótulos do quadro, os blocos do robô (rótulo e
 *   ícone), as quatro mensagens que o robô recebe e o que ele fez com cada uma
 *   — o tipo de cada ação e a expressão esperada de cada pedido são o
 *   gabarito, e não descem.
 *
 * Os textos marcados **[Figma]** são os das telas E4-ALU-01 e E6-ALU-01/02 do
 * wireframe de 20/10 (chaves e4.alerta_* e e6.* da proposta do PO).
 *
 * Tudo em pt-BR (ADR-91). Os textos marcados **[novo]** não existem no sheet:
 * foram escritos nesta frente e esperam a revisão do PO.
 */

export const TEXTOS = {
  // ───────────────────────────────────────── Etapa 1: lista e chat da Nina
  lista: {
    /** `e1.rotulo.app_titulo` */
    titulo: "WhatsApp",
    /** `e1.rotulo.aba_conversas` */
    abaConversas: "Conversas",
    /** `e1.rotulo.chat_nina_nome` */
    nina: "Nina",
    /** `e1.narrativa.chat_nina_preview` */
    previaDaNina: "Preciso da sua ajuda! Rolou uma...",
    /**
     * [novo] A missão NASCE VAZIA: sem pacote aprovado não há Nina nem grupo, e
     * a lista fica vazia com esta linha. Não culpa o professor nem denuncia o
     * exercício — diz que falta pouco e que não é para sair.
     */
    grupoEmPreparo:
      "O grupo da turma ainda está sendo organizado. Deixe esta tela aberta: a conversa chega aqui quando ele estiver pronto.",
  },

  nina: {
    /** [novo] A linha de presença do app real, em pt-BR. */
    presenca: "online",
    /** `e1.rotulo.convite_subtitulo` */
    conviteSubtitulo: "Convite para grupo de conversa",
    /** `e1.rotulo.entrar_grupo` */
    entrarNoGrupo: "Entrar no grupo",
    /** [novo] O placeholder do campo inerte: o do pacote vem em inglês ("Type a message"). */
    campo: "Mensagem",
  },

  // ─────────────────────────────────────────────── Etapa 2: o grupo (clone)
  grupo: {
    /** [novo] O nome acessível do "digitando…" de um colega no grupo. */
    digitando: (nome: string) => `${nome} está digitando`,
    /** `e2.rotulo.grupo_subtitulo` — "você e mais 24 participantes". */
    participantes: (outros: number) =>
      outros === 1 ? "você e mais 1 participante" : `você e mais ${outros} participantes`,
    /** `e2.feedback.sistema_entrou` */
    entrou: "Você entrou usando o link de convite deste grupo",
    /** `e2.instrucao.banner_topo` */
    banner: "Encaminhe 3 mensagens para o Mural da Turma",
    /** `e2.rotulo.contador_selecao` — o texto inteiro vai à região viva; na faixa fica só "N/3". */
    contador: (n: number) => `Mensagens selecionadas para o Mural: ${n}/3`,
    contadorCurto: (n: number) => `${n}/3`,
    /** `e2.feedback.rodape_bloqueado` */
    soAdmins: "Apenas administradores podem enviar mensagens",
    /** `e2.rotulo.botao_avancar_mural` */
    irParaOMural: "Ir para o Mural da Turma",
    /** `e2.instrucao.microbanner_inatividade` — depois de 90 s sem encaminhar. */
    apoioDaNina:
      "Nina está esperando as 3 mensagens no Mural da Turma. Toque na seta ao lado das bolhas para escolher.",
    /** `e2.erro.toast_menor_3` */
    faltamMensagens: "Você precisa selecionar exatamente 3 mensagens antes de continuar.",
    /** `e2.erro.toast_limite_3` */
    limiteAtingido: "Limite de 3 mensagens atingido. Desmarque uma mensagem para escolher outra.",
    /** [novo] Nome acessível da seta de cada balão (o `ForwardButton` exige `label`). */
    encaminharDe: (remetente: string) => `Encaminhar mensagem de ${remetente}`,
    /** [novo] Nome acessível do toque que abre o comunicado ou a prévia em tela cheia. */
    abrirMidiaDe: (remetente: string) => `Abrir mídia de ${remetente}`,
  },

  midia: {
    /** `e2.rotulo.modal_fechar` */
    fechar: "Fechar",
    /** `e2.acessibilidade.modal_alt_comunicado` */
    altDoComunicado: "Imagem de comunicado escolar em papel timbrado com carimbo e assinatura",
    /** [novo] O `alt` de cada desenho de imagem (`regras.ts#estiloDaImagem`). */
    alt: {
      comunicado: "Imagem de comunicado escolar em papel timbrado com carimbo e assinatura",
      cartaz: "Imagem de cartaz colorido com um aviso em letras grandes",
      print: "Imagem de print de tela de uma publicação na internet",
      bilhete: "Imagem de bilhete escrito à mão em papel pautado",
    },
    /** `e2.feedback.midia_reserva_texto` — a transcrição do comunicado. */
    transcricao: (texto: string) => `Texto do comunicado: ${texto}`,
    /** [novo] A transcrição dos outros desenhos, que não são comunicado. */
    transcricaoDaImagem: (texto: string) => `Texto da imagem: ${texto}`,
  },

  folha: {
    /** `e2.rotulo.sheet_titulo` */
    titulo: "Encaminhar para...",
    /** `e2.rotulo.sheet_destino` */
    destino: "Mural da Turma",
    /** `e2.rotulo.sheet_subdestino` */
    subdestino: "Conversa com a professora",
    /** `e2.rotulo.sheet_confirmar` */
    enviar: "Enviar",
  },

  // ──────────────────────────────────────── Etapa 3: o Mural e a enquete
  mural: {
    /** `e3.rotulo.mural_titulo` */
    titulo: "Mural da Turma",
    /** `e2.rotulo.sheet_subdestino`, reusado como a presença do cabeçalho. */
    presenca: "Conversa com a professora",
    /** `e3.rotulo.tag_encaminhada` */
    encaminhada: "Encaminhada",
    /** `e3.instrucao.revisao_aviso` */
    confira: "Confira as 3 mensagens escolhidas antes de confirmar o envio.",
    /** `e3.rotulo.botao_revisar` */
    revisar: "Revisar seleção no grupo",
    /** `e3.rotulo.botao_confirmar` */
    confirmar: "Confirmar envio",
  },

  enquete: {
    /** `e3.pergunta.enquete_titulo` — as opções vêm da api (`opcoes.motivos`). */
    pergunta: "O que mais te fez escolher essas mensagens?",
    /** `e3.rotulo.enquete_votar` */
    votar: "Votar",
  },

  espera: {
    /** `e3.feedback.espera_titulo` */
    titulo: "Mensagens entregues no Mural da Turma",
    /** `e3.feedback.espera_descricao` */
    descricao: "Você terminou esta etapa. Aguarde a orientação do professor para a revelação.",
    /** `e3.feedback.espera_status` */
    status: "Suas escolhas foram registradas com sucesso.",
  },

  // ─────────────────────────────────────────────── Etapa 4: a revelação
  revelacao: {
    /** `e4.rotulo.motivo_declarado` */
    motivoDeclarado: (motivo: string) => `Seu motivo declarado: ${motivo}`,
    /** `e4.rotulo.cracha_*` — o pictograma é a forma que distingue, a cor não. */
    veracidade: {
      verdadeira: { icone: "✅", rotulo: "Verdadeira" },
      falsa: { icone: "❌", rotulo: "Falsa" },
    },
    tom: {
      emocional: { icone: "🔥", rotulo: "Emocional" },
      neutra: { icone: "💬", rotulo: "Neutra" },
    },
    /**
     * O resumo de duas barras da turma (sala sem projetor). Os rótulos são os
     * do telão (`e4.professor.telao_*`), de propósito: a criança e o telão
     * falam da mesma conta com as mesmas palavras.
     */
    termometro: {
      titulo: "Termômetro da Turma — Como a sala compartilhou",
      falsaNeutra: "Mensagens falsas repassadas que tinham formato sério ou neutro",
      falsaNeutraValor: (p: number) => `${p}% da turma repassou`,
      verdadeiraEmocional: "Mensagens verdadeiras descartadas por parecerem exageradas",
      verdadeiraEmocionalValor: (p: number) => `${p}% da turma descartou`,
    },
  },

  // ───────────────────────────────────────────────── Etapa 5: a síntese
  sintese: {
    /** `e5.instrucao.infografico_titulo` */
    titulo: "O gatilho do compartilhamento",
    /** `e5.narrativa.infografico_sintese` */
    frase:
      "A velocidade do repasse não mede a verdade da notícia. A desinformação não se espalha porque as pessoas querem mentir, mas porque a embalagem da mensagem (urgência, autoridade aparente, indignação ou calma técnica) desarma nosso filtro de checagem.",
    /**
     * As quatro embalagens e o filtro, desenhados na lâmina. As palavras são as
     * da própria `frase` — o desenho não diz nada que o texto não diga.
     */
    embalagens: ["urgência", "autoridade aparente", "indignação", "calma técnica"],
    filtro: "filtro de checagem",
    /** [novo] O texto alternativo da lâmina desenhada. */
    altDaLamina:
      "Lâmina “O gatilho do compartilhamento”: urgência, autoridade aparente, indignação e calma técnica desarmam o filtro de checagem.",
    /** `e5.narrativa.infografico_callback` */
    callback:
      "Vocês não estão descobrindo isso agora: desde o começo do bimestre vocês treinam duas ferramentas pra essa hora — comparar com uma fonte confiável e não deixar a emoção apertar o botão por você. Foi isso que usamos, ou esquecemos de usar, no Mural da Turma.",
    /** `e5.feedback.trava_debate` */
    trava: "Participe da conversa na sala. O professor liberará a atividade final em instantes.",
  },

  // ────────────────────── Etapa 4: o alerta do grupo (EF05CO03), no clone
  alerta: {
    /** [Figma] A faixa que abre o alerta, depois dos crachás. */
    faixa: "Alerta do grupo · Role para montar os alertas ↓",
    /** [Figma] */
    titulo: "Alerta do grupo",
    /** [Figma] */
    contador: (n: number, total: number) => `Alerta ${n} de ${total}`,
    /** [Figma] A instrução, só no primeiro pedido. */
    instrucao:
      "Monte o filtro do pedido e toque em Ver resultado. As mensagens que passam ficam destacadas. Quando achar que está certo, envie o alerta ao grupo.",
    /** [Figma] */
    quadro: "Mensagens do grupo",
    /** [Figma] O crachá de quem encaminhou ao Mural. */
    voceEnviou: "Você enviou",
    /** [novo] A etiqueta de quem passou no filtro executado — a forma, não a cor, é que diz. */
    destacada: { icone: "🔦", rotulo: "Destacada" },
    /** [Figma] */
    montar: "Destacar mensagens que são:",
    /** [Figma] O interruptor antes de cada condição, e os dois chips. */
    nao: "NÃO",
    atributo: { falsa: "Falsa", emocional: "Emocional" },
    /** [Figma] Os conectores. */
    conector: { E: "E", OU: "OU" },
    /** [novo] Os nomes acessíveis de cada grupo de chips. */
    primeiraCondicao: "Primeira condição",
    segundaCondicao: "Segunda condição",
    ligacao: "Juntar com outra condição",
    /** [Figma] A dica fixa do OU (em português "ou" costuma soar exclusivo). */
    dicaOu: "OU vale se uma das partes for verdadeira, ou as duas.",
    /** [Figma] */
    verResultado: "Ver resultado",
    /** [Figma] */
    enviar: "Enviar alerta ao grupo",
    /** [Figma] */
    executeAntes: "Toque em Ver resultado antes de enviar o alerta.",
    /** [Figma] */
    passam: (n: number) => (n === 1 ? "1 mensagem passa no filtro." : `${n} mensagens passam no filtro.`),
    /** [Figma] */
    execucao: (k: number, total: number) => `Execução ${k} de ${total}`,
    /** [novo] Esgotou as execuções do pedido. */
    semExecucoes: "Você já viu o resultado 3 vezes. Envie o alerta ao grupo.",
    /** [Figma] A bolha enviada ao grupo. */
    bolhaTitulo: "⚠ Alerta do grupo",
    bolha: (referencias: readonly string[]) =>
      referencias.length === 0
        ? "Nenhuma mensagem destacada."
        : `${referencias.length} ${referencias.length === 1 ? "mensagem destacada" : "mensagens destacadas"}: ${referencias.join(", ")}.`,
    /** [Figma] Depois do 4º. */
    enviados: "Alertas enviados.",
    /** [novo] O professor apresentou a síntese antes dos quatro. */
    fechou: "O alerta do grupo fechou.",
  },

  // ────────────────────────── Etapa 6: o robô do grupo (EF05CO04), na casca
  robo: {
    /** [Figma] */
    etapa: "Etapa 6 · Refletir",
    /** [Figma] */
    comando: "Monte o robô do grupo para as mensagens não passarem sem checar. Depois, ligue e veja o que ele faz.",
    /** [Figma] O título da calha. */
    cabeca: "🤖 Cabeça do robô",
    /** [Figma] As legendas das vagas, em ordem (laço, SE, ENTÃO, E DEPOIS). */
    vagas: {
      laco: "PARA CADA mensagem nova (opcional)",
      condicao: "SE a mensagem for…",
      acao1: "ENTÃO o robô…",
      acao2: "E DEPOIS (se quiser)…",
    },
    /** [Figma] O que falta em cada vaga vazia (lido também pelo leitor de tela). */
    vazias: {
      laco: "Toque no laço 🔁 para encaixar (opcional)",
      condicao: "escolha a condição",
      acao1: "escolha uma ação",
      acao2: "ação 2 (opcional)",
    },
    /** [novo] O nome acessível de cada vaga vazia. */
    vagaVazia: (legenda: string, falta: string) => `${legenda} ${falta}, vazia`,
    /** [Figma] A bandeja. */
    blocos: "Blocos",
    repeticao: "Repetição",
    condicoes: "Condição (SE)",
    acoes: "Ação (ENTÃO, até 2 em ordem)",
    /** [Figma] */
    pronto: "Seu robô está pronto para ligar.",
    /** [Figma] */
    ligar: "Ligar o robô",
    /** [Figma] */
    faltaParaLigar: "Escolha uma condição e uma ação para ligar.",
    /** [novo] Esgotou as ligações. */
    semLigacoes: "Você já ligou o robô 5 vezes. Envie o seu robô.",
    /** [Figma] */
    ligado: (k: number, total: number) => `Robô ligado · ${k} de ${total}`,
    /** [Figma] */
    chegando: "As mensagens chegam uma a uma. O robô age em cada uma.",
    /** [Figma] */
    olhando: "Olhando esta mensagem…",
    aguardando: "Chegando…",
    /** [Figma] O tipo do áudio ao lado de quem mandou. */
    audio: "áudio",
    /** [Figma] A mensagem sem sinal (a de controle). */
    semSinais: "sem sinais de alerta",
    /** [novo] O nome acessível da linha do que o robô fez. */
    oRobo: "🤖",
    /** [Figma] */
    mudar: "Mudar o robô",
    /** [Figma] */
    enviar: "Enviar meu robô",
  },

  conclusao: {
    /** `e6.rotulo.conclusao_titulo` */
    titulo: "Missão Concluída",
    /** [Figma] O card do robô enviado. */
    cardTitulo: "Seu robô do grupo",
    /** [Figma] */
    registrado: "Seu robô foi registrado e enviado ao professor.",
    /** `e6.instrucao.conclusao_rodape` */
    rodape: "Você completou todas as etapas desta missão no Unooria Hub.",
  },

  // ───────────────────────────────────────── as falhas, na voz da ficção
  erros: {
    /** `e2.erro.offline_cabecalho` — no lugar da presença do cabeçalho, como o app real. */
    conectando: "Conectando...",
    /** `e2.erro.sessao_expirada_modal` */
    sessaoExpirada: "Sua conexão expirou. Toque para reconectar.",
    /** [novo] A ação da janela de sessão expirada. */
    reconectar: "Reconectar",
    /** [novo] Um envio que não saiu por falta de rede (o toast do app). */
    naoEnviou: "Não foi possível enviar. Verifique a conexão e tente de novo.",
    /** [texto da v1] A porta da sala (ADR-69) ou a disponibilidade (ADR-87), na abertura. */
    naoLiberada: "Este grupo ainda não abriu para a sua turma. Volte daqui a pouco.",
    /** [texto da v1] O resto: nada de "erro 500" dentro de um app de mensagens. */
    indisponivel: "Estas conversas não estão disponíveis agora.",
  },
} as const;
