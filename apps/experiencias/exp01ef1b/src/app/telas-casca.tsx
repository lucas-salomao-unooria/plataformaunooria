/**
 * As telas em que quem fala é a CASCA UNOORIA (mapa "quem está falando" do
 * handoff): E1 (Desafiar/crachá), E6 (Reflexão e Conclusão) e os erros na voz
 * da ficção. Família `ds` — aqui não há disfarce a proteger.
 */
import { useEffect, useState, type JSX } from "react";
import { Button } from "@edu/ui/ds";
import { AUDIO, SFX, tocar } from "../lib/audio";
import { TEXTO } from "../lib/textos";
import type { MarcaId, PostDaGaleria } from "../lib/tipos";
import {
  AudioReplayButton,
  BadgeSelectorGrid,
  IlustracaoNinaFotografa,
  IlustracaoNinaMegafone,
} from "./componentes/casca";
import { PicGlobo, PicLupa, PicMedalhaDetetive } from "./componentes/pictogramas";
import { altDaFoto, urlDaFoto } from "./componentes/clone";

/* ------------------------------ E1: Desafiar ------------------------------ */

export function TelaDesafiar({
  aoConfirmar,
}: {
  aoConfirmar: (marca: MarcaId) => void;
}): JSX.Element {
  const [marca, setMarca] = useState<MarcaId | null>(null);

  useEffect(() => {
    // Autoplay da saudação na montagem (não-negociável 🔒). Se o navegador
    // bloquear, o botão de repetição ao lado do balão cobre o gesto.
    tocar(AUDIO.e1Saudacao);
  }, []);

  return (
    <main className="fc-tela fc-tela-casca">
      <div className="fc-balao-nina">
        <IlustracaoNinaFotografa />
        <div className="fc-balao-texto">
          <h1>{TEXTO.e1.saudacao}</h1>
          <AudioReplayButton audioId={AUDIO.e1Saudacao} />
        </div>
      </div>

      <p className="fc-instrucao">
        {TEXTO.e1.escolhaMarca}
        <AudioReplayButton audioId={AUDIO.e1Marca} rotulo={`OUVIR: ${TEXTO.e1.escolhaMarca}`} />
      </p>

      <BadgeSelectorGrid
        selecionada={marca}
        aoEscolher={(m) => {
          setMarca(m);
          tocar(SFX.badge);
        }}
      />

      <Button
        variant="primary"
        disabled={!marca}
        className="fc-botao-largo"
        onClick={() => {
          if (!marca) return;
          tocar(AUDIO.e1Pronta);
          aoConfirmar(marca);
        }}
      >
        {TEXTO.e1.entrar}
      </Button>
    </main>
  );
}

/* --------------------------- E6-1: a síntese ------------------------------ */

export function TelaRefletir({
  latchLiberado,
  aoEscolher,
  feedbackRetry,
}: {
  latchLiberado: boolean;
  aoEscolher: (escolha: "lupa" | "globo") => void;
  feedbackRetry: boolean;
}): JSX.Element {
  useEffect(() => {
    tocar(AUDIO.e6Sintese);
  }, []);

  useEffect(() => {
    if (feedbackRetry) tocar(AUDIO.e6RetryGlobo);
  }, [feedbackRetry]);

  return (
    <main className="fc-tela fc-tela-casca">
      <div className="fc-balao-nina">
        <IlustracaoNinaMegafone />
        <div className="fc-balao-texto">
          <h1>{TEXTO.e6.sintese}</h1>
          <AudioReplayButton audioId={AUDIO.e6Sintese} />
        </div>
      </div>

      {feedbackRetry ? <p className="fc-retry">{TEXTO.e6.retryGlobo}</p> : null}

      <div className="fc-cards-reflexao" role="radiogroup" aria-label={TEXTO.e6.sintese}>
        <div className="fc-card-reflexao">
          <button type="button" disabled={!latchLiberado} onClick={() => aoEscolher("lupa")}>
            <PicLupa />
            <span>{TEXTO.e6.opcaoLupa}</span>
          </button>
          <AudioReplayButton audioId={AUDIO.e6OptLupa} rotulo={`OUVIR: ${TEXTO.e6.opcaoLupa}`} />
        </div>
        <div className={`fc-card-reflexao${feedbackRetry ? " fc-card-reflexao--pisca" : ""}`}>
          <button type="button" disabled={!latchLiberado} onClick={() => aoEscolher("globo")}>
            <PicGlobo />
            <span>{TEXTO.e6.opcaoGlobo}</span>
          </button>
          <AudioReplayButton audioId={AUDIO.e6OptGlobo} rotulo={`OUVIR: ${TEXTO.e6.opcaoGlobo}`} />
        </div>
      </div>
    </main>
  );
}

/* -------------------------- E6-2: a conclusão ----------------------------- */

export function TelaConclusao({
  galeria,
  aoVerMural,
  mostrandoMural,
}: {
  galeria: PostDaGaleria[];
  aoVerMural: () => void;
  mostrandoMural: boolean;
}): JSX.Element {
  useEffect(() => {
    tocar(SFX.fanfare);
  }, []);

  if (mostrandoMural) {
    return (
      <main className="fc-tela fc-tela-casca">
        <h1 className="fc-titulo-mural">{TEXTO.e6.verMural}</h1>
        <div className="fc-galeria">
          {galeria.map((p, i) => (
            <figure key={`${p.criadoEm}-${i}`} className="fc-galeria-item">
              <img src={urlDaFoto(p.fotoId)} alt={altDaFoto(p.fotoId)} />
              <figcaption>{p.legendaTexto}</figcaption>
            </figure>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="fc-tela fc-tela-casca fc-confete">
      <PicMedalhaDetetive />
      <h1>{TEXTO.e6.badgeTitulo}</h1>
      {/* O podcast (streaming do CDN) ainda não foi gravado: o player nativo
          aponta o caminho canônico e fica mudo até o arquivo existir —
          pendência de asset declarada, não decisão escondida. */}
      <div className="fc-podcast">
        <span>{TEXTO.e6.ouvirPodcast}</span>
        <audio controls preload="none" src="audio/pod_resumo.mp3" />
      </div>
      <Button variant="secondary" className="fc-botao-largo" onClick={aoVerMural}>
        {TEXTO.e6.verMural}
      </Button>
    </main>
  );
}

/* ------------------------- erros na voz da ficção ------------------------- */

export function TelaErro({
  tipo,
  aoTentarDeNovo,
}: {
  tipo: "conexao" | "sessao";
  aoTentarDeNovo: () => void;
}): JSX.Element {
  useEffect(() => {
    tocar(tipo === "conexao" ? AUDIO.errConexao : AUDIO.errSessao);
  }, [tipo]);

  return (
    <main className="fc-tela fc-tela-casca">
      <IlustracaoNinaMegafone />
      <h1>{tipo === "conexao" ? TEXTO.err.conexao : TEXTO.err.sessao}</h1>
      <Button variant="primary" className="fc-botao-largo" onClick={aoTentarDeNovo}>
        {tipo === "conexao" ? TEXTO.err.tentarNovamente : TEXTO.err.reconectar}
      </Button>
    </main>
  );
}
