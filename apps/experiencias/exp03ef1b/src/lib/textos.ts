import type { Campo, Carimbo, CartaoDaInspecao, CartaoDoCaso, Dia, Etiqueta, Lugar, Pessoa, Suporte } from "./tipos";

/**
 * Tudo o que a TELA escreve, em português do Brasil (ADR-91). A fonte é o sheet
 * `design/06-copy-strings-revisada.md` (chave entre parênteses), com os ajustes
 * do PO da spec §7, que VENCEM o sheet:
 *
 * - §7.1: "aposta" → "escolha" em toda tela ("Escolha travada!" no lugar de
 *   "Escolha travada sob vidro."). `textos.test.ts` reprova "aposta" aqui;
 * - §7.3: a fala de Nina da E3 é a longa, com a instrução logo abaixo;
 * - §7.5: os três carimbos com ícone + TEXTO visíveis ("É verdade", "Não é
 *   verdade", "Não dá para saber"), no lugar da ajuda de toque longo.
 *
 * O que nem o sheet nem a spec traziam e a tela precisou está marcado
 * `ESCRITA AQUI` (o inventário no `README.md`). As falas de Nina são
 * LITERAIS: o teste compara letra por letra com o sheet.
 *
 * O conteúdo do pacote (manchetes, legendas, cartaz, fichas, ferramentas)
 * NÃO mora aqui: vem da api, porque a professora pode gerá-lo com IA.
 */

export const NINA = {
  nome: "Nina",
  /** e1.narrativa.nina */
  galeria: "Encontre as reportagens do pátio!",
  /** ESCRITA AQUI — o protótipo (E2-ALU-01) traz a fala; o sheet não tem a chave. */
  escolha: "Quais reportagens vão aparecer quando a gente filtrar por pátio?",
  /** Spec §7.3 (ajuste do PO), literal. */
  filtro:
    "A Nina sabe que existem três reportagens sobre a feira de livros da escola. Você consegue ajudá-la a encontrar, no jornal, todas as reportagens que se referem ao pátio?",
  /** e3.instrucao.nina — logo abaixo da fala (spec §7.3). */
  instrucaoDoFiltro: "Utilize o filtro para encontrar a(s) reportagem(ns) do local.",
  /** e4.narrativa.nina */
  ficha: "Uma notícia não apareceu! O que o seu filtro deixou de fora?",
  /** e4.feedback.sucesso_busca */
  sucesso: "As 3 notícias apareceram no jornal.",
  /** e4.feedback.erro_explicado */
  erro: "O pátio indica o local. Coloque no campo Onde!",
  /** e5.narrativa.ponte */
  ponte:
    "Você encontrou o que faltava nessa reportagem! Mas chegaram outras ao jornal. Será que alguma também deixou a ficha incompleta?",
  /** ESCRITA AQUI — o protótipo (E5-ALU-00) traz a linha de apoio; o sheet não. */
  ponteApoio: "Não dá para abrir ficha por ficha na mão quando o arquivo é grande. Precisamos de uma rotina automática!",
} as const;

export const CABECALHO = {
  /** O nome do jornal (o `Logo` da seção desenha a marca; este é o nome acessível). */
  jornal: "Unoojornal",
  edicaoDaFeira: "Edição especial — Feira de Livros",
  equipe: "Equipe Investigadora",
  filtroDeAcervo: "Filtro de acervo",
  /** ESCRITA AQUI — o rótulo do protótipo ("Previsão por Gesto") era anotação de design. */
  suaEscolha: "Sua escolha",
  filtroAtivo: "Filtro: Onde = Pátio",
  inspecao: "Inspeção de Cadastro",
  julgamento: "Julgamento Lógico",
  reparo: "Reparo da Ficha",
  /** e4.feedback.sucesso_titulo */
  fichaCorrigida: "Ficha corrigida com sucesso!",
  pilha: (n: number) => (n === 1 ? "Pilha: 1 ficha pendente" : `Pilha: ${n} fichas pendentes`),
  pilhaRestante: (n: number) => (n === 1 ? "Pilha: 1 ficha restante" : `Pilha: ${n} fichas restantes`),
  pilhaZerada: "Pilha: 0 fichas (finalizado)",
  painel: "Painel da Investigação",
} as const;

