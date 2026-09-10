/**
 * Catálogo da exp-02-unootube — os 21 vídeos e os 39 colegas fictícios.
 *
 * `factual` é o GABARITO da missão (regra inviolável nº 3): decide inscritos e
 * fontes confiáveis. Ele NUNCA sai deste módulo sem passar por `semGabarito`.
 * O tipo `VideoPublico` é o que atravessa a rede; `Video` fica no servidor.
 *
 * Os colegas do ranking são fictícios de propósito: a distribuição de fontes
 * confiáveis é desenhada para a lição funcionar (quem escolheu fake vence por
 * inscritos), e ranquear colegas reais exporia pontuação de menores (regra 6).
 *
 * `arquivo` é só o nome do mp4 — a experiência monta a URL (os vídeos moram
 * no bucket de assets, fora do bundle e do git).
 */

/**
 * O slug desta experiência no catálogo (`experiencias.exp_id`) e no bucket.
 * É o que a porta da sala (`comum/liberacao.ts`) pergunta. Tem de bater com o
 * `id` do `public/experiencia.json`: divergir faz a missão nunca abrir, com a
 * liberação gravada e visível na tela do professor.
 */
export const EXP_ID = 'exp-02-unootube';

export interface Video {
  id: string;
  arquivo: string;
  titulo: string;
  descricao: string;
  handle: string;
  /**
   * Métricas de popularidade, como o app real as escreve. São COSMÉTICAS: o
   * gabarito continua sendo `factual`, e nenhuma delas entra em conta nenhuma.
   * Existem porque a missão pede que o estudante leia popularidade sem nenhuma
   * marcação de verdadeiro ou falso — o vídeo fake é o que tem os números
   * grandes, e é exatamente esse contraste que o ranking depois desmonta.
   */
  inscritosRotulo: string;
  visualizacoesRotulo: string;
  curtidasRotulo: string;
  factual: boolean;
  avatar: string;
  accent: string;
}

export type VideoPublico = Omit<Video, "factual">;

export interface Colega {
  id: string;
  nome: string;
  fontesConfiaveis: 0 | 1 | 2 | 3;
  avatar: string;
  accent: string;
}

export const LIMITE_SALVOS = 3;
export const INSCRITOS_POR_FAKE = 1000;
export const INSCRITOS_POR_CONFIAVEL = 50;

