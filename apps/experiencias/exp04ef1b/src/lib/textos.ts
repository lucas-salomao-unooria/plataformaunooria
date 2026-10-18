import type {
  DecisaoDaSimulacao,
  DecisaoDaTransferencia,
  LadoDaCondicao,
  Motivo,
  Repeticao,
  SeFalhar,
  TipoDePista,
  Veredito,
} from "./tipos";

/**
 * Só o que a TELA escreve — em português do Brasil, sempre (ADR-91).
 *
 * **A fonte é o sheet congelado da missão** (`design/06-copy-strings-revisada.md`,
 * passada 2). Cada entrada diz a chave do sheet ao lado; as que dizem
 * **ESCRITA AQUI** são as que o sheet não tinha e a tela precisou (estão
 * listadas no `AGENTS.md` desta pasta, para o PO revisar). Duas mudanças do
 * sheet são por DECISÃO, não esquecimento:
 *
 * - a pergunta `e3.modal.pergunta` saiu do modal de publicar e virou a tela de
 *   MOTIVO, depois do latch (decisão de 2026-09-25: perguntar antes anteciparia
 *   a descoberta, PDF §4);
 * - a síntese final é ÚNICA (`e6.feedback.sintese_inicial` para todos): a
 *   criança nunca sabe o nível, e a tela também não.
 *
 * **A 3.0.0 (Canal A puro, ADR-168)** tirou P1/P2 e mediu tudo por ação: o
 * "confio / não confio" na mesa, a Chave MONTADA (sem correção), a simulação e
 * o boato com "Repassar" à mão. A copy dessas telas veio do desenho do plenário
 * pedagógico; o que ele não escreveu está marcado ESCRITA AQUI.
 *
 * O CONTEÚDO da missão (as oito notícias, o texto das pistas, as reações dos
 * leitores, os blocos e os cartões da Chave, as matérias da simulação, a frase
 * de referência e o boato) NÃO mora aqui:
 * vem da api, e corrigir uma palavra dele não pode exigir republicar um caminho
 * imutável no bucket. `textos.test.ts` cobra que nada daqui use os termos que a
 * api proíbe na tela da criança (`TERMOS_PROIBIDOS_NA_TELA`).
 *
 * **Três vozes, e cada tela tem uma só**: o Bento (E1 e E5, e em nenhuma outra
 * — ele fica calado na mesa), a redação (seca, de gráfica; a simulação também
 * é dela) e a Unooria (o boato, fora da redação, numa tela NEUTRA).
 */

// ─────────────────────────────────────────────────── a redação (moldura)

export const REDACAO = {
  /** `e1.ui.topbar_nome` */
  nome: "Jornal da Escola",
  /** `e1.ui.status_edicao` */
  emEdicao: "Em Edição",
  /** ESCRITA AQUI — o nome do guia sobre o balão (o sheet o chama de Bento em todo lugar). */
  bento: "Bento",
} as const;

// ───────────────────────────────────────────────────────── E1: a abertura

export const E1 = {
  /** `e1.narrativa.bento_abertura` */
  bentoAbertura:
    "A redação recebeu 8 notícias. Temos só 3 vagas na capa. Vamos escolher matérias para informar os colegas sem espalhar confusão!",
  /** `e1.rotulo.explorar_mesa` */
  explorarMesa: "Explorar Mesa de Notícias",
} as const;

// ─────────────────────────────────────────── E2/E3: a mesa e a página

export const E2 = {
  /** `e2.ui.aba_pautas` */
  abaPautas: "Pautas da Semana",
  /** `e2.ui.aba_capa` */
  abaCapa: "Primeira Página",
  /** O indicador `0/3` da aba, como o sheet o descreve em `e2.ui.aba_capa`. */
  contagem: (n: number, total: number) => `${n}/${total}`,
  /**
   * As três vagas vazias. Os nomes são os do PRD (§5, Etapa 1); o `Vaga
   * Disponível` é `e2.rotulo.cartao_vaga`, a etiqueta sobre a caixa tracejada.
   */
  vagasVazias: [
    "Manchete Principal — Vaga Disponível",
    "Notícia Secundária A — Vaga Disponível",
    "Notícia Secundária B — Vaga Disponível",
  ] as [string, string, string],
  /** `e2.rotulo.btn_adicionar` */
  adicionar: "Adicionar ao Jornal",
  /** `e2.rotulo.btn_fechar_gaveta` — o nome do X da gaveta. */
  voltarParaMesa: "Voltar para a Mesa",
  /** ESCRITA AQUI — o texto da pista enquanto o `POST pista` não volta. */
  abrindoPista: "Abrindo a pista…",
  /** ESCRITA AQUI — o rótulo do par de botões sob a pista aberta (nomeia o grupo para o leitor de tela). */
  julgar: "Você confia nesta pista?",
  /** ESCRITA AQUI — o veredito já marcado (o primeiro vale; não muda mais). */
  marcado: (veredito: string) => `Marcado: ${veredito}`,
} as const;

