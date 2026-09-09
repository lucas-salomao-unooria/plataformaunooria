/**
 * O REGISTRO DE ROTAS DA TRILHA — a resposta a "qual é o breadcrumb desta
 * página".
 *
 * Lógica pura, sem React, e mora em `lib/` por um motivo mecânico: o
 * `vitest.config.ts` do hub só varre os testes dentro de `lib/`. Enquanto isto
 * vivia em `components/trilha.tsx`, o registro não tinha rede nenhuma — e o
 * jeito de ele quebrar é justamente o que passa no typecheck: mudar o formato
 * do slug do ano faz a trilha cair no rótulo genérico ("Missão") sem erro
 * nenhum, em silêncio, em 12 telas.
 *
 * Quem RENDERIZA é `components/trilha.tsx` (`TrilhaDaRota`, chamado pelo layout
 * de cada área). A doutrina — por que a trilha é do layout e não da página —
 * está em `apps/hub/AGENTS.md`.
 */

// Caminho relativo, e não `@/lib/papeis`: o `vitest.config.ts` do hub não
// declara o alias `@` — é o Next que o resolve. O resto de `lib/` faz igual.
import { homeDoPapel, type Papel } from "./papeis";

export type ItemDaTrilha = {
  label: string;
  /** Ausente no item atual (o último), que nunca é link. */
  href?: string;
};

/* ==========================================================================
   O REGISTRO DE ROTAS

   Uma trilha por página é o desenho que produziu o defeito: nada obriga, então
   umas têm e outras não. Aqui o dono da trilha é a ROTA, e quem a desenha é o
   layout da área — página nova ganha trilha sem fazer nada, e não existe mais
   o estado "esqueci".

   O que uma tabela de rotas NÃO sabe é o nome próprio do que vive atrás de um
   `[id]`: o título da atividade, o nome da turma. Para esses a página publica o
   rótulo (`RotuloDaTrilha`), e o padrão daqui é um rótulo de DOMÍNIO
   ("Atividade", "Turma", "Estudante") — nunca o segmento cru da URL. Ou seja: a
   página só melhora a trilha, jamais a apaga. É essa assimetria que faz a
   ausência ser impossível por esquecimento.
   ========================================================================== */

type Segmentos = string[];

type NoDaTrilha = {
  /**
   * Rótulo humano do nó — em português, com acento, no vocabulário do domínio.
   * Função quando ele sai do próprio endereço (o slug do ano e da unidade).
   */
  rotulo: string | ((segmentos: Segmentos) => string);
  /**
   * Endereço do item. Ausente = o próprio caminho. `null` = o nó não tem tela
   * (entra como texto). String/função = o nó empresta o lugar a que pertence —
   * é o caso de `/professor/atividades`, segmento que não tem página nenhuma.
   */
  href?: string | null | ((segmentos: Segmentos) => string);
  /** Segmento estrutural, sem tela e sem nome: não entra na trilha. */
  oculto?: true;
  /**
   * A PÁGINA desenha a própria trilha e o layout se cala. Escape declarado, com
   * dono: hoje só os dois guias da aula, porque quem renderiza a trilha deles é
   * `components/guia/guia-da-aula.tsx`, por dentro, e duas trilhas na mesma tela
   * é pior que trilha nenhuma. Some quando o guia deixar de receber a prop.
   */
  aPaginaDesenha?: true;
};

/**
 * "8º ano · Unidade 1" a partir de `8-ano/unidade-1`.
 *
 * ESPELHA `rotuloDaMissao` + `ANOS` de `lib/entre-redes/catalogo.ts`, e não
 * importa dali de propósito: este módulo é client, e o catálogo carrega as
 * fichas e os guias das missões inteiras — 600 linhas de texto que iriam para o
 * bundle de TODA página da plataforma só para escrever quatro palavras. O custo
 * da cópia é que mudar o formato do slug do ano faz a trilha cair no genérico
 * ("Missão") em vez de acusar erro — e o `vitest` do hub só varre os testes
 * dentro de `lib/`, então hoje nada prende os dois formatos.
 */
function rotuloDaUnidade(segmentos: Segmentos): string {
  const [anoSlug, unidadeSlug] = segmentos.slice(-2);
  const ano = /^(\d+)-ano$/.exec(anoSlug ?? '');
  const serie = /^(\d+)-serie$/.exec(anoSlug ?? '');
  const lugar = ano ? `${ano[1]}º ano` : serie ? `${serie[1]}ª série` : null;
  if (!lugar) return 'Missão';
  const unidade = /^unidade-(\d+)$/.exec(unidadeSlug ?? '');
  return unidade ? `${lugar} · Unidade ${unidade[1]}` : lugar;
}

