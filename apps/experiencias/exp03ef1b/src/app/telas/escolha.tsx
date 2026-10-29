import { useState } from "react";
import { CAIXA_VAZIA, caixaDosItens, itensDaCaixa, porNaCaixa, tirarDaCaixa, type Caixa } from "../../lib/regras";
import { CABECALHO, E2, NINA, NOME_CURTO_DO_SUPORTE } from "../../lib/textos";
import type { ReportagemPublica } from "../../lib/tipos";
import { Cabecalho } from "../jornal/cabecalho";
import { AcaoDaMissao } from "../mecanica/acoes";
import { BandejaDaEscolha, CaixaDaEscolha, VidroDaEscolha } from "../mecanica/caixa";
import { FalaDaNina } from "../mecanica/nina";
import { Casca } from "./casca";

/**
 * E2-ALU-01 — a ESCOLHA (o nome interno é `aposta`/`previsao`; na tela é
 * "escolha", spec §7.1). A dupla põe na caixa as notícias que acha que a
 * busca "Onde: Pátio" vai trazer e trava. Travar é o LATCH (`POST
 * previsao`): só vale quando a api confirma, e depois a caixa fica sob o
 * vidro esperando a professora liberar o filtro — sem botão.
 */
export function TelaDaEscolha({
  reportagens,
  previsao,
  ocupado,
  aoTravar,
  inicial,
}: {
  reportagens: readonly ReportagemPublica[];
  previsao: { itens: readonly string[]; travada: boolean };
  ocupado: boolean;
  aoTravar: (itens: string[]) => void;
  inicial?: { caixa?: Caixa };
}) {
  const [caixa, setCaixa] = useState<Caixa>(() => inicial?.caixa ?? (previsao.travada ? caixaDosItens(previsao.itens) : CAIXA_VAZIA));
  const travada = previsao.travada;
  const naCaixa = travada ? [...previsao.itens] : itensDaCaixa(caixa);
  const exibida = travada ? caixaDosItens(previsao.itens) : caixa;

  const noticias = reportagens.map((r) => ({ id: r.id, rotulo: r.kicker, curto: NOME_CURTO_DO_SUPORTE[r.suporte] }));
  const vazia = naCaixa.length === 0;

  return (
    <Casca topo={<Cabecalho direita={CABECALHO.suaEscolha} />}>
      {travada ? null : <FalaDaNina fala={NINA.escolha} />}
      <div className={`escolha${travada ? " escolha--travada" : ""}`}>
        <BandejaDaEscolha
          noticias={noticias}
          naCaixa={naCaixa}
          travada={travada}
          aoTocar={(id) => setCaixa((c) => porNaCaixa(c, id))}
          rodape={
            !travada && !vazia ? (
              <AcaoDaMissao variante="outline" larga aoTocar={() => setCaixa(CAIXA_VAZIA)}>
                {E2.esvaziar}
              </AcaoDaMissao>
            ) : undefined
          }
        />
        <div className="escolha__caixa">
          <CaixaDaEscolha
            caixa={exibida}
            noticias={noticias}
            travada={travada}
            aoTirar={(id) => setCaixa((c) => tirarDaCaixa(c, id))}
            status={!travada && vazia ? E2.vazia : undefined}
            acao={
              travada ? null : (
                <AcaoDaMissao
                  desabilitado={vazia}
                  ocupado={ocupado}
                  icone="lock"
                  larga={vazia}
                  aoTocar={() => aoTravar(itensDaCaixa(caixa))}
                >
                  {E2.travar}
                </AcaoDaMissao>
              )
            }
          />
          {travada ? (
            <VidroDaEscolha titulo={E2.travada} linhas={[E2.travadaApoio(previsao.itens.length), E2.esperaFiltro]} />
          ) : null}
        </div>
      </div>
    </Casca>
  );
}
