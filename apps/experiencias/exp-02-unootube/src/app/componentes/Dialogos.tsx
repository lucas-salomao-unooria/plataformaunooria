export function DialogoReiniciar({ aoCancelar, aoConfirmar }: { aoCancelar: () => void; aoConfirmar: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={aoCancelar}>
      <section
        className="reset-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-dialog-title"
        aria-describedby="reset-dialog-copy"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <h2 id="reset-dialog-title">Reiniciar a missão?</h2>
        <p id="reset-dialog-copy">
          Isso vai apagar seus vídeos salvos, curtidas, inscritos, fontes confiáveis e o desbloqueio do ranking. Você voltará ao primeiro Short.
        </p>
        <div className="reset-dialog-actions">
          <button type="button" autoFocus onClick={aoCancelar}>Cancelar</button>
          <button className="confirm-reset" type="button" onClick={aoConfirmar}>Sim, reiniciar</button>
        </div>
      </section>
    </div>
  );
}

interface MissaoConcluidaProps {
  inscritos: number;
  fontesConfiaveis: number;
  limite: number;
  aoVerRanking: () => void;
  aoFechar: () => void;
}

export function DialogoMissaoConcluida({ inscritos, fontesConfiaveis, limite, aoVerRanking, aoFechar }: MissaoConcluidaProps) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={aoFechar}>
      <section
        className="complete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-dialog-title"
        aria-describedby="complete-dialog-copy"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <span className="complete-icon" aria-hidden="true">✓</span>
        <span className="eyebrow">MISSÃO CONCLUÍDA</span>
        <h2 id="complete-dialog-title">Você salvou {limite} vídeos!</h2>
        <p id="complete-dialog-copy">Agora compare popularidade e credibilidade com os outros 39 alunos da turma.</p>
        <div className="complete-result">
          <span><small>Inscritos</small><strong>{inscritos.toLocaleString("pt-BR")}</strong></span>
          <span><small>Fontes confiáveis</small><strong>{fontesConfiaveis}/{limite}</strong></span>
        </div>
        <button className="complete-ranking-button" type="button" autoFocus onClick={aoVerRanking}>Ver ranking da turma</button>
        <button className="complete-later-button" type="button" onClick={aoFechar}>Ver depois</button>
      </section>
    </div>
  );
}
