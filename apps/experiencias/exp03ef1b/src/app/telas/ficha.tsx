import { useEffect, useState } from "react";
import { telemetria } from "../../lib/telemetria";
import { CABECALHO, E4, NINA, NOME_CURTO_DO_SUPORTE, ROTULO_DO_VALOR } from "../../lib/textos";
import { PULSO_DA_INSPECAO_MS, type Ficha, type ReportagemPublica } from "../../lib/tipos";
import { enderecoDaImagem } from "../comum/midia";
import { AcaoDoJornal } from "../jornal/acoes";
import { Cabecalho } from "../jornal/cabecalho";
import { FotoDaMateria } from "../jornal/painel";
import { AcaoDaMissao } from "../mecanica/acoes";
import { FichaDeCampos, type ConteudoDoCampo } from "../mecanica/ficha";
import { FalaDaNina } from "../mecanica/nina";
import { Casca } from "./casca";

function conteudoDaFicha(ficha: Ficha): Record<"quem" | "onde" | "quando", ConteudoDoCampo> {
  const de = (v: keyof typeof ROTULO_DO_VALOR | null): ConteudoDoCampo => (v ? { tipo: "valor", rotulo: ROTULO_DO_VALOR[v] } : { tipo: "vazio" });
  return { quem: de(ficha.quem), onde: de(ficha.onde), quando: de(ficha.quando) };
}

export { conteudoDaFicha };

/**
 * E4-ALU-01 — a ficha do telão. A foto grande (que MOSTRA o pátio) e
 * "Inspecionar Ficha"; 15 s sem abrir, o botão pulsa (e o `POST ficha` leva
 * `dica: true` — a régua da EF15CO08). Aberta, a gaveta "Ficha da
 * Reportagem" mostra Quem e Quando preenchidos e o Onde VAZIO. "Avançar" só
 * depois de abrir. Sem lupa guiada (spec §7.4).
 */
export function TelaDaFicha({
  telao,
  ficha,
  jaAberta,
  ocupado,
  aoAbrir,
  aoAvancar,
  inicial,
}: {
  telao: ReportagemPublica;
  ficha: Ficha | null;
  jaAberta: boolean;
  ocupado: boolean;
  aoAbrir: (dica: boolean) => void;
  aoAvancar: () => void;
  inicial?: { pulsando?: boolean };
}) {
  const [pulsando, setPulsando] = useState(inicial?.pulsando ?? false);
  const aberta = jaAberta && ficha !== null;

  useEffect(() => {
    if (aberta || inicial?.pulsando !== undefined) return;
    const relogio = window.setTimeout(() => setPulsando(true), PULSO_DA_INSPECAO_MS);
    return () => window.clearTimeout(relogio);
  }, [aberta, inicial?.pulsando]);

  return (
    <Casca topo={<Cabecalho direita={CABECALHO.inspecao} />} corpo="casca__corpo--gaveta">
      <div className="ficha-tela">
        <div className="ficha-tela__materia">
          <FalaDaNina fala={NINA.ficha} />
          <article className="quadro-jornal materia-grande">
            <FotoDaMateria src={enderecoDaImagem(telao.imagem, "telao")} alt={telao.imagem.alt} className="materia-grande__foto" />
            <p className="materia-grande__kicker">{telao.kicker}</p>
            <h2 className="materia-grande__titulo">{telao.manchete}</h2>
            <div>
              <AcaoDoJornal
                variante="secondary"
                pulsando={pulsando && !aberta}
                desabilitado={ocupado || aberta}
                aoTocar={() => {
                  telemetria.abriuFicha(pulsando);
                  aoAbrir(pulsando);
                }}
              >
                {E4.inspecionar}
              </AcaoDoJornal>
            </div>
          </article>
        </div>
        {aberta && ficha ? (
          <aside className="gaveta" aria-label={E4.fichaTitulo}>
            <FichaDeCampos
              titulo={E4.fichaTitulo}
              etiqueta={NOME_CURTO_DO_SUPORTE.telao.toUpperCase()}
              campos={conteudoDaFicha(ficha)}
              destacarVazio
            />
            <p className="gaveta__apoio">{E4.fichaEmBranco}</p>
            <AcaoDaMissao larga aoTocar={aoAvancar}>
              {E4.avancar}
            </AcaoDaMissao>
          </aside>
        ) : null}
      </div>
    </Casca>
  );
}