export const E1 = {
  /** e1.rotulo.icone_patio */
  lugar: "Pátio escolar",
  tocarNaFoto: "Toque na foto",
  /** e1.rotulo.selo_cartaz */
  selo: "Mesma feira",
  /** e1.botao.avancar */
  avancar: "Avançar",
  modalTitulo: (suporte: string) => `Inspeção de Foto-reportagem — ${suporte}`,
  /** ESCRITA AQUI (do protótipo) */
  modalApoio: "Reconheça o cartaz comum nas 3 fotos.",
  confirmar: "Confirmar Mesma Feira",
  cartazToque: "Toque no cartaz para confirmar",
  fechar: "Fechar",
  /** e1.erro.midia */
  erroMidia: "Foto indisponível no momento.",
  /** ESCRITA AQUI (do protótipo) */
  erroMidiaApoio: "O sistema da redação não conseguiu baixar a imagem.",
  /** e1.botao.retry */
  tentarCarregar: "Tentar carregar",
  faltamSelos: (n: number) => (n === 1 ? "Falta 1 cartaz para confirmar." : `Faltam ${n} cartazes para confirmar.`),
} as const;

export const E2 = {
  /** e2.rotulo.bandeja */
  bandeja: "Notícias da feira",
  caixa: "Caixa de resultados esperados",
  busca: "Pátio",
  vaga: (i: number) => `Nicho ${i + 1}`,
  vagaVazia: (i: number) => `Nicho ${i + 1}, vazio`,
  /** e2.feedback.vazia */
  vazia: "Coloque ao menos uma notícia na caixa",
  /** ESCRITA AQUI (do protótipo) */
  bandejaVazia: "Todas as 3 notícias foram colocadas na caixa.",
  /** ESCRITA AQUI — o protótipo dizia "Arraste ou toque"; a interação é só o toque (spec §0.2). */
  bandejaAjuda: "Toque numa notícia para colocar na caixa. Toque de novo para tirar.",
  esvaziar: "Esvaziar Caixa",
  /** e2.botao.travar */
  travar: "Travar Escolha",
  /** e2.feedback.travado, com o ajuste do PO (spec §7.1) */
  travada: "Escolha travada!",
  /** ESCRITA AQUI */
  travadaApoio: (n: number) => (n === 1 ? "Sua escolha: 1 notícia na caixa." : `Sua escolha: ${n} notícias na caixa.`),
  /** ESCRITA AQUI */
  esperaFiltro: "Espere a professora liberar o filtro.",
} as const;

export const E3 = {
  pastilhas: "Campos da busca",
  valoresPara: (campo: string) => `Valores para ${campo}:`,
  escolhaCampo: "Escolha um campo para filtrar.",
  escolhaValor: (campo: string) => `Selecione o valor do campo ${campo} para executar a busca.`,
  configurado: (campo: string, valor: string) => `Filtro configurado: ${campo} = ${valor}`,
  cliqueBuscar: "Toque em Buscar para consultar o jornal.",
  /** e3.botao.buscar */
  buscar: "Buscar",
  /** spec §1 / decisão 8 */
  zero: "0 notícias encontradas",
  /** ESCRITA AQUI */
  zeroApoio: "Nenhuma reportagem tem esse valor na ficha. Tente outro campo.",
  /** e3.rotulo.lista_titulo */
  encontradas: "Notícias encontradas",
  /** e3.feedback.contador */
  contador: (n: number) => (n === 1 ? "1 notícia no pátio" : `${n} notícias no pátio`),
  suaEscolha: "Sua escolha travada",
  /** ESCRITA AQUI */
  prometidas: (n: number) => (n === 1 ? "1 notícia escolhida" : `${n} notícias escolhidas`),
  metaDaNina: "Meta de Nina (as coberturas da feira)",
  presente: "Presente",
  /** e3.feedback.moldura_vazia */
  naoEncontrada: "Notícia não encontrada",
  confrontar: "Confrontar e Aguardar Turma",
  /** e3.feedback.pausa */
  conversar: "Momento de conversar com a turma!",
  /** spec §1 (E3-SIS-01), literal */
  conversarApoio: 'A professora está conduzindo o debate oral na sala: "O que o filtro olhou?".',
} as const;

