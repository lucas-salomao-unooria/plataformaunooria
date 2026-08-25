import { ordenarRanking, posicaoDoAluno } from "../../lib/ranking";
import type { ModoRanking, RespostaRanking } from "../../lib/tipos";

interface Props {
  ranking: RespostaRanking | null;
  modo: ModoRanking;
  credibilidadeAdicionada: boolean;
  avatar: string;
  inscritos: number;
  fontesConfiaveis: number;
  limite: number;
  aoOrdenar: (modo: ModoRanking) => void;
  aoAdicionarCredibilidade: () => void;
}

/**
 * O clímax da missão: o ranking abre por inscritos (quem escolheu fake vence);
 * "Adicionar credibilidade" revela a coluna de fontes confiáveis e a métrica
 * vira. As 39 outras linhas são colegas fictícios — vêm prontas da api.
 */
export function Ranking(props: Props) {
  const { ranking, modo, credibilidadeAdicionada, limite } = props;
  const linhas = ranking ? ordenarRanking(ranking.linhas, modo) : [];
  const posicao = ranking ? posicaoDoAluno(ranking.linhas, modo) : 0;

  return (
    <section className="content-view ranking-view">
      <div className="ranking-heading">
        <div className="content-heading">
          <span className="eyebrow">MISSÃO CONCLUÍDA</span>
          <h1>Ranking da turma</h1>
          <p>{credibilidadeAdicionada ? "Compare as duas formas de organizar a turma." : "Veja a classificação da turma pelo número de inscritos."}</p>
        </div>
        <div className={`current-ranking-summary ${credibilidadeAdicionada ? "with-credibility" : ""}`}>
          <span className="ranking-avatar blue" aria-hidden="true">{props.avatar}</span>
          <div><small>Sua posição agora</small><strong>{posicao ? `${posicao}º lugar` : "—"}</strong></div>
          <div><small>Inscritos</small><strong>{props.inscritos.toLocaleString("pt-BR")}</strong></div>
          {credibilidadeAdicionada && <div><small>Fontes confiáveis</small><strong>{props.fontesConfiaveis}/{limite}</strong></div>}
        </div>
      </div>

      {credibilidadeAdicionada ? (
        <div className="ranking-controls" role="tablist" aria-label="Ordenar ranking da turma">
          <button className={modo === "confiaveis" ? "active" : ""} type="button" role="tab" aria-selected={modo === "confiaveis"} onClick={() => props.aoOrdenar("confiaveis")}>
            Mais fontes confiáveis
          </button>
          <button className={modo === "inscritos" ? "active" : ""} type="button" role="tab" aria-selected={modo === "inscritos"} onClick={() => props.aoOrdenar("inscritos")}>
            Mais inscritos
          </button>
        </div>
      ) : (
        <button className="add-credibility-button" type="button" onClick={props.aoAdicionarCredibilidade}>Adicionar credibilidade</button>
      )}

      {credibilidadeAdicionada && <p className="ranking-lesson" role="status">Ter muitos inscritos não significa contar a verdade.</p>}

      <div className="ranking-table-wrap">
        <div className={`ranking-table ${credibilidadeAdicionada ? "with-credibility" : "subscribers-only"}`} role="table" aria-label="Ranking com 40 alunos">
          <div className="ranking-table-header" role="row">
            <span role="columnheader">Posição</span>
            <span role="columnheader">Aluno</span>
            <span role="columnheader">Inscritos</span>
            {credibilidadeAdicionada && <span role="columnheader">Fontes confiáveis</span>}
          </div>
          {!ranking && <div className="ranking-row" role="row"><span role="cell" className="ranking-position">…</span><span role="cell" className="ranking-student"><strong>Carregando a turma</strong></span><span role="cell" /></div>}
          {linhas.map((linha, indice) => (
            <div className={`ranking-row ${linha.voce ? "current" : ""}`} role="row" key={`${modo}-${linha.id}`}>
              <span className="ranking-position" role="cell">{indice + 1}º</span>
              <span className="ranking-student" role="cell">
                <span className={`ranking-avatar ${linha.accent}`} aria-hidden="true">{linha.avatar}</span>
                <strong>{linha.nome}</strong>
                {linha.voce && <em>Você</em>}
              </span>
              <strong className="ranking-subscribers" role="cell">{linha.inscritos.toLocaleString("pt-BR")}</strong>
              {credibilidadeAdicionada && <strong className="ranking-sources" role="cell">{linha.fontesConfiaveis}/{limite}</strong>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
