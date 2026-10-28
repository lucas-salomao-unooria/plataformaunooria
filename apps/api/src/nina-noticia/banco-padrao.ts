import { aplicarEstrutura, type ConteudoDoPacote, type TextosDoPacote } from "./conteudo";
import type { Disciplina } from "./vocabulario";

/**
 * O BANCO PADRÃO da exp03ef1b — a Feira de Troca de Livros, o "Caminho Curto:
 * Pacote Curado Padrão" da professora (E0-PROF-02, um clique, sem IA) e o
 * FALLBACK do preparo (sem cota ou com a IA fora do ar: `usouIa: false`,
 * `motivo`).
 *
 * LITERAL das duas fontes, e cada campo diz de qual:
 *
 * - tema, disciplina e assuntos: a "Amostra 1 — Língua Portuguesa" do sheet de
 *   copy (`design/06-copy-strings-revisada.md`); os assuntos, que lá são uma
 *   lista, viram o texto do campo "Assunto da matéria" (spec §7.2);
 * - manchete e legenda: o acervo canônico do `dev/01e-banco-conteudo.md`
 *   (txt-exp03ef1b-01, §1);
 * - a descrição da cena (o texto do prompt da imagem): a `descricao_cena` da
 *   Amostra 1;
 * - o cartaz: o "Elemento comum (hitbox E1)" do 01e — o Cartaz da Feira de
 *   Troca de Livros, idêntico nas três fotos.
 *
 * O `alt` não existe em nenhuma das duas: foi escrito aqui, descrevendo a cena
 * sem acrescentar fato.
 *
 * A ESTRUTURA (suportes, fichas, lugar) não está aqui: sai de
 * `conteudo.ts#aplicarEstrutura`, como a de qualquer pacote.
 */

export const DISCIPLINA_DO_BANCO_PADRAO: Disciplina = "lingua-portuguesa";
export const TEMA_DO_BANCO_PADRAO = "Feira de Troca de Livros";
export const ASSUNTOS_DO_BANCO_PADRAO =
  "notícia escolar, suportes de comunicação, busca estruturada, local do evento";

export const TEXTOS_DO_BANCO_PADRAO: TextosDoPacote = {
  tema: TEMA_DO_BANCO_PADRAO,
  cartaz: {
    texto: "Feira de Troca de Livros",
    imagem: {
      descricao: "Cartaz da Feira de Troca de Livros, com livros desenhados com asas e um calendário.",
      alt: "Cartaz da Feira de Troca de Livros, com livros voando e um calendário.",
    },
  },
  reportagens: [
    {
      suporte: "mural",
      manchete: "Feira de Livros",
      legenda: "Estudantes trocam gibis no pátio com árvores.",
      imagem: {
        descricao:
          "Mural de cortiça com cartaz colorido da feira de livros e crianças trocando gibis no pátio com árvores.",
        alt: "Foto no mural: crianças trocam gibis no pátio, com árvores e o cartaz da feira.",
      },
    },
    {
      suporte: "portal",
      manchete: "Livros no Pátio",
      legenda: "Mesas compridas com livros no pátio da escola.",
      imagem: {
        descricao:
          "Página digital da escola mostrando foto ampla das mesas de livros no pátio e o mesmo cartaz ilustrado.",
        alt: "Foto no portal: mesas compridas cheias de livros no pátio, com o cartaz da feira.",
      },
    },
    {
      suporte: "telao",
      manchete: "Troca de Leituras",
      legenda: "Crianças leem juntas no banco do pátio ensolarado.",
      imagem: {
        descricao:
          "Telão do corredor exibindo crianças sorridentes lendo livros no pátio central da escola com o cartaz ao fundo.",
        alt: "Foto no telão: crianças leem juntas num banco do pátio ensolarado, com o cartaz da feira ao fundo.",
      },
    },
  ],
};

/** O pacote do banco padrão, já com a estrutura do servidor. Uma cópia nova por chamada. */
export function conteudoDoBancoPadrao(): ConteudoDoPacote {
  return aplicarEstrutura(structuredClone(TEXTOS_DO_BANCO_PADRAO));
}

/**
 * O conteúdo é o banco padrão INTOCADO? Homologar um rascunho que é
 * exatamente este conteúdo grava `origem = 'padrao'` (as imagens do banco,
 * geradas pelo `admin`, servem a ele).
 */
export function ehConteudoDoBancoPadrao(conteudo: ConteudoDoPacote): boolean {
  return JSON.stringify(conteudo) === JSON.stringify(conteudoDoBancoPadrao());
}
