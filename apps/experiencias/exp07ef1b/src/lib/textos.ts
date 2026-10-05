/**
 * Só o que a TELA escreve — em português do Brasil, sempre (ADR-91). Dentro do
 * clone ficam os nomes que o Instagram usa na versão brasileira dele (`Feed`,
 * `Stories`, `Posts`); fora dele, tudo é pt-BR.
 *
 * **A fonte é o sheet congelado da missão** (`design/06-copy-strings-revisada.md`,
 * passada 2) e o texto do PO para as enquetes. Cada entrada diz a chave do
 * sheet ao lado; as que dizem **ESCRITA AQUI** são as que o sheet não tinha e
 * a tela precisou (estão listadas no `AGENTS.md` desta pasta, para o PO revisar).
 *
 * O CONTEÚDO da missão (os 12 posts, a legenda do colega, as fichas, as
 * perguntas das enquetes) NÃO mora aqui: vem da api, e corrigir uma palavra dele
 * não pode exigir republicar um caminho imutável no bucket.
 *
 * **Três vozes, e cada tela tem uma só**: a Amara (a DM, E1, E5 e as
 * enquetes), a plataforma simulada (seca, funcional — feed, salvos, Stories,
 * Mural, os avisos de rede) e a Unooria (E6 e as telas da escola). O teste de
 * `textos.test.ts` cobra que nada de E1 a E4 diga, antes da revelação, as
 * palavras que entregariam a descoberta (`TERMOS_PROIBIDOS_NA_TELA` da api).
 */

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}

// ─────────────────────────────────────────────── o clone: identidades

export const CONTAS = {
  /** `e2.ui.topbar_usuario` */
  estudante: "@estudante_gremio",
  /** ESCRITA AQUI — o sheet dá a Amara como personagem, mas não o nome da conta dela. */
  amara: "amara.gremio",
  /** ESCRITA AQUI — a linha sob o nome na conversa, como no app real. */
  amaraSubtitulo: "Ativa agora",
  /** ESCRITA AQUI — anunciado só ao leitor de tela antes de cada balão dela. */
  amaraParaLeitor: "Amara",
} as const;

// ────────────────────────────────────────────────── os avisos globais (clone)

export const GLOBAL = {
  /** `global.erro.offline` */
  offline: "Sem conexão com a rede. Suas marcações de posts foram salvas no aparelho. Reconectando ao grêmio...",
  /** `global.erro.sessao_expirada` */
  sessaoExpirada: "Sua conexão com a conta do grêmio expirou. Toque para revalidar seu acesso.",
  /** `global.ui.btn_revalidar` */
  revalidar: "Revalidar acesso",
  /** `global.ui.btn_tentar_novamente` */
  tentarNovamente: "Tentar novamente",
  /** ESCRITA AQUI — a abertura que falhou por um motivo que não é a rede. */
  naoAbriu: "Não foi possível carregar o feed agora.",
  /** Reserva da api (`sem-turma`), na voz do clone. */
  semTurma: "Sua conta do grêmio ainda não está ligada a nenhuma turma.",
} as const;

// ──────────────────────────────────────────────────── E1: o desafio (Amara)

export const E1 = {
  /** `e1.narrativa.dm_amara` */
  dmAmara:
    "Oi! Preciso de uma força rápida pra fechar a cobertura do evento de ontem na nossa comunidade pro perfil do grêmio. O feed tá cheio de matérias de três veículos locais. O seu desafio é selecionar exatamente 3 posts salvos que mostrem o que realmente aconteceu e publicar nos Stories do grêmio com uma legenda explicando a escolha. Posso contar com você?",
  /** `e1.ui.btn_abrir_feed` */
  abrirFeed: "Abrir Feed da Cobertura",
} as const;

// ───────────────────────────────────────────────────────── E2: o feed

export const E2 = {
  /** ESCRITA AQUI — o título de página que só o leitor de tela ouve. */
  tituloDaTela: "Feed da cobertura",
  /** `e2.feedback.contador_salvos` */
  contadorSalvos: (n: number) => `Posts salvos: ${n}`,
  /** `e2.ui.btn_ir_salvos` */
  irSalvos: "Ir para aba Salvos",
  /** `e2.instrucao.scaffold_inatividade` */
  dicaInatividade: "Dica: toque no ícone de marcador para salvar os posts que você quer analisar antes de publicar.",
  /** `e2.falha.midia_erro` */
  midiaErro: "Não foi possível carregar a imagem. Toque para tentar novamente.",
  /** ESCRITA AQUI — a prova social como o app escreve. */
  curtidas: (n: number) => `${n.toLocaleString("pt-BR")} ${plural(n, "curtida", "curtidas")}`,
  /** ESCRITA AQUI — os nomes acessíveis das duas abas da barra inferior. */
  abaFeed: "Feed",
  abaSalvos: "Salvos",
  /** ESCRITA AQUI — o nome acessível da barra inferior. */
  navegacao: "Navegação",
} as const;

