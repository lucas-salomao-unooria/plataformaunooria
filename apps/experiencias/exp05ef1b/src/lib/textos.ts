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
 *   encerramento, as falas antes das perguntas, os rótulos dos motivos e o
 *   callback do motivo — a api é quem sabe o motivo gravado;
 * - o enunciado e as alternativas das perguntas de evidência — a ficha (E14) é
 *   dona deles, e o nível de cada alternativa nunca desce.
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
    /** [novo] Só para quem votou DEPOIS de a turma passar da revelação: sai do Mural para a regra. */
    continuar: "Continuar",
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

  perguntas: {
    /** [novo] O rótulo do voto já enviado na enquete da Nina (o `Poll` desenha o tique). */
    respostaEnviada: "Resposta enviada",
  },

  conclusao: {
    /** `e6.rotulo.conclusao_titulo` */
    titulo: "Missão Concluída",
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
