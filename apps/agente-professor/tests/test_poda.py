from google.genai import types

from agente_professor.poda import (
    TETO_DA_RESPOSTA,
    TETO_DA_STRING,
    podar_historico,
    podar_resposta,
    tamanho,
)


def test_resposta_pequena_volta_o_mesmo_objeto() -> None:
    resposta = {"trechos": [{"trecho": "curto"}]}
    assert podar_resposta("buscar_acervo", resposta) is resposta


def test_string_longa_e_cortada() -> None:
    texto = ("uma frase, " * 700)[: TETO_DA_STRING + 500]
    podada = podar_resposta("buscar_acervo", {"texto": texto})
    assert podada["texto"].startswith(texto[:TETO_DA_STRING])
    assert "cortado: mais 500" in podada["texto"]


def test_base64_longo_e_removido() -> None:
    podada = podar_resposta("buscar_acervo", {"imagem": "QUJD" * 2000})
    assert podada["imagem"].startswith("<conteúdo binário")


def test_resposta_grande_vira_trecho_truncado() -> None:
    resposta = {"itens": [{"t": "um trecho, " * 450} for _ in range(10)]}
    podada = podar_resposta("buscar_acervo", resposta)
    assert podada["resposta_truncada"] is True
    assert len(podada["trecho"]) == TETO_DA_RESPOSTA


def test_buscar_habilidades_tem_teto_proprio_para_a_lista_inteira() -> None:
    # ~58k caracteres: a Língua Portuguesa do 8º ano inteira tem de passar.
    resposta = {
        "habilidades": [{"codigo": f"EF08LP{i:02d}", "descricao": "d" * 500} for i in range(110)]
    }
    assert tamanho(resposta) > TETO_DA_RESPOSTA
    assert podar_resposta("buscar_habilidades", resposta) is resposta


def _retorno(nome: str, resposta: dict) -> types.Content:
    return types.Content(
        role="user",
        parts=[
            types.Part(
                function_response=types.FunctionResponse(id="1", name=nome, response=resposta)
            )
        ],
    )


def test_historico_resume_so_os_turnos_anteriores_e_nao_edita_no_lugar() -> None:
    antigo = _retorno(
        "buscar_habilidades", {"habilidades": [{"codigo": "EF06MA01", "descricao": "…"}]}
    )
    atual = _retorno("buscar_acervo", {"trechos": [{"titulo": "BNCC", "pagina_inicio": 9}]})
    conteudos = [
        types.Content(role="user", parts=[types.Part(text="pergunta 1")]),
        types.Content(role="model", parts=[types.Part(function_call=types.FunctionCall(name="x"))]),
        antigo,
        types.Content(role="model", parts=[types.Part(text="resposta 1")]),
        types.Content(role="user", parts=[types.Part(text="pergunta 2")]),
        atual,
    ]
    assert podar_historico(conteudos) == 1
    resumido = conteudos[2].parts[0].function_response.response or {}  # type: ignore[index,union-attr]
    assert resumido["codigos"] == ["EF06MA01"] and "resumo" in resumido
    assert conteudos[5] is atual
    # O objeto original (o do evento da sessão) ficou intacto.
    assert "habilidades" in antigo.parts[0].function_response.response  # type: ignore[index,union-attr]
    assert podar_historico(conteudos) == 0  # idempotente