/**
 * Os dois botões do julgamento — do desenho do plenário. O símbolo vai SEMPRE
 * com o texto (nunca só ✓ ou ✗): a cor e o glifo não podem ser a única pista.
 */
export const VEREDITO: Record<Veredito, string> = {
  confio: "✓ Confio",
  nao_confio: "✗ Não confio",
};

/** Os três chips da gaveta: `e2.rotulo.chip_fonte`, `chip_data`, `chip_autoria` (o emoji virou o ícone do `RevealClue`). */
export const PISTA: Record<TipoDePista, { rotulo: string; pergunta: string }> = {
  fonte: { rotulo: "Fonte", pergunta: "De onde veio?" },
  data: { rotulo: "Data", pergunta: "Quando aconteceu?" },
  autoria: { rotulo: "Autoria", pergunta: "Quem assina?" },
};

export const E3 = {
  /** `e3.rotulo.btn_trocar` */
  trocar: "Trocar Matéria",
  /** `e3.rotulo.btn_publicar1` */
  publicar1: "Publicar 1ª Edição",
  /** `DEG_SLOTS_INCOMPLETOS` — a linha sob o botão enquanto faltam vagas (o Bento fica calado: não é balão). */
  slotsIncompletos: "Precisamos preencher as 3 vagas da página para o jornal poder rodar!",
  /** `DEG_QUARTA_MATERIA` */
  quartaMateria: "A capa cabe só 3 matérias. Toque em Trocar Matéria para substituir uma notícia.",
  /** Do spec da missão — a diagramação em curso (IA ou modelo automático). */
  montando: "A redação está montando a página…",
  /** `e3.modal.titulo` */
  modalTitulo: "Confirmar Publicação da Capa",
  /**
   * ESCRITA AQUI — a linha do modal que avisa que o latch é irreversível. O
   * sheet tinha a pergunta de motivo neste lugar; ela saiu por decisão.
   */
  modalDescricao: (edicao: 1 | 2) =>
    `A ${edicao}ª edição vai para os leitores da escola e não pode mais ser trocada.`,
  /** `e3.modal.btn_confirmar` */
  distribuir: "Distribuir Jornal Agora",
  /** `e3.modal.btn_cancelar` */
  revisarMais: "Revisar mais",
} as const;

// ───────────────────────────────────── o motivo (DEPOIS do latch da 1ª)

export const MOTIVO = {
  /** `e3.modal.pergunta` — saiu do modal e virou esta tela (decisão de 2026-09-25). */
  pergunta: "Como as três matérias foram escolhidas?",
  /**
   * Os rótulos da 3.0.0, do desenho do plenário (antes: `e3.modal.opcao_visual`
   * e `e3.modal.opcao_auditada`). A pergunta não avalia nada: registra como a
   * escolha foi feita.
   */
  opcoes: {
    visual: "Escolhi porque chamou atenção",
    checagem: "Escolhi porque conferi as pistas",
  } satisfies Record<Motivo, string>,
  /** ESCRITA AQUI — o botão que envia a resposta (no sheet, a pergunta dividia o botão do latch). */
  enviar: "Enviar resposta",
} as const;

// ──────────────────────────────────────────── E4: a espera e o resultado

