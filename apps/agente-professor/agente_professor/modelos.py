"""Os modelos do agente: Gemini em `global`, com reserva em `us`.

`global` é a location de maior disponibilidade, mas não é garantia: um 429 de cota,
um 503 ou um 404 de modelo ainda não publicado em `global` derrubariam o turno. O
`ModeloComReserva` tenta o principal e, se ele falhar ANTES de entregar qualquer
pedaço de resposta, repete o MESMO pedido no reserva. Depois do primeiro pedaço não
há troca: o professor já está lendo, e trocar de modelo no meio duplicaria texto.

A location vai no `client_kwargs` do `Gemini` (ADK ≥ 2.4), nunca em
`GOOGLE_CLOUD_LOCATION`: no Agent Engine essa env é reservada e vale a região do
deploy.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from google.adk.models import BaseLlm, LlmCapabilities
from google.adk.models.google_llm import Gemini
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import errors, types

from .config import Configuracao

logger = logging.getLogger(__name__)

#: Códigos HTTP que justificam tentar a outra location.
CODIGOS_DE_TROCA = frozenset({404, 429, 500, 503, 504})


def deve_trocar(erro: BaseException) -> bool:
    if isinstance(erro, errors.APIError):
        return int(getattr(erro, "code", 0) or 0) in CODIGOS_DE_TROCA
    return isinstance(erro, httpx.TimeoutException | httpx.ConnectError)


class ModeloComReserva(BaseLlm):
    """Delega ao `principal`; na falha elegível antes do 1º pedaço, ao `reserva`."""

    principal: BaseLlm
    reserva: BaseLlm

    @property
    def capabilities(self) -> LlmCapabilities:
        return self.principal.capabilities

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        # O Gemini pré-processa o pedido no lugar; a reserva recebe o original.
        copia = llm_request.model_copy(deep=True)
        entregou = False
        try:
            async for resposta in self.principal.generate_content_async(llm_request, stream):
                entregou = True
                yield resposta
            return
        except Exception as erro:
            if entregou or not deve_trocar(erro):
                raise
            logger.warning(
                "modelo principal falhou (%s %s); tentando a reserva",
                type(erro).__name__,
                getattr(erro, "code", ""),
            )
        copia.model = self.reserva.model
        async for resposta in self.reserva.generate_content_async(copia, stream):
            yield resposta


def _gemini(modelo: str, location: str, projeto: str | None) -> Gemini:
    kwargs: dict[str, Any] = {"enterprise": True, "location": location}
    if projeto:
        kwargs["project"] = projeto
    return Gemini(model=modelo, client_kwargs=kwargs)


def criar_modelo(cfg: Configuracao, *, modelo: str | None = None) -> ModeloComReserva:
    nome = modelo or cfg.modelo
    return ModeloComReserva(
        model=nome,
        principal=_gemini(nome, cfg.modelo_location, cfg.projeto_efetivo),
        reserva=_gemini(nome, cfg.modelo_location_reserva, cfg.projeto_efetivo),
    )


async def gerar_texto(
    modelo: BaseLlm,
    *,
    instrucao: str,
    texto: str,
    json: bool = False,
    max_tokens: int = 256,
) -> tuple[str, int]:
    """Uma chamada curta e sem ferramenta (guarda de escopo, título). → (texto, tokens)."""
    config = types.GenerateContentConfig(
        system_instruction=instrucao,
        temperature=0.0,
        max_output_tokens=max_tokens,
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL),
    )
    if json:
        config.response_mime_type = "application/json"
    pedido = LlmRequest(
        model=modelo.model,
        contents=[types.Content(role="user", parts=[types.Part(text=texto)])],
        config=config,
    )
    partes: list[str] = []
    tokens = 0
    async for resposta in modelo.generate_content_async(pedido, stream=False):
        if resposta.error_code:
            raise RuntimeError(f"modelo respondeu erro {resposta.error_code}")
        if resposta.content and resposta.content.parts:
            partes.extend(p.text for p in resposta.content.parts if p.text and not p.thought)
        if resposta.usage_metadata and resposta.usage_metadata.total_token_count:
            tokens += resposta.usage_metadata.total_token_count
    return "".join(partes).strip(), tokens