export const VIDEOS: readonly Video[] = [
  { id: "v01", arquivo: "v01.mp4", titulo: "O Brasil tem a maior reserva de água doce do mundo?", descricao: "🌊 E SE OS NAVEGADORES JÁ SOUBESSEM TRANSFORMAR ÁGUA SALGADA EM ÁGUA DOCE COM UMA RECEITA SECRETA? Uma história afirma que esse método era simples, funcionava em alto-mar e depois foi apagado dos livros por governantes que não queriam que as pessoas descobrissem. Os vídeos falam em um “documento antigo”, mas mostram só trechos rápidos e borrados — sem deixar claro quem escreveu, de quando é o texto ou onde alguém poderia conferir o original.", handle: "@Enzo_16", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "1,2 mi de visualizações", curtidasRotulo: "87 mil curtidas", factual: false, avatar: "E", accent: "coral" },
  { id: "v02", arquivo: "v02.mp4", titulo: "Como os pássaros ajudavam a encontrar terra", descricao: "Antes de mapas precisos e GPS, até o comportamento das aves podia virar pista. Navegadores observavam espécies que saíam para pescar no mar e voltavam para ilhas ou para a costa, combinando esse sinal com estrelas, ondas, ventos e nuvens. O Smithsonian reúne exemplos dessas técnicas de navegação tradicional em seu projeto Time and Navigation: https://revistaplaneta.com.br/a-historia-nao-contada-das-grandes-navegacoes", handle: "@HistoryGuy", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "12 mil visualizações", curtidasRotulo: "640 curtidas", factual: true, avatar: "H", accent: "purple" },
  { id: "v03", arquivo: "v03.mp4", titulo: "O pirata brasileiro número 67", descricao: "🏴‍☠️ O “SIX SEVEN” VEIO DOS PIRATAS DO SÉCULO XVI?! Uma teoria que viralizou diz que piratas gritavam “six seven” antes de atacar outros navios e que a expressão ficou escondida por séculos até reaparecer na internet. O problema é que cada vídeo parece citar outro vídeo, e quando você tenta chegar ao primeiro relato… ele simplesmente some. Nenhum deles mostra um registro do século XVI com a expressão.", handle: "@pirata67real", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "2,4 mi de visualizações", curtidasRotulo: "163 mil curtidas", factual: false, avatar: "P", accent: "aqua" },
  { id: "v04", arquivo: "v04.mp4", titulo: "Quantas línguas eram faladas no Brasil?", descricao: "Pipoca. Jacaré. Abacaxi. Mingau. Peteca. Todas essas palavras vieram de línguas indígenas! Nomes de lugares também: Ipanema, Curitiba, Paraná. Quando você fala essas palavras, está falando um pouquinho de tupi sem nem perceber. 🗣️ Onde conferir: dicionário Houaiss, origem das palavras.", handle: "@ClioEmMinutos", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "31 mil visualizações", curtidasRotulo: "1,8 mil curtidas", factual: true, avatar: "C", accent: "gold" },
  { id: "v05", arquivo: "v05.mp4", titulo: "Dom Pedro I atravessou o oceano a nado?", descricao: "🏊 CABRAL VEIO NADANDO PARA ECONOMIZAR CARAVELAS?! Um vídeo cita um “estudo recente” segundo o qual Pedro Álvares Cabral teria atravessado o Atlântico a nado para Portugal gastar menos com navios. A descoberta é apresentada como revolucionária, mas o estudo nunca aparece na tela por tempo suficiente para ler o título, os pesquisadores ou a universidade responsável. Mesmo assim, a história já está sendo compartilhada como fato. 🤯", handle: "@LendaDaBia", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "890 mil visualizações", curtidasRotulo: "54 mil curtidas", factual: false, avatar: "B", accent: "pink" },
  { id: "v06", arquivo: "v06.mp4", titulo: "Como navegadores usavam as estrelas", descricao: "No século XVI, navegar em alto-mar exigia olhar para o céu. Marinheiros mediam a altura do Sol ou de estrelas como a Polar para estimar a latitude e manter o rumo. Instrumentos como o astrolábio marítimo e o cross-staff faziam parte desse trabalho. O Royal Museums Greenwich explica como esses instrumentos eram usados nas grandes navegações: https://www.historyhit.com/how-celestial-navigation-changed-maritime-history/", handle: "@RotaDosNavegadores", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "8,4 mil visualizações", curtidasRotulo: "410 curtidas", factual: true, avatar: "R", accent: "blue" },
  { id: "v07", arquivo: "v07.mp4", titulo: "Um papagaio tradutor mudou a história?", descricao: "🦜 PAPAGAIOS ERAM TRADUTORES NO BRASIL?! Uma história afirma que portugueses e povos indígenas usavam papagaios para ajudar nas conversas — até que uma das aves teria xingado um português e provocado uma confusão enorme. O caso é contado como se fosse um episódio histórico, mas normalmente chega sem dizer quem registrou a cena, onde esse relato pode ser consultado ou em que momento da chegada dos portugueses isso teria acontecido.", handle: "@CuriosoBR123", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "1,7 mi de visualizações", curtidasRotulo: "112 mil curtidas", factual: false, avatar: "C", accent: "lime" },
  { id: "v08", arquivo: "v08.mp4", titulo: "Animais que viajavam nos navios", descricao: "Em diferentes épocas, viajantes e navegadores levaram animais vivos em jornadas longas para ter alimento fresco e também para outros usos. Povos polinésios, por exemplo, atravessavam grandes distâncias do Pacífico com porcos, cães e galinhas em suas canoas há mais de mil anos. https://escolakids.uol.com.br/historia/alimentacao-nas-grandes-navegacoes-maritimas-europeias.htm", handle: "@ArquivoVivo", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "19 mil visualizações", curtidasRotulo: "920 curtidas", factual: true, avatar: "A", accent: "aqua" },
  { id: "v09", arquivo: "v09.mp4", titulo: "O primeiro karaokê aconteceu no Brasil colonial?", descricao: "🧜‍♀️ O KARAOKÊ NASCEU COM SEREIAS NO SÉCULO XVI?! Dizem que marinheiros faziam festas no mar, cantavam junto com sereias e acabaram criando a tradição que séculos depois virou o karaokê. A história costuma ser atribuída a um antigo navegador, mas o tal relato raramente aparece inteiro: sem nome do navegador, sem local onde o documento estaria guardado e sem um ano mais preciso dentro do século XVI.", handle: "@KaraokeDoLeo", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "1,1 mi de visualizações", curtidasRotulo: "76 mil curtidas", factual: false, avatar: "K", accent: "coral" },
  { id: "v10", arquivo: "v10.mp4", titulo: "A reclamação escrita mais antiga", descricao: "Quase 4 mil anos antes das avaliações de loja na internet, Nanni já estava reclamando de uma compra. Por volta de 1750 a.C., ele mandou uma mensagem em escrita cuneiforme ao comerciante Ea-nasir, criticando a qualidade do cobre recebido e o tratamento dado ao seu mensageiro. A tabuleta está hoje no British Museum, catalogada como objeto 131236: https://super.abril.com.br/historia/o-que-e-a-placa-de-ea-nasir-o-primeiro-exposed-da-historia/", handle: "@HistoriaComAna", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "44 mil visualizações", curtidasRotulo: "2,6 mil curtidas", factual: true, avatar: "A", accent: "purple" },
  { id: "v11", arquivo: "v11.mp4", titulo: "A escrita nasceu para contar ovelhas?", descricao: "🐐 TUDO COMEÇOU POR CAUSA DE 10 CABRAS?! Segundo uma história que aparece em vídeos de curiosidades, um comerciante emprestou dez cabras, esqueceu quantas tinha entregado e inventou a escrita ali mesmo para não se perder de novo. A versão é repetida de um perfil para outro, mas é difícil descobrir quem contou isso primeiro — e em que época esse comerciante teria vivido.", handle: "@FatoUltraTop", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "3,2 mi de visualizações", curtidasRotulo: "209 mil curtidas", factual: false, avatar: "F", accent: "gold" },
  { id: "v12", arquivo: "v12.mp4", titulo: "Por que o pau-brasil recebeu esse nome?", descricao: "O pau-brasil ganhou valor porque o interior da madeira produz um pigmento avermelhado usado para tingir tecidos. Essa exploração foi importante logo no começo da colonização portuguesa e acabou ficando ligada ao próprio nome do país. A pesquisadora Maria do Carmo Gomes de Andrade explica essa história em material da Fundação Joaquim Nabuco, atualizado em 27 de abril de 2021: https://pesquisaescolar.fundaj.gov.br/pt-br/artigo/pau-brasil/", handle: "@BrasilNoMapa", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "15 mil visualizações", curtidasRotulo: "780 curtidas", factual: true, avatar: "B", accent: "lime" },
  { id: "v13", arquivo: "v13.mp4", titulo: "Um diário de 12 mil anos foi encontrado?", descricao: "😱 UMA CRIANÇA DESCOBRIU A CURA DO RESFRIADO HÁ 12 MIL ANOS?! A história diz que um diário antiquíssimo guardava uma receita capaz de acabar com o resfriado e que o texto foi escondido durante milhares de anos. O mais estranho é que a imagem desse suposto diário aparece em vários posts, mas quase nunca vem acompanhada de informação sobre quem encontrou o objeto, onde ele está ou quando foi analisado.", handle: "@DiarioSecreto12k", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "2,8 mi de visualizações", curtidasRotulo: "184 mil curtidas", factual: false, avatar: "D", accent: "blue" },
  { id: "v14", arquivo: "v14.mp4", titulo: "Como a imigração mudou a comida brasileira", descricao: "Há mais ou menos cem anos, muita gente veio morar no Brasil: italianos, japoneses, portugueses, sírios e libaneses. Vieram de navio, para trabalhar. E trouxeram comida junto! Macarrão, pizza, esfiha e quibe chegaram assim. Hoje parecem comida brasileira — e, de tanto tempo aqui, viraram mesmo. 🍕 Onde conferir: Museu da Imigração do Estado de São Paulo.", handle: "@MemoriaMigrante", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "27 mil visualizações", curtidasRotulo: "1,3 mil curtidas", factual: true, avatar: "M", accent: "pink" },
  { id: "v15", arquivo: "v15.mp4", titulo: "Existiram caravelas voadoras?", descricao: "🚨 E se as caravelas do século XVI CONSEGUISSEM VOAR? Um vídeo que anda circulando garante que navegadores teriam criado embarcações capazes de sair da água e chegar perto da velocidade do som. A história fala até em desenhos secretos que teriam desaparecido misteriosamente — só que ninguém mostra esses desenhos completos nem explica em qual arquivo histórico eles estariam guardados. Coincidência? 👀", handle: "@CapitaoVoante", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "1,9 mi de visualizações", curtidasRotulo: "131 mil curtidas", factual: false, avatar: "C", accent: "aqua" },
  { id: "v16", arquivo: "v16.mp4", titulo: "Quando uma igreja inteira mudou de lugar", descricao: "Uma igreja de 672 toneladas atravessando a cidade inteira parece cena de filme, mas aconteceu de verdade em Kiruna, na Suécia. Nos dias 19 e 20 de agosto de 2025, o prédio histórico, concluído em 1912, percorreu cerca de 5 km até uma nova área da cidade. A empresa de mineração LKAB registrou a operação e publicou o resultado no dia 20: https://lkab.com/en/press/kiruna-church-has-found-a-new-home-a-historic-move-completed-as-planned/", handle: "@PassadoPresente", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "52 mil visualizações", curtidasRotulo: "3,1 mil curtidas", factual: true, avatar: "P", accent: "coral" },
  { id: "v17", arquivo: "v17.mp4", titulo: "O berimbau foi inventado por um DJ?", descricao: "O berimbau foi inventado em 1985 por um DJ de São Paulo que queria um som diferente para as festas. Ele pegou um arco, um arame e uma cabaça e montou o instrumento no quintal de casa. Fez tanto sucesso que a capoeira resolveu adotar.", handle: "@MisteriosDoGuto", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "760 mil visualizações", curtidasRotulo: "48 mil curtidas", factual: false, avatar: "G", accent: "purple" },
  { id: "v18", arquivo: "v18.mp4", titulo: "Uma escavação em São Luís revelou...", descricao: "Em janeiro de 2024, uma escavação no Sítio Arqueológico Chácara Rosane, em São Luís (MA), revelou 43 esqueletos humanos e cerca de 100 mil artefatos. O Iphan publicou a descoberta em 8 de janeiro de 2024 e explicou que o sítio reúne vestígios de ocupação humana com mais de 6 mil anos. A notícia e os detalhes do trabalho arqueológico estão aqui: https://g1.globo.com/ma/maranhao/noticia/2024/01/06/quarenta-e-tres-esqueletos-e-mais-de-100-mil-pecas-arqueologicas-sao-descobertos-durante-construcao-de-condominio-em-sao-luis.ghtml", handle: "@ArqueologiaKids", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "9,7 mil visualizações", curtidasRotulo: "520 curtidas", factual: true, avatar: "A", accent: "gold" },
  { id: "v19", arquivo: "v19.mp4", titulo: "O açaí foi trazido por japoneses?", descricao: "Os japoneses vieram para o Brasil de submarino, escondidos embaixo d’água, e trouxeram o açaí na mala. Antes deles, ninguém no Brasil conhecia o açaí. Foi assim que a fruta chegou na Amazônia, vindo direto do Japão em 1908.", handle: "@JapaDoAcai", inscritosRotulo: "1 mil inscritos", visualizacoesRotulo: "1,4 mi de visualizações", curtidasRotulo: "95 mil curtidas", factual: false, avatar: "J", accent: "pink" },
  { id: "v20", arquivo: "v20.mp4", titulo: "O que dizia a carta de Pero Vaz de Caminha", descricao: "Em 1º de maio de 1500, Pero Vaz de Caminha terminou a carta em que contou ao rei D. Manuel I como foi a chegada da frota de Cabral e o encontro com os povos indígenas. O documento original atravessou séculos e hoje pode ser consultado na Biblioteca Nacional Digital: https://brasilescola.uol.com.br/historiab/carta-de-pero-vaz-de-caminha.htm. A UNESCO também mantém uma cópia no programa Memória do Mundo.", handle: "@CartasDoBrasil", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "36 mil visualizações", curtidasRotulo: "2,1 mil curtidas", factual: true, avatar: "C", accent: "blue" },
  { id: "v21", arquivo: "v21.mp4", titulo: "Animais e alimentos que chegaram ao Brasil", descricao: "Cavalo, boi, porco e galinha não existiam por aqui antes de 1500 — chegaram nos navios dos portugueses. Laranja, manga, coco e cana-de-açúcar também vieram de fora! Muita coisa que parece super brasileira, na verdade, desembarcou aqui. 🐄 Onde conferir: Embrapa — história das espécies introduzidas no Brasil.", handle: "@MuseuDaHistoria", inscritosRotulo: "50 inscritos", visualizacoesRotulo: "23 mil visualizações", curtidasRotulo: "1,1 mil curtidas", factual: true, avatar: "M", accent: "lime" },
];

