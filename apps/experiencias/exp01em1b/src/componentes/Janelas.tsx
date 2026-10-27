import { Button, Modal, ModalBody, Tag } from "@edu/ui/ds";
import { TEXTOS } from "../lib/textos";

/**
 * As janelas que cobrem QUALQUER tela — todas `Modal` do DS (seção `unooria`,
 * a escola), com o conteúdo no `ModalBody` (o recuo lateral da janela: sem
 * ele o texto encostava nas bordas em 375px), nenhuma fecha por ESC nem pelo véu: fechar sem a condição
 * cumprida deixaria a tela aceitando toques que não vão a lugar nenhum.
 *
 * - `Espera` (E4-SIS-01, E5-SIS-01 e a trava 0 da E1): a camada da mediação
 *   docente. O passo continua o mesmo por baixo; quem a tira é o professor
 *   (o polling de 3 s do gate relê a sessão).
 * - `Offline` (E4-SIS-02): a rede caiu; as jogadas esperam na fila em memória.
 * - `Expirada` (E4-SIS-03): um 401. O SDK pede token novo ao hub a cada 10
 *   minutos; "Entrar Novamente" tenta de novo AGORA (a fila e a sessão).
 */

/**
 * O respiro da janela, nos tokens do DS (24px em cima e embaixo, 16px dos
 * lados). Em tela de até 640px o `Modal` do DS 0.2.23 vira uma folha que sobe
 * da base, e o `ModalBody` perde o recuo de cima (`padding: 0 16px 20px`):
 * sem cabeçalho, o conteúdo colava na borda. O Figma desenha um modal
 * CENTRALIZADO, mas o DS não tem a prop (1.0.5): fica a folha, com o respiro
 * pela própria prop `padding` do `ModalBody` — nenhuma regra de CSS local.
 */
const RESPIRO = "var(--unooria-spacing-m, 24px) var(--unooria-spacing-s, 16px)";

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
      <ModalBody padding={RESPIRO}>
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
      </ModalBody>
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
      <ModalBody padding={RESPIRO}>
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
      </ModalBody>
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
      <ModalBody padding={RESPIRO}>
        <div className="janela">
          <p className="janela__marca">{TEXTOS.expirada.marca}</p>
          <p className="janela__titulo">{TEXTOS.expirada.titulo}</p>
          <p className="janela__texto">{TEXTOS.expirada.texto}</p>
          <Button variant="primary" fullWidth isLoading={tentando} onClick={aoEntrar}>
            {TEXTOS.expirada.botao}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}
