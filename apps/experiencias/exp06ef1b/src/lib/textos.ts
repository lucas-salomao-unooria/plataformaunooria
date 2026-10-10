import type { Conviccao, IdDaEnquete } from "./tipos";

/**
 * Só o que a TELA escreve — em português do Brasil, sempre (ADR-91). Dentro do
 * clone ficam os nomes que o app real usa na versão brasileira dele (`Feed`,
 * `Stories`); fora dele, tudo é pt-BR.
 *
 * **A fonte é a copy do PRD v2** (`design/06-copy-strings-revisada.md`, passada
 * 2, 2026-10-10). Cada entrada diz a chave da copy ao lado; as que dizem
 * **ESCRITA AQUI** são as que a copy não tinha e a tela precisou (nome para o
 * leitor de tela, estado que a copy não previu). Estão listadas no `AGENTS.md`
 * da experiência, para o PO revisar.
 *
 * Duas regras valem sobre a copy:
 *
 * - **nenhuma taxa cravada**: o "75%" e os "12 projetos" da copy são o caso
 *   típico da saturação, não o número desta criança. A taxa e a contagem são as
 *   REAIS da sessão, vindas da api (`GaleriaSchema.invisibilidade`), na moldura
 *   da copy;
 * - **uma exclamação só na missão inteira**: a do Léo (`E5.ponteLeo`). O
 *   `textos.test.ts` conta.
 *
 * O CONTEÚDO da missão (os dezesseis estandes, as categorias e hashtags, os
 * blocos da cadeia, o caso Mariana e os cartões, as perguntas das enquetes)
 * NÃO mora aqui: vem da api, e corrigir uma palavra dele não pode exigir
 * republicar um caminho imutável no bucket.
 *
 * **Duas vozes**: a comissão da mostra dentro do Unoovista (crachá, feed,
 * cédula, espera, galeria, consulta, conclusão) e a Unooria (a cadeia com a
 * ponte do Léo, o caso Mariana e o infográfico final — PRD §10.1).
 */

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}

// ─────────────────────────────────────────────── o clone: identidades

export const CONTAS = {
  /** `e1.narrativa.emissor` — a conta da comissão (`@comissao_juri`). */
  comissao: "comissao_juri",
  /** `e2.rotulo.topbar_badge` — o crachá da criança no cabeçalho. */
  jurado: "@jurado_oficial",
} as const;

// ────────────────────────────────────────── os avisos globais (clone)

export const GLOBAL = {
  /** `e2.erro.toast_conexao` — o estado `MODO_OFFLINE_AVISO`. */
  offline: "Tentando reconectar aos servidores da Mostra Estadual...",
  /** `e3.erro.sessao_renova_msg` — o estado `MODO_SESSAO_RENOVA`. */
  sessaoExpirada:
    "Credencial de jurado suspensa momentaneamente. Atualizando sua conexão com a comissão examinadora...",
  /** `e3.erro.sessao_renova_btn` */
  revalidar: "Reconectar ao Feed",
  /** ESCRITA AQUI — a abertura que falhou por um motivo que não é a rede. */
  naoAbriu: "Não foi possível carregar a mostra agora.",
  /** ESCRITA AQUI — o botão da abertura que falhou. */
  tentarNovamente: "Tentar novamente",
  /** Reserva da api (`sem-turma`), na voz da comissão. */
  semTurma: "Sua credencial ainda não está ligada a nenhuma turma.",
  /** ESCRITA AQUI — o próximo post a caminho (região viva, sem shimmer). */
  carregando: "Carregando estandes credenciados...",
} as const;

// ───────────────────────────────────────── as telas da ESCOLA (unooria)

export const ESCOLA = {
  /** Reserva da api (`atividade-nao-preparada`): a turma sem atividade é a mesma porta fechada. */
  indisponivelTitulo: "Esta missão ainda não foi aberta para a sua turma.",
  /** ESCRITA AQUI — o 403 da liberação (ADR-69), da atividade (ADR-130) ou do interruptor da rede (ADR-87). */
  indisponivelCorpo: "Quando o seu professor liberar, ela aparece aqui.",
  /** ESCRITA AQUI — os dois avisos globais na voz da ESCOLA (os da copy são da comissão). */
  offline: "Sem conexão com a internet. Assim que ela voltar, o envio continua sozinho.",
  sessao: "Sua sessão expirou. Estamos renovando o seu acesso.",
  tentarNovamente: "Tentar novamente",
} as const;