export const E4 = {
  /** e4.botao.inspecionar */
  inspecionar: "Inspecionar Ficha",
  fichaTitulo: "Ficha da Reportagem",
  campo: (rotulo: string) => `Campo ${rotulo}`,
  /** e4.rotulo.campo_vazio */
  campoVazio: "Campo vazio",
  /** spec §1, literal */
  fichaEmBranco: "A foto mostra o pátio, mas a ficha está em branco!",
  /** e4.botao.avancar_carimbos */
  avancar: "Avançar",
  cartao: (id: string) => `Cartão ${id.toUpperCase()}`,
  /** ESCRITA AQUI */
  faltamCarimbos: "Carimbe os três cartões para avançar.",
  fichaDoTelao: "Ficha do Telão",
  etiquetas: "Etiquetas disponíveis",
  /** ESCRITA AQUI — o protótipo dizia "Arraste"; a interação é o toque (spec §0.2). */
  etiquetasAjuda: "Toque numa etiqueta e depois no campo da ficha. A conferência só acontece quando você tocar em Concluir.",
  colocarEm: (campo: string) => `Colocar no campo ${campo}`,
  posicionada: (rotulo: string) => `${rotulo} (posicionada)`,
  /** ESCRITA AQUI */
  escolhaEtiqueta: (rotulo: string) => `${rotulo} escolhida. Toque num campo da ficha para colocar.`,
  /** e4.botao.concluir */
  concluir: "Concluir",
  /** ESCRITA AQUI */
  faltamEtiquetas: "Coloque as três etiquetas na ficha para concluir.",
  /** e4.feedback.erro_previa */
  previa: "Veja como ficariam as 3 notícias completas:",
  /** spec §1 (E4-05), literal */
  previaApoio:
    "Com o campo Onde preenchido, a busca pelo local encontra todas as coberturas do pátio no jornal escolar.",
  recuperada: "Recuperada",
  correto: "Pátio (correto)",
  /** e4.botao.continuar_sucesso / continuar_erro */
  continuar: "Continuar",
} as const;

export const E5 = {
  /** e5.botao.continuar */
  continuar: "Continuar",
  bandeja: "Blocos disponíveis (desorganizados)",
  /** ESCRITA AQUI — o protótipo dizia "Organize"; o toque está escrito. */
  bandejaAjuda: "Toque num bloco e depois numa vaga da esteira. Toque num bloco encaixado para devolver.",
  esteira: "Esteira da rotina",
  esteiraExecutando: "Esteira da rotina (executando)",
  vagaVazia: (i: number) => `Vaga ${i + 1}: tocar para colocar`,
  /** ESCRITA AQUI */
  escolhido: (rotulo: string) => `${rotulo}: escolhido. Toque numa vaga da esteira.`,
  /** ESCRITA AQUI */
  faltam: (n: number) => (n === 1 ? "Falta 1 bloco na esteira." : `Faltam ${n} blocos na esteira.`),
  /** e5.botao.testar_rotina */
  testar: "Testar Rotina",
  executando: "Executando simulação...",
  fichaEmTeste: (i: number, total: number) => `Ficha em teste (passo ${i} de ${total})`,
  ondeVazio: "Onde: vazio",
  ondePreenchido: "Onde: preenchido",
  marcaOk: "Marcar: ok",
  marcaRevisar: "Marcar: revisar",
  /** spec §1, literal */
  sucessoTitulo: "Rotina testada com sucesso!",
  sucessoTexto:
    "A pilha chegou a zero e a máquina parou exatamente na hora certa. A ficha incompleta recebeu a bandeira de revisão!",
  irParaCaso: "Ir para o Caso Novo",
  /** e5.erro.laco_infinito */
  erroTitulo: "A rotina não para. Revise os blocos!",
  /** spec §1, literal */
  erroTexto: "O computador continuaria rodando sem fim porque falta a condição de parada. Vamos reorganizar?",
  /** e5.botao.reorganizar */
  reorganizar: "Reorganizar",
} as const;

export const E6 = {
  /** e6.rotulo.manchete_caso — o tema vem da api; este é o rótulo de reserva. */
  caso: "Festival de Ciências",
  ferramentas: "Ferramentas da investigação",
  avancar: "Avançar",
  /** e6.rotulo.painel_titulo */
  painel: "Painel da Investigação",
  /** e6.feedback.concluido */
  concluida: "Investigação concluída!",
  colunas: ["1. Suportes", "2. Omissão", "3. Reparo", "4. Automação"] as const,
  /** ESCRITA AQUI — o resumo da PRÓPRIA sessão, nas palavras do protótipo. */
  suportes: (n: number) =>
    `3 coberturas identificadas com selo "mesma feira". Sua escolha: ${n === 1 ? "1 notícia" : `${n} notícias`}.`,
  omissao: (encontradas: number, deFora: string) =>
    `A busca Onde = Pátio encontrou ${encontradas} de 3. A do ${deFora} ficou de fora: o filtro buscou no campo, e não na imagem.`,
  reparoSucesso: "Campo Onde preenchido com a etiqueta Pátio.",
  reparoErro: "O pátio indica o local: o lugar dele é o campo Onde.",
  automacao: (testes: number) =>
    `Rotina condicional testada com parada exata (${testes === 1 ? "1 teste" : `${testes} testes`}).`,
  /** spec §1, literal */
  somenteLeitura: "Modo somente-leitura. Os dados foram salvos e travados para a professora.",
  /** e6.botao.desafio_extra */
  desafioExtra: "Desafio Extra",
  /** ESCRITA AQUI */
  desafioApoio: "Duas fichas para olhar com calma. Nada aqui é gravado.",
  fechar: "Fechar",
} as const;

