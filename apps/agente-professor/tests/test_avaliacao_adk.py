"""O evalset e o test_config do `adk eval` são válidos para o ADK instalado (sem rodar)."""

import json
from pathlib import Path

from google.adk.evaluation.eval_config import EvalConfig
from google.adk.evaluation.eval_set import EvalSet

PASTA = Path(__file__).parents[1] / "avaliacao"


def test_evalset_valido() -> None:
    conjunto = EvalSet.model_validate_json((PASTA / "agente_professor.evalset.json").read_text())
    assert len(conjunto.eval_cases) >= 15
    ids = [c.eval_id for c in conjunto.eval_cases]
    assert len(set(ids)) == len(ids)
    ferramentas = {
        u.name
        for c in conjunto.eval_cases
        for i in c.conversation or []
        for u in getattr(i.intermediate_data, "tool_uses", [])
    }
    assert ferramentas == {"buscar_habilidades", "buscar_acervo"}
    assert sum(c.eval_id.startswith("fora-escopo") for c in conjunto.eval_cases) >= 3


def test_config_valida() -> None:
    config = EvalConfig.model_validate(json.loads((PASTA / "test_config.json").read_text()))
    assert "tool_trajectory_avg_score" in config.criteria
