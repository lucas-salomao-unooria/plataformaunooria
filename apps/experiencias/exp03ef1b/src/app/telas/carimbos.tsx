import { useState } from "react";
import { carimbosCompletos } from "../../lib/regras";
import { CABECALHO, CARTOES, E4, NINA } from "../../lib/textos";
import { CARTOES_DA_INSPECAO, type Carimbo, type CartaoDaInspecao } from "../../lib/tipos";
import { Cabecalho } from "../jornal/cabecalho";
import { AcaoDaMissao } from "../mecanica/acoes";
import { CartaoDeCarimbo } from "../mecanica/carimbos";
import { FiguraDoCartao } from "../mecanica/figura";
import { FalaDaNina } from "../mecanica/nina";
import { Casca } from "./casca";

/**
 * E4-ALU-02 — os três cartões-afirmação K1–K3, cada um com os TRÊS carimbos
 * visíveis (spec §7.5). Trocar à vontade; "Avançar" com os três manda o
 * `POST carimbos {etapa:"e4"}`. Nenhum retorno de certo ou errado: os
 * carimbos não têm resposta (regra 3).
 */
export function TelaDosCarimbos({
  fotoDoTelao,
  ocupado,
  aoEnviar,
  inicial,
}: {
  fotoDoTelao: string;
  ocupado: boolean;
  aoEnviar: (carimbos: Record<CartaoDaInspecao, Carimbo>) => void;
  inicial?: Partial<Record<CartaoDaInspecao, Carimbo>>;
}) {
  const [marcas, setMarcas] = useState<Partial<Record<CartaoDaInspecao, Carimbo>>>(inicial ?? {});
  const [ultimo, setUltimo] = useState<CartaoDaInspecao | null>(null);
  const completos = carimbosCompletos(CARTOES_DA_INSPECAO, marcas);

  return (
    <Casca
      topo={<Cabecalho direita={CABECALHO.julgamento} />}
      acoes={
        <>
          {completos ? null : <p className="ajuda">{E4.faltamCarimbos}</p>}
          <AcaoDaMissao desabilitado={!completos} ocupado={ocupado} aoTocar={() => completos && aoEnviar(completos)}>
            {E4.avancar}
          </AcaoDaMissao>
        </>
      }
    >
      <FalaDaNina fala={NINA.ficha} />
      <div className="grade-de-tres">
        {CARTOES_DA_INSPECAO.map((k) => (
          <CartaoDeCarimbo
            key={k}
            titulo={E4.cartao(k)}
            figura={<FiguraDoCartao cartao={k} fotos={[fotoDoTelao]} />}
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
