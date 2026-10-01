# apps/agente-professor

O **agente de IA do professor** da Unooria — Python, Google ADK 2.10, servido pelo
Vertex AI Agent Engine — e o pipeline que alimenta os seus dois data stores
(Vertex AI Search). O contrato com a api, o hub e a infra está em
[`docs/regras/agente-professor.md`](../../docs/regras/agente-professor.md).

```
agente_professor/
  agente.py          LlmAgent raiz (`agente_professor`) + App com os plugins
  instrucoes.py      instrução do agente, da guarda de escopo e do título
  ferramentas/       buscar_habilidades, buscar_acervo (REST do Discovery Engine)
  plugins.py         guarda de escopo, título, poda, marcação de eventos
  modelos.py         Gemini em `global` com reserva em `us`
  curriculo.py       normalização de componente/ano/etapa (a MESMA da ingestão)
  fabrica.py         o AdkApp (sessões em memória fora do Agent Engine)
  app_engine.py      entrypoint do Agent Engine: `adk_app`
  servidor.py        o contrato de runtime do container (imagem e shim)
  shim.py            o servidor em :8090, para a api em `AGENTE_PROFESSOR_MODO=local`
ingestao/            exportar, dividir, gerar metadados, importar, avaliar
avaliacao/           evalset do `adk eval`
tests/               pytest, sem rede
```

## Pré-requisitos

