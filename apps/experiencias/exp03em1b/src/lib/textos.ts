/**
 * Só o que a TELA escreve — a copy revisada da esteira
 * (`design/06-copy-strings-revisada`), literal, em pt-BR, com a chave ao lado.
 * O que muda com a turma (o recorte do grupo, a tabela, a nota técnica, as
 * camadas, as reações) e os textos FIXOS da missão (o bot, o laudo, a
 * perícia, a conclusão) vêm da api, em `sessao.conteudo` e `sessao.textos`:
 * corrigir uma palavra deles não pode exigir republicar o bundle.
 *
 * Marcas: `[PROTÓTIPO]` = está no protótipo aprovado (`08-prototipo.html`) e
 * não no 06; `[PROPOSTA]` = em nenhum dos dois (validar com o PO). Sem marca,
 * é chave do 06.
 *
 * A cota é escrita de UM jeito só ("Publicações Oficiais Disponíveis: N/3"):
 * o 06 tinha três ("Publicações: 3/3", "Publicações Disponíveis: 2/3",
 * "Cota: 2/3"), e o plano aprovado unificou.
 */
export const TEXTOS = {
  erroDeAbertura: "Não foi possível abrir a missão. Recarregue a página ou chame o professor.", // [PROPOSTA] fora do clone (antes do handshake)

  aparelho: { bateria: "85%" },
  semConexao: "Sem conexão com o servidor municipal. Suas seleções estão salvas neste aparelho.", // e3.banner.offline

  // ── E1-ALU-01 — a lista de conversas
  lista: {
    app: "Unoochat", // e1.header.titulo
    abas: { conversas: "Conversas", arquivados: "Arquivados" }, // [PROTÓTIPO]
    ontem: "Ontem", // [PROTÓTIPO]
    espera: "Aguarde a liberação da atividade da sala.", // = api erros#atividade-nao-preparada
    novaDoAssistente: "Atenção, Porta-Voz: ERRATA TÉCNICA CORRETIVA disponível.", // [PROPOSTA] a prévia da lista na E4b
  },

  cota: (n: number) => `Publicações Oficiais Disponíveis: ${n}/3`, // e1.header.cota_inicial (TC-03) e e4.header.cota_pos_envio (TC-09), unificadas — nome acessível do chip
  cotaCurta: (n: number) => `Publicações: ${n}/3`, // [PROTÓTIPO] o chip visível do cabeçalho (E1-ALU-02/E3-ALU-01)

  // ── E1-ALU-02 a E2 — o chat do Assistente
  assistente: {
    presenca: "assistente oficial do programa", // [PROTÓTIPO], sem o inglês (ADR-91)
    nudgeDigitando: "Assistente de Dados está digitando", // [PROPOSTA] nome acessível do TypingIndicator
    tituloDaTabela: "Registros Consolidados da Subprefeitura", // [PROTÓTIPO]
    colPeriodo: "Período", // e2.rotulo.col_periodo
    colIndicador: "Índice de Conformidade", // e2.rotulo.col_indicador
    ampliar: "Visualização Ampliada", // e2.rotulo.btn_lupa
    voltarDaTabela: "Voltar à conversa", // [PROPOSTA] o rótulo da seta do MediaViewer
    /* e2.rotulo.anexo_meta, partido em dois: o `MessageBubble.Document` põe os
       detalhes NA LINHA do nome (e o nome encolhe até sumir com detalhe longo);
       ali vai só o tamanho, e a procedência vira a legenda do balão. */
    anexoDetalhes: ["PDF", "42 KB"],
    anexoProcedencia: "Documento Oficial · Subprefeitura Municipal",
    abrirAnexo: (arquivo: string) => `Abrir ${arquivo}`, // [PROPOSTA] nome acessível
    concluirLeitura: "Concluir Leitura do Anexo", // e2.sheet.btn_fechar
    gerarPrevias: "Gerar Prévias das Escalas", // [PROTÓTIPO], sem o inglês (ADR-91)
    exibindo: (escala: string) => `Exibindo: ${escala}`, // [PROTÓTIPO]
    abrirCompositor: "Abrir Compositor de Publicação", // e2.acao.avancar_composicao
    erroDoGrafico: "Boletim visual indisponível temporariamente. Os registros numéricos estão preservados.", // e2.erro.svg_titulo
    recarregarGrafico: "Recarregar renderização visual", // e2.erro.svg_recarregar
    voltarAsConversas: "Voltar às conversas", // [PROPOSTA] nome acessível da seta
  },

  // ── E3 — o compositor
  compositor: {
    titulo: "Monte seu Boletim Oficial", // e3.header.compositor, trocado pelo Lucas (29/10)
    tituloDaErrata: "Monte sua Errata Oficial (Publicação 2 de 3)", // e4.header.errata_compositor, sem o inglês (ADR-91) e no tom do título da 1ª
    tagErrata: "Errata", // [PROTÓTIPO] "Prévia: ERRATA TÉCNICA OFICIAL"
    avisoDaErrata:
      "Seleções da 1ª publicação pré-carregadas. Altere o que julgar necessário para reparar a clareza pública. O original permanecerá no histórico do comitê.", // [PROTÓTIPO]
    escala: "Origem do Eixo Vertical (Eixo Y):", // e3.rotulo.seletor_escala
    opcoes: { zero: "0–100%", oitenta: "80–100%" }, // [PROTÓTIPO]
    camadas: {
      explicacao: "Anotação de escala", // e3.toggle.rotulo_escala
      fonte: "Fonte dos dados", // e3.toggle.rotulo_fonte
      contexto: "Contexto da oscilação", // e3.toggle.rotulo_contexto
    },
    explicacaoSemEscala: "Anota a origem do eixo escolhida acima.", // [PROPOSTA] antes de escolher a escala
    previa: "Prévia ao vivo do boletim oficial:", // e3.rotulo.previa_ao_vivo
    previaSemEscala: "Escolha a origem do eixo vertical para gerar a prévia.", // [PROPOSTA] decisão 5 (sem escala pré-marcada)
    encaminhar: "Gerar Artefato Final e Encaminhar ao Grupo Público", // e3.acao.encaminhar (TC-07)
    publicarErrata: "Publicar Errata Corretiva", // e4.acao.confirmar_errata
    pularErrata: "Avançar sem publicar errata", // e4.acao.desistir_errata (TC-19)
    confirmar: {
      titulo: "Confirmar Envio Oficial Irreversível", // e3.modal.titulo
      corpo:
        "Atenção: Esta ação gastará 1 de suas 3 publicações oficiais no grupo da cidade. Mensagens encaminhadas não podem ser editadas ou excluídas. Deseja publicar?", // e3.modal.alerta_corpo (TC-08)
      corpoDaErrata:
        "Atenção: Esta ação gastará a 2ª de suas 3 publicações oficiais no grupo da cidade. A errata entra abaixo do boletim original, que permanece no histórico. Mensagens encaminhadas não podem ser editadas ou excluídas. Deseja publicar?", // [PROPOSTA] o equivalente do TC-08 para o slot 2
      ok: "Confirmar Envio", // e3.modal.btn_confirmar
      revisar: "Revisar Parametrização", // e3.modal.btn_cancelar
      gravando: "Gravando no Comitê...", // [PROTÓTIPO] processando envio
    },
  },

  // ── E4 — o grupo da cidade
  grupo: {
    presenca: "48 membros · canal oficial", // [PROTÓTIPO]
    hoje: "Hoje", // [PROTÓTIPO]
    autoria: "Porta-Voz Oficial da Escola", // e4.badge.autoria_aluno
    boletim: "Boletim Técnico Oficial", // [PROTÓTIPO] "BOLETIM TÉCNICO OFICIAL"
    digitando: (quem: string) => `${quem} está digitando`, // [PROPOSTA] nome acessível
    aguardeOrientacoes: "Aguarde orientações.", // e4.faixa.pausa_docente, sem o gênero de quem conduz
    abrirAssistente: "Abrir mensagem do Assistente de Dados", // [PROPOSTA] decisão 7: quem chega ao Aha depois da retomada
    irAoLaudo: "Prosseguir para o Laudo de Auditoria", // [PROPOSTA] depois da errata publicada
    conversa: "Conversa", // [PROPOSTA] nome acessível da área que rola
  },

  // ── E5 — o laudo (Unooria)
  laudo: {
    marca: "Laudo técnico", // [PROPOSTA] a etiqueta da escola
    metrica: "Fator de Mentira", // [PROTÓTIPO] "Fator de Mentira de Tufte (Lie Factor)", sem o inglês (ADR-91)
    metricaDescricao: (visual: string, real: string) => `Variação visual ${visual} ÷ variação real ${real}`, // [PROPOSTA]
    comoCalcula: "Como o fator é calculado", // [PROPOSTA]
    leitura: (origem: string, fator: string) => `Com o eixo em ${origem}%, o Fator de Mentira é ${fator}.`, // [PROPOSTA] leitura viva da régua
    valorDaRegua: (v: number) => `Eixo em ${v}%`, // [PROPOSTA]
  },

  // ── E6 — a perícia
  pericia: {
    presenca: "canal público de transmissão", // [PROTÓTIPO]
    verDados: "Ver dados e fonte", // e6.cartao.acao_dados_a/b
    retornar: "Retornar aos Cartões", // e6.sheet.fechar
    fonte: (f: string) => `Fonte: ${f}`, // [PROPOSTA]
    colPeriodo: "Período", // [PROTÓTIPO] E6-ALU-02
    colOcorrencias: "Ocorrências", // [PROPOSTA] o dado que o protótipo não tabulava
    colTaxa: "Taxa por 100 mil hab.", // [PROTÓTIPO] E6-ALU-02
    populacao: (porPeriodo: string) => `População de referência — ${porPeriodo}`, // [PROPOSTA]
  },

  // ── E6-ALU-03 — a conclusão (Unooria)
  conclusao: {
    titulo: "Protocolo Pericial Encerrado", // [PROTÓTIPO]
    texto: "Suas decisões como Porta-Voz e Auditor foram registradas no sistema municipal com sucesso.", // [PROTÓTIPO]
  },

  // ── a instrução ao lado do aparelho (hub, fora do clone) — [PROPOSTA] todas
  instrucao: {
    abertura: { antes: "Você é Porta-Voz Oficial de Dados da escola. Abra a conversa com o ", destaque: "Assistente de Dados", depois: "." },
    dados: {
      antes: "Inspecione a tabela e, se quiser, a nota técnica anexada. Depois, ",
      destaque: "gere as prévias das escalas",
      depois: " e abra o compositor.",
    },
    compositor: {
      antes: "No compositor, escolha a ",
      destaque: "origem do eixo vertical",
      depois: " e as camadas que acompanham o boletim. O envio ao grupo é irreversível.",
    },
    feed: { antes: "Acompanhe a reação do ", destaque: "grupo da cidade", depois: " ao seu boletim." },
    errata: {
      antes: "O Assistente de Dados liberou o ",
      destaque: "2ª publicação",
      depois: ": publique uma errata ou avance sem publicar.",
    },
    laudo: { antes: "Arraste a régua e veja o ", destaque: "Fator de Mentira", depois: " mudar com a origem do eixo." },
    pericia: { antes: "Inspecione os dois cartões eleitorais e ", destaque: "emita seu parecer técnico", depois: "." },
    pausa: { antes: "", destaque: "Sessão pausada pela Coordenação", depois: ": acompanhe o debate em sala." },
  },
} as const;
