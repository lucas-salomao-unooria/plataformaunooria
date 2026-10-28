import { useState } from "react";
import { telemetria } from "../../lib/telemetria";
import { carimbosCompletos } from "../../lib/regras";
import { CARTOES, E4, E6 } from "../../lib/textos";
import { CARTOES_DO_CASO, type Carimbo, type CartaoDoCaso, type FerramentaPublica, type Sessao } from "../../lib/tipos";
import { enderecoDaImagem } from "../comum/midia";
import { Cabecalho } from "../jornal/cabecalho";
import { FerramentasDoCaso } from "../jornal/ferramentas";
import { AcaoDaMissao } from "../mecanica/acoes";
import { CartaoDeCarimbo } from "../mecanica/carimbos";
import { FiguraDoCartao } from "../mecanica/figura";
import { Casca } from "./casca";

/**
 * E6-ALU-01 — o caso novo (Festival de Ciências): as três ferramentas do
 * jornal (retornos NEUTROS da api) e os cartões K4–K6 com o MESMO componente
 * de carimbo da E4. "Avançar" manda os carimbos da E6 e conclui (sem Canal
 * B, spec §0.1).
 */
export function TelaDoCaso({
  caso,
  ocupado,
  aoEnviar,
  inicial,
}: {
  caso: NonNullable<Sessao["caso"]>;
  ocupado: boolean;
  aoEnviar: (carimbos: Record<CartaoDoCaso, Carimbo>) => void;
  inicial?: { marcas?: Partial<Record<CartaoDoCaso, Carimbo>>; ferramenta?: FerramentaPublica | null };
}) {
  const [marcas, setMarcas] = useState<Partial<Record<CartaoDoCaso, Carimbo>>>(inicial?.marcas ?? {});
  const [usada, setUsada] = useState<FerramentaPublica | null>(inicial?.ferramenta ?? null);
  const [ultimo, setUltimo] = useState<CartaoDoCaso | null>(null);
  const completos = carimbosCompletos(CARTOES_DO_CASO, marcas);
  const fotos = caso.materias.map((m, i) => enderecoDaImagem(m.imagem, i === 0 ? "caso-a" : "caso-b"));

  return (
    <Casca
      topo={<Cabecalho edicao={caso.tema || E6.caso} />}
      acoes={
        <>
          {completos ? null : <p className="ajuda">{E4.faltamCarimbos}</p>}
          <AcaoDaMissao desabilitado={!completos} ocupado={ocupado} aoTocar={() => completos && aoEnviar(completos)}>
            {E6.avancar}
          </AcaoDaMissao>
        </>
      }
    >
      <FerramentasDoCaso
        tema={caso.tema || E6.caso}
        ferramentas={caso.ferramentas}
        usada={usada}
        aoUsar={(f) => {
          telemetria.usouFerramenta(f.id);
          setUsada(f);
        }}
      />
      <div className="grade-de-tres">
        {CARTOES_DO_CASO.map((k) => (
          <CartaoDeCarimbo
            key={k}
            titulo={E4.cartao(k)}
            figura={<FiguraDoCartao cartao={k} fotos={k === "k5" ? fotos.slice(0, 1) : fotos} />}
            pergunta={CARTOES[k].pergunta}
            marcado={marcas[k]}
            destaque={ultimo === k}
            desabilitado={ocupado}
            aoCarimbar={(c) => {
              setMarcas((m) => ({ ...m, [k]: c }));
              setUltimo(k);
            }}
          />
        ))}
      </div>
    </Casca>
  );
}
