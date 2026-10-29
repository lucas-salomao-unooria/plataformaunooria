import { AdminOnlyNotice } from "@edu/ui/ds-unoochat";
import { TEXTOS } from "../lib/textos";

/**
 * E4-ALU-03 fora do grupo — a pausa do professor ("Pausar Telas para Debate")
 * alcançou o estudante antes de publicar (no chat ou no compositor). A tela
 * de baixo fica `inert` (App) e a faixa da Coordenação ocupa a base, onde
 * estaria o campo de escrever: o mesmo `AdminOnlyNotice` do grupo. Sem botão:
 * só o gate da turma a tira (o polling de 3 s relê a sessão).
 *
 * No grupo (o caso do desenho, E4-ALU-03) a pausa NÃO usa esta camada: a
 * rolagem fica livre para o debate e o próprio rodapé troca o texto (`Grupo`).
 */
export function Pausa({ texto }: { texto: string }) {
  return (
    <div className="pausa" data-pausa>
      <AdminOnlyNotice role="status">
        {texto} {TEXTOS.grupo.aguardeOrientacoes}
      </AdminOnlyNotice>
    </div>
  );
}