// ────────────────────────────────────── E1-ALU-01: o crachá (clone)

export const E1 = {
  /** `e1.narrativa.modal_topo` */
  topo: "10ª Mostra Estadual de Projetos Escolares",
  /** `e1.narrativa.emissor` */
  emissor: "Notificação oficial de @comissao_juri",
  /** `e1.narrativa.corpo_cracha` — 36 palavras, literal do PO (exceção nomeada de teto). */
  corpo:
    "Sua missão como jurado é explorar o feed oficial da mostra, analisar as publicações dos projetos finalistas das escolas públicas do estado e registrar seu voto oficial no projeto que merece o Prêmio Estadual de Inovação Escolar.",
  /** `e1.rotulo.btn_entrar` */
  entrar: "Acessar Feed da Mostra",
  /** ESCRITA AQUI — o nome da timeline desfocada atrás do crachá, para o leitor de tela. */
  timeline: "Feed da mostra, aguardando o credenciamento",
} as const;

// ──────────────────────────────────────── E2: o feed e o app (clone)

export const E2 = {
  /** ESCRITA AQUI — o título de página que só o leitor de tela ouve. */
  tituloDaTela: "Feed da mostra",
  /** `e2.rotulo.topbar_marca` */
  marca: "Unoovista",
  /** `e2.rotulo.tab_feed`, `tab_busca`, `tab_notif`, `tab_perfil` */
  abaInicio: "Início",
  abaBusca: "Busca",
  abaNotificacoes: "Notificações",
  abaJurado: "Jurado",
  /** ESCRITA AQUI — o nome da barra de abas para o leitor de tela. */
  navegacao: "Navegação do app",
  /** `e2.rotulo.comentarios_desabilitados` — comentar e compartilhar respondem, e não pesam. */
  comentariosFechados: "Comentários restritos à coordenação da mostra estadual.",
  /** ESCRITA AQUI — a aba Busca antes da auditoria, na mesma voz da linha de cima. */
  buscaFechada: "Busca restrita à coordenação da mostra estadual durante o julgamento.",
  /** `e2.rotulo.btn_expandir` e `e2.rotulo.btn_recolher` */
  mais: "...mais",
  menos: "menos",
  /** `e2.instrucao.carrossel_contador` */
  foto: (atual: number) => `Foto ${atual} de 3`,
  /** ESCRITA AQUI — as setas do carrossel (o mouse não arrasta como o dedo). */
  fotoAnterior: "Foto anterior",
  proximaFoto: "Próxima foto",
  /** `e2.erro.placeholder_midia` e `e2.erro.placeholder_legenda` — o estado `PLACEHOLDER_DIEGETICO`. */
  placeholderMidia: "[Protótipo Escolar: Estande Técnico]",
  placeholderLegenda:
    "Imagem técnica do projeto em sincronização. A avaliação dos dados e do relatório da bancada segue disponível abaixo.",
  /** `e2.rotulo.btn_abrir_cedula` */
  abrirCedula: "Cédula Oficial de Votação — Jurado",
  /** Reserva da api (`feed-incompleto`), quando a cédula é pedida antes da hora. */
  feedIncompleto: "Continue avaliando os estandes do feed: a cédula abre na 10ª publicação ou aos 8 minutos.",
  /** ESCRITA AQUI — a aba Notificações: a única notificação é o crachá da comissão. */
  notificacoesTitulo: "Notificações",
  notificacaoDoCracha: "credenciou você como jurado oficial da 10ª Mostra Estadual de Projetos Escolares.",
} as const;

// ──────────────────────────────────────────── E3: a cédula (clone)