export const E4 = {
  /** `e4.ui.status_espera` */
  statusEspera: "Edição em Análise na Escola",
  /** `e4.espera.mensagem` */
  mensagemEspera: "Edição entregue aos leitores! Aguardando o sinal do professor para a reunião geral de pauta...",
  /** `e4.rotulo.btn_curiosidades` */
  curiosidades: "Ver Curiosidades da Imprensa",
  /** `e4.curiosidade.texto` */
  curiosidade: "O primeiro jornal impresso escolar do Brasil foi feito por estudantes há mais de cem anos!",
  /** `e4.ui.mural_titulo` */
  muralTitulo: "Mural da Escola: Edição em Circulação",
  /** `e4.feedback.indicador_factual` */
  indicador: (verificadas: number, pct: number) => `${verificadas} de 3 notícias verificadas nesta edição (${pct}%)`,
  /**
   * ESCRITA AQUI — a espera da REVISÃO, com o resultado já na tela. O sheet
   * só tinha a espera do resultado (`e4.espera.mensagem`); a decisão dos dois
   * portões criou esta segunda.
   */
  esperaRevisao: "Aguardando o professor liberar a mesa de revisão...",
} as const;

// ─────────────────────────────────────────────── E5: a Chave (o Montador)

export const E5 = {
  /** `e5.ui.titulo_ferramenta` */
  titulo: "Ferramenta de Checagem do Bento",
  /**
   * ESCRITA AQUI — a fala do Bento no Montador. A do sheet
   * (`e5.narrativa.bento_algoritmo`: "Conecte os três blocos periciais para
   * destravar…") prometia um encaixe certo, e a 3.0.0 não corrige a Chave.
   */
  bentoAlgoritmo:
    "Uma notícia bonita pode enganar. Monte a sua Chave do Editor: escolha três blocos, diga quando a pista passa ou falha e o que fazer se ela falhar.",
  /** O nome da calha — é o nome que a copy dá à ferramenta inteira. */
  chave: "Chave do Editor",
  /** O lembrete da dupla — do desenho do plenário. */
  combinem: "Combinem antes de tocar.",
  /** ESCRITA AQUI — a linha de status da calha enquanto a criança monta. */
  preenchidas: (n: number, total: number) => `${n} de ${total} vagas preenchidas`,
  /** ESCRITA AQUI — o bloco escolhido na bandeja, esperando a vaga. */
  escolhido: (rotulo: string) => `${rotulo} escolhido. Toque numa vaga para colocar.`,
  /** ESCRITA AQUI — o rótulo da bandeja (nomeia o grupo dos blocos soltos). */
  bandeja: "Blocos periciais",
  /** ESCRITA AQUI — pôr o bloco escolhido na primeira vaga livre. */
  adicionar: "Adicionar na próxima vaga",
  /** ESCRITA AQUI — o botão de uma vaga vazia quando há bloco escolhido. */
  colocarAqui: "Colocar aqui",
  /** ESCRITA AQUI — o nome acessível do botão da vaga vazia. */
  colocarNaVaga: (rotulo: string, vaga: number) => `Colocar ${rotulo} na vaga ${vaga}`,
  /** ESCRITA AQUI — a ordem de cada vaga, sobre o bloco. */
  ordem: (vaga: number) => `${vaga}º passo`,
  /** ESCRITA AQUI — o cartão de condição com o exemplo curto (os dois vêm da api). */
  cartao: (texto: string, exemplo: string) => `${texto} (ex.: ${exemplo})`,
  /** A escolha de cada cartão — do desenho do plenário (APROVA / REPROVA, em palavras de 9 anos). */
  lado: { aprova: "A pista passa", reprova: "A pista falha" } satisfies Record<LadoDaCondicao, string>,
  /** O "se esta pista falhar" de cada vaga — do desenho do plenário. */
  seFalhar: "Se esta pista falhar:",
  opcoesSeFalhar: { parar: "Não publico", seguir: "Olho a próxima pista" } satisfies Record<SeFalhar, string>,
  /** ESCRITA AQUI — o rótulo do grupo da repetição (as duas opções são do plenário). */
  repeticao: "Onde usar estes passos?",
  opcoesRepeticao: {
    todas: "Usar estes passos em TODAS as notícias",
    so_a_primeira: "Só na primeira notícia",
  } satisfies Record<Repeticao, string>,
  /** O envio — do desenho do plenário. */
  pronto: "Pronto",
  /** ESCRITA AQUI — a linha sob o "Pronto" enquanto falta escolha. */
  falta: "Escolha os três blocos e marque todas as opções para terminar a Chave.",
  /** ESCRITA AQUI — o título da confirmação. */
  confirmarTitulo: "Enviar a Chave do Editor?",
  /** O aviso da confirmação — do desenho do plenário. */
  confirmarDescricao: "Depois de enviar, a Chave não muda.",
  /** ESCRITA AQUI — os dois botões da confirmação. */
  enviar: "Enviar a Chave",
  conferir: "Voltar e conferir",
  /** ESCRITA AQUI — a Chave enviada (neutra: a tela não sabe se está certa). */
  montada: "Chave do Editor montada! A mesa de revisão está aberta.",
  /** ESCRITA AQUI — sair da Chave montada para a mesa de revisão. */
  irParaRevisao: "Abrir a Mesa de Revisão",
} as const;

