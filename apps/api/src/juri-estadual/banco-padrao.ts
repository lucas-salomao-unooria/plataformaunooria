import type { ConteudoDoPacote } from "./regras/preparo";
import { IDS_DE_PROJETO_LEGADOS, compararIdsDeProjeto, type Area, type Disciplina } from "./vocabulario";

/**
 * O BANCO PADRÃO da exp06ef1b (PRD v2, RF-007, §12.2) — QUARENTA projetos, dez
 * por área, nas quatro áreas e chips do PRD: Tecnologia (#robotica), Meio
 * Ambiente (#meioambiente), Cultura (#artes) e Saúde (#saude).
 *
 * Os projetos 1 a 4 de cada área são os dezesseis curados do banco de conteúdo
 * (`dev/01e-banco-conteudo.md`, txt-exp06ef1b-01 a 16), com o MESMO id e o
 * MESMO texto: o podcast padrão cita estandes deles, e os pacotes `padrao` de
 * dezesseis que já existem só são reconhecidos como banco padrão por esse texto
 * (`ehConteudoDoBancoPadrao`). Os projetos 5 a 10 (2026-10-14) foram escritos
 * no molde deles: escolas públicas fictícias, perfil derivado da escola,
 * legenda e bastidor do mesmo tamanho e tom, problemas reais da comunidade
 * escolar.
 *
 * Três caminhos chegam aqui, e os três dão um pacote com `origem = 'padrao'`:
 *
 * 1. o atalho do professor, "Usar Banco Padrão Oficial" (E0-PROF-02): sem IA,
 *    sem curadoria e sem imagem gerada — direto para pôr no ar (E0-PROF-05);
 * 2. o FALLBACK do preparo: sem cota de IA (ou com a IA fora do ar), o
 *    `gerar-conteudo` responde 200 com este conteúdo e `usouIa: false`;
 * 3. a homologação de um rascunho que é exatamente este conteúdo.
 *
 * Do 01e vêm LITERAIS: título, escola, legenda e hashtags (a da área foi posta
 * primeiro quando o 01e a trazia depois — é a que o chip da busca encontra), e
 * o "resumo técnico (Ficha de Auditoria)", que é o texto do BASTIDOR. O 01e não
 * tem perfil da equipe, descrição de imagem nem texto alternativo: o perfil sai
 * do nome da escola e a imagem descreve o estande pelo título (sem inventar
 * conteúdo pedagógico).
 *
 * As IMAGENS do banco: uma por projeto, geradas pelo `admin`
 * (`banco-padrao-imagens.service.ts`) com o nome determinístico da descrição.
 * O pacote `padrao` nasce com as imagens aprovadas e com a `midia` das que já
 * existem no storage; o projeto sem imagem usa a ARTE PROCEDURAL da experiência.
 */

export const DISCIPLINA_DO_BANCO_PADRAO: Disciplina = "ciencias";
export const TEMA_DO_BANCO_PADRAO = "Feira de Ciências e Sustentabilidade";
export const ASSUNTOS_DO_BANCO_PADRAO =
  "Banco padrão oficial: robótica, meio ambiente, cultura e saúde na comunidade escolar.";

export const CATEGORIAS_DO_BANCO_PADRAO: readonly { area: Area; nome: string; hashtag: string }[] = [
  { area: "area_a", nome: "Tecnologia", hashtag: "#robotica" },
  { area: "area_b", nome: "Meio Ambiente", hashtag: "#meioambiente" },
  { area: "area_c", nome: "Cultura", hashtag: "#artes" },
  { area: "area_d", nome: "Saúde", hashtag: "#saude" },
];

type Linha = {
  id: string;
  area: Area;
  titulo: string;
  escola: string;
  perfil: string;
  legenda: string;
  bastidor: string;
  hashtags: string[];
};

