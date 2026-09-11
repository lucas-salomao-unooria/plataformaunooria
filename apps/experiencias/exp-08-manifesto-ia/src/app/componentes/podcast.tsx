import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Modal,
  ModalBody,
  ModalHeader,
  ModalTitle,
} from "@edu/ui/ds";
import { PLATAFORMA } from "../../lib/textos";
import type { BlocoDoPodcast } from "../../lib/tipos";

/**
 * E6-ALU-01 — o episódio de fechamento e o selo. **Seção `unooria`.**
 *
 * O ÁUDIO AINDA NÃO EXISTE: o brief pede `e6-podcast-manifesto.mp3` (~3,8 MB,
 * bucket de mídia da escola), e ele não foi gravado. Mesma decisão da exp-06 —
 * o episódio é servido em TEXTO, e o texto não é andaime: a transcrição
 * integral já é requisito de acessibilidade (sala sem fone de ouvido), então
 * quando o MP3 chegar ele entra ao lado dela, não no lugar dela.
 *
 * O botão de ouvir aparece desabilitado com o motivo à vista em vez de sumir:
 * um controle que existe no roteiro do professor e não existe na tela faz a
 * aula parar para alguém procurá-lo.
 */
export function Podcast({
  titulo,
  blocos,
  pergunta,
  insignia,
  concluido,
  enviando,
  onAbrirTranscricao,
  onFinalizar,
}: {
  titulo: string;
  blocos: BlocoDoPodcast[];
  pergunta: string;
  insignia: string;
  concluido: boolean;
  enviando: boolean;
  onAbrirTranscricao: () => void;
  onFinalizar: () => void;
}) {
  const [aberta, setAberta] = useState(false);

  function abrir() {
    setAberta(true);
    onAbrirTranscricao();
  }

  return (
    <div className="escola">
      <div className="escola__cartao">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>{titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="escola__narrativa">{pergunta}</p>
            <div className="escola__rodape" style={{ marginTop: 16 }}>
              <Button
                variant="secondary"
                isDisabled
                title="A gravação ainda não foi publicada. O roteiro completo está na transcrição."
              >
                {PLATAFORMA.ouvirAudio}
              </Button>
              <Button variant="primary" onClick={abrir} data-acao="ler-transcricao">
                {PLATAFORMA.lerTranscricao}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="escola__rodape">
          <Badge variant="success">{insignia}</Badge>
        </div>

        <div className="escola__rodape cta-48">
          <Button
            variant="primary"
            size="lg"
            isDisabled={concluido || enviando}
            onClick={onFinalizar}
            data-acao="finalizar-percurso"
          >
            {concluido
              ? PLATAFORMA.missaoConcluida
              : enviando
                ? "Encerrando…"
                : PLATAFORMA.finalizarPercurso}
          </Button>
        </div>
      </div>

      {/* O `Modal` do pacote traz `aria-modal`, o foco preso e o Esc — três
          coisas que uma moldura à mão não teria, e a transcrição é justamente o
          caminho de quem depende de tecnologia assistiva. */}
      <Modal isOpen={aberta} onClose={() => setAberta(false)}>
        <ModalHeader onClose={() => setAberta(false)}>
          <ModalTitle>{titulo}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {blocos.map((bloco) => (
            <div key={bloco.rotulo} className="podcast__bloco">
              <p className="podcast__rotulo">{bloco.rotulo}</p>
              <ul className="podcast__falas">
                {bloco.falas.map((fala, i) => (
                  <li key={i}>{fala}</li>
                ))}
              </ul>
            </div>
          ))}
        </ModalBody>
      </Modal>
    </div>
  );
}
