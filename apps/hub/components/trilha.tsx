'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Breadcrumb } from '@edu/ui/ds';
import { homeDoPapel, type Papel } from '@/lib/papeis';

export type ItemDaTrilha = {
  label: string;
  /** Ausente no item atual (o último), que nunca é link. */
  href?: string;
};

/**
 * Breadcrumb do DS ligado ao roteador do Next.
 *
 * Existe porque o header do professor perdeu os atalhos fixos: com o hub de
 * produtos, a navegação é hierárquica (produto → missão → atividade) e é a
 * trilha que devolve o caminho de volta. O `as: Link` precisa ser costurado
 * aqui, num client component: referência de componente não atravessa a
 * fronteira RSC.
 *
 * **Quem monta os itens é o layout da área**, pelo `TrilhaDaRota` abaixo — não
 * a página. `Trilha` continua exportada porque o guia da aula
 * (`components/guia/guia-da-aula.tsx`) desenha a trilha por dentro; fora dali,
 * página que chama `Trilha` na mão é a lacuna que este arquivo existe para
 * fechar.
 */
export function Trilha({ itens }: { itens: ItemDaTrilha[] }) {
  const ultimo = itens.length - 1;

  return (
    <Breadcrumb
      size="s"
      ariaLabel="Onde você está"
      /* Colapso é do DS. `maxItems={5}` porque a trilha mais funda que existe
         hoje tem 5 níveis (Início / Entre Redes / missão / resultados /
         estudante): ela cabe, e a de 6 que aparecer amanhã vira "..." em vez de
         quebrar em duas linhas. `itemsAfterCollapse={2}` mantém o PAI visível —
         é ele, e não a raiz, que o breadcrumb existe para devolver. */
      maxItems={5}
      itemsBeforeCollapse={1}
      itemsAfterCollapse={2}
      items={itens.map((item, indice) => {
        const atual = indice === ultimo;
        return {
          label: item.label,
          isCurrent: atual,
          // Item atual sai como texto: com `as` o DS renderiza um <Link> mesmo
          // marcado como current, e a página viraria link para si mesma.
          ...(atual || !item.href ? {} : { href: item.href, as: Link }),
        };
      })}
    />
  );
}

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
  '/admin/escolas': { rotulo: 'Escolas' },
  '/admin/minhas-escolas': { rotulo: 'Minhas escolas' },
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
type AjusteDaPagina = { label?: string; href?: string };

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

/* ==========================================================================
   O que a página publica
   ========================================================================== */

const ContextoDosAjustes = createContext<Record<string, AjusteDaPagina>>({});
const ContextoDoPublicador = createContext<
  ((caminho: string, ajuste: AjusteDaPagina | null) => void) | null
>(null);

/**
 * Liga a trilha do layout às páginas que vivem dentro dele. **Não renderiza DOM
 * nenhum** — de propósito: em `/professor/**` o `<main>` distribui a altura por
 * `main:has(> .tela-cheia)`, e um `<div>` a mais aqui quebraria o seletor de
 * filho direto e devolveria a barra de rolagem parada das telas de embed.
 */
export function ProvedorDaTrilha({ children }: { children: React.ReactNode }) {
  const [ajustes, setAjustes] = useState<Record<string, AjusteDaPagina>>({});

  const publicar = useCallback((caminho: string, ajuste: AjusteDaPagina | null) => {
    setAjustes((anterior) => {
      if (!ajuste) {
        if (!(caminho in anterior)) return anterior;
        const proximo = { ...anterior };
        delete proximo[caminho];
        return proximo;
      }
      const atual = anterior[caminho];
      if (atual?.label === ajuste.label && atual?.href === ajuste.href) return anterior;
      return { ...anterior, [caminho]: ajuste };
    });
  }, []);

  return (
    <ContextoDoPublicador.Provider value={publicar}>
      <ContextoDosAjustes.Provider value={ajustes}>{children}</ContextoDosAjustes.Provider>
    </ContextoDoPublicador.Provider>
  );
}

/**
 * A página diz o NOME do que ela está mostrando — o título da atividade, o nome
 * da turma —, porque uma tabela de rotas não tem como saber.
 *
 * Não renderiza nada e não pode apagar a trilha: sem ela o item continua lá com
 * o rótulo de domínio do registro ("Atividade", "Turma"). O custo é um quadro:
 * o HTML do servidor traz o rótulo genérico e a hidratação o troca pelo nome. É
 * o preço de a trilha ter UM autor — o layout, que renderiza antes da página e
 * não tem como perguntar nada a ela.
 *
 * `para` aponta outro nó da trilha (um ANTEPASSADO), para a tela que sabe o nome
 * de quem está acima dela.
 */
export function RotuloDaTrilha({
  valor,
  href,
  para,
}: {
  /** O nome próprio. `undefined`/`null` deixa o rótulo do registro valer. */
  valor?: string | null;
  /** Endereço melhor — o que carrega `?escolaId=`, por exemplo. */
  href?: string;
  /** Caminho do nó ajustado. Ausente = a própria página. */
  para?: string;
}) {
  const publicar = useContext(ContextoDoPublicador);
  const pathname = usePathname();
  const caminho = para ?? pathname;

  useEffect(() => {
    if (!publicar) return;
    if (!valor && !href) {
      publicar(caminho, null);
      return;
    }
    publicar(caminho, { label: valor ?? undefined, href });
    return () => publicar(caminho, null);
  }, [publicar, caminho, valor, href]);

  return null;
}

/**
 * A trilha da área, desenhada pelo LAYOUT.
 *
 * Renderiza `null` na home do papel e nas rotas que declaram
 * `aPaginaDesenha` — e nunca por esquecimento de quem escreveu a página.
 */
export function TrilhaDaRota({ papel }: { papel: Papel }) {
  const pathname = usePathname();
  const ajustes = useContext(ContextoDosAjustes);
  const itens = useMemo(() => itensDaRota(pathname, papel, ajustes), [pathname, papel, ajustes]);

  if (itens.length === 0) return null;

  /* O respiro é daqui e não da página: antes a trilha era o primeiro filho de
     uma coluna `gap-6` de cada página, e ao subir para o layout ela perderia o
     espaçamento. `mb-6` fica no lugar do gap que ela tinha. */
  return (
    <div className="mb-6">
      <Trilha itens={itens} />
    </div>
  );
}
