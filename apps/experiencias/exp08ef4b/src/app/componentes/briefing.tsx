import { Button, Card, CardContent, CardHeader, CardTitle } from "@edu/ui/ds";
import { PLATAFORMA } from "../../lib/textos";

/**
 * E1-ALU-01 — o alerta de Amara. **Seção `unooria`**: quem fala é a guia da
 * missão, e o disfarce só começa no toque em "Iniciar chat".
 *
 * O ÁUDIO AINDA NÃO EXISTE, e a tela é honesta sobre isso. O brief de assets
 * pede `e1-alerta-amara.mp3` (~650 KB, CDN), e ele não foi gravado. Duas coisas
 * que a tela NÃO faz:
 *
 * - não desenha um player morto: um botão de play que não toca nada ensina o
 *   estudante a desconfiar da interface, e é o mesmo motivo pelo qual o
 *   `Composer` desta missão esconde os alvos de anexo e de voz;
 * - não esconde o texto atrás do áudio: a narrativa está SEMPRE na tela, que é
 *   a exigência de acessibilidade da sala sem fone (e o que a exp06ef2b fez com a
 *   transcrição dos áudios dela).
 *
 * Quando o MP3 existir, ele entra AQUI com o texto continuando visível — a
 * transcrição não é fallback de mídia ausente, é o conteúdo acessível.
 */
export function Briefing({ onIniciar }: { onIniciar: () => void }) {
  return (
    <div className="escola">
      <div className="escola__cartao">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Amara chamou você</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="escola__narrativa">{PLATAFORMA.alertaDeAmara}</p>
          </CardContent>
        </Card>

        <div className="escola__rodape cta-48">
          <Button variant="primary" size="lg" onClick={onIniciar} data-acao="iniciar-chat">
            {PLATAFORMA.iniciarChat}
          </Button>
        </div>
      </div>
    </div>
  );
}
