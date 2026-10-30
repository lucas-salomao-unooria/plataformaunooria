import { useState } from "react";
import { BottomSheet, Button, Dialog, MessageTag, Radio, Switch, TextButton } from "@edu/ui/ds-unoochat";
import { corpoDaPublicacao, escolhaInicial, textoDaCamada, type Escolha } from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { Camada, Escala, Publicar, SessaoPreparada } from "../lib/tipos";
import { PostDoBoletim } from "./Pecas";

/**
 * E3-ALU-01/02 e E4-ALU-05 — o compositor do boletim, numa `BottomSheet` sobre
 * o chat do Assistente. A origem do eixo é `Radio` SEM pré-seleção (decisão
 * 5): o botão de publicar fica desabilitado até a escolha; as QUATRO camadas
 * (`Switch`, decisão 3) são opcionais, com o texto FIXO do pacote — a
 * anotação de escala acompanha a origem marcada. A 4ª é a projeção, incorreta
 * de propósito (ADR-203), e a ordem das quatro vem do servidor, embaralhada
 * por estudante: a tela não sabe qual é a errada. A prévia ao vivo é o MESMO
 * `PostDoBoletim` que o grupo mostra depois.
 *
 * Na errata, o compositor volta com a 1ª publicação INTEIRA (escala e
 * camadas), a etiqueta "Errata" e as duas saídas do protótipo. Publicar passa
 * pela confirmação (`Dialog`, TC-08 na 1ª; o equivalente do slot 2 na
 * errata), e só o "Confirmar Envio" chama a api.
 */
export function Compositor({
  modo,
  sessao,
  aberto,
  ocupado,
  aoFechar,
  aoPublicar,
  aoPularErrata,
}: {
  modo: "inicial" | "errata";
  sessao: SessaoPreparada;
  aberto: boolean;
  ocupado: boolean;
  aoFechar: () => void;
  aoPublicar: (corpo: Publicar) => Promise<boolean>;
  aoPularErrata: () => void;
}) {
  const { conteudo } = sessao;
  const [escolha, setEscolha] = useState<Escolha>(() => escolhaInicial(modo, sessao.publicacoes.inicial));
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const corpo = corpoDaPublicacao(escolha);
  const etapa = modo === "inicial" ? "E3" : "E4b";
  const nome = `escala-${modo}`;

  const marcarEscala = (e: Escala) => {
    setEscolha((x) => ({ ...x, escala: e }));
    telemetria.escala(e, etapa);
  };

  const confirmar = async () => {
    if (!corpo) return;
    setEnviando(true);
    const ok = await aoPublicar(corpo);
    setEnviando(false);
    if (ok) setConfirmando(false);
  };

  const camada = (chave: Camada, descricao: string) => (
    <Switch
      key={chave}
      checked={escolha[chave]}
      onChange={(ligado) => setEscolha((x) => ({ ...x, [chave]: ligado }))}
      label={TEXTOS.compositor.camadas[chave]}
      description={descricao}
      labelPosition="left"
      style={{ width: "100%" }}
    />
  );

  return (
    <>
      <BottomSheet
        open={aberto && !confirmando}
        title={modo === "inicial" ? TEXTOS.compositor.titulo : TEXTOS.compositor.tituloDaErrata}
        onClose={aoFechar}
        footer={
          <div className="compositor__acoes">
            <Button size="lg" block disabled={!corpo || ocupado} onClick={() => setConfirmando(true)}>
              {modo === "inicial" ? TEXTOS.compositor.encaminhar : TEXTOS.compositor.publicarErrata}
            </Button>
            {modo === "errata" && (
              <TextButton onClick={aoPularErrata} disabled={ocupado}>
                {TEXTOS.compositor.pularErrata}
              </TextButton>
            )}
          </div>
        }
      >
        <div className="compositor" data-compositor={modo}>
          {modo === "errata" && (
            <div className="compositor__errata">
              <MessageTag>{TEXTOS.compositor.tagErrata}</MessageTag>
              <p className="compositor__aviso">{TEXTOS.compositor.avisoDaErrata}</p>
            </div>
          )}

          <fieldset className="compositor__grupo">
            <legend className="compositor__rotulo">{TEXTOS.compositor.escala}</legend>
            <div className="compositor__radios">
              <Radio name={nome} value="0" label={TEXTOS.compositor.opcoes.zero} checked={escolha.escala === 0} onChange={() => marcarEscala(0)} />
              <Radio name={nome} value="80" label={TEXTOS.compositor.opcoes.oitenta} checked={escolha.escala === 80} onChange={() => marcarEscala(80)} />
            </div>
          </fieldset>

          <div className="compositor__camadas">
            {conteudo.camadas.ordem.map((c) =>
              camada(
                c,
                c === "explicacao" && escolha.escala === null
                  ? TEXTOS.compositor.explicacaoSemEscala
                  : textoDaCamada(conteudo.camadas, c, escolha.escala ?? 0),
              ),
            )}
          </div>

          <p className="compositor__rotulo">{TEXTOS.compositor.previa}</p>
          <div className="compositor__previa" aria-live="polite">
            {corpo ? (
              <PostDoBoletim
                publicacao={corpo}
                serie={conteudo.servico.serie}
                indicador={conteudo.servico.indicador}
                camadas={conteudo.camadas}
                errata={modo === "errata"}
              />
            ) : (
              <p className="compositor__vazio">{TEXTOS.compositor.previaSemEscala}</p>
            )}
          </div>
        </div>
      </BottomSheet>

      <Dialog
        open={aberto && confirmando}
        title={TEXTOS.compositor.confirmar.titulo}
        onClose={() => !enviando && setConfirmando(false)}
        footer={
          <div className="dialogo__acoes">
            <Button block disabled={enviando || !corpo} onClick={() => void confirmar()}>
              {enviando ? TEXTOS.compositor.confirmar.gravando : TEXTOS.compositor.confirmar.ok}
            </Button>
            <Button block variant="outline" disabled={enviando} onClick={() => setConfirmando(false)}>
              {TEXTOS.compositor.confirmar.revisar}
            </Button>
          </div>
        }
      >
        {modo === "inicial" ? TEXTOS.compositor.confirmar.corpo : TEXTOS.compositor.confirmar.corpoDaErrata}
      </Dialog>
    </>
  );
}
