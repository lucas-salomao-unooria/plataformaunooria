interface Props {
  salvos: number;
  limite: number;
  aoVerSalvos: () => void;
}

/** Card lateral "DESAFIO DE HOJE" — o skin YouTube o esconde por CSS (>=1120px também), como no origem. */
export function CartaoMissao({ salvos, limite, aoVerSalvos }: Props) {
  return (
    <aside className="mission-card">
      <span className="eyebrow">DESAFIO DE HOJE</span>
      <h2>Em quais fontes você confiaria?</h2>
      <p>Assista com atenção e salve até {limite} vídeos que parecem contar uma história confiável.</p>
      <div className="slot-row" aria-label={`${salvos} de ${limite} espaços preenchidos`}>
        {Array.from({ length: limite }, (_, i) => <i key={i} className={i < salvos ? "filled" : ""} />)}
      </div>
      <button className="open-playlist" type="button" onClick={aoVerSalvos}>Ver meus salvos</button>
      <div className="tip"><b>Dica</b><span>Muitos inscritos não significam informação verdadeira.</span></div>
    </aside>
  );
}