// ───────────────────────────────────────────────── EREV: a revisão

export const EREV = {
  /** `erev.ui.titulo_mesa` */
  titulo: "Mesa de Revisão Pericial",
  /** `erev.ui.aviso_chave` */
  avisoChave: "A Chave do Editor marcou notícias duvidosas. Troque os furos por matérias verificadas!",
  /** `DEG_REV_INCOMPLETA` */
  incompleta: "Mantenha as 3 vagas preenchidas com matérias verificadas antes de publicar a revisão.",
  /** `erev.rotulo.btn_publicar2` */
  publicar2: "Publicar 2ª Edição Revisada",
  /**
   * ESCRITA AQUI — o texto do marcador de cada vaga (`NewspaperSlot.marker`).
   * O DS exige texto além da cor. Só aparece depois de a Chave se formar.
   */
  marcador: {
    fonte: "Fonte sem confirmação",
    data: "Fato que já passou",
    autoria: "Ninguém assina",
  } satisfies Record<TipoDePista, string>,
  /** ESCRITA AQUI — o marcador da vaga que passou na checagem. */
  verificada: "Matéria verificada",
  /** ESCRITA AQUI — a etiqueta da Chave fixada no topo da mesa. */
  chaveFixada: "Chave do Editor",
  /** `erev.ui.titulo_comparativo` */
  tituloComparativo: "Comparativo das Edições",
  /** `erev.feedback.sucesso_ed2` — o exemplo do sheet ("1 de 3 ➔ 3 de 3"), com os números da api. */
  contraste: (v1: number, v2: number) => `1ª Edição: ${v1} de 3 verificadas ➔ 2ª Edição: ${v2} de 3 verificadas!`,
  /** `erev.reacao.comunidade_grata` — só quando a 2ª edição tem as três verificadas. */
  comunidadeGrata:
    "Agora sim! As notícias da 2ª edição têm data certa, fonte clara e ajudaram todo mundo na escola!",
  /** ESCRITA AQUI — quem fala o balão da comunidade. */
  comunidade: "Comunidade da escola",
  /** O "Testar a minha Chave" — do desenho do plenário (antes, `erev.rotulo.btn_ir_reflexao`). */
  irParaSimulacao: "Testar a minha Chave",
  /** ESCRITA AQUI — o nome de cada edição no cabeçalho da página. */
  edicao: (n: 1 | 2) => `${n}ª edição`,
} as const;

// ──────────────────────────────── a simulação da Chave (a redação fala)

export const SIM = {
  /** ESCRITA AQUI — o título da tela. */
  titulo: "Teste da Chave do Editor",
  /** ESCRITA AQUI — a instrução: usar a Chave, sem dizer a ordem (a ordem é a evidência). */
  instrucao: "Use a sua Chave nas duas matérias novas e decida se cada uma vai para o jornal.",
  /** ESCRITA AQUI — o rótulo da Chave dela, mostrada como roteiro. */
  suaChave: "Sua Chave do Editor",
  /** ESCRITA AQUI — o "se falhar" de cada vaga no roteiro. */
  seFalhar: (texto: string) => `Se falhar: ${texto}`,
  /** ESCRITA AQUI — a repetição dela, sob o roteiro. */
  repeticao: (texto: string) => `Combinado: ${texto}`,
  /** ESCRITA AQUI — de qual matéria se trata. */
  materia: (n: number, total: number) => `Matéria ${n} de ${total}`,
  /** ESCRITA AQUI — a pista aberta que ainda espera a marcação (aqui ela é obrigatória). */
  marqueParaSeguir: "Marque se você confia nesta pista para seguir.",
  /** Os dois botões da decisão — do desenho do plenário. */
  decisao: { publicar: "Publicar", nao_publicar: "Não publicar" } satisfies Record<DecisaoDaSimulacao, string>,
  /** ESCRITA AQUI — o envio em curso. */
  enviando: "Registrando o teste…",
  /** ESCRITA AQUI — o título sobre a frase de referência (a mesma para todos, vinda da api). */
  referencia: "Para pensar",
  /** ESCRITA AQUI — seguir para o boato. */
  continuar: "Continuar",
} as const;

