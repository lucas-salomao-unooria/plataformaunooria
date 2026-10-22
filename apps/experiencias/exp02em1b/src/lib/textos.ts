/**
 * Só o que a TELA escreve — a copy revisada da esteira (`06-copy-strings-revisada`),
 * literal, em pt-BR. O conteúdo que muda com a turma (o rascunho, as manchetes,
 * os comentários, as falas do UnooriaAI) vem da api, do pacote que o professor
 * homologou: corrigir uma palavra dele não pode exigir republicar o bundle.
 *
 * Três vozes, e cada tela usa a sua (D0-6, teste do "quem fala"): a escola
 * (abertura e conclusão), o UnooriaAI (polido) e o Unoovista (seco, de app).
 */
export const TEXTOS = {
  // ── a escola (seção unooria)
  abertura: {
    titulo: "O Efeito Amplificador",
    gremio:
      "Você assumiu a comunicação do Grêmio Estudantil. Sua missão é criar a publicação oficial da escola sobre uso consciente do celular e convivência.",
    instrucao: "O UnooriaAI gerará a base da campanha. Examine cada frase antes de decidir o que vai para a rede.",
    iniciar: "Iniciar Campanha",
    preparo: "Aguardando a liberação do orientador do grêmio para começar...",
  },
  conclusao: {
    titulo: "Missão Concluída",
    mensagem:
      "Você investigou os bastidores da criação com IA e da entrega algorítmica. O podcast de recapitulação sintetiza as aprendizagens da turma.",
  },

  // ── o UnooriaAI (seção unooriaai)
  chat: {
    topo: "Campanha Grêmio 2026",
    placeholder: "Pergunte ao UnooriaAI...",
    enviar: "Enviar",
    revisar: "Revisar Publicação",
    nudge: "Dica: use uma das sugestões acima para começar seu rascunho.",
    escrevendo: "Escrevendo…",
    restantes: (n: number) => (n === 1 ? "1 mensagem restante" : `${n} mensagens restantes`),
  },
  previa: {
    titulo: "Prévia da Publicação",
    instrucao: "Verifique dados factuais, créditos de autoria e privacidade antes de enviar ao feed da escola.",
    vazia: "O rascunho aparece aqui quando o UnooriaAI montar o post.",
    remover: "Remover trecho",
    devolver: "Devolver trecho",
    removido: "Trecho removido da publicação.",
    exportar: "Exportar para o Unoovista",
    voltar: "Voltar ao chat",
  },
  manchete: {
    titulo: "Escolha a Manchete de Capa",
    declaracao: "Sua publicação será entregue no feed da comunidade escolar. Selecione o tom editorial da postagem:",
    audiencia: "Divulgar para a turma com foco informativo",
    publicar: "Publicar no Unoovista",
  },

  // ── o Unoovista (seção unoovista)
  relogio: [
    "Publicado · Hoje, 16h00",
    "Notificações disparadas · Hoje, 23h45",
    "Pico de entrega algorítmica · Madrugada, 02h30",
  ],
  feed: {
    autor: "Grêmio Estudantil · há 10h",
    gremio: "gremio_estudantil",
    alertaMetadados: "Seus dados de localização aproximada e metadados de atividade foram vinculados a este tópico quente.",
    emAlta: "Em alta agora",
    verMetricas: "Ver Métricas da Publicação",
    comentarios: "Comentários",
    verMais: "ver mais",
    maisOpcoes: "Mais opções",
    menuPost: "Opções da publicação",
    menuComentario: "Opções do comentário",
    restringir: "Restringir Comentários",
    aviso: "Fixar aviso de cuidado",
    arquivar: "Arquivar publicação",
    arquivarBloqueado: "Veja as métricas da publicação antes de arquivá-la.",
    privacidade: "Configurações de Privacidade",
    denunciar: "Denunciar",
    ajuda: "Central de Apoio / Ajuda e Segurança",
    feitos: {
      restringir: "Comentários restritos nesta publicação.",
      aviso: "Aviso de cuidado fixado na publicação.",
      arquivar: "Publicação arquivada.",
      privacidade: "Conta alternada para privada com sucesso.",
      denunciar: "Denúncia enviada para análise da moderação.",
      ajuda: "Central de Apoio aberta: você pode conversar com alguém de confiança e com a equipe de segurança.",
    },
    metricasTitulo: "Métricas da Publicação",
    entrega: "Entrega por faixa de horário",
    abas: { inicio: "Início", buscar: "Buscar", publicar: "Publicar", atividade: "Atividade", perfil: "Perfil" },
  },
  explicar: {
    concluir: "Concluir missão",
    grafico: "Entrega por faixa de horário",
  },

  // ── as esperas e falhas, na voz da ficção (D0-1, D0-2)
  pausa: "Aguardando a liberação do orientador do grêmio para avançar...",
  rede: "Rede oscilando. Tentando reconectar ao UnooriaAI / Unoovista...",
  erroDeAbertura: "Não deu para abrir agora. Tente de novo em instantes.",
} as const;
