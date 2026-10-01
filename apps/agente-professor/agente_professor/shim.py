"""O shim local: o MESMO servidor do contrato de runtime, em `:8090`, sessões em memória.

    uv run python -m agente_professor.shim

`AGENTE_SHIM_PORTA` troca a porta. As sessões morrem com o processo — é o modo `local`
da api, para desenvolver sem Agent Engine; o modelo e os data stores continuam os
reais (ADC do dev).
"""

from __future__ import annotations

import logging
import os

from .servidor import criar_servidor

PORTA_DO_SHIM = 8090


def principal() -> None:
    import uvicorn

    from .app_engine import adk_app

    logging.basicConfig(level=os.environ.get("AGENTE_LOG", "INFO"))
    porta = int(os.environ.get("AGENTE_SHIM_PORTA", PORTA_DO_SHIM))
    uvicorn.run(criar_servidor(adk_app), host="127.0.0.1", port=porta)


if __name__ == "__main__":
    principal()
