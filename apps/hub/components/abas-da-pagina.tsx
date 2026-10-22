"use client";

import { useEffect, useState, type ReactNode } from "react";

import { ScrollBar, Tabs } from "@edu/ui/ds";

/**
 * Abas que dividem UMA PÁGINA do professor em blocos — a ficha da missão
 * ("conhecer a missão") e a página da atividade (a aula, o conteúdo, as
 * equipes, as habilidades). É o template das telas de condução (ADR-182).
 *
 * **Todas as abas ficam MONTADAS; a fechada leva `hidden`.** Na página da
 * atividade isso não é escolha: o painel da aula consulta a api a cada 5 s e é
 * ele que chama `router.refresh()` quando a evidência muda — desmontado ao
 * abrir "Habilidades", o painel de habilidades pararia de acompanhar a aula, e
 * voltaria a mostrar o estado do carregamento da página. `hidden` é
 * `display: none`: nada fica focável sem ser visto (o defeito do `Collapse`
 * fechado, que deixa botões dentro de `aria-hidden`, não existe aqui).
 *
 * A âncora do endereço ABRE uma aba (`#atividade-habilidades`, o link de outra
 * tela), mas o clique NÃO a grava: o F5 da professora no meio da aula tem de
 * voltar à aba que o ESTADO escolhe — a Aula ao vivo, com a atividade em
 * andamento —, e não à aba em que ela estava conferindo uma imagem. É âncora e
 * não `?aba=` porque trocar a query refaria a página no servidor — seis
 * leituras da api, numa tela que o professor usa na frente da turma.
 *
 * Os botões são o `Tabs` do DS (`id="tab-<valor>"`); o painel é um `div` com
 * `role="tabpanel"`, `id="tabpanel-<valor>"` e `aria-labelledby` na aba,
 * porque o `TabPanel` do DS desmonta a aba fechada. (O `Tab` montado por
 * `items` não emite `aria-controls` na 0.2.19: lacuna pedida ao DS.)
 */

export interface AbaDaPagina {
  id: string;
  rotulo: string;
  /** Glifo do Material Symbols. Sem ele o `Tab` do DS desenha um "+", que leria como "adicionar". */
  icone?: string;
  /** Contador ou estado curto ao lado do rótulo ("3 a aprovar", "ao vivo"). */
  selo?: ReactNode;
  conteudo: ReactNode;
}

export function AbasDaPagina({
  abas,
  inicial,
  rotulo,
  prefixo = "aba",
}: {
  abas: readonly AbaDaPagina[];
  /** A aba que abre sem âncora no endereço — a página decide pelo estado (em andamento abre a aula). */
  inicial?: string;
  /** O nome do conjunto, para o leitor de tela. */
  rotulo: string;
  /** Prefixo do valor das abas: o DS monta `id="tab-<valor>"`, e duas listas de abas na mesma página não podem colidir. */
  prefixo?: string;
}) {
  const visiveis = abas.filter((a) => a.conteudo !== null && a.conteudo !== undefined && a.conteudo !== false);
  const ids = visiveis.map((a) => a.id).join("|");
  const primeira = visiveis.find((a) => a.id === inicial)?.id ?? visiveis[0]?.id ?? "";
  const [ativa, setAtiva] = useState(primeira);

  useEffect(() => {
    const aplicar = () => {
      const ancora = decodeURIComponent(window.location.hash.slice(1));
      const id = ancora.startsWith(`${prefixo}-`) ? ancora.slice(prefixo.length + 1) : "";
      if (ids.split("|").includes(id)) setAtiva(id);
    };
    aplicar();
    window.addEventListener("hashchange", aplicar);
    return () => window.removeEventListener("hashchange", aplicar);
  }, [prefixo, ids]);

  if (visiveis.length === 0) return null;
  /* Uma aba só não é escolha nenhuma: a barra viraria um rótulo com cara de botão. */
  if (visiveis.length === 1) return <div className="flex flex-col gap-6">{visiveis[0]!.conteudo}</div>;
  const valor = (id: string) => `${prefixo}-${id}`;
  /* A aba guardada pode ter sumido (a atividade saiu do ar e a "Aula ao vivo" não existe mais). */
  const aberta = visiveis.some((a) => a.id === ativa) ? ativa : primeira;

  return (
    <div className="abas-da-pagina flex flex-col gap-5" role="group" aria-label={rotulo}>
      <ScrollBar orientation="horizontal" autoHide>
        <Tabs
          value={valor(aberta)}
          onChange={(v) => {
            setAtiva(String(v).slice(prefixo.length + 1));
          }}
          items={visiveis.map((a) => ({
            value: valor(a.id),
            label: a.rotulo,
            icon: a.icone,
            showIcon: Boolean(a.icone),
            badge: a.selo,
            showBadge: a.selo !== undefined && a.selo !== null,
          }))}
        />
      </ScrollBar>
      {visiveis.map((a) => (
        <div
          key={a.id}
          role="tabpanel"
          id={`tabpanel-${valor(a.id)}`}
          aria-labelledby={`tab-${valor(a.id)}`}
          hidden={a.id !== aberta}
          data-aba={a.id}
        >
          <div className="flex flex-col gap-6">{a.conteudo}</div>
        </div>
      ))}
    </div>
  );
}
