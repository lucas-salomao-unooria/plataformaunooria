import { useCallback, useEffect, useState } from "react";
import { telemetria } from "../../lib/telemetria";
import { CABECALHO, E1, NINA } from "../../lib/textos";
import { PULSO_DA_GALERIA_MS, type Sessao } from "../../lib/tipos";
import { enderecoDaImagem, preCarregar } from "../comum/midia";
import { AcaoDoJornal } from "../jornal/acoes";
import { Cabecalho } from "../jornal/cabecalho";
import { CartaoDaReportagem, ErroDeMidia, FotoAmpliada } from "../jornal/reportagem";
import { FalaDaNina } from "../mecanica/nina";
import { Casca } from "./casca";

export interface InicialDaGaleria {
  aberta?: string | null;
  pulsando?: boolean;
  erroDeMidia?: boolean;
}

/**
 * E1-ALU-01 — a galeria: as três reportagens da mesma feira (mural, portal,
 * telão). Tocar a foto abre a foto ampliada com o cartaz; tocar o cartaz (ou
 * "Confirmar Mesma Feira") acende o selo "Mesma feira" no cartão. Com os três
 * selos, "Avançar".
 *
 * As fotos são PRÉ-CARREGADAS: a que não baixa mostra o erro de mídia
 * (E1-SIS-01, "Tentar carregar"); na segunda falha seguida a tela segue com a
 * ilustração local, para a criança nunca ficar presa.
 */
export function TelaDaGaleria({
  jornal,
  selos,
  ocupado,
  aoSelar,
  aoAvancar,
  inicial,
}: {
  jornal: Sessao["jornal"];
  selos: readonly string[];
  ocupado: boolean;
  aoSelar: (id: string) => void;
  aoAvancar: () => void;
  inicial?: InicialDaGaleria;
}) {
  const [aberta, setAberta] = useState<string | null>(inicial?.aberta ?? null);
  const [pulsando, setPulsando] = useState(inicial?.pulsando ?? false);
  const [erroDeMidia, setErroDeMidia] = useState(inicial?.erroDeMidia ?? false);
  const [falhas, setFalhas] = useState(0);
  const usarIlustracao = falhas >= 2;

  const carregar = useCallback(() => {
    const urls = [...jornal.reportagens.map((r) => r.imagem.url), jornal.cartaz.imagem.url];
    void preCarregar(urls).then((falharam) => {
      if (falharam.length === 0) {
        setErroDeMidia(false);
        return;
      }
      telemetria.midiaFalhou();
      setFalhas((f) => f + 1);
      setErroDeMidia(true);
    });
  }, [jornal]);

  useEffect(() => {
    if (inicial?.erroDeMidia !== undefined) return;
    carregar();
  }, [carregar, inicial?.erroDeMidia]);

  // 20 s com a foto aberta sem tocar o cartaz: o cartaz pulsa.
  useEffect(() => {
    if (!aberta || selos.includes(aberta) || inicial?.pulsando !== undefined) return;
    setPulsando(false);
    const relogio = window.setTimeout(() => {
      setPulsando(true);
      telemetria.cartazPulsou();
    }, PULSO_DA_GALERIA_MS);
    return () => window.clearTimeout(relogio);
  }, [aberta, selos, inicial?.pulsando]);

  const topo = <Cabecalho edicao={CABECALHO.edicaoDaFeira} direita={CABECALHO.equipe} />;

  if (erroDeMidia && !usarIlustracao) {
    return (
      <Casca topo={<Cabecalho />} corpo="casca__corpo--centro">
        <ErroDeMidia
          aoTentar={() => {
            setErroDeMidia(false);
            if (falhas >= 2) return;
            carregar();
          }}
        />
      </Casca>
    );
  }

  const reportagemAberta = jornal.reportagens.find((r) => r.id === aberta) ?? null;
  const completos = jornal.reportagens.every((r) => selos.includes(r.id));

  return (
    <Casca
      topo={topo}
      acoes={
        <AcaoDoJornal desabilitado={!completos || ocupado} aoTocar={aoAvancar}>
          {E1.avancar}
        </AcaoDoJornal>
      }
    >
      <FalaDaNina fala={NINA.galeria} />
      <div className="grade-de-tres grade-de-tres--alta">
        {jornal.reportagens.map((r) => {
          const selada = selos.includes(r.id);
          return (
            <CartaoDaReportagem
              key={r.id}
              imagem={enderecoDaImagem(r.imagem, r.suporte, usarIlustracao)}
              alt={r.imagem.alt}
              kicker={r.kicker}
              manchete={r.manchete}
              lugar={r.lugar || E1.lugar}
              chamada={E1.tocarNaFoto}
              selo={selada ? E1.selo : undefined}
              seloForte={selada}
              moldura={selada ? "forte" : undefined}
              aoAbrir={() => {
                telemetria.abriuFoto(r.suporte);
                setAberta(r.id);
              }}
            />
          );
        })}
      </div>
      {reportagemAberta ? (
        <FotoAmpliada
          aberta
          suporte={reportagemAberta.kicker}
          foto={enderecoDaImagem(reportagemAberta.imagem, reportagemAberta.suporte, usarIlustracao)}
          alt={reportagemAberta.imagem.alt}
          legenda={reportagemAberta.legenda}
          cartaz={enderecoDaImagem(jornal.cartaz.imagem, "cartaz", usarIlustracao)}
          cartazAlt={jornal.cartaz.imagem.alt}
          cartazTexto={jornal.cartaz.texto}
          pulsando={pulsando}
          aoConfirmar={() => {
            aoSelar(reportagemAberta.id);
            setAberta(null);
            setPulsando(false);
          }}
          aoFechar={() => {
            setAberta(null);
            setPulsando(false);
          }}
        />
      ) : null}
    </Casca>
  );
}
