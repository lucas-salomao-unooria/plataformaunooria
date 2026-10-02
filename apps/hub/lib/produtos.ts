/**
 * Os produtos da Plataforma Unooria.
 *
 * A plataforma deixou de ser "a tela de uma atividade" e passou a ser um **hub**
 * com dois produtos independentes:
 *
 * 1. **Gerador de Plano de Aula** — ferramenta de autoria; a experiência
 *    `app-90` embedada em `/professor/plano-de-aula` (`lib/plano-de-aula.ts`).
 * 2. **Entre Redes** — trilha de missões de letramento digital, dentro da
 *    plataforma (`lib/entre-redes/catalogo.ts`).
 * 3. **Como você está?** — check-in de bem-estar do professor (DASS-21 em
 *    microdoses); a experiência `app-91` embedada em `/professor/bem-estar`
 *    (`lib/bem-estar.ts`). O card mostra se o check-in de hoje já foi feito.
 *
 * Por isso o header do professor não carrega mais atalhos para "Guia da aula" e
 * "Plano de aula": eram links de uma plataforma de atividade única. A navegação
 * agora desce pelo hub (produto → missão → atividade) e volta pelo breadcrumb.
 *
 * Nada aqui aparece para o estudante: o aparelho não menciona aula, plano nem
 * professor (regra de ouro 1 do CLAUDE.md).
 *
 * **Produto SEM card** (`PRODUTOS_SEM_CARD`): o agente de IA do professor. A
 * superfície dele é o botão flutuante do layout de `/professor`, não um card na
 * home (`docs/regras/agente-professor.md`). Ele mora numa lista SEPARADA, e não
 * como `PRODUTOS` com uma marca "sem card", porque a home itera `PRODUTOS` e o
 * `ICONES` de `components/cartao-produto.tsx` é exaustivo sobre o slug: na mesma
 * lista, ele viraria card na primeira tela que esquecesse o filtro. Aqui ele só
 * dá NOME ao interruptor do painel da Unooria (`buscarProduto`).
 */

import { MISSOES_DISPONIVEIS } from "@/lib/entre-redes/catalogo";
import { ROTA_BEM_ESTAR } from "@/lib/bem-estar";
import { ROTA_PLANO_DE_AULA } from "@/lib/plano-de-aula";
import { ROTA_PLANO_DE_ENSINO } from "@/lib/plano-de-ensino";

export type Produto = {
  slug: "plano-de-aula" | "plano-de-ensino" | "entre-redes" | "bem-estar";
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
    slug: "plano-de-ensino",
    nome: "Planejamento de Ensino",
    chamada: "Currículo e planejamento",
    descricao:
      "Do plano anual ao plano de cada aula, a partir das habilidades da BNCC do seu componente e ano. Você escolhe o que trabalhar em cada bimestre; a ferramenta escreve o plano e organiza a semana.",
    destino: ROTA_PLANO_DE_ENSINO,
    externo: false,
    acao: "Abrir planejamento",
    situacao: "1º ano do Fundamental à 3ª série do Médio",
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
    acao: "Responder hoje",
    // Substituída na página do hub pelo estado real (`GET /bemestar/resumo`).
    situacao: "Menos de 1 minuto por dia",
  },
];

/** A COPY de um produto — o que o painel da Unooria precisa para nomear o interruptor. */
export type CopyDoProduto = Pick<Produto, "nome" | "chamada" | "descricao"> & { slug: SlugDeProduto };

/** Os produtos que existem e NÃO têm card na home do professor. */
export const PRODUTOS_SEM_CARD = [
  {
    slug: "agente-professor",
    nome: "Agente de IA do professor",
    chamada: "Dúvidas sobre a BNCC e o material",
    descricao:
      "Um chat no canto das telas do professor, que responde sobre a BNCC — inclusive a de Computação — e sobre os livros da Unooria, citando a fonte e a página.",
  },
  {
    /* A Ajuda com avatar (ADR-132): o item "Ajuda" do menu da conta, em todas
       as áreas menos a do estudante. Sem card — é suporte, não ferramenta. */
    slug: "ajuda",
    nome: "Ajuda com atendente",
    chamada: "Tire dúvidas sobre a plataforma",
    descricao:
      "Um atendente em vídeo, aberto pelo menu da conta, que explica por voz ou por texto como usar a plataforma. Para professores e equipes de gestão; estudantes não veem.",
  },
] as const satisfies ReadonlyArray<{ slug: string; nome: string; chamada: string; descricao: string }>;

/** Todo slug de produto que o hub conhece — a cópia do `PRODUTOS` da api (`src/recursos/catalogo.ts`). */
export type SlugDeProduto = Produto["slug"] | (typeof PRODUTOS_SEM_CARD)[number]["slug"];

export function buscarProduto(slug: SlugDeProduto): CopyDoProduto {
  const produto = [...PRODUTOS, ...PRODUTOS_SEM_CARD].find((item) => item.slug === slug);
  // O catálogo é estático: um slug ausente é erro de programação, não de dado.
  if (!produto) throw new Error(`Produto desconhecido: ${slug}`);
  return { slug: produto.slug, nome: produto.nome, chamada: produto.chamada, descricao: produto.descricao };
}