/** Os cartões-afirmação (perguntas da spec §1; a figura do `conteudo.ts` da api). Sem o certo. */
export const CARTOES: Readonly<Record<CartaoDaInspecao | CartaoDoCaso, { figura: string; pergunta: string }>> = {
  k1: { figura: "Foto do telão + Pátio", pergunta: "A foto mostra o pátio?" },
  k2: { figura: "Campo Onde + Pátio", pergunta: "A ficha diz pátio?" },
  k3: { figura: "Campo Onde + Pátio + selo NÃO", pergunta: "A ficha NÃO diz pátio?" },
  k4: { figura: "As duas fotos do Festival", pergunta: "As duas fotos tratam do Festival?" },
  k5: { figura: "Festival + calendário de sexta", pergunta: "O Festival foi na sexta-feira?" },
  k6: { figura: "Campo Quando + calendário de sábado", pergunta: "A ficha diz que foi no sábado?" },
};

/** Spec §7.5: as três opções visíveis, ícone + texto. Sem cor de certo ou errado. */
export const ROTULO_DO_CARIMBO: Readonly<Record<Carimbo, string>> = {
  v: "É verdade",
  x: "Não é verdade",
  duvida: "Não dá para saber",
};

export const ROTULO_DO_CAMPO: Readonly<Record<Campo, string>> = { quem: "Quem", onde: "Onde", quando: "Quando" };

export const ROTULO_DO_SUPORTE: Readonly<Record<Suporte, string>> = {
  mural: "Mural Impresso",
  portal: "Portal da Escola",
  telao: "Telão do Corredor",
};

/** O nome curto do suporte (as molduras da Meta de Nina e as fotos do desfecho). */
export const NOME_CURTO_DO_SUPORTE: Readonly<Record<Suporte, string>> = {
  mural: "Mural",
  portal: "Portal",
  telao: "Telão",
};

export const ROTULO_DO_VALOR: Readonly<Record<Lugar | Pessoa | Dia, string>> = {
  patio: "Pátio",
  biblioteca: "Biblioteca",
  quadra: "Quadra",
  estudantes: "estudantes",
  professores: "professores",
  familias: "famílias",
  visitantes: "visitantes",
  segunda: "segunda",
  terca: "terça",
  quarta: "quarta",
  quinta: "quinta",
  sexta: "sexta",
  sabado: "sábado",
};

/** O campo de cada etiqueta do reparo — só para o ÍCONE dela (não é o gabarito: a criança põe onde quiser). */
export const ICONE_DA_ETIQUETA: Readonly<Record<Etiqueta, Campo>> = { patio: "onde", estudantes: "quem", sexta: "quando" };

export const GLOBAL = {
  /** e3.erro.sem_sinal */
  semSinal: "Sem sinal. Anotações salvas na mesa.",
  reconectar: "Reconectar",
  /** ESCRITA AQUI */
  sessao: "A redação está conferindo seu acesso. Um instante.",
  /** ESCRITA AQUI */
  pausa: "A professora pausou a turma. Espere ela retomar.",
  /** ESCRITA AQUI — a abertura que falhou, na voz do jornal. */
  naoAbriu: "Não deu para abrir o jornal agora. Tente de novo em instantes.",
  tentarNovamente: "Tentar de novo",
  /** ESCRITA AQUI — a porta fechada fala pela escola. */
  indisponivelTitulo: "Esta missão ainda não foi aberta para a sua turma.",
  indisponivelTexto: "Quando a professora liberar, ela aparece aqui.",
  /** ESCRITA AQUI */
  rodadaNova: "A professora começou de novo. O jornal voltou para o começo.",
} as const;
