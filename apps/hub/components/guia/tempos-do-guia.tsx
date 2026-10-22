"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button, ScrollBar, Tabs } from "@edu/ui/ds";

/**
 * As ABAS do guia da aula: os quatro tempos (Preparar, Conduzir, Fechar,
 * Consultar — `TEMPOS_DO_GUIA`, ADR-182), com o índice das seções do tempo
 * aberto ao lado.
 *
 * **Os quatro painéis ficam MONTADOS, e o fechado leva `hidden`** — o contrário
 * do `AbasDasAreas` e da sala, que só renderizam a aba aberta. Duas razões, as
 * duas do guia:
 *
 * - **o papel imprime os quatro tempos**: o professor conduz com a folha na
 *   mão, e `guia.css` devolve os painéis escondidos à impressão. Um painel que
 *   não existe no DOM não teria o que imprimir;
 * - **a âncora de uma seção precisa existir** antes de a aba dela abrir: o link
 *   `#roteiro` (do índice, de outra tela, de um favorito) troca a aba e rola até
 *   a seção.
 *
 * `hidden` é `display: none`: tira o painel da ordem do Tab e da árvore de
 * acessibilidade. Não é o defeito do `Collapse` fechado (botões focáveis dentro
 * de `aria-hidden`) — nada fica alcançável sem ser visto.
 *
 * Os botões são o `Tabs` do DS (`id="tab-<valor>"`); o painel é um `div` com
 * `role="tabpanel"`, `id="tabpanel-<valor>"` e `aria-labelledby` na aba,
 * porque o `TabPanel` do DS desmonta a aba fechada. (O `Tab` montado por
 * `items` não emite `aria-controls` na 0.2.19: lacuna pedida ao DS.)
 */

export interface TempoNaTela {
  id: string;
  rotulo: string;
  quando: string;
  icone: string;
  secoes: ReadonlyArray<{ id: string; titulo: string }>;
}

/** O valor da aba leva prefixo: o DS monta `id="tab-<valor>"`, e "conduzir" sozinho colidiria com outra aba da página. */
const valorDaAba = (tempo: string) => `guia-${tempo}`;

export function TemposDoGuia({
  tempos,
  paineis,
}: {
  tempos: readonly TempoNaTela[];
  /** O conteúdo de cada tempo, montado no servidor (com os blocos vivos). */
  paineis: Record<string, ReactNode>;
}) {
  const [ativo, setAtivo] = useState(tempos[0]?.id ?? "");
  /** A seção a rolar depois que a aba dela abrir — o painel precisa estar visível para ter posição. */
  const [rolarPara, setRolarPara] = useState<string | null>(null);

  const tempoDaAncora = useCallback(
    (ancora: string) => tempos.find((t) => t.id === ancora || t.secoes.some((s) => s.id === ancora)),
    [tempos],
  );

  /* O endereço escolhe a aba: `#conduzir` abre o tempo, `#debate` abre o tempo
     do debate e rola até ele. É o que mantém vivo o link antigo para uma seção. */
  useEffect(() => {
    const aplicar = () => {
      const ancora = decodeURIComponent(window.location.hash.slice(1));
      const tempo = ancora ? tempoDaAncora(ancora) : undefined;
      if (!tempo) return;
      setAtivo(tempo.id);
      setRolarPara(ancora === tempo.id ? null : ancora);
    };
    aplicar();
    window.addEventListener("hashchange", aplicar);
    return () => window.removeEventListener("hashchange", aplicar);
  }, [tempoDaAncora]);

  useEffect(() => {
    if (!rolarPara) return;
    document.getElementById(rolarPara)?.scrollIntoView({ block: "start" });
    setRolarPara(null);
  }, [rolarPara, ativo]);

  const abrir = (tempo: string, secao?: string) => {
    setAtivo(tempo);
    window.history.replaceState(null, "", `#${secao ?? tempo}`);
    if (secao) setRolarPara(secao);
  };

  const indice = tempos.findIndex((t) => t.id === ativo);
  const aberto = tempos[indice];
  const proximo = tempos[indice + 1];

  return (
    <div className="guia-tempos flex flex-col gap-6">
      <div className="guia-fora-do-papel guia-tempos__abas">
        <ScrollBar orientation="horizontal" autoHide>
          <Tabs
            value={valorDaAba(ativo)}
            onChange={(valor) => abrir(String(valor).replace(/^guia-/, ""))}
            items={tempos.map((t) => ({
              value: valorDaAba(t.id),
              label: (
                <span className="guia-tempos__rotulo">
                  <span>{t.rotulo}</span>
                  <span className="guia-tempos__quando">{t.quando}</span>
                </span>
              ),
              icon: t.icone,
            }))}
          />
        </ScrollBar>
      </div>

      <div className="guia__corpo grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="guia-fora-do-papel hidden lg:block" aria-label="Seções do guia">
          <div className="guia-indice">
            {tempos.map((tempo) => (
              <div key={tempo.id} className="guia-indice__tempo" data-aberto={tempo.id === ativo || undefined}>
                <button type="button" className="guia-indice__titulo" onClick={() => abrir(tempo.id)}>
                  {tempo.rotulo}
                </button>
                {tempo.id === ativo
                  ? tempo.secoes.map((secao) => (
                      <a
                        key={secao.id}
                        className="guia-indice__link"
                        href={`#${secao.id}`}
                        onClick={(evento) => {
                          evento.preventDefault();
                          abrir(tempo.id, secao.id);
                        }}
                      >
                        {secao.titulo}
                      </a>
                    ))
                  : null}
              </div>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-8">
          {tempos.map((tempo) => (
            <div
              key={tempo.id}
              role="tabpanel"
              id={`tabpanel-${valorDaAba(tempo.id)}`}
              aria-labelledby={`tab-${valorDaAba(tempo.id)}`}
              hidden={tempo.id !== ativo}
              className="guia-tempo"
              data-tempo={tempo.id}
            >
              {/* Só no papel: na tela quem diz o tempo é a aba. */}
              <p className="guia-tempo__no-papel">
                {tempo.rotulo} · {tempo.quando}
              </p>
              <div className="flex flex-col gap-10">{paineis[tempo.id]}</div>
            </div>
          ))}

          {aberto && proximo ? (
            <div className="guia-fora-do-papel flex flex-wrap items-center justify-between gap-4 border-t border-unooria-neutral-200 pt-5">
              <p className="text-[13px] text-unooria-neutral-500">
                Próximo tempo: {proximo.rotulo.toLowerCase()}, {proximo.quando.toLowerCase()}.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  abrir(proximo.id);
                  window.scrollTo({ top: 0 });
                }}
              >
                Ir para {proximo.rotulo}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