const LINHAS: readonly Linha[] = [
  {
    id: "proj-a1",
    area: "area_a",
    titulo: "Braço Mecânico Hidráulico de Papelão",
    escola: "E.E. Professora Maria da Glória",
    perfil: "@ee.mariadagloria",
    legenda:
      "Criamos um braço robótico articulado que funciona apenas com seringas e pressão de água! O protótipo consegue erguer latinhas de metal e pequenos blocos sem gastar energia elétrica. Testamos mais de vinte conexões até acertar a força de elevação dos pistões.",
    bastidor:
      "Garras robóticas acionadas por transmissão hidrostática com seringas plásticas de descarte e papelão estrutural.",
    hashtags: ["#robotica", "#reciclagem", "#tecnologia"],
  },
  {
    id: "proj-a2",
    area: "area_a",
    titulo: "Carrinho Seguidor de Linha com Sensor Solar",
    escola: "E.E. Engenheiro Santos Dumont",
    perfil: "@ee.santosdumont",
    legenda:
      "Nosso veículo autônomo usa fotossensores para seguir fitas pretas no chão da quadra da escola. Instalamos uma minoplaca solar na capota para recarregar as pilhas durante o percurso! O circuito foi montado peça por peça pela nossa equipe no laboratório de ciências.",
    bastidor:
      "Veículo de pequeno porte com controle diferencial via sensores ópticos analógicos alimentados por célula fotovoltaica de 5V.",
    hashtags: ["#robotica", "#energiasolar", "#automacao"],
  },
  {
    id: "proj-a3",
    area: "area_a",
    titulo: "Alarme de Enchente com Sensor de Nível",
    escola: "E.E. Bairro das Águas",
    perfil: "@ee.bairrodasaguas",
    legenda:
      "Desenvolvemos um sensor sonoro e luminoso para alertar vizinhos quando a água do córrego sobe muito rápido. Usamos uma placa programada por nós que aciona um apito de alerta assim que a boia sobe cinco centímetros acima do limite seguro.",
    bastidor:
      "Sistema de telemetria hídrica de baixo custo com sensor boia eletromecânico e alarme piezelétrico de alta potência.",
    hashtags: ["#robotica", "#tecnologia", "#prevencao"],
  },
  {
    id: "proj-a4",
    area: "area_a",
    titulo: "Semáforo Inteligente para Faixa Escolar",
    escola: "E.E. Cecília Meireles",
    perfil: "@ee.ceciliameireles",
    legenda:
      "Programamos luzes de LED com sensor ultrassônico na calçada da frente da nossa escola. Quando detecta estudantes esperando para atravessar por mais de dez segundos, o sinal fecha para os carros e libera os pedestres com segurança total!",
    bastidor:
      "Semáforo microcontrolado sincronizado com sensor ultrassônico de presença para travessia prioritária de pedestres.",
    hashtags: ["#robotica", "#tecnologia", "#cidadania"],
  },
  {
    id: "proj-b1",
    area: "area_b",
    titulo: "Irrigador Solar por Gotejamento de Garrafas",
    escola: "E.E. Parque das Flores",
    perfil: "@ee.parquedasflores",
    legenda:
      "Construímos um sistema de irrigação automática para a horta comunitária usando apenas calor do sol e garrafas retornáveis. Conforme a terra esquenta durante a tarde, a água evapora, condensa no topo e rega as mudas de alface gota a gota sem desperdício!",
    bastidor:
      "Irrigador solar passivo de condensação em circuito fechado construído com garrafas plásticas reaproveitadas.",
    hashtags: ["#meioambiente", "#sustentabilidade", "#hortaescolar"],
  },
  {
    id: "proj-b2",
    area: "area_b",
    titulo: "Composteira Térmica com Restos da Merenda",
    escola: "E.E. Dona Leopoldina",
    perfil: "@ee.donaleopoldina",
    legenda:
      "Transformamos cascas de banana, talos de verdura e pó de café da cozinha da escola em adubo rico e cheiroso para o jardim. Monitoramos a temperatura com termômetro todos os dias para comprovar como as bactérias do bem fazem todo o trabalho limpo.",
    bastidor:
      "Composteira aeróbica em três estágios para reaproveitamento integral de resíduos orgânicos da alimentação escolar.",
    hashtags: ["#meioambiente", "#compostagem", "#reciclagem"],
  },
  {
    id: "proj-b3",
    area: "area_b",
    titulo: "Filtro de Areia e Carvão para Água de Chuva",
    escola: "E.E. Serra Verde",
    perfil: "@ee.serraverde",
    legenda:
      "Criamos um filtro em quatro camadas com brita, areia fina, carvão vegetal ativado e algodão para limpar a água recolhida pelas calhas da nossa quadra. Essa água filtrada agora abastece as descargas e a limpeza do pátio com economia garantida!",
    bastidor:
      "Estação mecânica de filtragem de águas pluviais por gravidade para reuso em serviços gerais da escola.",
    hashtags: ["#meioambiente", "#agualimpa", "#sustentabilidade"],
  },
  {
    id: "proj-b4",
    area: "area_b",
    titulo: "Telhado Verde de Suculentas contra o Calor",
    escola: "E.E. Jardim Primavera",
    perfil: "@ee.jardimprimavera",
    legenda:
      "Cobrimos uma maquete da nossa sala de aula com plantas suculentas e medimos a diferença de temperatura com sensor térmico. A sala com telhado verde ficou quatro graus mais fresca ao meio-dia, provando que a vegetação refresca o ambiente sem gastar ventilador!",
    bastidor:
      "Módulo de cobertura vegetal isolante com plantas xerófitas para atenuação térmica passiva em edifícios escolares.",
    hashtags: ["#meioambiente", "#clima", "#sustentabilidade"],
  },
  {
    id: "proj-c1",
    area: "area_c",
    titulo: "Memória Viva: Histórias dos Bairros do Interior",
    escola: "E.E. Monteiro Lobato",
    perfil: "@ee.monteirolobato",
    legenda:
      "Entrevistamos e gravamos depoimentos de dez idosos que viveram a chegada da primeira ferrovia e das fábricas na nossa cidade. Transformamos as gravações em um mapa interativo sonoro e em ilustrações feitas à mão pelos estudantes da nossa turma.",
    bastidor:
      "Acervo sonoro digitalizado e painel cartográfico ilustrado baseado em metodologia de história oral comunitária.",
    hashtags: ["#artes", "#historia", "#memoria"],
  },
  {
    id: "proj-c2",
    area: "area_c",
    titulo: "Tintas Naturais com Terra, Folhas e Especiarias",
    escola: "E.E. Vila Nova",
    perfil: "@ee.vilanova",
    legenda:
      "Extraímos pigmentos e tintas coloridas de folhas caídas, pó de café usado, beterraba cozida e terra avermelhada do barranco. Pintamos um grande mural coletivo no pátio da escola sem usar nenhuma tinta química sintética comprada em loja!",
    bastidor: "Extração botânica e mineral de pigmentos naturais para pintura escolar sem solventes químicos tóxicos.",
    hashtags: ["#artes", "#pigmentos", "#criatividade"],
  },
  {
    id: "proj-c3",
    area: "area_c",
    titulo: "Fanzine Coletivo de Cordel e Rimas Locais",
    escola: "E.E. Cora Coralina",
    perfil: "@ee.coracoralina",
    legenda:
      "Escrevemos livretos de cordel com rimas contando lendas populares, causos engraçados da nossa cidade e desafios da convivência escolar. Imprimimos as capas usando carimbos entalhados em borracha escolar reciclada com técnica de xilogravura caseira!",
    bastidor:
      "Produção editorial artesanal de folhetos em estrofes de sextilha com capas xilogravadas em matriz de borracha.",
    hashtags: ["#artes", "#cultura", "#literatura"],
  },
  {
    id: "proj-c4",
    area: "area_c",
    titulo: "Instrumentos de Percussão com Sucata Urbana",
    escola: "E.E. Villa-Lobos",
    perfil: "@ee.villalobos",
    legenda:
      "Montamos uma orquestra rítmica usando baldes de tinta plásticos, canos de PVC cortados em medidas musicais afinadas e tampinhas metálicas de garrafa. Criamos composições musicais autorais mostrando que ritmo e arte não dependem de instrumentos caros comprados!",
    bastidor:
      "Construção acústica experimental de idiofones e membranofones com resíduos industriais reaproveitados.",
    hashtags: ["#artes", "#musica", "#cultura"],
  },
  {
    id: "proj-d1",
    area: "area_d",
    titulo: "Repelente Escolar de Citronela contra o Mosquito",
    escola: "E.E. Oswaldo Cruz",
    perfil: "@ee.oswaldocruz",
    legenda:
      "Cultivamos folhas frescas de citronela na escola, destilamos a essência com água quente e misturamos com álcool de cereais. O repelente natural tem cheiro agradável e foi distribuído para todas as famílias do bairro durante o mutirão contra a dengue!",
    bastidor:
      "Extração hidroalcoólica de óleo essencial de Cymbopogon nardus para prevenção comunitária contra arboviroses.",
    hashtags: ["#saude", "#prevencao", "#bemestar"],
  },
  {
    id: "proj-d2",
    area: "area_d",
    titulo: "Bebedouro Acessível com Pedal Mecânico",
    escola: "E.E. Paulo Freire",
    perfil: "@ee.paulofreire",
    legenda:
      "Adaptamos os bebedouros de pressão do corredor instalando uma alavanca de pé feita com barra de ferro reciclada e cabo de freio de bicicleta. Agora todo mundo consegue beber água sem precisar tocar as mãos nas torneiras sujas após o recreio!",
    bastidor:
      "Acionador podálico mecânico para válvulas de bebedouro escolar visando redução de contaminação cruzada.",
    hashtags: ["#saude", "#higiene", "#acessibilidade"],
  },
  {
    id: "proj-d3",
    area: "area_d",
    titulo: "Guia Visual de Lanches Saudáveis da Merenda",
    escola: "E.E. Albert Sabin",
    perfil: "@ee.albertsabin",
    legenda:
      "Pesquisamos a quantidade de açúcar e sal nos pacotes de salgadinhos e bolachas mais consumidos no recreio. Montamos potes de vidro mostrando o açúcar real de cada pacote e espalhamos cartazes educativos com opções saborosas e nutritivas da horta escolar.",
    bastidor:
      "Painel comparativo de densidade calórica e sódio em alimentos ultraprocessados versus preparações in natura da merenda.",
    hashtags: ["#saude", "#nutricao", "#bemestar"],
  },
  {
    id: "proj-d4",
    area: "area_d",
    titulo: "Banco de Alongamento e Postura com Paletes",
    escola: "E.E. Rui Barbosa",
    perfil: "@ee.ruibarbosa",
    legenda:
      "Construímos um circuito de barras de apoio e assentos de madeira de paletes no pátio para aliviar as dores nas costas dos estudantes que carregam mochilas pesadas. Colocamos placas desenhadas mostrando três exercícios fáceis de fazer antes das aulas.",
    bastidor:
      "Equipamento ergonômico em madeira reciclada com sinalização instrucional para descompressão vertebral e prevenção postural.",
    hashtags: ["#saude", "#postura", "#bemestar"],
  },
  // ── os vinte e quatro de 2026-10-14 (proj-a5…a10, b5…b10, c5…c10, d5…d10), no molde dos dezesseis do 01e
  {
    id: "proj-a5",
    area: "area_a",
    titulo: "Lixeira que Separa Latinhas Sozinha",
    escola: "E.E. Carolina Maria de Jesus",
    perfil: "@ee.carolinamariadejesus",
    legenda:
      "A Larissa e o Davi tiveram a ideia depois de ver latinhas misturadas com papel no pátio. Montamos uma lixeira com sensor de metal que desvia as latinhas para outro compartimento. Em uma semana, juntamos trezentas latas para a cooperativa do bairro.",
    bastidor:
      "Triagem automática de resíduos com sensor indutivo de metal e rampa basculante acionada por servomotor reaproveitado.",
    hashtags: ["#robotica", "#reciclagem", "#automacao"],
  },
  {
    id: "proj-a6",
    area: "area_a",
    titulo: "Robô Varredor de Pátio com Motor de Sucata",
    escola: "E.E. Vila Operária",
    perfil: "@ee.vilaoperaria",
    legenda:
      "Desmontamos um ventilador quebrado e uma impressora velha para tirar motores, engrenagens e rodinhas. Com isso, construímos um pequeno robô que empurra folhas secas e papéis para um canto do pátio. Ele desvia das paredes com um para-choque de mola e anda sozinho durante o recreio.",
    bastidor:
      "Plataforma móvel com motores de corrente contínua de sucata eletrônica e chave de contato mecânica para desvio de obstáculos.",
    hashtags: ["#robotica", "#sucata", "#tecnologia"],
  },
  {
    id: "proj-a7",
    area: "area_a",
    titulo: "Estação do Tempo no Telhado da Escola",
    escola: "E.E. Professor Milton Santos",
    perfil: "@ee.miltonsantos",
    legenda:
      "Instalamos no telhado um medidor de chuva feito com funil e garrafa, um cata-vento com contador de voltas e um termômetro. A Yasmin anota os números todo dia e a turma publica a previsão da semana no mural. Já acertamos a chegada de três frentes frias seguidas!",
    bastidor:
      "Estação meteorológica escolar com pluviômetro artesanal, anemômetro de copos com sensor magnético e registro diário em planilha coletiva.",
    hashtags: ["#robotica", "#clima", "#ciencia"],
  },
  {
    id: "proj-a8",
    area: "area_a",
    titulo: "Bengala que Vibra Perto de Obstáculos",
    escola: "E.E. Nise da Silveira",
    perfil: "@ee.nisedasilveira",
    legenda:
      "Um colega da turma tem baixa visão e tropeçava nos bancos do corredor. O João Pedro e a Ana Clara prenderam um sensor de distância e um motorzinho de vibração numa bengala. Quando algo aparece a um metro, o cabo vibra. Ele mesmo testou e ajudou a ajustar.",
    bastidor:
      "Dispositivo de mobilidade assistiva com sensor ultrassônico de distância e motor vibratório de celular reaproveitado no punho.",
    hashtags: ["#robotica", "#acessibilidade", "#inclusao"],
  },
  {
    id: "proj-a9",
    area: "area_a",
    titulo: "Contador de Vagas do Bicicletário",
    escola: "E.E. Jardim das Palmeiras",
    perfil: "@ee.jardimdaspalmeiras",
    legenda:
      "Muitos estudantes chegam de bicicleta e perdiam tempo procurando lugar. Colocamos um sensor de luz em cada vaga e um painel de LEDs no portão que mostra quantas estão livres. Agora dá para saber de longe se ainda tem lugar.",
    bastidor:
      "Rede de sensores de luminosidade por vaga ligada a um painel de contagem com diodos emissores de luz na entrada da escola.",
    hashtags: ["#robotica", "#mobilidade", "#tecnologia"],
  },
  {
    id: "proj-a10",
    area: "area_a",
    titulo: "Mão Robótica de Canudos e Linha de Pesca",
    escola: "E.E. Machado de Assis",
    perfil: "@ee.machadodeassis",
    legenda:
      "Estudamos como os tendões movem os nossos dedos e copiamos a ideia com canudos cortados, linha de pesca e papelão. Puxando cada linha, um dedo dobra igualzinho ao da mão humana. Na mostra, os visitantes conseguem pegar uma bolinha de papel com a nossa mão robótica.",
    bastidor:
      "Modelo biomecânico de mão com falanges de canudo articuladas e tendões de náilon tracionados manualmente.",
    hashtags: ["#robotica", "#corpohumano", "#ciencia"],
  },
  {
    id: "proj-b5",
    area: "area_b",
    titulo: "Ecotijolos de Garrafa PET para o Banco da Praça",
    escola: "E.E. Chico Mendes",
    perfil: "@ee.chicomendes",
    legenda:
      "Recolhemos garrafas PET no bairro e enchemos cada uma, bem apertado, com embalagens plásticas que iriam para o lixo. Cada garrafa virou um tijolo firme. O Kauã calculou que usamos quase quarenta quilos de plástico para montar um banco novo na praça em frente à escola.",
    bastidor:
      "Construção com ecotijolos de garrafas plásticas compactadas com resíduos flexíveis e revestimento de argamassa simples.",
    hashtags: ["#meioambiente", "#reciclagem", "#comunidade"],
  },
  {
    id: "proj-b6",
    area: "area_b",
    titulo: "Viveiro de Mudas Nativas para a Beira do Rio",
    escola: "E.E. Beira-Rio",
    perfil: "@ee.beirario",
    legenda:
      "O córrego atrás da escola perdeu as árvores das margens e a terra começou a desbarrancar. Coletamos sementes de árvores nativas, plantamos em caixinhas de leite e cuidamos de cem mudas por três meses. Em parceria com os vizinhos, plantamos todas na margem num sábado de mutirão.",
    bastidor:
      "Viveiro escolar de espécies nativas em recipientes reaproveitados para recomposição de mata ciliar e contenção de erosão.",
    hashtags: ["#meioambiente", "#reflorestamento", "#agua"],
  },
  {
    id: "proj-b7",
    area: "area_b",
    titulo: "Óleo de Cozinha que Vira Sabão",
    escola: "E.E. Bertha Lutz",
    perfil: "@ee.berthalutz",
    legenda:
      "Um litro de óleo jogado na pia pode sujar milhares de litros de água. A Maria Eduarda e o Gabriel montaram um ponto de coleta, e as famílias trazem o óleo usado em garrafas. Com a professora de ciências, transformamos tudo em sabão para a limpeza.",
    bastidor:
      "Ponto de coleta de óleo residual doméstico e produção supervisionada de sabão por reação de saponificação em laboratório escolar.",
    hashtags: ["#meioambiente", "#reciclagem", "#agualimpa"],
  },
  {
    id: "proj-b8",
    area: "area_b",
    titulo: "Jardim de Chuva contra a Poça do Portão",
    escola: "E.E. Morada do Sol",
    perfil: "@ee.moradadosol",
    legenda:
      "Toda chuva forte formava uma poça enorme no portão de entrada. Cavamos um canteiro mais baixo ao lado, enchemos com pedras, areia e plantas que aguentam água, e desviamos a enxurrada para lá. Na última tempestade, a entrada ficou seca.",
    bastidor:
      "Canteiro pluvial de infiltração com camadas drenantes de brita e areia e vegetação tolerante a encharcamento.",
    hashtags: ["#meioambiente", "#chuva", "#sustentabilidade"],
  },
  {
    id: "proj-b9",
    area: "area_b",
    titulo: "Hotel de Abelhas sem Ferrão no Jardim",
    escola: "E.E. Augusto Ruschi",
    perfil: "@ee.augustoruschi",
    legenda:
      "As abelhas nativas sem ferrão polinizam as flores da horta e quase não aparecem na cidade. Construímos caixas de madeira com furos e bambus para elas morarem e plantamos flores ao redor. Em dois meses, contamos três espécies diferentes visitando o jardim da escola.",
    bastidor:
      "Abrigo para polinizadores nativos em madeira reaproveitada e bambu com monitoramento semanal de espécies visitantes.",
    hashtags: ["#meioambiente", "#abelhas", "#biodiversidade"],
  },
  {
    id: "proj-b10",
    area: "area_b",
    titulo: "Mapa do Desperdício de Água nas Torneiras",
    escola: "E.E. Vale do Ipê",
    perfil: "@ee.valedoipe",
    legenda:
      "Colocamos um copo medidor embaixo de cada torneira da escola por uma hora e descobrimos onze vazamentos. Desenhamos um mapa colorido mostrando onde mais se perdia água e entregamos para a direção. Depois do conserto, a conta de água caiu.",
    bastidor:
      "Levantamento volumétrico de vazamentos por ponto de consumo e mapeamento cartográfico do desperdício hídrico escolar.",
    hashtags: ["#meioambiente", "#agua", "#economia"],
  },
  {
    id: "proj-c5",
    area: "area_c",
    titulo: "Teatro de Sombras das Lendas do Folclore",
    escola: "E.E. Câmara Cascudo",
    perfil: "@ee.camaracascudo",
    legenda:
      "Recortamos personagens do Saci, da Iara e do Boitatá em papelão e montamos um palco com lençol branco e lanterna. Cada grupo escreveu um roteiro curto contando a lenda do seu jeito. Apresentamos para as turmas do primeiro ano, que ajudaram a fazer os barulhos da floresta.",
    bastidor:
      "Espetáculo de teatro de sombras com silhuetas articuladas em papelão e iluminação por fonte pontual sobre tela de tecido.",
    hashtags: ["#artes", "#folclore", "#teatro"],
  },
  {
    id: "proj-c6",
    area: "area_c",
    titulo: "Rádio do Recreio com Notícias do Bairro",
    escola: "E.E. Lima Barreto",
    perfil: "@ee.limabarreto",
    legenda:
      "Toda sexta-feira, a nossa rádio toca no alto-falante do pátio durante o recreio. A Isadora e o Enzo apresentam, e a turma entrevista a merendeira, o porteiro e os comerciantes do bairro. Já são vinte programas, com músicas escolhidas pelos estudantes.",
    bastidor:
      "Produção de programa radiofônico escolar com pauta comunitária, roteiro, entrevistas gravadas e veiculação semanal em sistema de som.",
    hashtags: ["#artes", "#comunicacao", "#comunidade"],
  },
  {
    id: "proj-c7",
    area: "area_c",
    titulo: "Museu dos Objetos Guardados pelas Avós",
    escola: "E.E. Cidade Nova",
    perfil: "@ee.cidadenova",
    legenda:
      "Pedimos às famílias um objeto antigo com história: um ferro de passar a carvão, uma máquina de costura de mão, fotos em preto e branco. Cada objeto ganhou uma caixa de sapato decorada e uma etiqueta escrita pelos netos. A exposição ocupou a biblioteca por duas semanas.",
    bastidor:
      "Exposição de cultura material familiar com curadoria estudantil, expositores de papelão e fichas de catalogação manuscritas.",
    hashtags: ["#artes", "#memoria", "#historia"],
  },
  {
    id: "proj-c8",
    area: "area_c",
    titulo: "Mosaico de Azulejos Quebrados na Entrada",
    escola: "E.E. Tarsila do Amaral",
    perfil: "@ee.tarsiladoamaral",
    legenda:
      "Uma loja de materiais de construção doou caixas de azulejos quebrados que iriam para o entulho. Desenhamos um sol, um rio e as crianças da escola, e cada turma colou uma parte do mosaico. O muro cinza da entrada virou a parede mais fotografada do bairro.",
    bastidor:
      "Painel em mosaico com fragmentos cerâmicos de descarte assentados com argamassa sobre desenho coletivo em escala real.",
    hashtags: ["#artes", "#mosaico", "#reaproveitamento"],
  },
  {
    id: "proj-c9",
    area: "area_c",
    titulo: "Livro de Receitas das Famílias da Turma",
    escola: "E.E. Rachel de Queiroz",
    perfil: "@ee.racheldequeiroz",
    legenda:
      "Cada estudante entrevistou alguém da família sobre uma receita que passa de geração em geração. O Miguel ilustrou as páginas e a turma escreveu a história de cada prato. O livro tem receitas de cinco estados diferentes, porque as nossas famílias vieram de muitos lugares do Brasil.",
    bastidor:
      "Coletânea ilustrada de receitas familiares com registro de história oral e mapeamento das origens regionais da turma.",
    hashtags: ["#artes", "#culinaria", "#cultura"],
  },
  {
    id: "proj-c10",
    area: "area_c",
    titulo: "Grafite sobre Respeito no Muro da Quadra",
    escola: "E.E. Candido Portinari",
    perfil: "@ee.candidoportinari",
    legenda:
      "Conversamos com um grafiteiro do bairro, aprendemos a fazer esboços em escala e escolhemos o tema respeito entre colegas. Pintamos o muro da quadra com tinta doada pelas famílias. Agora o muro que era pichado tem frases e desenhos da própria turma.",
    bastidor:
      "Intervenção mural com técnica de grafite a partir de esboço quadriculado ampliado e paleta de tintas acrílicas doadas.",
    hashtags: ["#artes", "#grafite", "#convivencia"],
  },
  {
    id: "proj-d5",
    area: "area_d",
    titulo: "Balança da Mochila no Portão da Escola",
    escola: "E.E. Anita Garibaldi",
    perfil: "@ee.anitagaribaldi",
    legenda:
      "Pesamos as mochilas de duzentos estudantes e descobrimos que muitas passavam do peso recomendado para as costas. O Pedro Henrique e a Sofia instalaram uma balança no portão com uma tabela colorida de peso ideal por idade.",
    bastidor:
      "Estudo de carga das mochilas escolares com balança de plataforma e tabela de referência de peso relativo ao corpo.",
    hashtags: ["#saude", "#postura", "#prevencao"],
  },
  {
    id: "proj-d6",
    area: "area_d",
    titulo: "Semáforo do Barulho na Sala de Aula",
    escola: "E.E. Parque Industrial",
    perfil: "@ee.parqueindustrial",
    legenda:
      "Barulho alto o dia todo cansa e atrapalha a concentração. Montamos uma caixinha com microfone que acende luz verde, amarela ou vermelha conforme o volume da sala. Durante um mês, medimos o barulho antes e depois de usar o semáforo, e a média caiu bastante nas aulas.",
    bastidor:
      "Indicador luminoso de nível sonoro ambiente com microfone de eletreto e três faixas de intensidade calibradas.",
    hashtags: ["#saude", "#audicao", "#bemestar"],
  },
  {
    id: "proj-d7",
    area: "area_d",
    titulo: "Cartazes de Primeiros Socorros do Recreio",
    escola: "E.E. Zilda Arns",
    perfil: "@ee.zildaarns",
    legenda:
      "Aprendemos com uma enfermeira do posto de saúde o que fazer em pequenos acidentes do recreio, como joelho ralado, nariz sangrando e torção. Transformamos tudo em cartazes com desenhos e passos simples, colados perto da quadra. Também treinamos as turmas menores a chamar um adulto rapidinho.",
    bastidor:
      "Sinalização ilustrada de condutas de primeiros socorros para ocorrências leves, validada por profissional da unidade básica de saúde.",
    hashtags: ["#saude", "#prevencao", "#cuidado"],
  },
  {
    id: "proj-d8",
    area: "area_d",
    titulo: "Horta de Temperos para Usar Menos Sal",
    escola: "E.E. Recanto Verde",
    perfil: "@ee.recantoverde",
    legenda:
      "Descobrimos que a comida pode ficar saborosa com menos sal quando tem bons temperos. Plantamos salsinha, cebolinha, manjericão e orégano em pneus pintados, e a merendeira passou a usar tudo no almoço. Fizemos uma votação e a turma aprovou o arroz temperado com ervas da nossa horta.",
    bastidor:
      "Horta de ervas aromáticas em canteiros de pneus reaproveitados para substituição parcial do sal na alimentação escolar.",
    hashtags: ["#saude", "#alimentacao", "#hortaescolar"],
  },
  {
    id: "proj-d9",
    area: "area_d",
    titulo: "Garrafinha Marcada para Beber Mais Água",
    escola: "E.E. Carlos Chagas",
    perfil: "@ee.carloschagas",
    legenda:
      "Muitos colegas passavam a manhã inteira sem beber água e reclamavam de dor de cabeça. A Heloísa teve a ideia de marcar as garrafinhas com horários, como uma régua. Em duas semanas, quase todo mundo chegava ao fim da aula com a garrafa vazia.",
    bastidor:
      "Campanha de hidratação com garrafas graduadas por horário e registro coletivo do consumo diário de água.",
    hashtags: ["#saude", "#hidratacao", "#bemestar"],
  },
  {
    id: "proj-d10",
    area: "area_d",
    titulo: "Ampulheta de Vinte Segundos na Pia",
    escola: "E.E. Vital Brazil",
    perfil: "@ee.vitalbrazil",
    legenda:
      "Lavar as mãos direito leva pelo menos vinte segundos, mas quase ninguém esperava tanto. Fizemos ampulhetas com garrafinhas e areia colorida, medidas no cronômetro, e prendemos uma em cada pia do banheiro. Com tinta que brilha no escuro, mostramos onde a sujeira ficava escondida.",
    bastidor:
      "Temporizador gravitacional de areia calibrado em vinte segundos e demonstração de higienização das mãos com tinta fluorescente.",
    hashtags: ["#saude", "#higiene", "#prevencao"],
  },
];

