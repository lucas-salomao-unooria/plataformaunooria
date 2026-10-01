"""Contenção do que entra no contexto do modelo: retorno de ferramenta e histórico.

Os tetos vêm do gerador-missoes (`agents/callbacks.py`), onde uma sequência de
respostas grandes de ferramenta estourou o 1.048.576 tokens do Gemini num turno só:
≤ 6.000 caracteres por string e ≤ 24.000 por resposta.

**Uma exceção medida: `buscar_habilidades`.** A lista inteira de Língua Portuguesa do
8º ano tem 109 habilidades e ~58.000 caracteres; cortá-la em 24.000 é exatamente o
"plano que descumpre o currículo" que o contrato proíbe. O teto dela é 120.000 (a
ferramenta já limita a 150 itens e tira o texto pedagógico acima de 20). O teto por
string vale para todas.

**Histórico.** A conversa não tem limite de duração, e cada `buscar_habilidades`
deixa ~50k caracteres no histórico. Sem poda, dez turnos pagam 500k caracteres por
chamada ao modelo. Retorno de ferramenta de turno ANTERIOR vira um resumo com os
códigos (o bastante para o modelo saber o que já foi mostrado); o turno corrente fica
intacto.
"""

from __future__ import annotations

import json
import re
from typing import Any

from google.genai import types

TETO_DA_STRING = 6_000
TETO_DA_RESPOSTA = 24_000
TETOS_POR_FERRAMENTA = {"buscar_habilidades": 120_000}
_TETO_DE_ITENS_DA_LISTA = 200

#: Base64 não tem espaço; texto em português tem. Só o primeiro é removido.
_BASE64_LONGO = re.compile(r"^[A-Za-z0-9+/=\r\n]{2000,}$")


def tamanho(obj: Any) -> int:
    try:
        return len(json.dumps(obj, ensure_ascii=False, default=str))
    except (TypeError, ValueError):
        return len(str(obj))


def _podar(valor: Any) -> Any:
    if isinstance(valor, str):
        if _BASE64_LONGO.match(valor):
            return f"<conteúdo binário de {len(valor)} caracteres removido>"
        if len(valor) > TETO_DA_STRING:
            return (
                valor[:TETO_DA_STRING]
                + f"\n…[cortado: mais {len(valor) - TETO_DA_STRING} caracteres]"
            )
        return valor
    if isinstance(valor, dict):
        return {k: _podar(v) for k, v in valor.items()}
    if isinstance(valor, list):
        podada = [_podar(v) for v in valor[:_TETO_DE_ITENS_DA_LISTA]]
        if len(valor) > _TETO_DE_ITENS_DA_LISTA:
            podada.append(f"…[cortado: mais {len(valor) - _TETO_DE_ITENS_DA_LISTA} itens]")
        return podada
    return valor


def podar_resposta(nome_da_ferramenta: str, resposta: Any) -> Any:
    """A resposta, podada. Devolve o MESMO objeto quando não há o que podar."""
    teto = TETOS_POR_FERRAMENTA.get(nome_da_ferramenta, TETO_DA_RESPOSTA)
    bruto = tamanho(resposta)
    podada = _podar(resposta) if bruto > TETO_DA_STRING else resposta
    if tamanho(podada) > teto:
        texto = json.dumps(podada, ensure_ascii=False, default=str)[:teto]
        return {
            "resposta_truncada": True,
            "motivo": (
                f"A resposta de `{nome_da_ferramenta}` tinha {bruto} caracteres e não cabe no "
                "contexto. Use o trecho abaixo, diga ao professor que a lista veio cortada e "
                "sugira refinar a busca."
            ),
            "trecho": texto,
        }
    if podada == resposta:
        return resposta
    return podada


def _resumo_de_retorno_antigo(nome: str, resposta: dict[str, Any] | None) -> dict[str, Any]:
    resposta = resposta or {}
    resumo: dict[str, Any] = {
        "resumo": f"Resultado de `{nome}` de um turno anterior, omitido para poupar contexto. "
        "Chame a ferramenta de novo se precisar do texto."
    }
    habilidades = resposta.get("habilidades")
    if isinstance(habilidades, list):
        resumo["codigos"] = [h.get("codigo") for h in habilidades if isinstance(h, dict)][:200]
    trechos = resposta.get("trechos")
    if isinstance(trechos, list):
        resumo["fontes"] = [
            {"titulo": t.get("titulo"), "pagina_inicio": t.get("pagina_inicio")}
            for t in trechos
            if isinstance(t, dict)
        ]
    return resumo


def _e_mensagem_do_professor(conteudo: types.Content) -> bool:
    return conteudo.role == "user" and any(
        p.text is not None and p.function_response is None for p in conteudo.parts or []
    )


def podar_historico(conteudos: list[types.Content]) -> int:
    """Troca, na LISTA, retornos de ferramenta anteriores ao turno corrente por resumos.

    Os `Content` do pedido podem ser os mesmos objetos dos eventos da sessão; por isso
    o item da lista é SUBSTITUÍDO por um novo, nunca editado — editar no lugar
    reescreveria o histórico que a api lê com `async_get_session`.

    Devolve quantos retornos foram resumidos.
    """
    ultimo = next(
        (i for i in range(len(conteudos) - 1, -1, -1) if _e_mensagem_do_professor(conteudos[i])),
        None,
    )
    if ultimo is None:
        return 0
    resumidos = 0
    for indice in range(ultimo):
        conteudo = conteudos[indice]
        partes = list(conteudo.parts or [])
        mudou = False
        for posicao, parte in enumerate(partes):
            retorno = parte.function_response
            if retorno is None or (retorno.response or {}).get("resumo"):
                continue
            partes[posicao] = types.Part(
                function_response=types.FunctionResponse(
                    id=retorno.id,
                    name=retorno.name,
                    response=_resumo_de_retorno_antigo(retorno.name or "", retorno.response),
                )
            )
            mudou = True
            resumidos += 1
        if mudou:
            conteudos[indice] = types.Content(role=conteudo.role, parts=partes)
    return resumidos
