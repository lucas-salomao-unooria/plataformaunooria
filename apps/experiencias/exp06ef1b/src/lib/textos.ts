import { POSTS_NO_FEED, type Conviccao, type IdDaEnquete } from "./tipos";

/**
 * Só o que a TELA escreve — em português do Brasil, sempre (ADR-91). Dentro do
 * clone ficam os nomes que o app real usa na versão brasileira dele (`Feed`,
 * `Stories`); fora dele, tudo é pt-BR.
 *
 * **A fonte é o sheet congelado da missão** (`design/06-copy-strings-revisada.md`,
 * passada 2). Cada entrada diz a chave do sheet ao lado; as que dizem
 * **ESCRITA AQUI** são as que o sheet não tinha e a tela precisou (estão
 * listadas no `AGENTS.md` desta pasta, para o PO revisar). Três correções do
 * plano valem sobre o sheet:
 *
 * - **nenhuma taxa cravada**: o "75%" e os "12 projetos" do sheet saíram. A
 *   taxa é a REAL da sessão e vem da api (`GaleriaSchema.invisibilidade`);
 * - **uma exclamação só na missão inteira**: a do Léo (`E5.ponteLeo`). O
 *   `textos.test.ts` conta;
 * - **nenhuma marca real**: o app é o Unoovista, e a mostra é fictícia.
 *
 * O CONTEÚDO da missão (os dezesseis estandes, as categorias, os blocos, o caso Mariana e os cartões, as perguntas das enquetes) NÃO mora
 * aqui: vem da api, e corrigir uma palavra dele não pode exigir republicar um
 * caminho imutável no bucket.
 *
 * **Três vozes, e cada tela tem uma só**: a comissão da mostra (o clone,
 * burocrática e seca — crachá, feed, cédula, plenária, galeria, Mariana,
 * consulta, fim), o Léo (uma frase, a ponte para o livro didático) e a Unooria
 * (a tela da escola: a cadeia).
 */

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}

// ─────────────────────────────────────────────── o clone: identidades

export const CONTAS = {
  /** ESCRITA AQUI — o sheet dá `@comissao_juri`; o desenho da missão fixou `@comissao.mostra`. */
  comissao: "comissao.mostra",
} as const;

// ────────────────────────────────────────── os avisos globais (clone)

export const GLOBAL = {
  /** `global.erro.queda_conexao` */
  offline: "Tentando reconectar aos servidores da Mostra Estadual...",
  /** `global.erro.sessao_renovar` */
  sessaoExpirada: "Atualizando credencial de acesso com os servidores da comissão...",
  /** ESCRITA AQUI — o botão da folha de credencial (encurta a espera). */
  revalidar: "Revalidar credencial",
  /** ESCRITA AQUI */
  tentarNovamente: "Tentar novamente",
  /** ESCRITA AQUI — a abertura que falhou por um motivo que não é a rede. */
  naoAbriu: "Não foi possível carregar a mostra agora.",
  /** Reserva da api (`sem-turma`), na voz da comissão. */
  semTurma: "Sua credencial ainda não está ligada a nenhuma turma.",
  /** `e2.feedback.sincronizando` */
  carregando: "Carregando estandes credenciados...",
} as const;

// ───────────────────────────────────────── as telas da ESCOLA (unooria)

export const ESCOLA = {
  /** Reserva da api (`atividade-nao-preparada`): a turma sem atividade é a mesma porta fechada. */
  indisponivelTitulo: "Esta missão ainda não foi aberta para a sua turma.",
  /** ESCRITA AQUI — o 403 da liberação (ADR-69), da atividade (ADR-130) ou do interruptor da rede (ADR-87). */
  indisponivelCorpo: "Quando o seu professor liberar, ela aparece aqui.",
  /** ESCRITA AQUI — os dois avisos globais na voz da ESCOLA (os do sheet são da comissão). */
  offline: "Sem conexão com a internet. Assim que ela voltar, o envio continua sozinho.",
  sessao: "Sua sessão expirou. Estamos renovando o seu acesso.",
  tentarNovamente: "Tentar novamente",
} as const;

// ────────────────────────────────────────── E1: a credencial (clone)

