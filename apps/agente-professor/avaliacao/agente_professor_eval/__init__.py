"""Ponto de entrada do `adk eval`: o MESMO `App` de produção (com a guarda de escopo).

A pasta não se chama `agente_professor` de propósito: o `adk eval` põe `avaliacao/`
no `sys.path`, e uma pasta com o nome do pacote real o esconderia.
"""

from agente_professor.agente import criar_app

app = criar_app()
root_agent = app.root_agent
