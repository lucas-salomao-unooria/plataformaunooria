import { Button } from "@edu/ui/ds-unootube";

interface Props {
  mensagem: string;
  cheio: boolean;
  aoAbrirPlaylist: () => void;
}

/**
 * Aviso transitório do app.
 *
 * COMPENSAÇÃO REGISTRADA: a seção Unootube do DS não publica toast/snackbar —
 * o arquivo de origem não desenha um. O da plataforma (`Snackbar`) existe, mas
 * NÃO cabe aqui: este aviso fala de dentro da ficção ("Vídeo salvo!"), com a
 * voz do app de vídeo, e a marca institucional apareceria antes da revelação.
 * Então a caixa é local — mas sem uma cor solta: tudo sai de `--uni-*`.
 *
 * Quando a seção publicar um toast, este arquivo vira uma linha.
 */
export function Toast({ mensagem, cheio, aoAbrirPlaylist }: Props) {
  return (
    <div className={`toast ${cheio ? "toast-full" : ""}`} role="status" aria-live="polite">
      <span>{mensagem}</span>
      {cheio && (
        <Button className="toast-acao" onClick={aoAbrirPlaylist}>
          Abrir playlist
        </Button>
      )}
    </div>
  );
}
