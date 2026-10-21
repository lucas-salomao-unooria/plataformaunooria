"""O que os scripts de ingestão compartilham: caminhos do bucket e ids de documento."""

from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

CAMINHO_HABILIDADES = "habilidades/habilidades.jsonl"
CAMINHO_ACERVO = "metadados/acervo.jsonl"
PREFIXO_BNCC_ORIGINAIS = "bncc/originais/"
PREFIXO_BNCC_PARTES = "bncc/partes/"
PREFIXO_LIVROS_ORIGINAIS = "livros/originais/"
PREFIXO_LIVROS_PARTES = "livros/partes/"
PREFIXO_ERROS = "import-erros/"

#: Id de documento do Discovery Engine: RFC-1034, até 128 caracteres. Usamos o
#: subconjunto seguro para os dois validadores que a API aplica na prática
#: (`[a-zA-Z0-9][a-zA-Z0-9-_]*`): letra/dígito nas pontas, hífen no meio.
ID_VALIDO = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,126}[A-Za-z0-9])?$")


def validar_id(valor: str) -> str:
    if not ID_VALIDO.match(valor):
        raise ValueError(f"id de documento inválido para o Discovery Engine: {valor!r}")
    return valor


def id_de_documento(caminho: str, prefixo: str = "") -> str:
    """Id estável a partir do caminho no bucket: legível e sempre válido.

    Caminho longo demais é cortado e ganha 10 caracteres de hash do caminho inteiro —
    dois livros com o mesmo começo de nome não colidem.
    """
    from agente_professor.curriculo import slug

    base = slug(f"{prefixo} {caminho.removesuffix('.pdf')}") or "doc"
    if len(base) > 128:
        resumo = hashlib.sha256(caminho.encode("utf-8")).hexdigest()[:10]
        base = f"{base[:117].rstrip('-')}-{resumo}"
    return validar_id(base)


def raiz_do_repo(inicio: Path | None = None) -> Path:
    atual = (inicio or Path(__file__)).resolve()
    for pasta in (atual, *atual.parents):
        if (pasta / "pnpm-workspace.yaml").is_file():
            return pasta
    raise SystemExit("raiz do monorepo (pnpm-workspace.yaml) não encontrada")


def projeto_padrao(valor: str | None) -> str | None:
    return valor or os.environ.get("AGENTE_PROJETO") or os.environ.get("GOOGLE_CLOUD_PROJECT")
