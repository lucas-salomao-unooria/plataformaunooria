import type { ConteudoDoPacote } from "./regras/preparo";
import type { Area, Disciplina } from "./vocabulario";

/**
 * O BANCO PADRÃO da exp06ef1b (PRD v2, RF-007, §12.2) — os dezesseis projetos
 * curados do banco de conteúdo (`dev/01e-banco-conteudo.md`,
 * txt-exp06ef1b-01 a 16), nas quatro áreas e chips do PRD: Tecnologia
 * (#robotica), Meio Ambiente (#meioambiente), Cultura (#artes) e Saúde
 * (#saude).
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
 * conteúdo pedagógico). Também não tem texto de PROTÓTIPO nem de DEPOIMENTO:
 * esses formatos repetem o bastidor e a legenda (`regras/publico.ts`).
 *
 * As imagens do banco são a ARTE PROCEDURAL que a experiência já desenha
 * (o brief de assets ainda não tem os arquivos): o pacote nasce sem `midia` e
 * com as imagens aprovadas.
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
];

/** O conteúdo do banco padrão, no formato do pacote (`ConteudoDoPacoteSchema`). */
export function conteudoDoBancoPadrao(): ConteudoDoPacote {
  return {
    tema: TEMA_DO_BANCO_PADRAO,
    categorias: CATEGORIAS_DO_BANCO_PADRAO.map((c) => ({ ...c })),
    projetos: LINHAS.map((l) => ({
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
 * O conteúdo é o banco padrão INTOCADO? Ordem de projetos e de chaves não
 * importa. É o que faz um pacote ser `padrao` e o podcast dele ser o do sheet.
 */
export function ehConteudoDoBancoPadrao(conteudo: unknown): boolean {
  if (conteudo === null || typeof conteudo !== "object") return false;
  const c = conteudo as { tema?: unknown; categorias?: unknown; projetos?: unknown };
  if (!Array.isArray(c.categorias) || !Array.isArray(c.projetos)) return false;
  const porId = (lista: unknown[], chave: string) =>
    [...lista].sort((x, y) =>
      String((x as Record<string, unknown>)[chave]).localeCompare(String((y as Record<string, unknown>)[chave])),
    );
  const padrao = conteudoDoBancoPadrao();
  return (
    canonico({ tema: c.tema, categorias: porId(c.categorias, "area"), projetos: porId(c.projetos, "id") }) ===
    canonico({ tema: padrao.tema, categorias: porId([...padrao.categorias], "area"), projetos: porId([...padrao.projetos], "id") })
  );
}