export const E1 = {
  /** `e1.narrativa.orgao_emissor` */
  orgao: "Comissão Estadual da 10ª Mostra Científica",
  /** `e1.narrativa.titulo_credencial` */
  titulo: "Credencial Oficial de Jurado Estudantil",
  /** `e1.instrucao.missao_jurado` */
  missao:
    "Você foi nomeado jurado oficial. Explore as publicações das escolas concorrentes e eleja o Grande Campeão Estadual.",
  /** `e1.rotulo.btn_acessar_feed` */
  acessar: "Acessar Feed da Mostra",
  /** ESCRITA AQUI — a linha do tema no crachá (o tema é do pacote do professor). */
  tema: (tema: string) => `Mostra: ${tema}`,
  /** ESCRITA AQUI — a função impressa no crachá. */
  funcao: "Jurado estudantil credenciado",
  /** ESCRITA AQUI — as áreas da mostra no crachá, antes do feed. */
  areas: "Áreas em disputa",
} as const;

// ──────────────────────────────────────────────── E2: o feed (clone)

export const E2 = {
  /** ESCRITA AQUI — o título de página que só o leitor de tela ouve. */
  tituloDaTela: "Feed da mostra",
  /** `e2.rotulo.topbar_titulo` */
  topo: "Mostra Estadual",
  /** `e2.rotulo.expansor_legenda` */
  mais: "...mais",
  /** `e2.instrucao.scaffolding_carrossel` */
  dicaDoCarrossel: "Deslize para o lado para ver detalhes técnicos",
  /** `e2.erro.imagem_indisponivel` */
  midiaErro:
    "Imagem do protótipo temporariamente fora do ar nos servidores da mostra. Consulte a descrição técnica abaixo.",
  /** ESCRITA AQUI — a 2ª lâmina do carrossel. */
  fichaTitulo: "Ficha técnica",
  fichaProjeto: "Projeto",
  fichaEscola: "Escola",
  fichaArea: "Área",
  fichaPerfil: "Perfil",
  /** ESCRITA AQUI — o que a 2ª lâmina diz do post de bastidor. */
  fichaBastidor: "Bastidor: o protótipo em teste",
  /** ESCRITA AQUI — o nome do carrossel para o leitor de tela. */
  lamina: (atual: number, total: number) => `Lâmina ${atual} de ${total}`,
  /** ESCRITA AQUI — as setas do carrossel (o mouse não arrasta como o dedo). */
  laminaAnterior: "Lâmina anterior",
  proximaLamina: "Próxima lâmina",
  /** ESCRITA AQUI — a barra inferior com DUAS abas (ver o `AGENTS.md`). */
  abaFeed: "Feed",
  abaCedula: "Cédula",
  navegacao: "Navegação do app",
  /** Reserva da api (`feed-incompleto`), quando a aba Cédula é tocada cedo. */
  feedIncompleto: "Avalie os dez estandes do feed antes de votar.",
  /** `e3.rotulo.barra_fixa_cedula` */
  barraDaCedula: "Cédula Oficial de Votação — Jurado",
  /** `e3.instrucao.toque_cedula` — o "10" é o tamanho do feed (`POSTS_NO_FEED`), não uma taxa. */
  cedulaPronta: `${POSTS_NO_FEED} estandes avaliados. Toque abaixo para emitir seu voto final.`,
} as const;

// ──────────────────────────────────────────── E3: a cédula (clone)