// ─────────────────────────────────────────────── E3: a aba Salvos e a poda

export const E3 = {
  /** `e3.ui.topbar_salvos` */
  titulo: "Itens Salvos",
  /** ESCRITA AQUI — o botão de voltar da barra, só para o leitor de tela. */
  voltarAoFeed: "Voltar para o Feed",
  /** `e3.feedback.status_selecao` */
  statusSelecao: (n: number) => `${n} de 3 selecionados`,
  /** ESCRITA AQUI — o nome acessível da grade. */
  grade: "Posts salvos",
  /** Spec §14 ("Estados que a seção já suporta"), o vazio da pasta Salvos. */
  vazio: "Nenhuma publicação salva ainda",
  /** `e3.instrucao.placeholder_legenda` (o `{tema}` já com o artigo em minúscula). */
  placeholderLegenda: (tema: string) =>
    `Escreva uma legenda de Stories (1 frase) justificando por que estes 3 posts informam melhor a escola sobre ${tema}`,
  /** ESCRITA AQUI — o nome acessível do campo (o `placeholder` some no 1º caractere). */
  rotuloDaLegenda: "Legenda dos Stories",
  /**
   * `e3.feedback.aviso_excesso` — com o plural resolvido: o literal do sheet
   * com `{excesso}` = 1 escreveria "Remova 1 posts".
   */
  avisoExcesso: (n: number, excesso: number) =>
    `Você selecionou ${n} posts. Remova ${excesso} ${plural(excesso, "post", "posts")} para manter apenas os 3 mais essenciais.`,
  /** `e3.feedback.aviso_insuficiente` */
  avisoInsuficiente: "Selecione exatamente 3 posts salvos para habilitar a publicação.",
  /** `e3.feedback.aviso_legenda_curta` */
  avisoLegendaCurta: "Escreva ao menos 10 caracteres na justificativa dos Stories.",
  /** `e3.ui.btn_publicar` */
  publicar: "Publicar nos Stories",
  /** `e3.narrativa.modal_titulo` */
  modalTitulo: "Publicar no perfil do grêmio?",
  /** `e3.narrativa.modal_corpo` */
  modalCorpo: "Confirmar publicação nos Stories do grêmio? Essa ação não poderá ser desfeita.",
  /** `e3.ui.modal_btn_cancelar` */
  cancelar: "Cancelar",
  /** `e3.ui.modal_btn_confirmar` */
  confirmar: "Confirmar publicação",
  /**
   * ESCRITA AQUI — o 422 do sanitizador. O SDK não entrega o corpo do erro,
   * então os cinco motivos (link, telefone, e-mail, @, palavrão) chegam como um
   * só, e a frase nomeia os cinco na voz seca do app, sem acusar ninguém.
   */
  legendaRecusada:
    "Não foi possível publicar. Tire da legenda links, telefones, e-mails, marcações de pessoas e palavrões, e tente de novo.",
} as const;

// ──────────────────────────────────────── E3-SIS-01: a espera depois do latch

export const ESPERA = {
  /** `e3.feedback.status_publicado` */
  publicado: "Publicado! Aguardando o professor liberar o mural da turma.",
  /** `e3.instrucao.espera_desc` */
  descricao:
    "Seus Stories foram enviados para a moderação do grêmio. Aguarde o anúncio da coordenação da sala para ver as publicações da turma.",
} as const;

// ──────────────────────────────────────────────── E4: o Mural e as fichas

export const E4 = {
  /** `e4.ui.topbar_mural` — aqui, o nome acessível do Mural (a tela pico não tem barra). */
  titulo: "Mural de Stories da Turma",
  /** `e4.feedback.label_voce` */
  voce: "Sua publicação",
  /** `e4.feedback.label_colega` */
  colega: (nome: string) => `Publicação de ${nome}`,
} as const;

