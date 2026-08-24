/**
 * Os produtos da Plataforma Unooria.
 *
 * A plataforma deixou de ser "a tela de uma atividade" e passou a ser um **hub**
 * com dois produtos independentes:
 *
 * 1. **Gerador de Plano de Aula** — ferramenta de autoria, roda fora daqui.
 * 2. **Entre Redes** — trilha de missões de letramento digital, dentro da
 *    plataforma (`lib/entre-redes/catalogo.ts`).
 *
 * Por isso o header do professor não carrega mais atalhos para "Guia da aula" e
 * "Plano de aula": eram links de uma plataforma de atividade única. A navegação
 * agora desce pelo hub (produto → missão → atividade) e volta pelo breadcrumb.
 *
 * Nada aqui aparece para o aluno: o aparelho não menciona aula, plano nem
 * professor (regra de ouro 1 do CLAUDE.md).
 */

import { MISSOES_DISPONIVEIS } from "@/lib/entre-redes/catalogo";
import { PLANO_DE_AULA_URL } from "@/lib/plano-de-aula";

export type Produto = {
  slug: "plano-de-aula" | "entre-redes";
  nome: string;
  /** Uma linha do que o produto é. */
  chamada: string;
  /** O parágrafo do card no hub. */
  descricao: string;
  destino: string;
  /** `true` ⇒ abre em nova guia (o professor não pode perder um formulário). */
  externo: boolean;
  /** Rótulo da ação principal do card. */
  acao: string;
  /** Linha de estado à direita do card ("1 missão disponível"). */
  situacao: string;
};

export const PRODUTOS: Produto[] = [
  {
    slug: "plano-de-aula",
    nome: "Gerador de Plano de Aula",
    chamada: "Autoria",
    descricao:
      "Monte o plano da sua aula a partir do conteúdo que vai trabalhar: objetivos, roteiro e materiais, prontos para editar.",
    destino: PLANO_DE_AULA_URL,
    externo: true,
    acao: "Abrir gerador",
    situacao: "Ferramenta externa",
  },
  {
    slug: "entre-redes",
    nome: "Entre Redes",
    chamada: "Letramento digital",
    descricao:
      "Trilha de missões em que a turma vive por dentro como as redes funcionam — e depois discute o que aconteceu. Cada ano tem 4 unidades, uma missão por unidade.",
    destino: "/professor/entre-redes",
    externo: false,
    acao: "Entrar no Entre Redes",
    situacao:
      MISSOES_DISPONIVEIS.length === 1
        ? "1 missão disponível"
        : `${MISSOES_DISPONIVEIS.length} missões disponíveis`,
  },
];

export function buscarProduto(slug: Produto["slug"]): Produto {
  const produto = PRODUTOS.find((item) => item.slug === slug);
  // O catálogo é estático: um slug ausente é erro de programação, não de dado.
  if (!produto) throw new Error(`Produto desconhecido: ${slug}`);
  return produto;
}
