/**
 * Os produtos da Plataforma Unooria.
 *
 * A plataforma deixou de ser "a tela de uma atividade" e passou a ser um **hub**
 * com dois produtos independentes:
 *
 * 1. **Gerador de Plano de Aula** — ferramenta de autoria; a experiência
 *    `exp-90` embedada em `/professor/plano-de-aula` (`lib/plano-de-aula.ts`).
 * 2. **Entre Redes** — trilha de missões de letramento digital, dentro da
 *    plataforma (`lib/entre-redes/catalogo.ts`).
 * 3. **Como você está?** — check-in de bem-estar do professor (DASS-21 em
 *    microdoses); a experiência `exp-91` embedada em `/professor/bem-estar`
 *    (`lib/bem-estar.ts`). O card mostra se o check-in de hoje já foi feito.
 *
 * Por isso o header do professor não carrega mais atalhos para "Guia da aula" e
 * "Plano de aula": eram links de uma plataforma de atividade única. A navegação
 * agora desce pelo hub (produto → missão → atividade) e volta pelo breadcrumb.
 *
 * Nada aqui aparece para o estudante: o aparelho não menciona aula, plano nem
 * professor (regra de ouro 1 do CLAUDE.md).
 */

import { MISSOES_DISPONIVEIS } from "@/lib/entre-redes/catalogo";
import { ROTA_BEM_ESTAR } from "@/lib/bem-estar";
import { ROTA_PLANO_DE_AULA } from "@/lib/plano-de-aula";

export type Produto = {
  slug: "plano-de-aula" | "entre-redes" | "bem-estar";
  nome: string;
  /** Uma linha do que o produto é. */
  chamada: string;
  /** O parágrafo do card no hub. */
  descricao: string;
  destino: string;
  /** `true` ⇒ abre em nova guia. Hoje nenhum produto é externo; o campo fica
   *  para o próximo parceiro que ainda rode fora da plataforma. */
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
    destino: ROTA_PLANO_DE_AULA,
    externo: false,
    acao: "Abrir gerador",
    situacao: "Ferramenta de autoria",
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
  {
    slug: "bem-estar",
    nome: "Como você está?",
    chamada: "Bem-estar",
    descricao:
      "Três frases e um espaço para contar como foi a semana — menos de um minuto por dia. Em sete dias, um retrato só seu, que ninguém mais vê.",
    destino: ROTA_BEM_ESTAR,
    externo: false,
    acao: "Fazer o check-in",
    // Substituída na página do hub pelo estado real (`GET /bemestar/resumo`).
    situacao: "Menos de 1 minuto por dia",
  },
];

export function buscarProduto(slug: Produto["slug"]): Produto {
  const produto = PRODUTOS.find((item) => item.slug === slug);
  // O catálogo é estático: um slug ausente é erro de programação, não de dado.
  if (!produto) throw new Error(`Produto desconhecido: ${slug}`);
  return produto;
}
