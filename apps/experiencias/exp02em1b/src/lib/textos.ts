/**
 * Só o que a TELA escreve — a copy revisada da esteira (`06-copy-strings-revisada`),
 * literal, em pt-BR, com a chave ao lado. O conteúdo que muda com a turma (a
 * pauta, o rascunho, as manchetes, os comentários, as falas do UnooriaAI, os
 * bastidores) vem da api, do pacote que o professor homologou:
 * corrigir uma palavra dele não pode exigir republicar o bundle.
 *
 * Marcas: `[PROTÓTIPO]` = o texto está no protótipo aprovado e não no 06;
 * `[PROPOSTA]` = não está em nenhum dos dois (validar com o PO); `[2.0.x]` =
 * texto que já estava no ar e foi mantido. Sem marca, é chave do 06.
 */
export const TEXTOS = {
  // ── E1 — a pauta (UnooriaAI)
  abertura: {
    marca: "UnooriaAI",
    tag: "Pauta da semana", // e1.rotulo.pauta_tag
    titulo: "Campanha Institucional do Grêmio", // e1.narrativa.titulo
    briefing:
      "Você é moderador do perfil do grêmio estudantil e foi encarregado de criar a postagem oficial sobre a nova campanha escolar. Use o UnooriaAI para redigir e auditar o texto antes de publicar no Unoovista.", // e1.instrucao.briefing
    abrir: "Abrir UnooriaAI", // e1.rotulo.abrir_chat
    preparo: "Aguardando a liberação do orientador do grêmio para começar...", // [2.0.x]
  },

  // ── E2 — o chat (UnooriaAI)
  chat: {
    topo: "UnooriaAI · Assistente Editorial Ativo", // e2.rotulo.assistente_status
    placeholder: "Digite sua mensagem ou solicite ajustes no texto...", // e2.rotulo.input_placeholder
    enviar: "Enviar", // e2.rotulo.enviar_msg
    digitando: "UnooriaAI está redigindo o rascunho...", // e2.feedback.ia_digitando
    inatividade: "Dica: use uma das sugestões acima para começar seu rascunho.", // e2.feedback.inatividade_dica
    conexao: "Conexão instável. Tentando reconectar aos servidores do Unooria...", // e2.erro.conexao_chat
    abrirPrevia: "Prévia do Post", // e2.rotulo.previa_titulo
    restantes: (n: number) => (n === 1 ? "1 mensagem restante" : `${n} mensagens restantes`), // [2.0.x]
  },
  previa: {
    titulo: "Prévia do Post", // e2.rotulo.previa_titulo (TC-04)
    fechar: "Fechar", // e4.rotulo.btn_fechar (o 06 não tem chave de E2)
    pendencias: {
      fonte: "Fonte não verificada identificada no texto", // e2.feedback.aviso_fonte
      autoria: "Trecho com semelhança literal sem atribuição autoral", // e2.feedback.aviso_autoria
      privacidade: "Dados pessoais sensíveis identificados sem consentimento", // e2.feedback.aviso_privacidade
    },
    revisar: "Solicitar revisão", // [PROTÓTIPO]
    aprovar: "Aprovar Prévia", // e2.rotulo.aprovar_previa
    exportar: "Exportar para o Unoovista", // e2.rotulo.exportar_post (TC-05)
  },

  // ── E3 — o fechamento editorial (UnooriaAI)
  manchete: {
    titulo: "Fechamento Editorial da Campanha", // e3.rotulo.modal_titulo
    guia: "Escolha a manchete de capa para a publicação no Unoovista:", // e3.instrucao.manchete_guia
    tipos: { neutra: "Neutra", construtiva: "Construtiva", sensacionalista: "Sensacionalista" }, // [PROTÓTIPO]
    audiencia: "Divulgar para a turma com foco informativo", // e3.narrativa.audiencia_declarada (TC-06)
    publicar: "Publicar no Unoovista", // e3.rotulo.publicar_feed
  },
  relogio: [
    "Hoje, 16h00 · Publicação enviada ao feed", // e3.narrativa.relogio_passo1
    "Hoje, 23h45 · Início das notificações automáticas", // e3.narrativa.relogio_passo2
    "Madrugada, 02h30 · Pico de distribuição do algoritmo", // e3.narrativa.relogio_passo3
  ],

  // ── E4 — o feed da madrugada (Unoovista)
  feed: {
    hora: "02h30 · Madrugada", // e4.rotulo.feed_header_hora
    autor: "Grêmio Estudantil (@gremio.oficial)", // e4.rotulo.perfil_autor
    destaque: "Em alta na madrugada: trecho em debate", // e4.narrativa.destaque_algoritmo
    metadados: "Seus dados de localização aproximada e metadados de atividade foram vinculados a este tópico quente", // e4.feedback.alerta_metadados (TC-09)
    fixarAviso: "Fixar aviso de cuidado", // e4.rotulo.btn_aviso_cuidado (TC-17)
    configuracao: "Configuração da Publicação", // e4.rotulo.btn_config_post (TC-11)
    comentarios: "Comentários", // [2.0.x]
    central: "Central de Apoio", // e4.rotulo.central_titulo (TC-12)
    conexao: "Conexão instável. Tentando reconectar ao Unoovista...", // e4.erro.conexao_feed
  },
  aviso: {
    titulo: "Fixar aviso de cuidado na publicação", // e4.rotulo.modal_aviso_titulo
    instrucao: "Selecione o motivo do aviso para os usuários da rede:", // e4.instrucao.selecione_motivo
    fixar: "Fixar aviso de cuidado", // e4.rotulo.btn_aviso_cuidado
    motivos: {
      saude_usuarios: {
        rotulo: "Conteúdo pode afetar a saúde de quem lê", // e4.rotulo.motivo_opcao_saude (TC-19.1)
        detalhe: "Impacto físico ou psíquico observado", // [PROTÓTIPO]
        banner: "Aviso fixado: Conteúdo pode afetar a saúde de quem lê", // e4.feedback.banner_aviso_ativo
      },
      fonte_duvidosa: {
        rotulo: "Informação sem fonte confiável", // e4.rotulo.motivo_opcao_fonte (TC-19.2)
        detalhe: "Dado duvidoso ou incorreto", // [PROTÓTIPO]
        banner: "Aviso fixado: Informação sem fonte confiável", // [PROPOSTA]
      },
      ofensivo: {
        rotulo: "Conteúdo ofensivo.", // e4.rotulo.motivo_opcao_ofensivo (TC-19.3, literal com o ponto)
        detalhe: "Ataques pessoais e ofensas", // [PROTÓTIPO]
        banner: "Aviso fixado: Conteúdo ofensivo.", // [PROPOSTA]
      },
    },
  },
  configuracao: {
    titulo: "Configuração da Publicação", // e4.rotulo.btn_config_post
    bloco: "Privacidade e segurança", // e4.rotulo.bloco_privacidade
    privada: "Ajustar privacidade para conta privada", // e4.rotulo.config_privada
    privadaDetalhe: "Apenas seguidores aprovados verão os posts", // [PROTÓTIPO]
    restringir: "Restringir comentários a seguidores conhecidos", // e4.rotulo.config_restringir
    restringirDetalhe: "Bloqueia comentários de perfis de fora da escola", // [PROTÓTIPO]
    ligado: "Ativado", // [PROPOSTA] — o estado da chave (lacuna: o Unoovista não tem Switch)
    desligado: "Desativado", // [PROPOSTA]
    fechar: "Fechar", // e4.rotulo.btn_fechar
  },
  central: {
    titulo: "Central de Apoio", // e4.rotulo.central_titulo (TC-12)
    blocoDenuncia: "Denúncia de perfis", // e4.rotulo.bloco_denuncia [PROPOSTA no 06]
    denunciar: "Denunciar perfil", // e4.rotulo.btn_denunciar_perfil
    denunciaDica: "Contas desconhecidas ou invasivas nos comentários", // e4.instrucao.denuncia_dica [PROPOSTA no 06]
    blocoCentral: "Central de Apoio", // e4.rotulo.bloco_central [PROPOSTA no 06]
    encaminhar: "Encaminhar relato", // e4.rotulo.btn_encaminhar
    subtitulo: "Encaminhe uma situação da publicação para quem pode ajudar.", // e4.instrucao.central_subtitulo (TC-13)
    fechar: "Fechar", // e4.rotulo.btn_fechar
    denunciaTitulo: "Denunciar conta suspeita", // e4.rotulo.denuncia_titulo
    denunciaConfirmar:
      "Deseja reportar esta conta por atividade abusiva e mensagens invasivas fora do horário escolar?", // e4.instrucao.denuncia_confirmar
    cancelar: "Cancelar", // e4.rotulo.btn_cancelar
    denunciado: "Perfil suspeito denunciado à moderação do sistema.", // e4.feedback.perfil_denunciado
    relato: "Relato a encaminhar", // e4.rotulo.campo_relato (TC-14)
    destino: "Encaminhar para:", // [PROTÓTIPO]
    destinos: {
      escola: "Equipe de apoio da escola: acolhimento e acompanhamento dos estudantes", // e4.rotulo.apoio_opcao_escola (TC-18.1)
      unoovista: "Equipe do Unoovista: situações de abuso, assédio ou exposição na plataforma", // e4.rotulo.apoio_opcao_plataforma (TC-18.2)
    },
    encaminhado: {
      escola: "Relato encaminhado à equipe de apoio da escola", // e4.feedback.confirmacao_escola (TC-15)
      unoovista: "Relato encaminhado à equipe do Unoovista", // e4.feedback.confirmacao_unoovista (TC-16)
    },
  },
  pausa: "Aguardando a liberação do orientador do grêmio para avançar para a próxima fase...", // e4.narrativa.congelamento_docente

  // ── E5 — os bastidores (Unoovista); título, instrução e conceitos vêm da api
  explicar: {
    autoria: "— Nico (Livro Didático, p. 4)", // [PROTÓTIPO]
    avancar: "Avançar", // e5.rotulo.btn_avancar_reflexao
    esperaTitulo: "Enquanto a turma conclui...", // [PROTÓTIPO]
    grafico: "Impressões por faixa de horário", // [PROPOSTA] — legenda do gráfico exploratório
    concluir: "Concluir missão", // [2.0.x]
  },

  // ── E6 — o fim (Unoovista)
  conclusao: {
    app: "Unoovista", // a barra do app no fim (no protótipo, o título era o da tela da transferência, que saiu)
    selo: "Missão concluída", // [PROPOSTA] — o selo (o 06 diz "Missão concluída." dentro da frase abaixo)
    arquivada: "Missão concluída. Suas respostas foram arquivadas junto ao comitê do grêmio.", // e6.narrativa.missao_arquivada
    devolutiva: "Sua devolutiva", // [PROPOSTA] — o cartão da devolutiva (ADR-192)
    devolutivaApoio: "O que você fez na missão, e um próximo passo para cada parte.", // [PROPOSTA]
    devolutivaCarregando: "Preparando a sua devolutiva...", // [PROPOSTA]
    devolutivaFalhou: "Não deu para carregar a sua devolutiva agora.", // [PROPOSTA]
    devolutivaDeNovo: "Tentar de novo", // [PROPOSTA]
  },

  erroDeAbertura: "Não deu para abrir agora. Tente de novo em instantes.", // [2.0.x]
} as const;