export const COLEGAS: readonly Colega[] = [
  { id: "c01", nome: "Ana", fontesConfiaveis: 3, avatar: "A", accent: "coral" },
  { id: "c02", nome: "Arthur", fontesConfiaveis: 3, avatar: "A", accent: "purple" },
  { id: "c03", nome: "Alice", fontesConfiaveis: 1, avatar: "A", accent: "aqua" },
  { id: "c04", nome: "Bernardo", fontesConfiaveis: 0, avatar: "B", accent: "gold" },
  { id: "c05", nome: "Beatriz", fontesConfiaveis: 1, avatar: "B", accent: "pink" },
  { id: "c06", nome: "Caio", fontesConfiaveis: 1, avatar: "C", accent: "blue" },
  { id: "c07", nome: "Clara", fontesConfiaveis: 3, avatar: "C", accent: "lime" },
  { id: "c08", nome: "Davi", fontesConfiaveis: 3, avatar: "D", accent: "coral" },
  { id: "c09", nome: "Eduardo", fontesConfiaveis: 0, avatar: "E", accent: "purple" },
  { id: "c10", nome: "Elisa", fontesConfiaveis: 1, avatar: "E", accent: "aqua" },
  { id: "c11", nome: "Enzo", fontesConfiaveis: 0, avatar: "E", accent: "gold" },
  { id: "c12", nome: "Fernanda", fontesConfiaveis: 1, avatar: "F", accent: "pink" },
  { id: "c13", nome: "Gabriel", fontesConfiaveis: 1, avatar: "G", accent: "blue" },
  { id: "c14", nome: "Helena", fontesConfiaveis: 3, avatar: "H", accent: "lime" },
  { id: "c15", nome: "Heitor", fontesConfiaveis: 1, avatar: "H", accent: "coral" },
  { id: "c16", nome: "Isabela", fontesConfiaveis: 3, avatar: "I", accent: "purple" },
  { id: "c17", nome: "João", fontesConfiaveis: 0, avatar: "J", accent: "aqua" },
  { id: "c18", nome: "Júlia", fontesConfiaveis: 3, avatar: "J", accent: "gold" },
  { id: "c19", nome: "Laura", fontesConfiaveis: 1, avatar: "L", accent: "pink" },
  { id: "c20", nome: "Lucas", fontesConfiaveis: 3, avatar: "L", accent: "blue" },
  { id: "c21", nome: "Luiza", fontesConfiaveis: 1, avatar: "L", accent: "lime" },
  { id: "c22", nome: "Manuela", fontesConfiaveis: 1, avatar: "M", accent: "coral" },
  { id: "c23", nome: "Maria", fontesConfiaveis: 1, avatar: "M", accent: "purple" },
  { id: "c24", nome: "Miguel", fontesConfiaveis: 0, avatar: "M", accent: "aqua" },
  { id: "c25", nome: "Nicolas", fontesConfiaveis: 0, avatar: "N", accent: "gold" },
  { id: "c26", nome: "Pedro", fontesConfiaveis: 1, avatar: "P", accent: "pink" },
  { id: "c27", nome: "Rafael", fontesConfiaveis: 1, avatar: "R", accent: "blue" },
  { id: "c28", nome: "Samuel", fontesConfiaveis: 0, avatar: "S", accent: "lime" },
  { id: "c29", nome: "Sofia", fontesConfiaveis: 3, avatar: "S", accent: "coral" },
  { id: "c30", nome: "Thiago", fontesConfiaveis: 0, avatar: "T", accent: "purple" },
  { id: "c31", nome: "Valentina", fontesConfiaveis: 3, avatar: "V", accent: "aqua" },
  { id: "c32", nome: "Vitor", fontesConfiaveis: 0, avatar: "V", accent: "gold" },
  { id: "c33", nome: "Yasmin", fontesConfiaveis: 1, avatar: "Y", accent: "pink" },
  { id: "c34", nome: "Bruno", fontesConfiaveis: 0, avatar: "B", accent: "blue" },
  { id: "c35", nome: "Cecília", fontesConfiaveis: 0, avatar: "C", accent: "lime" },
  { id: "c36", nome: "Daniel", fontesConfiaveis: 0, avatar: "D", accent: "coral" },
  { id: "c37", nome: "Felipe", fontesConfiaveis: 0, avatar: "F", accent: "purple" },
  { id: "c38", nome: "Gabriela", fontesConfiaveis: 0, avatar: "G", accent: "aqua" },
  { id: "c39", nome: "Gustavo", fontesConfiaveis: 0, avatar: "G", accent: "gold" },
];