export const E3 = {
  /** `e3.instrucao.cedula_cabecalho` — o título da folha (elemento 1 de 4). */
  cabecalho: "Selecione o projeto que receberá a nota máxima e o troféu de Grande Campeão Estadual.",
  /** `e3.pergunta.certeza` (elemento 3 de 4, com as duas respostas) */
  certeza: "Você considera que avaliou com justiça os concorrentes da mostra?",
  /** `e3.rotulo.certeza_sim` e `e3.rotulo.certeza_absoluta` — as DUAS afirmam certeza, de propósito. */
  conviccao: { examinei_bem: "Sim", vi_tudo: "Com certeza" } satisfies Record<Conviccao, string>,
  /** `e3.rotulo.btn_confirmar_voto` (elemento 4 de 4) */
  confirmar: "Confirmar Voto Oficial",
  /** `e3.erro.toast_inatividade` — 60 s parado COM A CÉDULA ABERTA, no topo dela. */
  inatividade: "Jurado, a plenária aguarda seu voto para prosseguir.",
  /** `e3.narrativa.carimbo_protocolo` */
  carimbo: (protocolo: string) => `Voto Registrado e Lacrado — Protocolo #${protocolo}`,
  /** `e3.narrativa.espera_latch` */
  espera: "Aguardando o encerramento do prazo de votação da comissão de jurados.",
  /** ESCRITA AQUI — os nomes dos dois grupos para o leitor de tela. */
  grupoDosProjetos: "Projetos do seu feed",
  grupoDaCerteza: "Sua certeza",
  /** ESCRITA AQUI — o nome do brasão da espera para o leitor de tela. */
  brasao: "Brasão da Comissão Estadual",
} as const;

// ─────────────────────────────────────── E4: a Galeria Oculta (clone)

export const E4 = {
  /** `e4.narrativa.notif_comissao` */
  notificacao: "Auditoria do Feed do Jurado — Comparar com o Acervo Completo",
  /** `e4.narrativa.seu_voto_label` */
  seuVoto: "Seu Voto Lacrado:",
  /** `e4.narrativa.galeria_titulo` */
  titulo: "Galeria Oculta da Mostra",
  /** `e4.narrativa.badge_invisivel` — com a taxa REAL da sessão. */
  badge: (percentual: number) => `${percentual}% dos projetos da feira ficaram fora do seu feed`,
  /** `e4.narrativa.galeria_subtitulo` — com a contagem REAL da sessão. */
  subtitulo: (ocultos: number) =>
    ocultos === 1
      ? "Este projeto concorrente nunca foi entregue à sua tela."
      : `Estes ${ocultos} projetos concorrentes nunca foram entregues à sua tela.`,
  /** `e4.rotulo.btn_inspecionar` */
  inspecionar: "Inspecionar Projeto",
  /** ESCRITA AQUI — o nome acessível de cada miniatura. */
  inspecionarO: (titulo: string) => `Inspecionar Projeto: ${titulo}`,
  /** `e4.instrucao.modal_ficha_titulo` e `e4.rotulo.btn_fechar_modal` */
  fichaTitulo: "Ficha Técnica de Auditoria",
  voltar: "Voltar à Galeria",
  /** `e4.instrucao.busca_placeholder` */
  busca: "Pesquisar projetos ou categorias...",
  /** ESCRITA AQUI */
  limparBusca: "Limpar busca",
  hashtags: "Hashtags da mostra",
  resultados: (n: number) =>
    n === 0 ? "Nenhum projeto encontrado." : `${n} ${plural(n, "projeto encontrado", "projetos encontrados")}.`,
  /** ESCRITA AQUI — o nome das duas grades para o leitor de tela. */
  gradeOculta: "Projetos que não chegaram ao seu feed",
  gradeBusca: "Projetos encontrados",
  /** `e4.instrucao.revisao_janela` */
  revisao: "Janela Extraordinária de Revisão de Voto",
  /** `e4.rotulo.btn_manter_voto` e `e4.rotulo.btn_confirmar_revisao` */
  manter: "Manter meu voto inicial",
  confirmarRevisao: "Confirmar Voto Revisado",
  /** ESCRITA AQUI — por que "Manter" está desligado (o mesmo texto do 409 `galeria-sem-inspecao` da api). */
  manterTravado: "Inspecione ao menos um projeto que não apareceu no seu feed antes de manter o voto.",
  /** ESCRITA AQUI — a lista da troca. */
  escolhaONovo: "Escolha o projeto que recebe o seu voto agora:",
  grupoDaRevisao: "Projetos da mostra",
} as const;

// ───────────────────────────────── E5: a cadeia (ESCOLA, unooria)