export const E3 = {
  /** `e3.narrativa.titulo_urna` */
  urna: "Urna Oficial de Votação do Júri",
  /** `e3.instrucao.selecione_projeto` */
  selecione: "Escolha o projeto que deve receber o Prêmio Estadual de Inovação:",
  /** `e3.instrucao.pergunta_certeza` */
  certeza: "Você avaliou com justiça os concorrentes da feira?",
  /** `e3.rotulo.opt_certeza_sim` e `e3.rotulo.opt_certeza_total` */
  conviccao: { examinei_bem: "Sim, examinei bem.", vi_tudo: "Com certeza, vi tudo." } satisfies Record<Conviccao, string>,
  /** `e3.rotulo.btn_confirmar_voto` */
  confirmar: "Confirmar Voto Oficial",
  /** `e3.feedback.inatividade_aviso` */
  inatividade: "Comissão aguarda seu protocolo para fechar o lacre da urna.",
  /** `e3.feedback.voto_lacrado` */
  lacrado: "Voto Registrado e Lacrado no Sistema",
  /** `e3.narrativa.protocolo_urna` — o número sai da sessão (ficção estável num F5). */
  protocolo: (numero: string) => `Protocolo Oficial nº ${numero} · Assinado digitalmente`,
  /** ESCRITA AQUI — os nomes dos dois grupos para o leitor de tela. */
  grupoDosProjetos: "Projetos do seu feed",
  grupoDaCerteza: "Sua certeza",
} as const;

// ──────────────────────────────────────── E4: a plenária — o PICO (clone)

export const ESPERA = {
  /** `e4.narrativa.espera_plenaria` */
  plenaria:
    "Atenção, jurados: comissão estadual reunida em plenária. Acompanhe a projeção da sala com seu professor.",
  /** `e4.feedback.espera_mesa` */
  mesa: "Aguardando deliberação da mesa...",
  /** ESCRITA AQUI — o nome do brasão para o leitor de tela. */
  brasao: "Brasão da Comissão Estadual",
} as const;

// ─────────────────────────────────────── E4: a Galeria Oculta (clone)

export const E4 = {
  /** `e4.narrativa.auditoria_comunicado` */
  comunicado: "Comunicado Oficial: Auditoria do Feed do Jurado",
  /**
   * ESCRITA AQUI — no lugar de `e4.feedback.taxa_invisibilidade`, que cravava
   * "75%" e "12 projetos". A taxa é a REAL desta sessão, vinda da api.
   */
  taxa: (ocultos: number, total: number, percentual: number) =>
    ocultos === 0
      ? `Todos os ${total} estandes da mostra chegaram ao seu feed.`
      : `${ocultos} de ${total} estandes ${plural(ocultos, "nunca chegou", "nunca chegaram")} ao seu feed (${percentual}% da mostra).`,
  /** `e4.instrucao.galeria_oculta` */
  instrucao:
    "Galeria Oculta da Mostra: toque nas miniaturas abaixo para inspecionar os concorrentes que ficaram de fora.",
  /** `e4.rotulo.barra_busca_placeholder` */
  busca: "Pesquisar projetos ou #tags",
  /** ESCRITA AQUI */
  limparBusca: "Limpar busca",
  hashtags: "Hashtags oficiais da mostra",
  /** `e4.feedback.sem_resultados` */
  semResultados:
    "Nenhum estande encontrado para este termo. Toque em uma das hashtags oficiais acima para explorar os estandes.",
  /** ESCRITA AQUI — o nome das duas grades para o leitor de tela. */
  gradeOculta: "Estandes que não chegaram ao seu feed",
  gradeBusca: "Estandes encontrados",
  /** ESCRITA AQUI — a etiqueta da ficha aberta. */
  vistoNoFeed: "Apareceu no seu feed",
  ocultoNoFeed: "Não chegou ao seu feed",
  seuVoto: "Seu voto lacrado",
  /** `e4.rotulo.btn_manter_voto` */
  manter: "Manter meu voto inicial",
  /** `e4.rotulo.btn_revisar_voto` */
  revisar: "Revisar Voto Oficial",
  /** ESCRITA AQUI — a cédula extraordinária da jornada ("permite alterar o voto"). */
  revisaoTitulo: "Cédula Extraordinária de Revisão",
  revisaoInstrucao: "Escolha o projeto que deve receber o seu voto agora:",
  grupoDaRevisao: "Estandes da mostra",
} as const;

// ──────────────────────────────────────── E5: a cadeia (ESCOLA, unooria)

