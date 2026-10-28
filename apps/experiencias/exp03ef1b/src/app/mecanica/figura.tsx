import type { Cartao } from "../../lib/tipos";
import { CARTOES, ROTULO_DO_VALOR } from "../../lib/textos";
import { Icone } from "../comum/icone";

/**
 * A FIGURA de cada cartão-afirmação (`conteudo.ts#CARTOES_DA_MISSAO.figura`):
 * K1 a foto do telão + o pin do Pátio; K2 o campo Onde + o pin; K3 o mesmo,
 * com o SELO NÃO (o círculo cortado, brief `pic-exp03ef1b-09`); K4 as duas
 * fotos do Festival; K5 o Festival + o calendário de sexta; K6 o campo Quando
 * + o calendário de sábado. A figura não diz o certo — é a pergunta em
 * desenho.
 *
 * (b) COMPENSAÇÃO — sem par no DS: composição de pictogramas e miniaturas
 * numa área cinza (`.figura`), só com tokens `--unooria-*`.
 */
export function FiguraDoCartao({ cartao, fotos }: { cartao: Cartao; fotos: readonly string[] }) {
  const legenda = CARTOES[cartao].figura;
  return (
    <div className="figura" role="img" aria-label={legenda}>
      {cartao === "k1" ? (
        <>
          {fotos[0] ? <img className="figura__foto" src={fotos[0]} alt="" /> : null}
          <span className="figura__mais">+</span>
          <Pin />
        </>
      ) : null}
      {cartao === "k2" || cartao === "k3" ? (
        <>
          <span className="figura__campo">
            <Icone nome="onde" tamanho={18} />
            Campo Onde
          </span>
          <span className="figura__mais">+</span>
          <Pin />
          {cartao === "k3" ? (
            <span className="figura__selo-nao">
              <Icone nome="selo-nao" tamanho={40} />
              <span>NÃO</span>
            </span>
          ) : null}
        </>
      ) : null}
      {cartao === "k4" ? (
        <>
          {fotos.slice(0, 2).map((f, i) => (
            <img key={i} className="figura__foto figura__foto--par" src={f} alt="" />
          ))}
        </>
      ) : null}
      {cartao === "k5" ? (
        <>
          {fotos[0] ? <img className="figura__foto" src={fotos[0]} alt="" /> : null}
          <span className="figura__mais">+</span>
          <Calendario dia={ROTULO_DO_VALOR.sexta} />
        </>
      ) : null}
      {cartao === "k6" ? (
        <>
          <span className="figura__campo">
            <Icone nome="quando" tamanho={18} />
            Campo Quando
          </span>
          <span className="figura__mais">+</span>
          <Calendario dia={ROTULO_DO_VALOR.sabado} />
        </>
      ) : null}
    </div>
  );
}

function Pin() {
  return (
    <span className="figura__valor">
      <Icone nome="onde" tamanho={18} />
      {ROTULO_DO_VALOR.patio}
    </span>
  );
}

function Calendario({ dia }: { dia: string }) {
  return (
    <span className="figura__valor">
      <Icone nome="quando" tamanho={18} />
      {dia}
    </span>
  );
}
