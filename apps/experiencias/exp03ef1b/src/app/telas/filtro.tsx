import { useState } from "react";
import { CABECALHO, E3, NINA, ROTULO_DO_CAMPO, ROTULO_DO_VALOR } from "../../lib/textos";
import { CAMPOS, VALORES_DO_FILTRO, type Campo, type PedidoDoFiltro } from "../../lib/tipos";
import { AcaoDoJornal } from "../jornal/acoes";
import { Cabecalho } from "../jornal/cabecalho";
import { Pastilhas } from "../jornal/filtro";
import { QuadroDoJornal } from "../jornal/quadro";
import { FalaDaNina } from "../mecanica/nina";
import { Casca } from "./casca";

export interface InicialDoFiltro {
  campo?: Campo | null;
  valor?: string | null;
  zero?: boolean;
}

/** Monta o pedido do `POST filtro` a partir da pastilha e do valor tocados. */
export function pedidoDoFiltro(campo: Campo, valor: string): PedidoDoFiltro | null {
  const valores: readonly string[] = VALORES_DO_FILTRO[campo];
  if (!valores.includes(valor)) return null;
  return { campo, valor } as PedidoDoFiltro;
}

/**
 * E3-ALU-01 — o filtro do jornal. A fala de Nina é a do ajuste do PO (spec
 * §7.3) com a instrução logo abaixo. A criança escolhe a pastilha (Quem,
 * Onde, Quando), o valor e toca "Buscar"; quem responde é o SERVIDOR (o
 * filtro honesto). Zero notícias: "0 notícias encontradas", a pastilha Onde
 * pulsa e a dupla tenta de novo (spec decisão 8). Onde = Pátio leva à
 * omissão — a tela é a resposta da api, não uma decisão daqui.
 *
 * Nenhuma pastilha nasce escolhida (o protótipo abria com Onde selecionada):
 * acertar o campo na primeira busca é a evidência da EF15CO08, e a tela não
 * pode dá-lo pronto.
 */
export function TelaDoFiltro({
  ocupado,
  aoBuscar,
  inicial,
}: {
  ocupado: boolean;
  /** Resolve com quantas notícias a busca encontrou (0 = fica aqui). */
  aoBuscar: (pedido: PedidoDoFiltro) => Promise<number>;
  inicial?: InicialDoFiltro;
}) {
  const [campo, setCampo] = useState<Campo | null>(inicial?.campo ?? null);
  const [valor, setValor] = useState<string | null>(inicial?.valor ?? null);
  const [zero, setZero] = useState(inicial?.zero ?? false);

  const pedido = campo && valor ? pedidoDoFiltro(campo, valor) : null;

  const escolherCampo = (c: Campo) => {
    setCampo(c);
    setValor(null);
  };

  const buscar = () => {
    if (!pedido) return;
    void aoBuscar(pedido).then((n) => setZero(n === 0));
  };

  const rotuloDoCampo = campo ? ROTULO_DO_CAMPO[campo] : "";

  return (
    <Casca
      topo={<Cabecalho edicao={CABECALHO.filtroDeAcervo} />}
      acoes={
        <AcaoDoJornal icone="search" desabilitado={!pedido || ocupado} aoTocar={buscar}>
          {E3.buscar}
        </AcaoDoJornal>
      }
    >
      <FalaDaNina fala={NINA.filtro} apoio={NINA.instrucaoDoFiltro} />
      <QuadroDoJornal rotulo={E3.pastilhas}>
        <Pastilhas
          rotulo={E3.pastilhas}
          grande
          selecionada={campo}
          pulsando={zero ? "onde" : null}
          itens={CAMPOS.map((c) => ({ id: c, rotulo: ROTULO_DO_CAMPO[c], icone: c }))}
          aoEscolher={escolherCampo}
        />
      </QuadroDoJornal>
      {campo ? (
        <QuadroDoJornal className="quadro-jornal--linha">
          <span className="valores__rotulo">{E3.valoresPara(rotuloDoCampo)}</span>
          <Pastilhas
            rotulo={E3.valoresPara(rotuloDoCampo)}
            selecionada={valor}
            itens={VALORES_DO_FILTRO[campo].map((v) => ({ id: v as string, rotulo: ROTULO_DO_VALOR[v] }))}
            aoEscolher={(v) => {
              setValor(v);
              setZero(false);
            }}
          />
        </QuadroDoJornal>
      ) : null}
      <QuadroDoJornal tracejado={!pedido && !zero} centro className="resultado-da-busca">
        <div aria-live="polite" className="resultado-da-busca__texto">
          {zero ? (
            <>
              <strong>{E3.zero}</strong>
              <span>{E3.zeroApoio}</span>
            </>
          ) : pedido && campo && valor ? (
            <>
              <strong>{E3.configurado(rotuloDoCampo, ROTULO_DO_VALOR[valor as keyof typeof ROTULO_DO_VALOR])}</strong>
              <span>{E3.cliqueBuscar}</span>
            </>
          ) : (
            <span>{campo ? E3.escolhaValor(rotuloDoCampo) : E3.escolhaCampo}</span>
          )}
        </div>
      </QuadroDoJornal>
    </Casca>
  );
}
