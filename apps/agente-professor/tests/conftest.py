from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).parent))

# Nada de GCP real nos testes: projeto de mentira e nenhuma credencial lida do disco.
os.environ.setdefault("AGENTE_PROJETO", "projeto-de-teste")
os.environ.pop("GOOGLE_CLOUD_AGENT_ENGINE_ID", None)

from agente_professor.busca import definir_cliente_busca
from agente_professor.config import configuracao
from fakes import DiscoveryEngineFalso


@pytest.fixture(scope="session")
def documentos() -> list[dict[str, Any]]:
    """O JSONL de verdade, gerado dos `.ts` da api (exige `node` >= 22.6)."""
    from ingestao.exportar_habilidades import gerar, ler_dados

    return gerar(ler_dados())


@pytest.fixture(autouse=True)
def _limpar_estado():
    configuracao.cache_clear()
    yield
    definir_cliente_busca(None)
    configuracao.cache_clear()


@pytest.fixture
def busca(documentos: list[dict[str, Any]]) -> DiscoveryEngineFalso:
    falso = DiscoveryEngineFalso(habilidades=documentos)
    definir_cliente_busca(falso)
    return falso