/*
 * A copy da FICHA TÉCNICA (E4-ALU-02) e a do CARROSSEL (E5) NÃO moram aqui:
 * estão em `textos-da-ficha.ts` e `textos-da-explicacao.ts`, que só entram em
 * chunks carregados sob demanda (`React.lazy`). As duas falam do MECANISMO — "a
 * Folha Oficial focou nas autoridades, a Voz Coletiva nos moradores…" é a
 * lente de cada veículo escrita por extenso —, e no chunk principal elas
 * estariam legíveis no DevTools antes do Mural. É o mesmo cuidado do hub com a
 * copy da moldura da exp08ef1b (`ExpHost.tsx`).
 */

// ──────────────────────────────────────── E6: a reflexão (voz da Unooria)

export const E6 = {
  /** `e6.narrativa.cabecalho` */
  cabecalho: "Reflexão Individual: O Papel do Repórter",
  /** `e6.pergunta.prompt_transferencia` */
  pergunta:
    "Imagine que um jornal de alcance nacional está cobrindo a reforma de uma escola pública no interior do estado. A equipe tem tempo para entrevistar apenas um destes três grupos: a diretoria da escola, os estudantes do grêmio ou os engenheiros da obra. Se o repórter decidir ouvir exclusivamente a diretoria, qual parte da história sobre as condições reais das salas de aula vai ficar invisível para o leitor? E como isso se conecta com a escolha que você fez nos Stories do grêmio hoje?",
  /** `e6.instrucao.privacidade` */
  privacidade: "Sua resposta é confidencial e será lida apenas pelo seu professor.",
  /** ESCRITA AQUI — o nome acessível do campo. */
  rotuloDoCampo: "Sua reflexão",
  /** `e6.instrucao.placeholder_reflexao` */
  placeholder:
    "Escreva sua reflexão analisando o que ficaria de fora e comparando com a curadoria que você fez nos Stories...",
  /** `e6.feedback.contador_chars` */
  contador: (n: number) => `${n} de 500 caracteres (mínimo de 100)`,
  /** `e6.feedback.aviso_minimo` — com o plural resolvido ("mais 1 caractere"). */
  avisoMinimo: (restante: number) =>
    `Escreva mais ${restante} ${plural(restante, "caractere", "caracteres")} para poder enviar sua reflexão.`,
  /** `e6.ui.btn_enviar` */
  enviar: "Enviar Reflexão ao Professor",
  /** Texto do PO (enquetes, passo 1): a confirmação do envio. */
  enviada: "Pronto! Sua resposta foi enviada ✓",
  /** ESCRITA AQUI — o botão que leva da confirmação à DM das enquetes. */
  continuar: "Continuar",
} as const;

// ─────────────────────────────────────────── as enquetes (de volta à Amara)

export const ENQUETE = {
  /** O rótulo do voto, o mesmo padrão do DS (`DmPoll`), dito aqui para não depender dele. */
  enviada: "Resposta enviada ✓",
  /** ESCRITA AQUI — a mensagem de encerramento da Amara, depois da segunda enquete. */
  encerramento: "Valeu pela força com a cobertura! Até a próxima.",
  /** ESCRITA AQUI — o rodapé que fecha a DM e leva à tela final. */
  fecharConversa: "Fechar conversa",
} as const;

// ─────────────────────────────────────────── as telas da escola (Unooria)

export const ESCOLA = {
  /** O fim, na voz da Unooria. `Missão concluída!` é do sheet (`e6.feedback.sucesso_conclusao`). */
  concluidaTitulo: "Missão concluída!",
  /**
   * ESCRITA AQUI — o sheet dizia "…enviada diretamente para o dashboard do seu
   * professor", mas a ordem do PO pôs as enquetes depois da reflexão, e
   * "dashboard" é o inglês que a ADR-91 tira da plataforma.
   */
  concluidaCorpo: "Sua reflexão e suas respostas foram enviadas ao seu professor.",
  /** ESCRITA AQUI — o 403 da liberação (ADR-69) ou do interruptor da rede (ADR-87). */
  indisponivelTitulo: "Esta missão ainda não está aberta para a sua turma.",
  indisponivelCorpo: "Quando o seu professor liberar, ela aparece aqui.",
  /**
   * ESCRITA AQUI — os dois avisos globais na voz da ESCOLA. Os do sheet
   * (`global.*`) são do clone ("marcações de posts", "conta do grêmio") e não
   * cabem na tela da reflexão.
   */
  offline: "Sem conexão com a internet. Assim que ela voltar, o envio continua sozinho.",
  sessao: "Sua sessão expirou. Estamos renovando o seu acesso.",
  tentarNovamente: "Tentar novamente",
} as const;