/** O conteúdo do banco padrão, no formato do pacote (`ConteudoDoPacoteSchema`), na ordem do vocabulário. */
export function conteudoDoBancoPadrao(): ConteudoDoPacote {
  return {
    tema: TEMA_DO_BANCO_PADRAO,
    categorias: CATEGORIAS_DO_BANCO_PADRAO.map((c) => ({ ...c })),
    projetos: [...LINHAS].sort((x, y) => compararIdsDeProjeto(x.id, y.id)).map((l) => ({
      ...l,
      hashtags: [...l.hashtags],
      imagem: {
        descricao: `Estande de feira de ciências escolar pública com o protótipo do projeto ${l.titulo} em evidência na mesa.`,
        alt: `Estande do projeto ${l.titulo}.`,
      },
    })),
  };
}

/** JSON com as chaves em ordem: o JSONB do Postgres reordena as chaves. */
function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor !== null && typeof valor === "object") {
    const chaves = Object.keys(valor as Record<string, unknown>).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(valor) ?? "null";
}

/**
 * O banco padrão de DEZESSEIS da 0.4.x: os projetos 1 a 4 de cada área, com o
 * texto de sempre. Não se escreve mais; existe para que um pacote `padrao`
 * antigo continue sendo reconhecido (o podcast dele é o do sheet).
 */
