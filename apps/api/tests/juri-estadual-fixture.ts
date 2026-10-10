import type { ConteudoDoPacote } from "../src/juri-estadual/regras/preparo";
import { AREAS, IDS_DE_PROJETO, areaDoProjeto, type Area } from "../src/juri-estadual/vocabulario";

/**
 * Uma MOSTRA válida para as suítes da exp06ef1b — o que a IA devolveria e o
 * professor homologaria (com os quatro formatos de post): quatro áreas,
 * dezesseis projetos, dentro da régua de `invariantes.ts`. O banco padrão do
 * PRD v2 é outro (`src/juri-estadual/banco-padrao.ts`).
 */

const CATEGORIAS: Record<Area, { nome: string; hashtag: string; titulos: string[]; tema: string }> = {
  area_a: {
    nome: "Energia limpa",
    hashtag: "#energialimpa",
    tema: "energia",
    titulos: ["Placa solar de garrafa", "Cata-vento que acende luz", "Forno solar de caixa", "Pedal que carrega celular"],
  },
  area_b: {
    nome: "Água e cuidado",
    hashtag: "#aguaecuidado",
    tema: "água",
    titulos: ["Filtro de areia e carvão", "Cisterna da quadra", "Sensor de vazamento", "Chuveiro que avisa o tempo"],
  },
  area_c: {
    nome: "Alimentação",
    hashtag: "#alimentacao",
    tema: "comida",
    titulos: ["Horta vertical de pallet", "Composteira da cantina", "Mapa do lanche nutritivo", "Secador solar de frutas"],
  },
  area_d: {
    nome: "Robótica de sucata",
    hashtag: "#roboticasucata",
    tema: "robô",
    titulos: ["Braço hidráulico de seringa", "Carrinho de motor reciclado", "Robô que separa lixo", "Semáforo para a escola"],
  },
};

const ESCOLAS = [
  "Escola Municipal Professora Lúcia Andrade",
  "Escola Estadual Rio das Pedras",
  "Escola Municipal Vila Esperança",
  "Escola Estadual Monte Verde",
  "Escola Municipal Dona Cecília Prado",
  "Escola Estadual Campo Alegre",
  "Escola Municipal Sítio Novo",
  "Escola Estadual Vale do Sol",
  "Escola Municipal Mestre Benedito",
  "Escola Estadual Lagoa Azul",
  "Escola Municipal Recanto das Flores",
  "Escola Estadual Serra Bonita",
  "Escola Municipal Ponte Alta",
  "Escola Estadual Boa Vista do Norte",
  "Escola Municipal Jardim Primavera",
  "Escola Estadual Porto Seguro do Sul",
];

const EQUIPES = [
  "ana.e.joao",
  "lab.da.julia",
  "davi_e_yasmin",
  "equipe.kaua",
  "isadora.ciencia",
  "pedro.e.lara",
  "maria.eduarda.lab",
  "time.do.enzo",
  "beatriz.e.caio",
  "gabriel.inventa",
  "sofia.e.miguel",
  "clube.da.alice",
  "heitor.e.lis",
  "valentina.lab",
  "arthur.e.manu",
  "laura.e.theo",
];

export function conteudoDeTeste(tema = "Ciência que cuida da cidade"): ConteudoDoPacote {
  return {
    tema,
    categorias: AREAS.map((area) => ({ area, nome: CATEGORIAS[area].nome, hashtag: CATEGORIAS[area].hashtag })),
    projetos: IDS_DE_PROJETO.map((id, i) => {
      const area = areaDoProjeto(id);
      const c = CATEGORIAS[area];
      const titulo = c.titulos[Number(id.charAt(6)) - 1] as string;
      return {
        id,
        area,
        titulo,
        escola: ESCOLAS[i] as string,
        perfil: `@${EQUIPES[i]}`,
        legenda: `Nossa equipe montou o projeto ${titulo} com material reciclado da escola. A ideia ajuda a cuidar da ${c.tema} no bairro.`,
        bastidor: `Hoje testamos o protótipo do ${titulo} no pátio e anotamos o que precisa melhorar.`,
        prototipo: `De perto, o protótipo do ${titulo} mostra as peças recicladas que a equipe juntou.`,
        depoimento: `A equipe do ${titulo} conta que o mais difícil foi testar e refazer até funcionar.`,
        hashtags: [c.hashtag, "#mostraestadual"],
        imagem: {
          descricao: `Ilustração colorida do protótipo ${titulo} em um estande de feira de ciências escolar.`,
          alt: `Protótipo ${titulo} no estande da mostra.`,
        },
      };
    }),
  };
}

/** O mesmo conteúdo no formato CRU que a IA devolve (sem `area` nos projetos, sem `tema`). */
export function saidaDaIaDeTeste(): unknown {
  const c = conteudoDeTeste();
  return {
    categorias: c.categorias,
    projetos: c.projetos.map(({ area: _area, ...resto }) => resto),
  };
}

export const PARAMETROS_DE_TESTE = {
  disciplina: "ciencias" as const,
  tema: "Ciência que cuida da cidade",
  assuntos: "Energia, água, alimentação e reaproveitamento de materiais na escola.",
};
