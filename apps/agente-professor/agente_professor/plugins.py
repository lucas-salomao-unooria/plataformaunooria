"""Os plugins do `App`: guarda de escopo, título, poda e marcação de eventos.

Nenhum deles loga conteúdo do professor: só códigos, contagens e tipos de erro. O
professor pode escrever o nome de um estudante, e log é o lugar onde isso vaza
(regra 6 da raiz).

Onde cada coisa aparece no stream (é o que a api lê):

- **Recusa de escopo**: um evento NÃO parcial, do autor `agente_professor`, com o
  texto pronto e `custom_metadata.fora_do_escopo = true`. Não vem parcial antes dele
  (não houve modelo), então a api repassa o texto desse evento como `delta` único.
- **Título**: `actions.state_delta.titulo_conversa`, num evento próprio do autor
  `agente_professor`, SEM conteúdo, emitido depois do evento final da resposta (é o
  `after_agent_callback` que muda o estado, e o ADK transforma mudança de estado de
  callback num evento).
- **Tokens das chamadas auxiliares** (guarda e título, que não passam pelo modelo
  principal): SOMADOS ao `usage_metadata.total_token_count` do primeiro evento NÃO
  parcial depois de cada chamada (criando o `usage_metadata` quando o evento não tem —
  a recusa e o evento do título), e repetidos em `custom_metadata.tokens_auxiliares`
  para auditoria. A api já soma `usage_metadata.total_token_count` dos não parciais
  para a quota (regra 5 da raiz): nada a mais a fazer lá.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.plugins.base_plugin import BasePlugin
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.tool_context import ToolContext
from google.genai import types

from . import instrucoes
from .modelos import gerar_texto
from .poda import podar_historico, podar_resposta, tamanho

logger = logging.getLogger(__name__)

NOME_DO_AGENTE = "agente_professor"
CHAVE_TITULO = "titulo_conversa"
CHAVE_NOME = "nome_professor"
TETO_DO_TITULO = 60
_TETO_DO_CONTEXTO = 600

FabricaDeModelo = Callable[[], BaseLlm]


# ------------------------------------------------------------ registro do turno


@dataclass
class _Turno:
    tokens_auxiliares: int = 0
    fora_do_escopo: bool = False


@dataclass
class RegistroDoTurno:
    """Estado por invocação que os plugins compartilham. Some no fim do turno."""

    _turnos: dict[str, _Turno] = field(default_factory=dict)

    def turno(self, invocation_id: str) -> _Turno:
        return self._turnos.setdefault(invocation_id, _Turno())

    def encerrar(self, invocation_id: str) -> None:
        self._turnos.pop(invocation_id, None)


def _texto(conteudo: types.Content | None) -> str:
    if not conteudo or not conteudo.parts:
        return ""
    return "".join(p.text for p in conteudo.parts if p.text and not p.thought).strip()


def _corte(texto: str, teto: int) -> str:
    return texto if len(texto) <= teto else texto[:teto] + "…"


# -------------------------------------------------------------- guarda de escopo


class GuardaDeEscopoPlugin(BasePlugin):
    """Classifica a mensagem com o modelo barato; fora do escopo, recusa sem o principal.

    Fail-open: se o classificador falhar (rede, cota, JSON inválido), o turno segue
    para o modelo principal, que também tem a regra de escopo na instrução. Barrar o
    professor porque o classificador caiu seria pior que deixá-lo passar.
    """

    def __init__(self, modelo: FabricaDeModelo, registro: RegistroDoTurno) -> None:
        super().__init__(name="guarda_de_escopo")
        self._modelo = modelo
        self._registro = registro

    @staticmethod
    def _contexto_anterior(ctx: InvocationContext) -> str:
        pergunta = resposta = ""
        for evento in reversed(ctx.session.events):
            if evento.invocation_id == ctx.invocation_id or evento.partial:
                continue
            texto = _texto(evento.content)
            if not texto:
                continue
            if evento.author == "user" and not pergunta:
                pergunta = texto
            elif evento.author != "user" and not resposta:
                resposta = texto
            if pergunta and resposta:
                break
        if not (pergunta or resposta):
            return ""
        return (
            f"PERGUNTA ANTERIOR: {_corte(pergunta, _TETO_DO_CONTEXTO)}\n"
            f"RESPOSTA ANTERIOR: {_corte(resposta, _TETO_DO_CONTEXTO)}\n"
        )

    async def before_agent_callback(
        self, *, agent: BaseAgent, callback_context: CallbackContext
    ) -> types.Content | None:
        if agent.name != NOME_DO_AGENTE:
            return None
        mensagem = _texto(callback_context.user_content)
        if not mensagem:
            return None
        ctx = callback_context._invocation_context
        entrada = f"{self._contexto_anterior(ctx)}MENSAGEM: {_corte(mensagem, 4_000)}"
        try:
            bruto, tokens = await gerar_texto(
                self._modelo(),
                instrucao=instrucoes.INSTRUCAO_DA_GUARDA,
                texto=entrada,
                json=True,
                max_tokens=32,
            )
            self._registro.turno(ctx.invocation_id).tokens_auxiliares += tokens
            dentro = json.loads(bruto).get("dentro_do_escopo")
            if not isinstance(dentro, bool):
                raise ValueError("campo dentro_do_escopo ausente")
        except Exception as erro:
            logger.warning(
                "guarda de escopo falhou (%s); seguindo (fail-open)", type(erro).__name__
            )
            return None
        if dentro:
            return None
        logger.info("guarda de escopo: mensagem fora do escopo, recusada")
        self._registro.turno(ctx.invocation_id).fora_do_escopo = True
        nome = callback_context.state.get(CHAVE_NOME) or None
        return types.Content(role="model", parts=[types.Part(text=instrucoes.recusa(nome))])


# ------------------------------------------------------------------------ título


def limpar_titulo(bruto: str) -> str:
    titulo = bruto.strip().splitlines()[0] if bruto.strip() else ""
    titulo = titulo.strip().strip("\"'“”‘’`*#").strip()
    titulo = re.sub(r"^(t[íi]tulo\s*:\s*)", "", titulo, flags=re.IGNORECASE)
    titulo = re.sub(r"\s+", " ", titulo)
    if len(titulo) > TETO_DO_TITULO:
        titulo = titulo[:TETO_DO_TITULO].rsplit(" ", 1)[0]
    return titulo.rstrip(" .;:,!…-—–").strip()


class TituloPlugin(BasePlugin):
    """Depois do 1º turno respondido, grava `titulo_conversa` no estado da sessão.

    Não escreve título em turno recusado (sairia "Pergunta fora do escopo") nem quando
    o modelo falha — o turno seguinte tenta de novo. Nunca usa a pergunta crua como
    título de reserva: ela pode ter o nome de um estudante, e o título vai para o
    Postgres e para a tela.
    """

    def __init__(self, modelo: FabricaDeModelo, registro: RegistroDoTurno) -> None:
        super().__init__(name="titulo_da_conversa")
        self._modelo = modelo
        self._registro = registro

    async def after_agent_callback(
        self, *, agent: BaseAgent, callback_context: CallbackContext
    ) -> types.Content | None:
        if agent.name != NOME_DO_AGENTE or callback_context.state.get(CHAVE_TITULO):
            return None
        ctx = callback_context._invocation_context
        turno = self._registro.turno(ctx.invocation_id)
        if turno.fora_do_escopo:
            return None
        pergunta = _texto(callback_context.user_content)
        resposta = next(
            (
                _texto(e.content)
                for e in reversed(ctx.session.events)
                if e.invocation_id == ctx.invocation_id
                and e.author == NOME_DO_AGENTE
                and not e.partial
                and _texto(e.content)
            ),
            "",
        )
        if not pergunta or not resposta:
            return None
        try:
            bruto, tokens = await gerar_texto(
                self._modelo(),
                instrucao=instrucoes.INSTRUCAO_DO_TITULO,
                texto=f"PERGUNTA: {_corte(pergunta, 1_500)}\nRESPOSTA: {_corte(resposta, 1_500)}",
                max_tokens=40,
            )
            turno.tokens_auxiliares += tokens
        except Exception as erro:
            logger.warning("título falhou (%s); fica para o próximo turno", type(erro).__name__)
            return None
        titulo = limpar_titulo(bruto)
        if titulo:
            callback_context.state[CHAVE_TITULO] = titulo
        return None


# -------------------------------------------------------------------------- poda


class PodaPlugin(BasePlugin):
    """Poda o retorno de ferramenta e os retornos antigos do histórico."""

    def __init__(self) -> None:
        super().__init__(name="poda")

    async def after_tool_callback(
        self,
        *,
        tool: BaseTool,
        tool_args: dict[str, Any],
        tool_context: ToolContext,
        result: dict[str, Any],
    ) -> dict[str, Any] | None:
        podada = podar_resposta(tool.name, result)
        if podada is result:
            return None
        logger.info(
            "poda: retorno de %s de %d para %d caracteres",
            tool.name,
            tamanho(result),
            tamanho(podada),
        )
        return podada

    async def before_model_callback(
        self, *, callback_context: CallbackContext, llm_request: LlmRequest
    ) -> None:
        resumidos = podar_historico(llm_request.contents)
        if resumidos:
            logger.info("poda: %d retornos de ferramenta antigos resumidos", resumidos)


# ---------------------------------------------------------- marcação de eventos


class MarcacaoDeEventosPlugin(BasePlugin):
    """O ÚNICO plugin com `on_event_callback` (o primeiro retorno não nulo encerra a
    cadeia no PluginManager). Marca a recusa e anexa os tokens auxiliares."""

    def __init__(self, registro: RegistroDoTurno) -> None:
        super().__init__(name="marcacao_de_eventos")
        self._registro = registro

    async def on_event_callback(
        self, *, invocation_context: InvocationContext, event: Event
    ) -> Event | None:
        if event.partial:
            return None
        turno = self._registro.turno(invocation_context.invocation_id)
        metadados: dict[str, Any] = {}
        if turno.fora_do_escopo and event.author == NOME_DO_AGENTE and _texto(event.content):
            metadados["fora_do_escopo"] = True
        if turno.tokens_auxiliares:
            # A api debita a quota somando `usage_metadata.total_token_count` dos eventos
            # NÃO parciais: os tokens da guarda e do título entram nessa mesma soma.
            uso = event.usage_metadata or types.GenerateContentResponseUsageMetadata()
            uso.total_token_count = (uso.total_token_count or 0) + turno.tokens_auxiliares
            event.usage_metadata = uso
            metadados["tokens_auxiliares"] = turno.tokens_auxiliares
            turno.tokens_auxiliares = 0
        if not metadados:
            return None
        event.custom_metadata = {**(event.custom_metadata or {}), **metadados}
        return event

    async def after_run_callback(self, *, invocation_context: InvocationContext) -> None:
        self._registro.encerrar(invocation_context.invocation_id)

    async def on_run_error_callback(
        self, *, invocation_context: InvocationContext, error: Exception
    ) -> None:
        self._registro.encerrar(invocation_context.invocation_id)
