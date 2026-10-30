import { useState } from "react";
import {
  BottomSheet,
  Button,
  ChatHeader,
  ChatWallpaper,
  MessageBubble,
  Radio,
  Switch,
  TextButton,
} from "@edu/ui/ds-unoochat";
import {
  PERICIA_VAZIA,
  alternarSinalizacao,
  descricaoDoGrafico,
  montarParecer,
  numeroBr,
  rotuloCurto,
  type MarcasDaPericia,
} from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { Cartao, Motivo, Parecer, SessaoPreparada } from "../lib/tipos";
import { GraficoDoBoletim } from "./GraficoDoBoletim";
import { BarraDoAparelho, GuardaDoGrafico, useHoraDeAgora } from "./Pecas";

const MOTIVOS: readonly Motivo[] = ["escala", "fonte", "titulo"];

/**
 * E6-ALU-01/02 — a perícia, de volta ao mensageiro: o canal "Notícias da
 * Cidade — Eleições Municipais", o chamado do perito (TC-23) e os dois cartões
 * eleitorais como balões com o gráfico E o título do gráfico — sem rótulo que
 * dê o gabarito (os cartões chegam da api como peças; o gabarito não desce).
 *
 * "Ver dados e fonte" abre a folha com os dados oficiais e o eixo de cada
 * cartão. "Sinalizar para revisão" (`Switch`) abre o motivo (`Radio`);
 * desligar desfaz o motivo. "Emitir parecer" fica desabilitado só enquanto um
 * cartão sinalizado não tem motivo (a api exige); "Avançar sem emitir parecer"
 * está sempre ali — nada aqui é gate.
 */
export function Pericia({
  sessao,
  ocupado,
  aoEmitir,
  aoPular,
}: {
  sessao: SessaoPreparada;
  ocupado: boolean;
  aoEmitir: (p: Parecer) => void;
  aoPular: () => void;
}) {
  const t = sessao.textos.pericia;
  const agora = useHoraDeAgora();
  const [marcas, setMarcas] = useState<MarcasDaPericia>(PERICIA_VAZIA);
  const [dadosAbertos, setDadosAbertos] = useState(false);
  const parecer = montarParecer(marcas);

  const barrasDe = () => t.dados.periodos.map((p) => ({ rotulo: rotuloCurto(p.rotulo), valor: p.taxa }));

  const cartao = (c: Cartao) => {
    const marca = marcas[c.id];
    const barras = barrasDe();
    return (
      <MessageBubble key={c.id} direction="in" sender={c.titulo} senderTone={c.id === "A" ? 2 : 3} time={agora} maxWidth={310} data-cartao={c.id}>
        <p className="cartao__partido">{c.partido}</p>
        <p className="post__titulo">{c.tituloDoGrafico}</p>
        <MessageBubble.Media alt={descricaoDoGrafico(barras, c.eixo.origem, c.eixo.teto, "")} ratio="auto">
          <GuardaDoGrafico>
            <GraficoDoBoletim barras={barras} origem={c.eixo.origem} teto={c.eixo.teto} unidade="" />
          </GuardaDoGrafico>
        </MessageBubble.Media>
        <p className="post__camada">{TEXTOS.pericia.fonte(c.fonte)}</p>
        <div className="cartao__acoes">
          <TextButton onClick={() => setDadosAbertos(true)}>{TEXTOS.pericia.verDados}</TextButton>
          <Switch
            checked={marca.sinalizou}
            onChange={(ligado) => setMarcas((m) => ({ ...m, [c.id]: alternarSinalizacao(m[c.id], ligado) }))}
            label={t.sinalizar}
            labelPosition="left"
            style={{ width: "100%" }}
          />
          {marca.sinalizou && (
            <fieldset className="compositor__grupo">
              <legend className="compositor__rotulo">{t.motivoTitulo}</legend>
              <div className="compositor__radios">
                {MOTIVOS.map((m) => (
                  <Radio
                    key={m}
                    name={`motivo-${c.id}`}
                    value={m}
                    label={t.motivos[m]}
                    checked={marca.motivo === m}
                    onChange={() => {
                      setMarcas((x) => ({ ...x, [c.id]: { sinalizou: true, motivo: m } }));
                      telemetria.motivo(c.id, m);
                    }}
                  />
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </MessageBubble>
    );
  };

  return (
    <div className="app">
      <BarraDoAparelho />
      <ChatHeader name={t.canal} initials="NC" presence={TEXTOS.pericia.presenca} />
      <ChatWallpaper className="app__corpo" role="region" tabIndex={0} aria-label={TEXTOS.grupo.conversa}>
        <div className="conversa">
          <MessageBubble direction="in" time={agora}>
            {t.chamado}
          </MessageBubble>
          {t.cartoes.map(cartao)}
        </div>
      </ChatWallpaper>
      <div className="rodape rodape__acao rodape__acao--dupla">
        <Button size="lg" block disabled={!parecer || ocupado} onClick={() => parecer && aoEmitir(parecer)}>
          {t.emitir}
        </Button>
        <TextButton onClick={aoPular} disabled={ocupado}>
          {t.pular}
        </TextButton>
      </div>

      <BottomSheet
        open={dadosAbertos}
        title={t.dados.titulo}
        onClose={() => setDadosAbertos(false)}
        footer={
          <Button block onClick={() => setDadosAbertos(false)}>
            {TEXTOS.pericia.retornar}
          </Button>
        }
      >
        <div className="folha">
          <p className="folha__orgao">{t.dados.origem}</p>
          {/* O relatório da Secretaria como a tabela do protótipo (E6-ALU-02): é
              CONTEÚDO (o documento oficial), como a planilha da E2 — o Unoochat
              não publica tabela, e a lista de linhas quebrava cada dado em três. */}
          <table className="dados">
            <caption className="dados__titulo">{t.dados.indicador}</caption>
            <thead>
              <tr>
                <th scope="col">{TEXTOS.pericia.colPeriodo}</th>
                <th scope="col">{TEXTOS.pericia.colOcorrencias}</th>
                <th scope="col">{TEXTOS.pericia.colTaxa}</th>
              </tr>
            </thead>
            <tbody>
              {t.dados.periodos.map((p) => (
                <tr key={p.rotulo}>
                  <th scope="row">{rotuloCurto(p.rotulo)}</th>
                  <td>{p.ocorrencias}</td>
                  <td className="dados__valor">{numeroBr(p.taxa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="folha__orgao">{TEXTOS.pericia.populacao(t.dados.periodos.map((p) => `${rotuloCurto(p.rotulo)}: ${p.populacao}`).join(" · "))}</p>
        </div>
      </BottomSheet>
    </div>
  );
}
