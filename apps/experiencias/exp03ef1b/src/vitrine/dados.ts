import type { BlocoPublico, EtiquetaPublica, PassoDaSimulacao, Sessao } from "../lib/tipos";

/**
 * Dados de EXEMPLO da vitrine (só desenvolvimento): o banco padrão da Feira de
 * Troca de Livros, com ids opacos inventados e SEM imagem (`url: null`), para
 * a tela desenhar as ilustrações locais. Nada daqui vai ao bundle.
 */
export const JORNAL: Sessao["jornal"] = {
  tema: "Feira de Troca de Livros",
  cartaz: { texto: "Feira de Troca de Livros", imagem: { url: null, alt: "Cartaz da Feira de Troca de Livros, com um calendário." } },
  reportagens: [
    {
      id: "rp-a1b",
      suporte: "mural",
      kicker: "Mural Impresso",
      manchete: "Feira de Livros",
      legenda: "Estudantes trocam gibis no pátio com árvores.",
      lugar: "Pátio escolar",
      imagem: { url: null, alt: "Foto no mural: crianças trocam gibis no pátio, com árvores e o cartaz da feira." },
    },
    {
      id: "rp-c2d",
      suporte: "portal",
      kicker: "Portal da Escola",
      manchete: "Livros no Pátio",
      legenda: "Mesas compridas com livros no pátio da escola.",
      lugar: "Pátio escolar",
      imagem: { url: null, alt: "Foto no portal: mesas compridas cheias de livros no pátio, com o cartaz da feira." },
    },
    {
      id: "rp-e3f",
      suporte: "telao",
      kicker: "Telão do Corredor",
      manchete: "Troca de Leituras",
      legenda: "Crianças leem juntas no banco do pátio ensolarado.",
      lugar: "Pátio escolar",
      imagem: { url: null, alt: "Foto no telão: crianças leem juntas num banco do pátio ensolarado, com o cartaz da feira ao fundo." },
    },
  ],
};

export const IDS = JORNAL.reportagens.map((r) => r.id);

export const ETIQUETAS: EtiquetaPublica[] = [
  { id: "et-k9p", etiqueta: "patio", rotulo: "Pátio" },
  { id: "et-2mz", etiqueta: "estudantes", rotulo: "estudantes" },
  { id: "et-q7r", etiqueta: "sexta", rotulo: "sexta" },
];

/** Embaralhados, como o servidor os manda. */
export const BLOCOS: BlocoPublico[] = [
  { id: "bl-x1a", bloco: "ok", rotulo: "Marcar: ok" },
  { id: "bl-c4d", bloco: "pegar", rotulo: "Pegar próxima ficha" },
  { id: "bl-9fz", bloco: "enquanto", rotulo: "ENQUANTO houver ficha pendente" },
  { id: "bl-m2k", bloco: "revisar", rotulo: "Marcar: revisar" },
  { id: "bl-t8s", bloco: "senao", rotulo: "SENÃO" },
  { id: "bl-h3j", bloco: "se", rotulo: "SE campo Onde tem ícone" },
  { id: "bl-w6q", bloco: "fim", rotulo: "FIM: voltar à pilha" },
];

/** A esteira montada da vitrine (o desenho do protótipo), pelos ids acima. */
export const ESTEIRA_DO_PROTOTIPO = ["bl-9fz", "bl-c4d", "bl-h3j", "bl-x1a", "bl-t8s", "bl-m2k", "bl-w6q"];

export const SIMULACAO: PassoDaSimulacao[] = [
  { manchete: "Oficina de Pipas", marca: "ok", pendentes: 2 },
  { manchete: "Clube de Xadrez", marca: "revisar", pendentes: 1 },
  { manchete: "Horta da Escola", marca: "ok", pendentes: 0 },
];

export const CASO: NonNullable<Sessao["caso"]> = {
  tema: "Festival de Ciências",
  materias: [
    { id: "a", titulo: "Festival de Ciências", ficha: { quem: "estudantes", onde: "patio", quando: null }, imagem: { url: null, alt: "Estudantes mostram um vulcão de argila; o cartaz do festival marca sexta." } },
    { id: "b", titulo: "Festival de Ciências", ficha: { quem: "estudantes", onde: "patio", quando: null }, imagem: { url: null, alt: "Outros estudantes no mesmo pátio; o cartaz do festival marca sábado." } },
  ],
  ferramentas: [
    { id: "filtrar", rotulo: "Filtrar por campo", retorno: "0 notícias encontradas", aviso: "Campo Quando está vazio." },
    { id: "fotos", rotulo: "Olhar as fotos", retorno: "A foto A mostra sexta e a foto B mostra sábado.", aviso: null },
    { id: "fontes", rotulo: "Comparar fontes", retorno: "Nenhuma outra fonte encontrada na redação.", aviso: null },
  ],
};

export const FIM: NonNullable<Sessao["fim"]> = {
  resumo: { suportes: { escolhidas: 3 }, omissao: { encontradas: 2, deFora: "telao" }, reparo: { desfecho: "sucesso" }, automacao: { testes: 2 } },
};