// ─────────────────────────────── E6: a transferência (a Unooria fala)

export const E6 = {
  /**
   * ESCRITA AQUI — o título da tela do boato. O do sheet ("Desafio Individual
   * de Checagem", `e6.ui.titulo_desafio`) pedia para verificar, e a tela da
   * 3.0.0 é NEUTRA: nada nela pede para conferir.
   */
  titulo: "Chegou uma mensagem",
  /** ESCRITA AQUI — o selo do balão encaminhado (o rótulo do próprio app, em português). */
  encaminhada: "Encaminhada",
  /** As duas decisões — do desenho do plenário, disponíveis desde o início. */
  decisao: {
    repassar: "Repassar para o grupo",
    nao_repassar: "Não repassar",
  } satisfies Record<DecisaoDaTransferencia, string>,
  /** ESCRITA AQUI — o nome do grupo dos dois botões. */
  oQueFazer: "O que você faz com esta mensagem?",
  /**
   * `e6.feedback.sintese_inicial` — a síntese ÚNICA, para todos (decisão: a
   * criança nunca sabe o nível, e as outras duas sínteses do sheet diriam).
   */
  sintese: "Antes de repassar qualquer aviso, pare e procure a fonte, a data e o autor para não espalhar enganos na escola.",
  /** ESCRITA AQUI — a conversa que vem depois (do desenho do plenário, a frase é desta tela). */
  conversa: "Daqui a pouco, a turma vai conversar sobre esta mensagem com a professora.",
  /** `e6.rotulo.btn_concluir` */
  concluir: "Concluir Missão",
  /** `e6.ui.modo_leitura` */
  modoLeitura: "Edição Publicada — Modo Leitura",
  /** `e6.ui.btn_ver_ed1` */
  verEd1: "Ver 1ª Edição",
  /** `e6.ui.btn_ver_ed2` */
  verEd2: "Ver 2ª Edição",
} as const;

// ───────────────────────────────────────── os erros, na voz da redação

export const ERROS = {
  /** `erro_sem_sinal` */
  semSinal: "Conexão com a gráfica oscilou. Suas matérias continuam salvas na mesa editorial!",
  /** `erro_midia_fallback` */
  midia: "Registro Informativo Transcrito: imagem temporariamente indisponível.",
  /** `erro_sessao_expirada` */
  sessaoExpirada: "Sua sessão na redação pausou. Faça login novamente para continuar de onde parou.",
  /**
   * ESCRITA AQUI — o 429 `muitas-requisicoes` (o rate limit da api), na voz da
   * redação. A chamada se repete sozinha; a frase não pode dizer que a conexão
   * caiu, porque não caiu.
   */
  muitasRequisicoes: "A gráfica está com muitos pedidos agora. Espere um instante: suas matérias continuam na mesa.",
  /**
   * ESCRITA AQUI — o 409 `rodada-mudou` (o professor zerou a turma ou trocou o
   * pacote no meio): a tela já releu a sessão sozinha e mostra a mesa nova.
   */
  rodadaMudou: "O professor atualizou a mesa de notícias. A redação continua daqui.",
  /** ESCRITA AQUI — a ação do aviso de sessão (o hub renova o token; o toque só encurta a espera). */
  tentarNovamente: "Tentar novamente",
  /** ESCRITA AQUI — a abertura que falhou por um motivo que não é a rede. */
  naoAbriu: "Não deu para abrir a redação agora.",
} as const;

/** A missão ainda não está aberta nesta turma (403) — a escola falando. ESCRITA AQUI. */
export const ESCOLA = {
  indisponivelTitulo: "Esta missão ainda não foi aberta para a sua turma.",
  indisponivelCorpo: "Quando o professor liberar o Jornal da Escola, ele aparece aqui.",
} as const;
