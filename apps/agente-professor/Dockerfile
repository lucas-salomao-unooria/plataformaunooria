# Imagem do agente de IA do professor para o Agent Engine (container customizado).
#
# Segue o contrato de runtime: escuta 0.0.0.0:$PORT (8080) e responde
# POST /api/reasoning_engine e POST /api/stream_reasoning_engine (NDJSON).
# O servidor é o MESMO do shim local (agente_professor/servidor.py).
#
#   docker build -t <região>-docker.pkg.dev/<projeto>/<repo>/agente-professor:<versão> apps/agente-professor
#
# Não defina GOOGLE_CLOUD_LOCATION, GOOGLE_CLOUD_PROJECT nem PORT: são reservadas e o
# Agent Engine as preenche. As envs do agente são as AGENTE_* (README).
FROM python:3.12-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.12.7 /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PORT=8080

WORKDIR /app

# Dependências primeiro (camada em cache enquanto o uv.lock não muda).
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY agente_professor ./agente_professor
COPY ingestao/__init__.py ./ingestao/__init__.py
RUN uv sync --locked --no-dev

RUN useradd --create-home --uid 10001 agente
USER agente

EXPOSE 8080
CMD ["/app/.venv/bin/python", "-m", "agente_professor.servidor"]