export const E5 = {
  /** `e5.narrativa.ponte_leo` — a ÚNICA exclamação da missão. */
  ponteLeo: "Você viveu na prática o que Léo investigou no livro didático!",
  /** `e5.instrucao.comparacao_historico` */
  comparacao:
    "Compare o resumo gerado pelas suas curtidas com o de outro jurado que curtiu temas diferentes.",
  /** ESCRITA AQUI — os dois lados do par simulado. */
  voce: "Você",
  outroJurado: "Outro jurado",
  publicacoes: (n: number) => `${n} ${plural(n, "publicação", "publicações")}`,
  curtidas: (n: number) => `${n} ${plural(n, "curtida", "curtidas")}`,
  maisVisto: "Tema que mais apareceu",
  /**
   * `e5.instrucao.arraste_blocos`. A calha do DS (`PuzzleTrack`) é de toque
   * sequencial, sem arraste: "Ordene" serve aos dois.
   */
  instrucao: "Ordene as etapas da regra que o programa executou para montar a sua tela:",
  /** ESCRITA AQUI — a bandeja e a calha, para o leitor de tela. */
  bandeja: "Etapas da regra",
  calha: "Cadeia lógica",
  /** `e5.rotulo.btn_validar_cadeia` */
  validar: "Validar Cadeia Lógica",
  /** `e5.feedback.cadeia_correta` e `e5.feedback.cadeia_erro` — o 422 nunca diz qual vaga errou. */
  correta: "Cadeia lógica confirmada. O sistema usou suas ações como dados para prever e limitar o que você via.",
  erro: "A ordem das regras precisa de ajuste. Lembre-se: primeiro vêm suas ações, depois os dados registrados pela máquina.",
  /** ESCRITA AQUI — a calha, vaga por vaga. */
  vagaVazia: (i: number) => `Posição ${i + 1}, vazia`,
  preenchidas: (n: number, total: number) => `${n} de ${total} posições preenchidas`,
  voltou: "Voltou para a bandeja",
  /** `e5.rotulo.btn_avancar_reflexao` */
  avancar: "Continuar para a Reflexão",
} as const;

// ─────────────────────────────────── E6-ALU-01: o caso Mariana (ESCOLA)

export const E6 = {
  /** ESCRITA AQUI — o título de página que só o leitor de tela ouve. */
  tituloDaTela: "O caso de Mariana",
  /** `e6.instrucao.selecione_cartoes` */
  instrucao: "Selecione exatamente 1 explicação sobre o mecanismo e 1 atitude para furar a bolha:",
  /** ESCRITA AQUI — os nomes dos dois grupos. */
  grupoDoMecanismo: "Explicação sobre o mecanismo",
  grupoDaAtitude: "Atitude para furar a bolha",
  /** `e6.rotulo.btn_submeter_analise` */
  submeter: "Submeter Análise do Júri",
} as const;

// ──────────────────────────────── E6-ALU-02: a consulta nos Stories (clone)

export const ENQUETE = {
  /** ESCRITA AQUI — o nome da consulta (o rodapé da história e o leitor de tela). */
  titulo: "Consulta Oficial aos Jurados",
  /** `e6.b1.feedback_submissao`, `e6.b2.feedback_submissao`, `e6.b3.feedback_submissao` */
  confirmada: {
    p1: "Resposta registrada na ata do júri",
    p2: "Dados computados",
    p3: "Regra conferida",
  } satisfies Record<IdDaEnquete, string>,
  /** ESCRITA AQUI — as zonas de toque do Story e o fecho da consulta. */
  proxima: "Próxima pergunta",
  anterior: "Pergunta anterior",
  encerrar: "Encerrar consulta",
  encerrada: "Consulta aos jurados encerrada.",
} as const;

// ─────────────────────────────────────────── E6-ALU-03: a conclusão

export const FIM = {
  /** `e6.conclusao.titulo` e `e6.conclusao.subtitulo` (clone) */
  titulo: "Credenciamento de Jurado Concluído",
  subtitulo: "Relatório enviado à Comissão Estadual. Aguarde a consolidação da plenária.",
  /** `e6.conclusao.infografico_card_titulo` e `e6.conclusao.infografico_corpo` (unooria) */
  infograficoTitulo: "Como os robôs leem nossas curtidas",
  infograficoCorpo:
    "Cada curtida vira um dado. Os algoritmos agrupam esses dados para identificar padrões e prever o que prende seus olhos na tela por mais tempo. Furar a bolha exige buscar fora do feed recomendado.",
} as const;