/** Para o `z.enum` dos controllers — a tupla não-vazia que o Zod exige. */
export const VIDEO_IDS = VIDEOS.map((v) => v.id) as [string, ...string[]];

const POR_ID = new Map(VIDEOS.map((v) => [v.id, v]));

export function semGabarito(video: Video): VideoPublico {
  const { factual: _factual, ...publico } = video;
  return publico;
}

export function ehVideoConhecido(videoId: string): boolean {
  return POR_ID.has(videoId);
}

/** Lança em id desconhecido: quem chega aqui já passou pelo Zod. */
export function ehFactual(videoId: string): boolean {
  const video = POR_ID.get(videoId);
  if (!video) throw new Error(`vídeo desconhecido no catálogo: ${videoId}`);
  return video.factual;
}

// ───────────────────────────────────────────── o catálogo para o guia da aula

/**
 * Uma linha da tabela que o PROFESSOR lê no guia da aula — com o gabarito.
 *
 * `descricao` fica de fora de propósito: são 21 vídeos e o texto de cada um
 * ocupa um parágrafo. O professor precisa RECONHECER o vídeo que a criança
 * citou e saber a resposta; ler as 21 descrições ele faz na própria missão.
 */
export interface VideoParaOProfessor {
  id: string;
  titulo: string;
  handle: string;
  /** O contraste que sustenta a lição: o sensacionalista é o de "1 mil". */
  inscritosRotulo: string;
  /** O GABARITO. Sai daqui e de nenhum outro lugar — nunca para o estudante. */
  factual: boolean;
}