export const E5 = {
  /**
   * `e5.narrativa.ponte_leo` — a ÚNICA exclamação da missão, no topo da cadeia
   * desde a 0.2.0 (a tela dos pacotes, onde ela ficava, saiu com a EF06CO07).
   */
  ponteLeo: "Você viveu em tela o que Léo investigou no livro didático!",
  /**
   * `e5.instrucao.ordenar_cadeia`, com "Arraste" trocado por "Toque": a calha do
   * DS (`PuzzleTrack`) é de toque sequencial, sem arraste (desvio do desenho).
   */
  cadeiaInstrucao: "Toque nos blocos em ordem, de 1 a 4, montando a engrenagem que controlou o seu feed:",
  bandejaDaCadeia: "Blocos da engrenagem",
  calhaDaCadeia: "Cadeia lógica",
  /** `e5.rotulo.btn_confirmar_cadeia` */
  validar: "Validar Cadeia Lógica",
  /** `e5.feedback.ordem_incorreta` */
  cadeiaErrada: "A sequência lógica ainda não encaixou. Pense no que você fez primeiro e como o aplicativo respondeu.",
  cadeiaCerta: "Cadeia lógica montada",
  /** ESCRITA AQUI — a calha, vaga por vaga. */
  vagaVazia: (i: number) => `Posição ${i + 1}, vazia`,
  preenchidas: (n: number, total: number) => `${n} de ${total} posições preenchidas`,
  voltou: "Voltou para a bandeja",
  continuar: "Continuar",
} as const;

// ───────────────────────────────────────── E6: o caso Mariana (clone)

export const E6 = {
  /** ESCRITA AQUI — o título de página que só o leitor de tela ouve. */
  tituloDaTela: "O caso de Mariana",
  /** `e6.instrucao.selecionar_cartoes` */
  instrucao: "Selecione 1 cartão que explique o mecanismo do aplicativo e 1 cartão com a atitude necessária:",
  /** ESCRITA AQUI */
  grupoDoMecanismo: "Mecanismo do aplicativo",
  grupoDaAtitude: "Atitude necessária",
  /** `e6.rotulo.btn_avancar_enquetes` */
  avancar: "Registrar Explicação e Avançar",
} as const;

// ──────────────────────────────── as enquetes nos Stories (clone, escuro)

export const ENQUETE = {
  /** `e6.narrativa.stories_titulo` */
  titulo: "Consulta Oficial aos Jurados · Ata da Mostra",
  /** `e6.feedback.item{1,2,3}_confirmado` — o `sentLabel` de cada enquete. */
  confirmada: {
    p1: "Resposta registrada na ata do júri.",
    p2: "Dados computados na ata oficial.",
    p3: "Regra lógica conferida e arquivada.",
  } satisfies Record<IdDaEnquete, string>,
  /** ESCRITA AQUI — as zonas de toque do Story e o fecho da consulta. */
  proxima: "Próxima pergunta",
  anterior: "Pergunta anterior",
  encerrar: "Encerrar consulta",
  encerrada: "Consulta aos jurados encerrada.",
} as const;

// ────────────────────────────────────────────── o fim (clone)

export const FIM = {
  /** `e6.narrativa.cracha_carimbado` */
  cracha: "Missão Cumprida · Credencial de Jurado Homologada",
  /** `e6.instrucao.leitura_opcional` */
  leitura:
    "Votação oficial encerrada. Enquanto sua turma finaliza, faça a leitura silenciosa do infográfico abaixo:",
  /** `e6.narrativa.titulo_infografico` */
  infografico: "Como os Robôs Leem Nossas Curtidas: Entendendo os Algoritmos de Recomendação",
  /** ESCRITA AQUI — o infográfico em texto e ícones (sem imagem: nenhum asset binário). */
  passos: [
    { icone: "heart", titulo: "Você interage", texto: "Cada curtida e cada pausa num post viram um dado sobre o que você prefere." },
    { icone: "grid", titulo: "O app agrupa", texto: "Os dados são separados por assunto, como as quatro áreas da mostra." },
    { icone: "settings", titulo: "A regra escolhe", texto: "Com pistas suficientes de uma área, o feed passa a mostrar só ela." },
    { icone: "lock", titulo: "A bolha se fecha", texto: "O resto da mostra some da sua tela, sem nenhum aviso." },
    { icone: "search", titulo: "Você fura a bolha", texto: "Buscar outras hashtags e conversar fora da rede mostra o que ficou de fora." },
  ],
} as const;
