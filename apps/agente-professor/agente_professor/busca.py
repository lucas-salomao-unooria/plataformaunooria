"""Cliente mínimo do `servingConfigs:search` do Vertex AI Search (Discovery Engine).

Por que não o `VertexAiSearchTool` do ADK: teto de 10 resultados, sem paginação, e —
com outra ferramenta no mesmo agente — ele é trocado em silêncio por um substituto
que descarta o `pageSpan`. "Todas as habilidades de Matemática do 6º ano" que volta
com 10 é um plano que descumpre o currículo (`docs/regras/agente-professor.md`).

A credencial é a do ambiente (ADC). As ferramentas dependem do `Protocol`
`ClienteBusca`, e os testes trocam o cliente por um fake com `definir_cliente_busca`.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import weakref
from typing import Any, Protocol

import google.auth
import google.auth.transport.requests
import httpx

from .config import configuracao

logger = logging.getLogger(__name__)

_ESCOPO = "https://www.googleapis.com/auth/cloud-platform"


class ErroDeBusca(RuntimeError):
    def __init__(self, status: int, motivo: str) -> None:
        super().__init__(f"busca falhou ({status}): {motivo}")
        self.status = status
        self.motivo = motivo


class ClienteBusca(Protocol):
    async def buscar(self, datastore: str, corpo: dict[str, Any]) -> dict[str, Any]:
        """POST no `default_search` do data store; devolve o JSON da resposta."""
        ...


def base_url(location: str) -> str:
    if location == "global":
        return "https://discoveryengine.googleapis.com/v1"
    return f"https://{location}-discoveryengine.googleapis.com/v1"


class CredencialDoAmbiente:
    """ADC com renovação preguiçosa. `refresh` é bloqueante: roda numa thread."""

    def __init__(self) -> None:
        self._credencial: Any = None
        # Trava de THREAD, não de asyncio: o processo tem mais de um event loop.
        self._trava = threading.Lock()

    def _renovar(self) -> None:
        with self._trava:
            if self._credencial is None:
                self._credencial, _ = google.auth.default(scopes=[_ESCOPO])
            if not self._credencial.valid:
                self._credencial.refresh(google.auth.transport.requests.Request())

    async def cabecalhos(self, projeto: str) -> dict[str, str]:
        if self._credencial is None or not self._credencial.valid:
            await asyncio.to_thread(self._renovar)
        credencial: Any = self._credencial
        cabecalhos = {"Authorization": f"Bearer {credencial.token}"}
        # Credencial de USUÁRIO (dev local) exige projeto de cota; a de SA, não — e
        # mandar o cabeçalho com a SA exige `serviceusage.services.use`, que ela não tem.
        if getattr(credencial, "quota_project_id", None) or type(credencial).__module__.startswith(
            "google.oauth2.credentials"
        ):
            cabecalhos["x-goog-user-project"] = projeto
        return cabecalhos


class ClienteDiscoveryEngine:
    def __init__(self, projeto: str, location: str = "global") -> None:
        self.projeto = projeto
        self.location = location
        self._credencial = CredencialDoAmbiente()
        # Um `AsyncClient` por event loop: o AdkApp roda o stream síncrono numa thread
        # com loop próprio, e um cliente preso a um loop fechado quebra na 2ª chamada.
        self._clientes: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, httpx.AsyncClient] = (
            weakref.WeakKeyDictionary()
        )

    def _http(self) -> httpx.AsyncClient:
        loop = asyncio.get_running_loop()
        cliente = self._clientes.get(loop)
        if cliente is None:
            cliente = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
            self._clientes[loop] = cliente
        return cliente

    def serving_config(self, datastore: str) -> str:
        return (
            f"projects/{self.projeto}/locations/{self.location}/collections/default_collection/"
            f"dataStores/{datastore}/servingConfigs/default_search"
        )

    async def buscar(self, datastore: str, corpo: dict[str, Any]) -> dict[str, Any]:
        url = f"{base_url(self.location)}/{self.serving_config(datastore)}:search"
        cabecalhos = await self._credencial.cabecalhos(self.projeto)
        resposta = await self._http().post(url, json=corpo, headers=cabecalhos)
        if resposta.status_code >= 400:
            # O corpo do erro do Discovery Engine não ecoa a query; é seguro resumir.
            try:
                motivo = str(resposta.json().get("error", {}).get("status", "erro"))
            except ValueError:
                motivo = "erro"
            raise ErroDeBusca(resposta.status_code, motivo)
        return resposta.json()


_cliente: ClienteBusca | None = None


def definir_cliente_busca(cliente: ClienteBusca | None) -> None:
    """Troca o cliente do processo (testes, avaliação com fake). `None` volta ao real."""
    global _cliente
    _cliente = cliente


def cliente_busca() -> ClienteBusca:
    global _cliente
    if _cliente is None:
        cfg = configuracao()
        projeto = cfg.projeto_efetivo
        if not projeto:
            raise ErroDeBusca(0, "AGENTE_PROJETO (ou GOOGLE_CLOUD_PROJECT) ausente")
        _cliente = ClienteDiscoveryEngine(projeto, cfg.busca_location)
    return _cliente
