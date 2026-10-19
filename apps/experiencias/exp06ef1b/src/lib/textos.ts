import type { Conviccao } from "./tipos";

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
 * - **nenhuma taxa cravada**: o "75%" e os "12 projetos" da copy eram o caso
 *   típico da saturação da 0.4.x, não o número desta criança. Desde a 0.5.0 a
 *   moldura é "X de Y estandes" — os dois números REAIS da sessão, vindos da
 *   api (`GaleriaSchema.invisibilidade`; Y é 40, ou 16 num pacote antigo) —,
 *   sem porcentagem nenhuma;
 * - **uma exclamação só na missão inteira**: a do Léo (`E5.ponteLeo`). O
 *   `textos.test.ts` conta.
 *
 * O CONTEÚDO da missão (os quarenta estandes, as categorias e hashtags, as
 * peças da regra, o caso Mariana e os cartões) NÃO mora aqui: vem da api, e corrigir uma palavra dele não pode exigir
 * republicar um caminho imutável no bucket.
 *
 * **Duas vozes**: a comissão da mostra dentro do Unoovista (crachá, feed,
 * cédula, separação, espera, galeria, conclusão) e a Unooria (a regra com a
 * ponte do Léo, o caso Mariana e o infográfico final — PRD §10.1).
 *
 * A 0.6.0 (ADR-174) tirou as enquetes e a cadeia de quatro blocos e pôs a
 * SEPARAÇÃO e a REGRA SE … ENTÃO; os textos delas são ESCRITA AQUI, levados ao
 * PO no card da missão.
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
  /**
   * ESCRITA AQUI (0.5.0) — a última lâmina do carrossel: o texto do bastidor do
   * estande (o protótipo em teste). É o título da lâmina e o nome dela para o
   * leitor de tela.
   */
  bastidor: "Bastidores do estande",
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

// ─────────────────────────── a separação, depois do voto (clone, ADR-174)

/**
 * ESCRITA AQUI (0.6.0) — a EF06CO01: a criança põe cada estande que viu numa
 * área. É ANTES da galeria, e quem pede é a comissão: nada aqui pode nomear a
 * descoberta (o teste do "antes da galeria" cobra). Sem certo/errado depois do
 * envio: o nível é do professor.
 */
export const SEPARACAO = {
  titulo: "Organize o que você viu",
  instrucao: "Antes da auditoria, a comissão quer saber como você organizaria a mostra.",
  pedido: "Para cada estande que apareceu no seu feed, escolha a área dele.",
  /** O nome acessível do grupo de áreas de cada estande. */
  areaDo: (titulo: string) => `Área do estande ${titulo}`,
  contador: (feitos: number, total: number) => `${feitos} de ${total} estandes separados`,
  enviar: "Enviar Organização à Comissão",
  enviada: "Organização registrada na ata do júri.",
} as const;

// ─────────────────────────────────────── E4: a Galeria Oculta (clone)

export const E4 = {
  /** `e4.narrativa.notif_comissao` */
  notificacao: "Auditoria do Feed do Jurado — Comparar com o Acervo Completo",
  /** `e4.narrativa.seu_voto_label` */
  seuVoto: "Seu Voto Lacrado:",
  /** `e4.narrativa.galeria_titulo` */
  titulo: "Galeria Oculta da Mostra",
  /**
   * `e4.narrativa.badge_invisivel`, REESCRITA na 0.5.0 (a decisão do PO e do
   * Lucas): "X de Y", os dois números REAIS da sessão, sem porcentagem.
   */
  badge: (ocultos: number, total: number) => `${ocultos} de ${total} estandes nunca chegaram ao seu feed`,
  /** ESCRITA AQUI (0.5.0) — o título da contagem por área. */
  porArea: "O que chegou ao seu feed, por área:",
  /** ESCRITA AQUI (0.5.0) — uma linha da contagem por área (o nome vem do pacote). */
  vistosNaArea: (nome: string, vistos: number, total: number) => `${nome}: você viu ${vistos} de ${total}`,
  /**
   * ESCRITA AQUI (0.5.0) — o CONTRASTE: o feed que esta criança teria tido sem
   * as curtidas (calculado na api). O total escondido é igual para todos; o que
   * muda é QUAL área sumiu.
   */
  semCurtidas: "Sem as suas curtidas, o seu feed teria trazido:",
  semCurtidasDaArea: (nome: string, posts: number) => `${nome} ${posts}`,
  /** `e4.narrativa.galeria_subtitulo` — com a contagem REAL da ÁREA escolhida nos chips (0.5.0). */
  subtitulo: (ocultos: number) =>
    ocultos === 0
      ? "Nenhum projeto desta área ficou fora do seu feed."
      : ocultos === 1
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
  /** ESCRITA AQUI — o nome das duas grades para o leitor de tela (0.5.0: a oculta é por área). */
  gradeOculta: (nome: string) => `Projetos de ${nome} que não chegaram ao seu feed`,
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

// ──────────────────────── E5: a regra SE … ENTÃO (ESCOLA, unooria, ADR-174)

export const E5 = {
  /** `e5.narrativa.ponte_leo` — a ÚNICA exclamação da missão. */
  ponteLeo: "Você viveu na prática o que Léo investigou no livro didático!",
  /** ESCRITA AQUI (0.6.0) — a regra no lugar da cadeia de quatro blocos. */
  instrucao: "Monte a regra que o aplicativo seguiu para escolher os próximos posts do seu feed:",
  se: "SE",
  entao: "ENTÃO",
  grupoDoSe: "SE — a condição",
  grupoDoEntao: "ENTÃO — a ação",
  enviar: "Enviar a Regra",
  /** Depois do envio: a regra que ela montou, a certa e o que a regra fez no feed DELA. */
  suaRegra: "A regra que você montou:",
  regraCerta: "A regra que o aplicativo seguiu:",
  revelacao: {
    curtidas: (hashtag: string) =>
      `Depois que você curtiu posts de ${hashtag}, o aplicativo passou a recomendar mais ${hashtag}. Uma regra simples assim pode deixar o feed menos variado.`,
    permanencia: (hashtag: string) =>
      `Você não curtiu dois posts do mesmo tema, mas parou mais tempo em ${hashtag}. O aplicativo também leva isso em conta.`,
    variado: "Seu feed ficou variado: a regra não disparou, porque nenhum tema juntou curtidas suficientes.",
  },
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