/** `.../estudantes` não tem tela: quem lista os estudantes é a de resultados. */
function resultadosDaMissao(segmentos: Segmentos): string {
  return `/${segmentos.slice(0, -1).join('/')}/resultados`;
}

/**
 * A hierarquia das rotas da plataforma. Chave = PADRÃO da rota, com `[x]` nos
 * segmentos dinâmicos, exatamente como a pasta em `app/`.
 */
const NOS: Record<string, NoDaTrilha> = {
  /* ---- professor ------------------------------------------------------- */
  '/professor': { rotulo: 'Início' },

  '/professor/entre-redes': { rotulo: 'Entre Redes' },
  // O ano sozinho não tem tela: a grade dos 12 anos é a própria trilha.
  '/professor/entre-redes/[ano]': { rotulo: 'Missão', oculto: true },
  '/professor/entre-redes/[ano]/[unidade]': { rotulo: rotuloDaUnidade },
  '/professor/entre-redes/[ano]/[unidade]/guia': {
    rotulo: 'Guia da aula',
    aPaginaDesenha: true,
  },
  '/professor/entre-redes/[ano]/[unidade]/resultados': {
    rotulo: 'Resultados da turma',
  },
  '/professor/entre-redes/[ano]/[unidade]/estudantes': {
    rotulo: 'Resultados da turma',
    href: resultadosDaMissao,
    // Não é `oculto`: é a tela DE ONDE o professor veio clicando num nome, e
    // sem ela a volta para a turma custa dois passos.
  },
  '/professor/entre-redes/[ano]/[unidade]/estudantes/[estudanteId]': {
    rotulo: 'Estudante',
  },

  // Transversal: mora fora da grade de ano/unidade, então tem os próprios nós.
  // O rótulo é curto de propósito — o título completo ("Vila do Lume — A Noite
  // Longa") ocupa meia trilha e o cabeçalho da página já o diz.
  '/professor/entre-redes/vila-do-lume': { rotulo: 'Vila do Lume' },
  '/professor/entre-redes/vila-do-lume/guia': {
    rotulo: 'Guia da aula',
    aPaginaDesenha: true,
  },
  '/professor/entre-redes/vila-do-lume/resultados': {
    rotulo: 'Resultados da turma',
  },
  '/professor/entre-redes/vila-do-lume/estudantes': {
    rotulo: 'Resultados da turma',
    href: resultadosDaMissao,
  },
  '/professor/entre-redes/vila-do-lume/estudantes/[estudanteId]': {
    rotulo: 'Estudante',
  },

  /* A atividade é uma configuração de missão do Entre Redes, mas a rota dela é
     rasa (`/professor/atividades/:id`). O segmento intermediário não tem tela,
     então empresta o lugar do produto de onde a atividade nasce. Não repetimos
     aqui a missão de origem: ela sai de um `MISSAO_ATUAL` fixo, que vira mentira
     no dia em que a segunda missão gerar atividade. */
  '/professor/atividades': { rotulo: 'Entre Redes', href: '/professor/entre-redes' },
  '/professor/atividades/nova': { rotulo: 'Nova atividade' },
  '/professor/atividades/[id]': { rotulo: 'Atividade' },
  '/professor/atividades/[id]/analise': { rotulo: 'Análise da turma' },

  '/professor/turmas': { rotulo: 'Minhas turmas' },
  '/professor/turmas/[id]': { rotulo: 'Turma' },

  // Os três produtos que são experiência embedada. O rótulo é o NOME DO PRODUTO
  // (`lib/produtos.ts`), que é o que o professor clicou no cartão.
  '/professor/plano-de-aula': { rotulo: 'Gerador de Plano de Aula' },
  '/professor/plano-de-ensino': { rotulo: 'Planejamento de Ensino' },
  '/professor/bem-estar': { rotulo: 'Como você está?' },

  /* ---- administração (gestor / admin-contrato) ------------------------- */
  // `/admin` não tem página: a área começa em `/admin/usuarios`.
  '/admin': { rotulo: 'Administração', oculto: true },
  '/admin/usuarios': { rotulo: 'Usuários' },
  '/admin/turmas': { rotulo: 'Turmas' },
  '/admin/turmas/[id]': { rotulo: 'Turma' },
  '/admin/importar': { rotulo: 'Importar pessoas' },
  '/admin/regionais': { rotulo: 'Regionais' },
  '/admin/escolas': { rotulo: 'Escolas' },
  '/admin/minhas-escolas': { rotulo: 'Minhas escolas' },
  '/admin/relatorios': { rotulo: 'Relatório' },
  '/admin/periodos-letivos': { rotulo: 'Ano letivo' },

  /* ---- análise de produto (admin-contrato) ----------------------------- */
  '/analise': { rotulo: 'Análise de produto' },
  // `oculto`, e não emprestando `/analise`: `/analise` já é prefixo desta rota
  // e o item apareceria duas vezes.
  '/analise/atividades': { rotulo: 'Atividades', oculto: true },
  '/analise/atividades/[id]': { rotulo: 'Atividade' },

  /* ---- estudante ------------------------------------------------------- */
  '/estudante': { rotulo: 'Minhas missões' },
};

