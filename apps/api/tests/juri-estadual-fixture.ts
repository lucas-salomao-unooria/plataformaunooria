import type { ConteudoDoPacote } from "../src/juri-estadual/regras/preparo";
import {
  AREAS,
  IDS_DE_PROJETO,
  IDS_DE_PROJETO_LEGADOS,
  areaDoProjeto,
  numeroDoProjeto,
  type Area,
} from "../src/juri-estadual/vocabulario";

/**
 * Uma MOSTRA válida para as suítes da exp06ef1b — o que a IA devolveria e o
 * professor homologaria: quatro áreas, QUARENTA projetos (dez por área), dentro
 * da régua de `invariantes.ts`, sem os formatos da 0.4.x. O banco padrão é
 * outro (`src/juri-estadual/banco-padrao.ts`).
 *
 * `conteudoLegadoDeTeste` é o pacote de DEZESSEIS da 0.4.x (com protótipo e
 * depoimento), para as provas de que ele continua legível.
 */

const CATEGORIAS: Record<Area, { nome: string; hashtag: string; titulos: string[]; tema: string }> = {
  area_a: {
    nome: "Energia limpa",
    hashtag: "#energialimpa",
    tema: "energia",
    titulos: [
      "Placa solar de garrafa",
      "Cata-vento que acende luz",
      "Forno solar de caixa",
      "Pedal que carrega celular",
      "Lanterna de manivela",
      "Aquecedor solar de latas",
      "Gerador de roda d'água",
      "Poste solar da quadra",
      "Bateria de limão e moeda",
      "Mapa da luz desperdiçada",
    ],
  },
  area_b: {
    nome: "Água e cuidado",
    hashtag: "#aguaecuidado",
    tema: "água",
    titulos: [
      "Filtro de areia e carvão",
      "Cisterna da quadra",
      "Sensor de vazamento",
      "Chuveiro que avisa o tempo",
      "Jardim que segura a chuva",
      "Torneira de pedal",
      "Medidor de chuva caseiro",
      "Mapa das goteiras",
      "Reuso da água do bebedouro",
      "Teste da água do córrego",
    ],
  },
  area_c: {
    nome: "Alimentação",
    hashtag: "#alimentacao",
    tema: "comida",
    titulos: [
      "Horta vertical de pallet",
      "Composteira da cantina",
      "Mapa do lanche nutritivo",
      "Secador solar de frutas",
      "Temperos no lugar do sal",
      "Feira de troca de sementes",
      "Cardápio sem desperdício",
      "Pão de casca de banana",
      "Minhocário da horta",
      "Rótulo que ninguém lê",
    ],
  },
  area_d: {
    nome: "Robótica de sucata",
    hashtag: "#roboticasucata",
    tema: "robô",
    titulos: [
      "Braço hidráulico de seringa",
      "Carrinho de motor reciclado",
      "Robô que separa lixo",
      "Semáforo para a escola",
      "Mão de canudos e linha",
      "Varredor de pátio",
      "Bengala que vibra",
      "Contador do bicicletário",
      "Alarme de mochila esquecida",
      "Catavento que mede vento",
    ],
  },
};

const LUGARES = [
  "Professora Lúcia Andrade", "Rio das Pedras", "Vila Esperança", "Monte Verde", "Dona Cecília Prado",
  "Campo Alegre", "Sítio Novo", "Vale do Sol", "Mestre Benedito", "Lagoa Azul",
  "Recanto das Flores", "Serra Bonita", "Ponte Alta", "Boa Vista do Norte", "Jardim Primavera",
  "Porto Seguro do Sul", "Morro Agudo", "Cachoeira Grande", "Bela Aurora", "Pedra Branca",
  "Três Barras", "Santa Luzia do Campo", "Barra Funda", "Capão Seco", "Alto do Ipê",
  "Rio Pequeno", "Mata Fresca", "Lagoa Seca", "Terra Nova", "Cerro Azul",
  "Areia Branca", "Poço Fundo", "Bom Retiro do Sul", "Arraial Novo", "Coqueiral",
  "Fazendinha", "Pinheiral", "Baixa Verde", "Ribeirão Claro", "Quatro Bocas",
];

/** O pacote novo: os quarenta, em ordem numérica dentro de cada área. */
export function conteudoDeTeste(tema = "Ciência que cuida da cidade"): ConteudoDoPacote {
  return {
    tema,
    categorias: AREAS.map((area) => ({ area, nome: CATEGORIAS[area].nome, hashtag: CATEGORIAS[area].hashtag })),
    projetos: IDS_DE_PROJETO.map((id, i) => {
      const area = areaDoProjeto(id);
      const c = CATEGORIAS[area];
      /* `numeroDoProjeto`, e não `charAt(6)`: o `proj-a10` tem dois dígitos. */
      const titulo = c.titulos[numeroDoProjeto(id) - 1] as string;
      return {
        id,
        area,
        titulo,
        escola: `Escola ${i % 2 === 0 ? "Municipal" : "Estadual"} ${LUGARES[i] as string}`,
        perfil: `@equipe.${id.slice(5)}`,
        legenda: `Nossa equipe montou o projeto ${titulo} com material reciclado da escola. A ideia ajuda a cuidar da ${c.tema} no bairro.`,
        bastidor: `Ficha técnica do ${titulo}: material reciclado, montagem no laboratório e teste no pátio.`,
        hashtags: [c.hashtag, "#mostraestadual"],
        imagem: {
          descricao: `Ilustração colorida do protótipo ${titulo} em um estande de feira de ciências escolar.`,
          alt: `Protótipo ${titulo} no estande da mostra.`,
        },
      };
    }),
  };
}

/**
 * O pacote LEGADO da 0.4.x: dezesseis projetos (`proj-a1`…`proj-d4`), com os
 * formatos da saturação (protótipo e depoimento). Só existe no banco — a
 * escrita não o aceita mais.
 */
export function conteudoLegadoDeTeste(tema = "Ciência que cuida da cidade") {
  const novo = conteudoDeTeste(tema);
  return {
    ...novo,
    projetos: novo.projetos
      .filter((p) => IDS_DE_PROJETO_LEGADOS.includes(p.id))
      .map((p) => ({
        ...p,
        prototipo: `De perto, o protótipo do ${p.titulo} mostra as peças recicladas que a equipe juntou.`,
        depoimento: `A equipe do ${p.titulo} conta que o mais difícil foi testar e refazer até funcionar.`,
      })),
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

/** A saída crua da chamada das CATEGORIAS do preparo. */
export function categoriasDaIaDeTeste(): unknown {
  return { categorias: conteudoDeTeste().categorias };
}

/** A saída crua da chamada de UMA área do preparo: os dez projetos dela. */
export function areaDaIaDeTeste(area: Area): unknown {
  return {
    projetos: conteudoDeTeste()
      .projetos.filter((p) => p.area === area)
      .map(({ area: _area, ...resto }) => resto),
  };
}

export const PARAMETROS_DE_TESTE = {
  disciplina: "ciencias" as const,
  tema: "Ciência que cuida da cidade",
  assuntos: "Energia, água, alimentação e reaproveitamento de materiais na escola.",
};
