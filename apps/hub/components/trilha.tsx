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
import { type Papel } from '@/lib/papeis';
import {
  itensDaRota,
  type AjusteDaPagina,
  type ItemDaTrilha,
} from '@/lib/trilha';

export type { ItemDaTrilha };

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
