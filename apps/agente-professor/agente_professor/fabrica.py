"""A fábrica do `AdkApp` — o objeto que o Agent Engine carrega e que o shim serve.

O entrypoint em si está em `app_engine.py` (construído na importação); os testes
importam só esta fábrica, para montar o `AdkApp` com modelos fake.

Sessões: no Agent Engine (há `GOOGLE_CLOUD_AGENT_ENGINE_ID` no ambiente) o AdkApp usa
o `VertexAiSessionService` do próprio engine; fora dele, sessões em memória que
aceitam — e ignoram — `ttl`/`expire_time`, para o shim aceitar o MESMO corpo que a api
manda ao engine.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import google.auth
import google.auth.exceptions
import vertexai
from google.adk.apps import App
from google.adk.sessions.base_session_service import BaseSessionService
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.adk.sessions.session import Session
from vertexai.agent_engines import AdkApp

from .agente import criar_app
from .config import configuracao

logger = logging.getLogger(__name__)

_PROJETO_DE_RESERVA = "sem-projeto-local"


class SessoesEmMemoria(InMemorySessionService):
    """`InMemorySessionService` que tolera os kwargs do `VertexAiSessionService`."""

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: dict[str, Any] | None = None,
        session_id: str | None = None,
        **kwargs: Any,
    ) -> Session:
        desconhecidos = set(kwargs) - {"ttl", "expire_time"}
        if desconhecidos:
            raise TypeError(f"argumentos inesperados: {sorted(desconhecidos)}")
        return await super().create_session(
            app_name=app_name, user_id=user_id, state=state, session_id=session_id
        )


def no_agent_engine() -> bool:
    return "GOOGLE_CLOUD_AGENT_ENGINE_ID" in os.environ


def _garantir_projeto() -> None:
    """O `AdkApp` exige um projeto já no construtor. Fora do GCP, sem ADC, usa um
    projeto de mentira — as ferramentas acusam a falta de `AGENTE_PROJETO` na chamada."""
    projeto = configuracao().projeto_efetivo
    if not projeto:
        try:
            _, projeto = google.auth.default()
        except google.auth.exceptions.DefaultCredentialsError:
            projeto = None
    if projeto:
        vertexai.init(project=projeto)
    else:
        logger.warning("sem projeto GCP no ambiente; o AdkApp sobe com %s", _PROJETO_DE_RESERVA)
        vertexai.init(project=_PROJETO_DE_RESERVA)


def _sessoes_em_memoria() -> BaseSessionService:
    return SessoesEmMemoria()


def criar_adk_app(app: App | None = None) -> AdkApp:
    _garantir_projeto()
    return AdkApp(
        app=app or criar_app(),
        session_service_builder=None if no_agent_engine() else _sessoes_em_memoria,
    )