function casa(padrao: string, caminho: Segmentos): boolean {
  const partes = padrao.split('/').filter(Boolean);
  if (partes.length !== caminho.length) return false;
  return partes.every((parte, i) => parte.startsWith('[') || parte === caminho[i]);
}

/** O nó de um caminho concreto. Padrão literal ganha de padrão com curinga. */
function noDoCaminho(caminho: Segmentos): NoDaTrilha | null {
  let melhor: { no: NoDaTrilha; curingas: number } | null = null;
  for (const [padrao, no] of Object.entries(NOS)) {
    if (!casa(padrao, caminho)) continue;
    const curingas = padrao.split('/').filter((p) => p.startsWith('[')).length;
    if (!melhor || curingas < melhor.curingas) melhor = { no, curingas };
  }
  return melhor?.no ?? null;
}

/**
 * Último recurso: rota que ninguém registrou acima.
 *
 * Humaniza o segmento em vez de devolver nada — trilha aproximada é um defeito
 * que se vê e se corrige; trilha ausente é o defeito que ninguém nota até o dono
 * do produto notar. Acento e vocabulário de domínio não se adivinham, e é por
 * isso que o rótulo certo mora no registro.
 */
function rotuloDeEmergencia(segmento: string): string {
  if (/^\d+$/.test(segmento) || /^[a-z0-9]{16,}$/i.test(segmento)) return 'Detalhe';
  const texto = segmento.replace(/-/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** O que a página publicou sobre um nó: um rótulo melhor, um endereço melhor. */
export type AjusteDaPagina = { label?: string; href?: string };

/**
 * Os itens da trilha de um endereço — a resposta a "qual é a trilha desta
 * página". Função pura, exportada para poder ser testada; o `vitest` do hub só
 * varre os testes dentro de `lib/`, então cobri-la pede mover isto (e `NOS`)
 * para `lib/trilha.ts` e deixar aqui só o que é React.
 *
 * Devolve `[]` quando não há trilha a desenhar — a home do papel (uma trilha de
 * um item só, que é a própria página, é ruído) e as rotas em que a página
 * desenha a sua.
 */
export function itensDaRota(
  pathname: string,
  papel: Papel,
  ajustes: Record<string, AjusteDaPagina> = {},
): ItemDaTrilha[] {
  const segmentos = pathname.split('/').filter(Boolean);
  if (segmentos.length === 0) return [];

  if (noDoCaminho(segmentos)?.aPaginaDesenha) return [];

  const home = homeDoPapel(papel);
  const itens: ItemDaTrilha[] = [{ label: 'Início', href: home }];

  for (let i = 1; i <= segmentos.length; i += 1) {
    const parcial = segmentos.slice(0, i);
    const caminho = `/${parcial.join('/')}`;
    // A home do papel já é o primeiro item; repetida, viraria "Início / Usuários"
    // apontando os dois para o mesmo lugar.
    if (caminho === home) continue;

    const no = noDoCaminho(parcial);
    if (no?.oculto) continue;

    const ajuste = ajustes[caminho];
    const rotulo = no?.rotulo;
    const label =
      ajuste?.label ??
      (typeof rotulo === 'function'
        ? rotulo(parcial)
        : (rotulo ?? rotuloDeEmergencia(parcial[i - 1] ?? '')));

    const href =
      ajuste?.href ??
      (no?.href === null
        ? undefined
        : typeof no?.href === 'function'
          ? no.href(parcial)
          : (no?.href ?? caminho));

    itens.push({ label, href });
  }

  // Só a raiz = a própria home. Não é trilha.
  if (itens.length < 2) return [];

  // O último item é a página atual e nunca é link.
  const ultimo = itens[itens.length - 1]!;
  itens[itens.length - 1] = { label: ultimo.label };
  return itens;
}
