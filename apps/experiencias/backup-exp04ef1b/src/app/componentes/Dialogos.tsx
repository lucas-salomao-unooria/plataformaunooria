import { Button, MetricCard, Modal } from "@edu/ui/ds";

import type { Aparencia } from "../../lib/tema";

/**
 * Os dois diálogos usam o `Modal` do DS da PLATAFORMA, e não o clone.
 *
 * O critério é o mesmo do ranking: os dois falam de "missão" e de "reiniciar",
 * ou seja, já falam da Unooria e não do app de vídeo. São a moldura do
 * exercício aparecendo por cima do disfarce — é justamente onde a linguagem
 * institucional cabe. O que continua no clone é o que fala DE DENTRO da
 * ficção: o toast de "vídeo salvo", que é fala do app.
 *
 * `theme` vem por prop porque a seção da plataforma não lê `data-uni-theme`.
 */

interface ReiniciarProps {
  aparencia: Aparencia;
  aoCancelar: () => void;
  aoConfirmar: () => void;
}

export function DialogoReiniciar({ aparencia, aoCancelar, aoConfirmar }: ReiniciarProps) {
  const tema = aparencia === "escuro" ? "dark" : "light";
  return (
    <Modal
      isOpen
      theme={tema}
      size="sm"
      onClose={aoCancelar}
      title="Reiniciar a missão?"
      description="Isso vai apagar seus vídeos salvos, curtidas, inscritos, fontes confiáveis e o desbloqueio do ranking. Você voltará ao primeiro Short."
      footerAlign="end"
      secondaryAction={
        <Button theme={tema} variant="ghost" autoFocus onClick={aoCancelar}>
          Cancelar
        </Button>
      }
      primaryAction={
        <Button theme={tema} variant="danger" onClick={aoConfirmar}>
          Sim, reiniciar
        </Button>
      }
    />
  );
}

interface MissaoConcluidaProps {
  aparencia: Aparencia;
  inscritos: number;
  fontesConfiaveis: number;
  limite: number;
  aoVerRanking: () => void;
  aoFechar: () => void;
}

export function DialogoMissaoConcluida({
  aparencia,
  inscritos,
  fontesConfiaveis,
  limite,
  aoVerRanking,
  aoFechar,
}: MissaoConcluidaProps) {
  const tema = aparencia === "escuro" ? "dark" : "light";
  return (
    <Modal
      isOpen
      theme={tema}
      size="md"
      onClose={aoFechar}
      title={`Você salvou ${limite} vídeos!`}
      description="Agora compare popularidade e credibilidade com os outros 39 estudantes da turma."
      footerAlign="end"
      secondaryAction={
        <Button theme={tema} variant="ghost" onClick={aoFechar}>
          Ver depois
        </Button>
      }
      primaryAction={
        <Button theme={tema} variant="primary" autoFocus onClick={aoVerRanking}>
          Ver ranking da turma
        </Button>
      }
    >
      <div className="complete-result">
        <MetricCard theme={tema} title="Inscritos" value={inscritos.toLocaleString("pt-BR")} />
        <MetricCard theme={tema} title="Fontes confiáveis" value={`${fontesConfiaveis}/${limite}`} />
      </div>
    </Modal>
  );
}
