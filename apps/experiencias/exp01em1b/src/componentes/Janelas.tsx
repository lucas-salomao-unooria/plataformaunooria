import { Button, Modal, Tag } from "@edu/ui/ds";
import { TEXTOS } from "../lib/textos";

/**
 * As janelas que cobrem QUALQUER tela — todas `Modal` do DS (seção `unooria`,
 * a escola), nenhuma fecha por ESC nem pelo véu: fechar sem a condição
 * cumprida deixaria a tela aceitando toques que não vão a lugar nenhum.
 *
 * - `Espera` (E4-SIS-01, E5-SIS-01 e a trava 0 da E1): a camada da mediação
 *   docente. O passo continua o mesmo por baixo; quem a tira é o professor
 *   (o polling de 3 s do gate relê a sessão).
 * - `Offline` (E4-SIS-02): a rede caiu; as jogadas esperam na fila em memória.
 * - `Expirada` (E4-SIS-03): um 401. O SDK pede token novo ao hub a cada 10
 *   minutos; "Entrar Novamente" tenta de novo AGORA (a fila e a sessão).
 */

export type QualEspera = "inicio" | "debate-1" | "debate-2";

const ICONE: Record<QualEspera, string> = { inicio: "⏱", "debate-1": "⏱", "debate-2": "📊" };

export function Espera({ qual }: { qual: QualEspera }) {
  const subtitulo = qual === "debate-1" ? TEXTOS.espera.debate1 : qual === "debate-2" ? TEXTOS.espera.debate2 : null;
  return (
    <Modal
      isOpen
      onClose={() => undefined}
      size="sm"
      theme="light"
      showCloseButton={false}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      aria-label={TEXTOS.espera.tag}
      data-testid="camada-de-espera"
    >
      <div className="janela" role="status" aria-live="polite">
        <Tag variant="neutral" size="sm">
          {TEXTOS.espera.tag}
        </Tag>
        <span className="janela__icone" aria-hidden="true">
          {ICONE[qual]}
        </span>
        <p className="janela__titulo">{TEXTOS.espera.texto}</p>
        {subtitulo && <p className="janela__texto">{subtitulo}</p>}
      </div>
    </Modal>
  );
}

export function Offline({ aoReconectar, tentando }: { aoReconectar: () => void; tentando: boolean }) {
  return (
    <Modal
      isOpen
      onClose={() => undefined}
      size="sm"
      theme="light"
      role="alertdialog"
      showCloseButton={false}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      aria-label={TEXTOS.offline.titulo}
    >
      <div className="janela">
        <span className="janela__icone" aria-hidden="true">
          📡
        </span>
        <p className="janela__titulo">{TEXTOS.offline.titulo}</p>
        <p className="janela__texto">{TEXTOS.offline.texto}</p>
        <Button variant="primary" fullWidth isLoading={tentando} onClick={aoReconectar}>
          {TEXTOS.offline.botao}
        </Button>
      </div>
    </Modal>
  );
}

export function Expirada({ aoEntrar, tentando }: { aoEntrar: () => void; tentando: boolean }) {
  return (
    <Modal
      isOpen
      onClose={() => undefined}
      size="sm"
      theme="light"
      role="alertdialog"
      showCloseButton={false}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      aria-label={TEXTOS.expirada.titulo}
    >
      <div className="janela">
        <p className="janela__marca">{TEXTOS.expirada.marca}</p>
        <p className="janela__titulo">{TEXTOS.expirada.titulo}</p>
        <p className="janela__texto">{TEXTOS.expirada.texto}</p>
        <Button variant="primary" fullWidth isLoading={tentando} onClick={aoEntrar}>
          {TEXTOS.expirada.botao}
        </Button>
      </div>
    </Modal>
  );
}
