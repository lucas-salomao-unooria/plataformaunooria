"""O agente de IA do professor: o `LlmAgent` raiz e o `App` com os plugins."""

from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.apps import App
from google.adk.models.base_llm import BaseLlm
from google.adk.plugins.base_plugin import BasePlugin
from google.adk.tools.function_tool import FunctionTool
from google.genai import types

from .config import Configuracao, configuracao
from .ferramentas import buscar_acervo, buscar_habilidades
from .instrucoes import INSTRUCAO_DO_AGENTE
from .modelos import criar_modelo
from .plugins import (
    NOME_DO_AGENTE,
    GuardaDeEscopoPlugin,
    MarcacaoDeEventosPlugin,
    PodaPlugin,
    RegistroDoTurno,
    TituloPlugin,
)

#: Nome do `App` — vira o `app_name` das sessões fora do Agent Engine.
NOME_DO_APP = "agente_professor"


def criar_agente(modelo: BaseLlm | None = None, cfg: Configuracao | None = None) -> LlmAgent:
    cfg = cfg or configuracao()
    return LlmAgent(
        name=NOME_DO_AGENTE,
        description="Agente de IA do professor da Unooria: BNCC e acervo de livros.",
        model=modelo or criar_modelo(cfg),
        instruction=INSTRUCAO_DO_AGENTE,
        tools=[FunctionTool(buscar_habilidades), FunctionTool(buscar_acervo)],
        generate_content_config=types.GenerateContentConfig(temperature=0.3),
    )


def criar_app(
    *,
    modelo: BaseLlm | None = None,
    modelo_escopo: BaseLlm | None = None,
    cfg: Configuracao | None = None,
) -> App:
    """O `App` do ADK. Os parâmetros existem para os testes (modelos fake, sem GCP)."""
    cfg = cfg or configuracao()
    escopo = modelo_escopo
    cache: dict[str, BaseLlm] = {}

    def fabrica_de_escopo() -> BaseLlm:
        # Preguiçoso: o modelo de escopo só é construído na primeira mensagem.
        if escopo is not None:
            return escopo
        if "m" not in cache:
            cache["m"] = criar_modelo(cfg, modelo=cfg.modelo_escopo)
        return cache["m"]

    registro = RegistroDoTurno()
    plugins: list[BasePlugin] = [
        GuardaDeEscopoPlugin(fabrica_de_escopo, registro),
        TituloPlugin(fabrica_de_escopo, registro),
        PodaPlugin(),
        MarcacaoDeEventosPlugin(registro),
    ]
    return App(name=NOME_DO_APP, root_agent=criar_agente(modelo, cfg), plugins=plugins)
