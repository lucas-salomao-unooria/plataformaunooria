import { CABECALHO, E3, NOME_CURTO_DO_SUPORTE } from "../../lib/textos";
import { SUPORTES, type ReportagemPublica } from "../../lib/tipos";
import { enderecoDaImagem } from "../comum/midia";
import { SeloDoJornal } from "../jornal/acoes";
import { Cabecalho } from "../jornal/cabecalho";
import { CartaoDaReportagem } from "../jornal/reportagem";
import { AcaoDaMissao } from "../mecanica/acoes";
import { Espera } from "../mecanica/espera";
import { MetaDaNina, SuaEscolha } from "../mecanica/meta";
import { Casca } from "./casca";

/**
 * E3-ALU-02 — a omissão visível: à esquerda a escolha travada; à direita as
 * notícias que a busca "Onde = Pátio" encontrou (as do servidor); embaixo a
 * Meta de Nina com a do telão TRACEJADA. "Confrontar e Aguardar Turma" pede
 * o passo `ficha`; com a etapa ainda em `filtro`, a api devolve
 * `aguardandoOProfessor` e a tela cai na espera (E3-SIS-01), sem botão —
 * e SEM o "[Demo: Liberar Inspeção]" do protótipo.
 */
export function TelaDaOmissao({
  reportagens,
  escolhidas,
  encontradas,
  aguardando,
  ocupado,
  aoConfrontar,
}: {
  reportagens: readonly ReportagemPublica[];
  escolhidas: readonly string[];
  encontradas: readonly string[];
  aguardando: boolean;
  ocupado: boolean;
  aoConfrontar: () => void;
}) {
  const achadas = reportagens.filter((r) => encontradas.includes(r.id));
  const nomesEscolhidos = reportagens
    .filter((r) => escolhidas.includes(r.id))
    .map((r) => NOME_CURTO_DO_SUPORTE[r.suporte]);
  const nomes =
    nomesEscolhidos.length > 1 ? `${nomesEscolhidos.slice(0, -1).join(", ")} e ${nomesEscolhidos.at(-1)}` : (nomesEscolhidos[0] ?? "");

  return (
    <>
      <Casca
        inerte={aguardando}
        topo={<Cabecalho direita={CABECALHO.filtroAtivo} />}
        acoes={
          aguardando ? undefined : (
            <AcaoDaMissao depois="play_arrow" ocupado={ocupado} aoTocar={aoConfrontar}>
              {E3.confrontar}
            </AcaoDaMissao>
          )
        }
      >
        <div className="omissao">
          <SuaEscolha quantas={escolhidas.length} nomes={nomes} />
          <section className="omissao__encontradas" aria-label={E3.encontradas}>
            <div className="omissao__cabeca">
              <h2 className="titulo-de-secao">{E3.encontradas}</h2>
              <SeloDoJornal forte>{E3.contador(achadas.length)}</SeloDoJornal>
            </div>
            <div className="grade-de-dois">
              {achadas.map((r) => (
                <CartaoDaReportagem
                  key={r.id}
                  imagem={enderecoDaImagem(r.imagem, r.suporte)}
                  alt={r.imagem.alt}
                  kicker={r.kicker}
                  manchete={r.manchete}
                />
              ))}
            </div>
          </section>
        </div>
        <MetaDaNina
          coberturas={SUPORTES.map((s) => {
            const r = reportagens.find((x) => x.suporte === s);
            return { nome: NOME_CURTO_DO_SUPORTE[s], presente: Boolean(r && encontradas.includes(r.id)) };
          })}
        />
      </Casca>
      {aguardando ? <Espera titulo={E3.conversar} apoio={E3.conversarApoio} /> : null}
    </>
  );
}
