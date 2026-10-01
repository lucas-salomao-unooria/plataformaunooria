"""Configuração do agente, lida das envs `AGENTE_*` e validada na carga.

Nenhuma env aqui é segredo: a credencial é a do ambiente (ADC — a SA do agente no
Agent Engine, o `gcloud auth application-default login` na máquina do dev).

**`GOOGLE_CLOUD_LOCATION` não é nossa.** No Agent Engine ela é reservada e vale a
região do deploy; o modelo em `global` e a busca em `global` se configuram pelas
envs abaixo, nunca por ela.
"""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_LOCATION_VALIDA = r"^(global|us|eu|[a-z]+-[a-z]+\d+)$"


class Configuracao(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AGENTE_", extra="ignore", frozen=True)

    #: Modelo principal da conversa.
    modelo: str = Field(default="gemini-3.7-flash", min_length=1)
    #: Onde o modelo principal roda. `global` dá a maior disponibilidade.
    modelo_location: str = Field(default="global", pattern=_LOCATION_VALIDA)
    #: Para onde o turno vai quando `global` falha (429/503/404 de modelo indisponível).
    modelo_location_reserva: str = Field(default="us", pattern=_LOCATION_VALIDA)
    #: Modelo barato da guarda de escopo e do título da conversa.
    modelo_escopo: str = Field(default="gemini-3.5-flash-lite", min_length=1)

    #: Projeto GCP. Ausente = `GOOGLE_CLOUD_PROJECT` (que o Agent Engine preenche).
    projeto: str | None = None
    #: Location dos data stores (Vertex AI Search). Os dois nascem em `global`.
    busca_location: str = Field(default="global", pattern=_LOCATION_VALIDA)
    datastore_habilidades: str = Field(default="agente-professor-habilidades", min_length=1)
    datastore_acervo: str = Field(default="agente-professor-acervo", min_length=1)

    @field_validator("projeto")
    @classmethod
    def _projeto_vazio_e_ausente(cls, valor: str | None) -> str | None:
        return valor or None

    @property
    def projeto_efetivo(self) -> str | None:
        return self.projeto or os.environ.get("GOOGLE_CLOUD_PROJECT") or None


@lru_cache(maxsize=1)
def configuracao() -> Configuracao:
    """A configuração do processo. `configuracao.cache_clear()` nos testes."""
    return Configuracao()