export function conteudoDoBancoPadraoLegado(): ConteudoDoPacote {
  const atual = conteudoDoBancoPadrao();
  return { ...atual, projetos: atual.projetos.filter((p) => IDS_DE_PROJETO_LEGADOS.includes(p.id)) };
}

/**
 * O conteúdo é o banco padrão INTOCADO — o de quarenta, ou o de dezesseis da
 * 0.4.x? Ordem de projetos e de chaves não importa. É o que faz um pacote ser
 * `padrao` e o podcast dele ser o do sheet.
 */
export function ehConteudoDoBancoPadrao(conteudo: unknown): boolean {
  if (conteudo === null || typeof conteudo !== "object") return false;
  const c = conteudo as { tema?: unknown; categorias?: unknown; projetos?: unknown };
  if (!Array.isArray(c.categorias) || !Array.isArray(c.projetos)) return false;
  const porId = (lista: unknown[], chave: string) =>
    [...lista].sort((x, y) =>
      String((x as Record<string, unknown>)[chave]).localeCompare(String((y as Record<string, unknown>)[chave])),
    );
  const recebido = canonico({ tema: c.tema, categorias: porId(c.categorias, "area"), projetos: porId(c.projetos, "id") });
  return [conteudoDoBancoPadrao(), conteudoDoBancoPadraoLegado()].some(
    (padrao) =>
      recebido ===
      canonico({ tema: padrao.tema, categorias: porId([...padrao.categorias], "area"), projetos: porId([...padrao.projetos], "id") }),
  );
}
