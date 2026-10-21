"""Importa os JSONL nos data stores (`documents:import`) e aplica os esquemas.

    uv run python -m ingestao.importar esquema      [--seco] --projeto P   # 1ª vez, e quando o esquema mudar
    uv run python -m ingestao.importar habilidades  [--seco] --projeto P
    uv run python -m ingestao.importar acervo       [--seco] --projeto P

- **habilidades**: `dataSchema: custom`, `idField: "id"`, `reconciliationMode: FULL` —
  o JSONL é o conjunto INTEIRO; documento que não está nele sai do data store. É por
  isso que `exportar_habilidades` aborta quando os totais não batem.
- **acervo**: `dataSchema: document`, `reconciliationMode: INCREMENTAL` — livro novo
  entra sem reprocessar os outros (o parser de layout cobra por página). Consequência:
  livro APAGADO do bucket continua no data store até alguém apagar o documento (ou
  rodar com `--full` uma vez).
- **esquema**: os campos de filtro (`codigo`, `anos`, `componente_slug`, `etapa`, `tipo`)
  têm de ser `indexable`, senão o filtro responde `INVALID_ARGUMENT`. Os esquemas
  ficam em `ingestao/esquemas/`.

Erros de linha vão para `gs://<bucket>/import-erros/<alvo>/<carimbo>/`. O script espera
a operação terminar e resume sucessos e falhas.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
from pathlib import Path
from typing import Any

import google.auth
import google.auth.transport.requests
import httpx

from agente_professor.busca import base_url

from .armazenamento import bucket_padrao
from .comum import CAMINHO_ACERVO, CAMINHO_HABILIDADES, PREFIXO_ERROS, projeto_padrao

ESQUEMAS = Path(__file__).with_name("esquemas")
DATASTORES = {"habilidades": "agente-professor-habilidades", "acervo": "agente-professor-acervo"}


def caminho_do_datastore(projeto: str, location: str, datastore: str) -> str:
    return (
        f"projects/{projeto}/locations/{location}/collections/default_collection/"
        f"dataStores/{datastore}"
    )


def corpo_de_importacao(
    alvo: str, bucket: str, carimbo: str, completo: bool = False
) -> dict[str, Any]:
    erros = {"gcsPrefix": f"gs://{bucket}/{PREFIXO_ERROS}{alvo}/{carimbo}/"}
    if alvo == "habilidades":
        return {
            "gcsSource": {
                "inputUris": [f"gs://{bucket}/{CAMINHO_HABILIDADES}"],
                "dataSchema": "custom",
            },
            "idField": "id",
            "reconciliationMode": "FULL",
            "errorConfig": erros,
        }
    if alvo == "acervo":
        return {
            "gcsSource": {
                "inputUris": [f"gs://{bucket}/{CAMINHO_ACERVO}"],
                "dataSchema": "document",
            },
            "reconciliationMode": "FULL" if completo else "INCREMENTAL",
            "errorConfig": erros,
        }
    raise ValueError(alvo)


def _cabecalhos(projeto: str) -> dict[str, str]:
    credencial, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    credencial.refresh(google.auth.transport.requests.Request())
    return {"Authorization": f"Bearer {credencial.token}", "x-goog-user-project": projeto}


def esperar(
    http: httpx.Client,
    base: str,
    operacao: dict[str, Any],
    teto_s: float = 3_600,
    dormir: Any = time.sleep,
) -> dict[str, Any]:
    nome = operacao["name"]
    espera, inicio = 5.0, time.monotonic()
    while not operacao.get("done"):
        if time.monotonic() - inicio > teto_s:
            raise SystemExit(f"operação {nome} não terminou em {teto_s:.0f}s; confira no console")
        dormir(espera)
        espera = min(espera * 1.5, 60.0)
        resposta = http.get(f"{base}/{nome}")
        resposta.raise_for_status()
        operacao = resposta.json()
    return operacao


def resumir(operacao: dict[str, Any]) -> tuple[str, bool]:
    if "error" in operacao:
        return f"FALHOU: {operacao['error'].get('message', operacao['error'])}", False
    metadados = operacao.get("metadata") or {}
    sucesso = int(metadados.get("successCount", 0) or 0)
    falha = int(metadados.get("failureCount", 0) or 0)
    linhas = [f"sucessos={sucesso} falhas={falha} total={metadados.get('totalCount', '?')}"]
    for amostra in (operacao.get("response") or {}).get("errorSamples", [])[:10]:
        linhas.append(f"  erro: {amostra.get('message', amostra)}")
    return "\n".join(linhas), falha == 0


def executar(
    alvo: str,
    *,
    projeto: str,
    bucket: str,
    location: str,
    seco: bool,
    completo: bool = False,
    http: httpx.Client | None = None,
    dormir: Any = time.sleep,
) -> int:
    base = base_url(location)
    carimbo = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")
    pedidos: list[tuple[str, str, dict[str, Any]]] = []
    if alvo == "esquema":
        for nome, datastore in DATASTORES.items():
            esquema = json.loads((ESQUEMAS / f"{nome}.json").read_text(encoding="utf-8"))
            url = f"{base}/{caminho_do_datastore(projeto, location, datastore)}/schemas/default_schema"
            pedidos.append(("PATCH", url, {"structSchema": esquema}))
    else:
        url = (
            f"{base}/{caminho_do_datastore(projeto, location, DATASTORES[alvo])}"
            "/branches/default_branch/documents:import"
        )
        pedidos.append(("POST", url, corpo_de_importacao(alvo, bucket, carimbo, completo)))

    if seco:
        for metodo, url, corpo in pedidos:
            print(
                f"[seco] {metodo} {url}\n{json.dumps(corpo, ensure_ascii=False, indent=2)[:2000]}"
            )
        return 0

    cliente = http or httpx.Client(headers=_cabecalhos(projeto), timeout=60.0)
    ok = True
    with cliente:
        for metodo, url, corpo in pedidos:
            resposta = cliente.request(metodo, url, json=corpo)
            if resposta.status_code >= 400:
                print(
                    f"{metodo} {url} → {resposta.status_code}: {resposta.text[:500]}",
                    file=sys.stderr,
                )
                ok = False
                continue
            operacao = esperar(cliente, base, resposta.json(), dormir=dormir)
            texto, sucesso = resumir(operacao)
            print(f"{alvo}: {texto}")
            ok = ok and sucesso
    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("alvo", choices=["esquema", "habilidades", "acervo"])
    parser.add_argument("--seco", action="store_true", help="só mostra o que faria")
    parser.add_argument("--projeto")
    parser.add_argument("--bucket")
    parser.add_argument("--location", default="global")
    parser.add_argument(
        "--full",
        action="store_true",
        help="acervo com reconciliationMode FULL (remove documentos ausentes)",
    )
    args = parser.parse_args(argv)
    projeto = projeto_padrao(args.projeto)
    if not projeto:
        raise SystemExit("informe --projeto (ou AGENTE_PROJETO)")
    return executar(
        args.alvo,
        projeto=projeto,
        bucket=args.bucket or bucket_padrao(projeto),
        location=args.location,
        seco=args.seco,
        completo=args.full,
    )


if __name__ == "__main__":
    sys.exit(main())
