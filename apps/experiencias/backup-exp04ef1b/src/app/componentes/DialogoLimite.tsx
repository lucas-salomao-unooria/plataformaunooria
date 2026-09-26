import { Button, Modal } from "@edu/ui/ds-unootube";

import type { Aparencia } from "../../lib/tema";
import type { VideoPublico } from "../../lib/tipos";
import { PreviaVideo } from "./PreviaVideo";

/**
 * Diálogo do limite de 3 favoritos (Figma `7:224`).
 *
 * Usa o `Modal` do CLONE, e não o da plataforma, pelo mesmo critério que
 * mantém o toast no clone: quem fala aqui é o app de vídeo sobre a sua própria
 * mecânica ("sua playlist tem três lugares"), não a escola sobre a missão. A
 * seção publica `Modal` desde a 0.1.17 justamente para isto.
 *
 * Substituiu o toast de "playlist cheia". O toast sumia em 5,2 s e não dava
 * saída: o estudante via a mensagem, não entendia o que fazer, e tentava salvar de
 * novo. Aqui a troca está na tela, com os três favoritos atuais e um "Remover"
 * em cada.
 *
 * A nota do Figma é explícita quanto ao tom: o diálogo NÃO repreende. Ele
 * explica a troca e oferece as duas saídas.
 *
 * Remover fecha o diálogo e libera o lugar — o fluxo de jornada devolve a seta
 * para "Toca em Salvar", ou seja, o estudante salva de novo por conta própria. Isso
 * é de propósito: salvar por ele decidiria uma escolha que é dele.
 */

interface Props {
  aparencia: Aparencia;
  salvos: VideoPublico[];
  limite: number;
  aoRemover: (id: string) => void;
  aoFechar: () => void;
}

export function DialogoLimite({ aparencia, salvos, limite, aoRemover, aoFechar }: Props) {
  const tema = aparencia === "escuro" ? "dark" : "light";
  return (
    <Modal
      open
      theme={tema}
      size="lg"
      onClose={aoFechar}
      className="dialogo-limite"
      aria-label={`Você já salvou ${limite} vídeos`}
    >
      <Modal.Body>
        {/*
         * (b) COMPENSAÇÃO — etiqueta de estado. A seção `unootube` não publica
         * `Tag` nem `Badge`; os dois arquivos de origem não desenham nenhum.
         * Pedido aberto ao `storybook-unooria`; some quando o pacote publicar.
         */}
        <span className="dialogo-limite__etiqueta">LIMITE ATINGIDO</span>
        <h2 className="dialogo-limite__titulo">Você já salvou {limite} vídeos!</h2>
        <p className="dialogo-limite__texto">
          Para salvar este Short, você precisa remover um dos seus {limite} favoritos.
        </p>

        <ul className="dialogo-limite__favoritos">
          {salvos.map((video) => (
            <li key={video.id}>
              <PreviaVideo video={video} className="dialogo-limite__previa" />
              <span className="dialogo-limite__nome">{video.titulo}</span>
              <Button onClick={() => aoRemover(video.id)}>Remover</Button>
            </li>
          ))}
        </ul>
      </Modal.Body>

      {/*
       * As duas ações fecham: "Voltar aos Shorts" é a saída que mantém os três
       * favoritos como estão, "Entendi!" é o reconhecimento. O wireframe
       * desenha as duas, e para uma criança de 9 anos a redundância é a favor —
       * quem não se reconhece em "voltar" se reconhece em "entendi".
       */}
      <Modal.Footer>
        <Button onClick={aoFechar}>Voltar aos Shorts</Button>
        <Button className="dialogo-limite__ok" autoFocus onClick={aoFechar}>
          Entendi!
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
