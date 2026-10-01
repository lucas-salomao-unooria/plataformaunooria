"""O bucket do agente, ou uma pasta local que o espelha — a mesma interface para os dois.

Convenção de pastas de `gs://<projeto>-agente-professor/` (a mesma no espelho local):

    bncc/originais/                         PDFs oficiais (BNCC completa, anexo de Computação)
    bncc/partes/                            GERADO: partes ≤ 500 páginas
    habilidades/habilidades.jsonl           GERADO: 1 documento por habilidade
    livros/originais/<componente>/<serie>/<arquivo>.pdf   o dono sobe aqui
    livros/partes/<componente>/<serie>/     GERADO
    metadados/acervo.jsonl                  GERADO: o JSONL `document` do acervo
    import-erros/                           erros do `documents:import`

Com o espelho local, as URIs gravadas nos metadados continuam `gs://<bucket>/…`: o
Discovery Engine lê do bucket, nunca da máquina de quem roda o script.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol


class Armazenamento(Protocol):
    bucket: str

    def listar(self, prefixo: str) -> list[str]:
        """Caminhos (relativos ao bucket) que começam com `prefixo`, em ordem."""
        ...

    def ler(self, caminho: str) -> bytes: ...

    def gravar(
        self, caminho: str, dados: bytes, tipo: str = "application/octet-stream"
    ) -> None: ...

    def existe(self, caminho: str) -> bool: ...


def uri(bucket: str, caminho: str) -> str:
    return f"gs://{bucket}/{caminho}"


def bucket_padrao(projeto: str) -> str:
    return f"{projeto}-agente-professor"


class ArmazenamentoLocal:
    def __init__(self, raiz: Path, bucket: str) -> None:
        self.raiz = raiz
        self.bucket = bucket

    def listar(self, prefixo: str) -> list[str]:
        base = self.raiz
        if not base.exists():
            return []
        saida = []
        for atual, _, arquivos in os.walk(base):
            for nome in arquivos:
                relativo = (Path(atual) / nome).relative_to(base).as_posix()
                if relativo.startswith(prefixo) and not nome.startswith("."):
                    saida.append(relativo)
        return sorted(saida)

    def ler(self, caminho: str) -> bytes:
        return (self.raiz / caminho).read_bytes()

    def gravar(self, caminho: str, dados: bytes, tipo: str = "application/octet-stream") -> None:
        destino = self.raiz / caminho
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(dados)

    def existe(self, caminho: str) -> bool:
        return (self.raiz / caminho).is_file()


class ArmazenamentoGcs:
    def __init__(self, bucket: str, projeto: str | None = None) -> None:
        from google.cloud import storage

        self.bucket = bucket
        self._bucket = storage.Client(project=projeto).bucket(bucket)

    def listar(self, prefixo: str) -> list[str]:
        return sorted(
            b.name for b in self._bucket.list_blobs(prefix=prefixo) if not b.name.endswith("/")
        )

    def ler(self, caminho: str) -> bytes:
        return self._bucket.blob(caminho).download_as_bytes()

    def gravar(self, caminho: str, dados: bytes, tipo: str = "application/octet-stream") -> None:
        self._bucket.blob(caminho).upload_from_string(dados, content_type=tipo)

    def existe(self, caminho: str) -> bool:
        return self._bucket.blob(caminho).exists()


def abrir(bucket: str | None, local: Path | None, projeto: str | None) -> Armazenamento:
    """`--local <pasta>` usa o espelho; sem ele, o bucket real."""
    nome = bucket or (bucket_padrao(projeto) if projeto else None)
    if not nome:
        raise SystemExit("informe --bucket ou --projeto (ou AGENTE_PROJETO)")
    if local is not None:
        return ArmazenamentoLocal(local, nome)
    return ArmazenamentoGcs(nome, projeto)
