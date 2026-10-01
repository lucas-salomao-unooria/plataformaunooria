from __future__ import annotations

import pytest
from google.adk.models.google_llm import Gemini
from google.adk.models.llm_request import LlmRequest
from google.genai import errors, types

from agente_professor.config import Configuracao
from agente_professor.modelos import ModeloComReserva, criar_modelo
from fakes import LlmRoteirizado, Texto


def _pedido() -> LlmRequest:
    return LlmRequest(
        model="gemini-fake", contents=[types.Content(role="user", parts=[types.Part(text="oi")])]
    )


def _erro(codigo: int) -> errors.APIError:
    return errors.APIError(codigo, {"error": {"code": codigo, "message": "x", "status": "X"}})


async def _textos(modelo: ModeloComReserva) -> list[str]:
    return [
        r.content.parts[0].text or ""
        async for r in modelo.generate_content_async(_pedido())
        if r.content and r.content.parts
    ]


@pytest.mark.parametrize("codigo", [404, 429, 500, 503, 504])
async def test_falha_elegivel_do_global_vai_para_a_reserva(codigo: int) -> None:
    principal = LlmRoteirizado(roteiro=[_erro(codigo)])
    reserva = LlmRoteirizado(model="gemini-reserva", roteiro=[Texto("da reserva", pedacos=1)])
    modelo = ModeloComReserva(model="gemini-fake", principal=principal, reserva=reserva)
    assert await _textos(modelo) == ["da reserva"]
    assert reserva.pedidos[0].model == "gemini-reserva"


@pytest.mark.parametrize("codigo", [400, 401, 403])
async def test_erro_do_pedido_nao_troca_de_location(codigo: int) -> None:
    reserva = LlmRoteirizado(roteiro=[Texto("não deveria")])
    modelo = ModeloComReserva(
        model="m", principal=LlmRoteirizado(roteiro=[_erro(codigo)]), reserva=reserva
    )
    with pytest.raises(errors.APIError):
        await _textos(modelo)
    assert reserva.pedidos == []


async def test_sem_falha_a_reserva_nem_e_chamada() -> None:
    reserva = LlmRoteirizado(roteiro=[])
    modelo = ModeloComReserva(
        model="m", principal=LlmRoteirizado(roteiro=[Texto("ok", pedacos=1)]), reserva=reserva
    )
    assert await _textos(modelo) == ["ok"]
    assert reserva.pedidos == []


def test_locations_vao_no_client_kwargs_e_nunca_na_env() -> None:
    cfg = Configuracao(projeto="p-1")
    modelo = criar_modelo(cfg)
    principal, reserva = modelo.principal, modelo.reserva
    assert isinstance(principal, Gemini) and isinstance(reserva, Gemini)
    assert principal.client_kwargs == {"enterprise": True, "location": "global", "project": "p-1"}
    assert (reserva.client_kwargs or {})["location"] == "us"
    assert modelo.model == "gemini-3.7-flash"
    assert criar_modelo(cfg, modelo=cfg.modelo_escopo).model == "gemini-3.5-flash-lite"


def test_configuracao_valida_location() -> None:
    with pytest.raises(ValueError):
        Configuracao(modelo_location="Global!")
