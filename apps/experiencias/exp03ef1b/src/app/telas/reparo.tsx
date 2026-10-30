import { useState } from "react";
import { campoDaEtiqueta, fichaMontada, MONTAGEM_VAZIA, soltarEtiqueta, tirarEtiqueta, type Montagem } from "../../lib/regras";
import { CABECALHO, E4, ICONE_DA_ETIQUETA, NINA } from "../../lib/textos";
import { CAMPOS, type Campo, type EtiquetaPublica, type FichaMontada } from "../../lib/tipos";
import { useArrastar } from "../comum/arrastar";
import { Cabecalho } from "../jornal/cabecalho";
import { AcaoDaMissao } from "../mecanica/acoes";
import { BandejaDeEtiquetas } from "../mecanica/etiquetas";
import { FichaDeCampos, type ConteudoDoCampo } from "../mecanica/ficha";
import { FalaDaNina } from "../mecanica/nina";
import { Casca } from "./casca";

/**
 * E4-ALU-03 — o reparo, com o ajuste do PO (spec §7.6): a Ficha do Telão
 * começa com os TRÊS campos vazios e as três etiquetas (Pátio, estudantes,
 * sexta) na bandeja. A criança monta a ficha como quiser — qualquer etiqueta
 * em qualquer campo, por TOQUE (toca a etiqueta, toca o campo; toca a
 * encaixada para devolver) ou por ARRASTE (ADR-201) — e só então "Concluir" (com as três
 * posicionadas). A avaliação é SÓ no Concluir, no servidor: nenhum sinal de
 * acerto antes.
 */
export function TelaDoReparo({
  etiquetas,
  ocupado,
  aoConcluir,
  inicial,
}: {
  etiquetas: readonly EtiquetaPublica[];
  ocupado: boolean;
  aoConcluir: (ficha: FichaMontada) => void;
  inicial?: { montagem?: Montagem; escolhida?: string | null };
}) {
  const [montagem, setMontagem] = useState<Montagem>(inicial?.montagem ?? MONTAGEM_VAZIA);
  const [escolhida, setEscolhida] = useState<string | null>(inicial?.escolhida ?? null);
  const pronta = fichaMontada(montagem);
  const { arrastavel } = useArrastar((id, alvo) => {
    setEscolhida(null);
    const campo = CAMPOS.find((c) => alvo.zona === `campo:${c}`);
    if (campo) setMontagem((m) => soltarEtiqueta(m, id, campo));
    else if (alvo.zona === "bandeja")
      setMontagem((m) => {
        const de = campoDaEtiqueta(m, id);
        return de ? tirarEtiqueta(m, de) : m;
      });
  });

  const campos = Object.fromEntries(
    CAMPOS.map((c): [Campo, ConteudoDoCampo] => {
      const e = etiquetas.find((x) => x.id === montagem[c]);
      return [c, e ? { tipo: "etiqueta", rotulo: e.rotulo, icone: ICONE_DA_ETIQUETA[e.etiqueta] } : { tipo: "vazio" }];
    }),
  ) as Record<Campo, ConteudoDoCampo>;

  const rotuloEscolhida = etiquetas.find((e) => e.id === escolhida)?.rotulo;
  const status = rotuloEscolhida ? E4.escolhaEtiqueta(rotuloEscolhida) : pronta ? "" : E4.etiquetasAjuda;

  return (
    <Casca topo={<Cabecalho direita={CABECALHO.reparo} />}>
      <FalaDaNina fala={NINA.ficha} />
      <div className="reparo">
        <FichaDeCampos
          titulo={E4.fichaDoTelao}
          campos={campos}
          acionavel
          esperandoToque={escolhida !== null}
          aoTocarCampo={(campo) => {
            if (!escolhida) return;
            setMontagem((m) => soltarEtiqueta(m, escolhida, campo));
            setEscolhida(null);
          }}
          aoTirar={(campo) => setMontagem((m) => tirarEtiqueta(m, campo))}
          arrastavel={arrastavel}
          idDoCampo={Object.fromEntries(CAMPOS.flatMap((c) => (montagem[c] ? [[c, montagem[c]]] : [])))}
        />
        <BandejaDeEtiquetas
          etiquetas={etiquetas.map((e) => ({
            id: e.id,
            rotulo: e.rotulo,
            icone: ICONE_DA_ETIQUETA[e.etiqueta],
            posicionada: campoDaEtiqueta(montagem, e.id) !== null,
          }))}
          escolhida={escolhida}
          aoEscolher={(id) => setEscolhida((atual) => (atual === id ? null : id))}
          arrastavel={arrastavel}
          status={status}
          acoes={
            <>
              {pronta ? null : <p className="ajuda">{E4.faltamEtiquetas}</p>}
              <AcaoDaMissao desabilitado={!pronta} ocupado={ocupado} aoTocar={() => pronta && aoConcluir(pronta)}>
                {E4.concluir}
              </AcaoDaMissao>
            </>
          }
        />
      </div>
    </Casca>
  );
}
