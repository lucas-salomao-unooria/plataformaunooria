"""O entrypoint do Agent Engine: `agente_professor.app_engine:adk_app`.

Deploy por código-fonte: `entrypoint_module="agente_professor.app_engine"`,
`entrypoint_object="adk_app"`. Deploy por imagem: o `Dockerfile` roda
`agente_professor.servidor`, que envolve ESTE objeto no contrato de runtime.
"""

from __future__ import annotations

from .fabrica import criar_adk_app

adk_app = criar_adk_app()