- [`uv`](https://docs.astral.sh/uv/) ≥ 0.12 — ele baixa o Python 3.12 sozinho
  (o Agent Engine aceita até 3.13; o 3.14 do sistema não serve).
- Node ≥ 24 (o do monorepo) — só para `exportar_habilidades`, que lê os `.ts` da api.
- Para falar com GCP: `gcloud auth application-default login`.

## Rodar

```sh
cd apps/agente-professor
uv sync                                  # cria .venv com as versões do uv.lock
AGENTE_PROJETO=entre-redes-dev uv run python -m agente_professor.shim   # :8090
```

A api aponta `AGENTE_PROFESSOR_MODO=local` e
`AGENTE_PROFESSOR_URL_LOCAL=http://localhost:8090`. O shim usa o modelo e os
data stores REAIS (com o seu ADC); só as sessões são em memória e morrem com o
processo. `AGENTE_SHIM_PORTA` troca a porta.

Experimentar à mão:

```sh
curl -s localhost:8090/api/reasoning_engine -H 'content-type: application/json' \
  -d '{"class_method":"async_create_session","input":{"user_id":"u-1","state":{"nome_professor":"Ana"}}}'
curl -sN localhost:8090/api/stream_reasoning_engine -H 'content-type: application/json' \
  -d '{"class_method":"async_stream_query","input":{"user_id":"u-1","session_id":"<id>",
       "message":"Habilidades de frações no 5º ano","run_config":{"streaming_mode":"sse"}}}'
```

### Envs

| Env | Padrão | Para quê |
|---|---|---|
| `AGENTE_PROJETO` | `GOOGLE_CLOUD_PROJECT` | projeto dos data stores e do Gemini |
| `AGENTE_MODELO` | `gemini-3.7-flash` | modelo da conversa |
| `AGENTE_MODELO_LOCATION` | `global` | location do modelo |
| `AGENTE_MODELO_LOCATION_RESERVA` | `us` | para onde vai quando `global` dá 404/429/5xx |
| `AGENTE_MODELO_ESCOPO` | `gemini-3.5-flash-lite` | guarda de escopo e título |
| `AGENTE_BUSCA_LOCATION` | `global` | location dos data stores |
| `AGENTE_DATASTORE_HABILIDADES` | `agente-professor-habilidades` | |
| `AGENTE_DATASTORE_ACERVO` | `agente-professor-acervo` | |
| `AGENTE_LOG` | `INFO` | nível de log do servidor |

**Nunca** defina `GOOGLE_CLOUD_LOCATION`, `GOOGLE_CLOUD_PROJECT` nem `PORT` no
Agent Engine: são reservadas.

## Testes

```sh
uv run pytest -q                 # 118 testes, sem rede
uv run ruff check && uv run pyright
pnpm turbo typecheck lint test --filter=@edu/agente-professor   # da raiz
```

Sem `uv` na máquina, o turbo **falha** com a instrução de instalação. Para pular
de propósito (imagem de CI sem Python): `AGENTE_PROFESSOR_PULAR_SEM_UV=1` — o pulo
sai num aviso em destaque e não é reaproveitado do cache numa execução com uv.

## Ingestão, passo a passo

O bucket é `gs://<projeto>-agente-professor/`; os data stores e o bucket nascem no
Terraform (repo de fundação). Todo script aceita `--seco` (mostra o que faria) e
`--local <pasta>` (um espelho do bucket, para ensaiar sem GCP).

```
bncc/originais/                    PDFs oficiais (BNCC completa, anexo de Computação)
bncc/partes/                       GERADO
habilidades/habilidades.jsonl      GERADO
livros/originais/<componente>/<serie>/<arquivo>.pdf    o dono sobe aqui
livros/partes/                     GERADO
metadados/acervo.jsonl             GERADO
import-erros/                      erros do documents:import
```

`<componente>`: `lingua-portuguesa`, `matematica`, `ciencias`, `historia`,
`geografia`, `arte`, `educacao-fisica`, `lingua-inglesa`, `ensino-religioso`,
`computacao`, `biologia`, `fisica`, `quimica`, `filosofia`, `sociologia` ou `todos`.
`<serie>`: `1`..`9`, `em1`, `em2`, `em3` ou `todas`. Título do livro: um arquivo
irmão `<arquivo>.json` com `{"titulo": "…"}` (senão, o nome do arquivo). Cortes
manuais de PDF grande: `{"cortes": [463]}` no mesmo arquivo.

```sh
P=entre-redes-dev
# 0. uma vez por data store (e quando ingestao/esquemas/ mudar)
uv run python -m ingestao.importar esquema --projeto $P
# 1. habilidades (1.304 EF + 183 EM + 130 Computação, ou aborta)
uv run python -m ingestao.exportar_habilidades --enviar --projeto $P
uv run python -m ingestao.importar habilidades --projeto $P
# 2. acervo: suba os PDFs nas pastas, depois
gcloud storage cp documentos-fonte/bncc/bncc-completa-2018.pdf documentos-fonte/bncc/bncc-computacao-2022.pdf gs://$P-agente-professor/bncc/originais/
uv run python -m ingestao.dividir_pdfs --projeto $P
uv run python -m ingestao.gerar_metadados_acervo --projeto $P
uv run python -m ingestao.importar acervo --projeto $P
# 3. o relatório que decide se a busca serve
uv run python -m ingestao.avaliar_habilidades --projeto $P
#    → ingestao/relatorios/avaliacao-habilidades-<data>.md
```

O data store de acervo precisa nascer com o parser de **layout** e chunking
ligado (Terraform): sem isso o modo `CHUNKS` não devolve `pageSpan`.

## Avaliação do agente (`adk eval`)

16 casos em `avaliacao/agente_professor.evalset.json` (escopo, código exato, lista
inteira de um ano, tema, acervo com citação, nome de estudante). Contra o dev, com
ADC válida:

```sh
AGENTE_PROJETO=entre-redes-dev GOOGLE_GENAI_USE_VERTEXAI=1 GOOGLE_CLOUD_PROJECT=entre-redes-dev \
GOOGLE_CLOUD_LOCATION=global \
  uv run adk eval avaliacao/agente_professor_eval avaliacao/agente_professor.evalset.json \
  --config_file_path avaliacao/test_config.json --print_detailed_results
```

(`GOOGLE_CLOUD_LOCATION` aqui é só para o modelo-juiz do `adk eval`, localmente.)

## Deploy

A imagem segue o contrato de runtime de container do Agent Engine (porta 8080,
`/api/reasoning_engine`, `/api/stream_reasoning_engine`) e é o mesmo servidor do shim:

```sh
docker build -t us-east1-docker.pkg.dev/<projeto>/<repo>/agente-professor:<versão> apps/agente-professor
docker push us-east1-docker.pkg.dev/<projeto>/<repo>/agente-professor:<versão>
```

O Terraform cria o engine com `container_spec.image_uri` apontando para a imagem
publicada (`agente_professor_imagem`). Alternativa sem imagem (deploy por código):
`entrypoint_module="agente_professor.app_engine"`, `entrypoint_object="adk_app"`,
com as `class_methods` de `adk_app.register_operations()`.