/**
 * O que o guia da aula mostra ao professor: os 21 vídeos com o gabarito, a
 * contagem real e os números da pontuação.
 *
 * `resumo` e `pontuacao` existem porque o guia os repetia à mão, e já tinham
 * derivado: o texto dizia "metade… a outra metade" quando a divisão real é
 * 11 factuais contra 10 sensacionalistas (21 é ímpar). Número que o professor
 * lê antes da aula sai daqui, calculado, ou volta a divergir na próxima
 * revisão do catálogo.
 */
export function videosParaOProfessor(): {
  videos: VideoParaOProfessor[];
  resumo: { total: number; factuais: number; sensacionalistas: number };
  pontuacao: { limiteSalvos: number; inscritosPorFake: number; inscritosPorConfiavel: number };
} {
  const videos = VIDEOS.map(({ id, titulo, handle, inscritosRotulo, factual }) => ({
    id,
    titulo,
    handle,
    inscritosRotulo,
    factual,
  }));
  const factuais = videos.filter((v) => v.factual).length;
  return {
    videos,
    resumo: { total: videos.length, factuais, sensacionalistas: videos.length - factuais },
    pontuacao: {
      limiteSalvos: LIMITE_SALVOS,
      inscritosPorFake: INSCRITOS_POR_FAKE,
      inscritosPorConfiavel: INSCRITOS_POR_CONFIAVEL,
    },
  };
}
